"""RAG 服务：文档切片→嵌入→Chroma 入库；问答检索。"""
from typing import List, Tuple
import os
import re
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings
from app.services.llm import embed, chat_text


_client = chromadb.PersistentClient(path=settings.CHROMA_DIR, settings=ChromaSettings(allow_reset=False))
_col = _client.get_or_create_collection(settings.COLLECTION, metadata={"hnsw:space": "cosine"})


def _split_sentences(paragraph: str) -> List[str]:
    """按中文/英文句末标点切句，保留句末标点，避免从句中间硬切。"""
    paragraph = re.sub(r"\s+", " ", paragraph.strip())
    if not paragraph:
        return []
    parts = re.split(r"(?<=[。！？；;.!?])\s*", paragraph)
    return [p.strip() for p in parts if p.strip()]


def split_text(text: str, size: int = 900, overlap: int = 180) -> List[str]:
    """语义边界优先切片。

    原实现是 500/50 的纯字符滑窗，容易切断标题、步骤、参数表。
    这里优先按段落/句子聚合，单段过长时再按句子拆分，并用更高 overlap
    保留相邻上下文，改善检修手册步骤连续性。
    """
    text = (text or "").strip()
    if not text:
        return []

    blocks = [b.strip() for b in re.split(r"\n{2,}", text) if b.strip()]
    units: List[str] = []
    for block in blocks:
        if len(block) <= size:
            units.append(block)
        else:
            units.extend(_split_sentences(block))

    chunks: List[str] = []
    current = ""
    for unit in units:
        sep = "\n\n" if current else ""
        if current and len(current) + len(sep) + len(unit) > size:
            chunks.append(current.strip())
            carry = current[-overlap:].strip() if overlap > 0 else ""
            current = f"{carry}\n\n{unit}" if carry else unit
        elif len(unit) > size:
            # 极端长句/表格行兜底切分，但仍保留 overlap。
            step = max(size - overlap, 1)
            for i in range(0, len(unit), step):
                part = unit[i:i + size].strip()
                if part:
                    chunks.append(part)
            current = ""
        else:
            current = f"{current}{sep}{unit}" if current else unit
    if current.strip():
        chunks.append(current.strip())
    return chunks


def _extract_image_paths(text: str) -> list[str]:
    paths: list[str] = []
    for line in (text or "").splitlines():
        if line.startswith("[图片文件]"):
            p = line.replace("[图片文件]", "", 1).strip()
            if p:
                paths.append(p)
    return paths


def ingest_document(doc_id: int, title: str, full_text: str):
    chunks = split_text(full_text)
    if not chunks:
        return 0
    vecs = embed(chunks)
    ids = [f"d{doc_id}_c{i}" for i in range(len(chunks))]
    total = len(chunks)
    metas = []
    for i, chunk in enumerate(chunks):
        image_paths = _extract_image_paths(chunk)
        meta = {"doc_id": doc_id, "title": title, "idx": i, "total": total}
        if image_paths:
            meta["image_paths"] = "|".join(image_paths)
        metas.append(meta)
    _col.add(ids=ids, documents=chunks, embeddings=vecs, metadatas=metas)
    return len(chunks)


def remove_document(doc_id: int) -> None:
    """从向量库移除某文档的全部切片（驳回 / 下架 / 删除时调用）。"""
    try:
        _col.delete(where={"doc_id": doc_id})
    except Exception:
        pass


# 多模态问题修复（第4项）：相似度阈值
# cosine distance > MAX_SEARCH_DISTANCE 的结果视为不相关，不返回
MAX_SEARCH_DISTANCE = 0.65


def _fetch_neighbor(doc_id: int, idx: int) -> tuple[str, dict]:
    """读取命中 chunk 的相邻切片，给模型补足上下文。"""
    if idx < 0:
        return "", {}
    cid = f"d{doc_id}_c{idx}"
    try:
        res = _col.get(ids=[cid])
        docs = res.get("documents") or []
        metas = res.get("metadatas") or []
        return (docs[0] if docs else ""), (metas[0] if metas else {})
    except Exception:
        return "", {}


def search(query: str, k: int = 5, include_neighbors: bool = True) -> List[dict]:
    """向量检索，返回 Top-k 结果。

    - 过滤掉 distance > MAX_SEARCH_DISTANCE 的低质量匹配；
    - 默认把命中 chunk 的前后相邻 chunk 拼入 context，缓解切片导致的上下文断裂。
    """
    query = (query or "").strip()
    if not query:
        return []
    q_vec = embed([query])[0]
    res = _col.query(query_embeddings=[q_vec], n_results=k)
    out = []
    for i in range(len(res["ids"][0])):
        dist = res["distances"][0][i] if res.get("distances") else None
        # 相似度阈值过滤：cosine distance 过大说明语义不相关
        if dist is not None and dist > MAX_SEARCH_DISTANCE:
            continue
        content = res["documents"][0][i]
        meta = res["metadatas"][0][i] or {}
        image_paths = _extract_image_paths(content)
        if meta.get("image_paths"):
            image_paths.extend(str(meta.get("image_paths")).split("|"))
        if include_neighbors:
            doc_id = meta.get("doc_id")
            idx = meta.get("idx")
            if isinstance(doc_id, int) and isinstance(idx, int):
                before, before_meta = _fetch_neighbor(doc_id, idx - 1)
                after, after_meta = _fetch_neighbor(doc_id, idx + 1)
                parts = [p for p in [before, content, after] if p]
                content = "\n\n".join(parts)
                image_paths.extend(_extract_image_paths(before))
                image_paths.extend(_extract_image_paths(after))
                for m in (before_meta, after_meta):
                    if m.get("image_paths"):
                        image_paths.extend(str(m.get("image_paths")).split("|"))
        image_paths = list(dict.fromkeys([p for p in image_paths if p]))
        out.append({
            "id": res["ids"][0][i],
            "content": content,
            "metadata": meta,
            "distance": dist,
            "image_paths": image_paths,
        })
    return out


SYSTEM_PROMPT = (
    "你是企业设备检修助手龙芯智修。必须严格、只依据用户提供的【检修知识】回答。"
    "硬性规则："
    "1) 不得使用常识或训练记忆补全手册中没有的步骤、参数、故障原因；"
    "2) 如果【检修知识】不足以回答，必须明确说：知识库未提供足够依据，并列出还需要查看的手册/参数；"
    "3) 回答中的关键判断、参数、步骤必须附带对应来源编号，如 [1]、[2]；"
    "4) 每个主要结论后尽量引用原文关键句，格式为：原文依据：\"...\"；"
    "5) 不得编造工具、零件型号、数值、验收标准。"
    "回答使用中文。"
)


def rag_answer(question: str, image_desc: str = "") -> Tuple[str, List[dict]]:
    """RAG 问答：基于问题（+ 可选图片描述）检索知识库并生成回答。

    多模态问题修复（第2项）：
    - 当 question 为空但 image_desc 非空时，以 image_desc 作为检索主查询
      （避免被空字符串或占位符稀释 embedding 语义）
    - 有文字问题时，拼接格式保持原有逻辑
    """
    if not question and image_desc:
        # 纯图片查询：VL 输出已包含文档识别结果，直接作为查询主体
        enriched = image_desc
    elif image_desc:
        enriched = f"{question}\n（图片观察：{image_desc}）"
    else:
        enriched = question

    hits = search(enriched, k=5)
    # 关键词兜底：嵌入向量可能因术语偏差("曲轴箱分解图" vs "曲轴连杆部装组件")不匹配
    # 提取短关键词逐一检索，合并命中结果
    if not hits:
        kws = re.findall(r'[\u4e00-\u9fff]{2,4}', enriched)
        seen_ids: set[str] = set()
        for kw in kws[:6]:
            for h in search(kw, k=3):
                hid = h.get("id", "")
                if hid not in seen_ids:
                    seen_ids.add(hid)
                    hits.append(h)
        if len(hits) > 5:
            hits.sort(key=lambda x: x.get("distance", 1.0))
            hits = hits[:5]
    if not hits:
        return (
            "知识库未检索到足够依据，不能可靠回答该问题。请补充或上传对应设备手册、故障代码表、"
            "维修步骤、参数表或更清晰的现场/文档图片后再试。",
            [],
        )
    context = "\n\n".join([f"[{i+1}] {h['metadata'].get('title','')}: {h['content']}" for i, h in enumerate(hits)])
    user = f"【检修知识】\n{context}\n\n【用户问题】\n{enriched}"
    answer = chat_text(SYSTEM_PROMPT, user, temperature=0.1, top_p=0.7)
    return answer, hits
