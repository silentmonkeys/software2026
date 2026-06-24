"""RAG 服务：文档切片→嵌入→Chroma 入库；问答检索。"""
from typing import List, Tuple
import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings
from app.services.llm import embed, chat_text


_client = chromadb.PersistentClient(path=settings.CHROMA_DIR, settings=ChromaSettings(allow_reset=False))
_col = _client.get_or_create_collection(settings.COLLECTION, metadata={"hnsw:space": "cosine"})


def split_text(text: str, size: int = 500, overlap: int = 50) -> List[str]:
    """切片策略：保证含图片markdown的段落不会被切到两个chunk里。

    每张图的"![](url)\\n【图片内容】..."形成一个完整block，
    切片时优先按段落边界切（两个\\n\\n之间）。
    """
    import re
    # 先按段落切（双换行）
    paragraphs = re.split(r"\n{2,}", text)
    chunks: List[str] = []
    buf = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        # 单段超过size，强制按字符切
        if len(para) > size:
            if buf:
                chunks.append(buf)
                buf = ""
            i = 0
            while i < len(para):
                chunks.append(para[i:i + size])
                i += size - overlap
            continue
        # 累积到当前buf里，超过size就flush
        if len(buf) + len(para) + 2 > size and buf:
            chunks.append(buf)
            buf = para
        else:
            buf = (buf + "\n\n" + para) if buf else para
    if buf:
        chunks.append(buf)
    return chunks


def ingest_document(doc_id: int, title: str, full_text: str):
    chunks = split_text(full_text)
    if not chunks:
        return 0
    vecs = embed(chunks)
    ids = [f"d{doc_id}_c{i}" for i in range(len(chunks))]
    metas = [{"doc_id": doc_id, "title": title, "idx": i} for i in range(len(chunks))]
    _col.add(ids=ids, documents=chunks, embeddings=vecs, metadatas=metas)
    return len(chunks)


def remove_document(doc_id: int) -> None:
    """从向量库移除某文档的全部切片（驳回 / 下架 / 删除时调用）。"""
    try:
        _col.delete(where={"doc_id": doc_id})
    except Exception:
        pass


def search(query: str, k: int = 5) -> List[dict]:
    q_vec = embed([query])[0]
    res = _col.query(query_embeddings=[q_vec], n_results=k)
    out = []
    for i in range(len(res["ids"][0])):
        out.append({
            "id": res["ids"][0][i],
            "content": res["documents"][0][i],
            "metadata": res["metadatas"][0][i],
            "distance": res["distances"][0][i] if res.get("distances") else None,
        })
    return out


SYSTEM_PROMPT = (
    "你是企业设备检修助手龙芯智修。请基于给定的【检修知识】片段回答用户问题，"
    "答案需要：1) 给出明确诊断与处置步骤；2) 标注引用来源（出自手册/案例编号）；"
    "3) 若知识不足，明确说明并给出排查建议。回答使用中文。\n\n"
    "【重要：图片引用规则】\n"
    "知识片段中可能包含两类与图片相关的内容：\n"
    "1) markdown 图片标记 `![文档图片-第X页](/uploads/img_xxx.png)`——这是从原文档中真实提取的图片，前端会自动渲染显示；\n"
    "2) `【图片内容】文档图片-第X页：...` 段落——这是Qwen-VL对该图片的文字描述，告诉你图里画的是什么。\n\n"
    "你必须：\n"
    "- 优先使用【图片内容】中的描述来回答'图里画的是什么/这张图说明什么'等问题，"
    "**不要回复'我是文本AI不能看图'**，因为图片已经被识别成文字了；\n"
    "- 当用户希望看到图本身（如：显示一下/给我看/show me），"
    "**必须把对应的 `![](...)` markdown 原样输出**（独占一行），让前端渲染图片；\n"
    "- 解释图片内容时，可以同时把图片markdown插入回答中，做到图文并茂；\n"
    "- 不要删除、改写、转义图片markdown的URL；\n"
    "- 引用图片时简短说明出处（如：图示出自手册第X页）。"
)


def rag_answer(question: str, image_desc: str = "") -> Tuple[str, List[dict]]:
    enriched = question if not image_desc else f"{question}\n（图片观察：{image_desc}）"
    hits = search(enriched, k=5)
    context = "\n\n".join([f"[{i+1}] {h['metadata'].get('title','')}: {h['content']}" for i, h in enumerate(hits)])
    user = f"【检修知识】\n{context}\n\n【用户问题】\n{enriched}"
    answer = chat_text(SYSTEM_PROMPT, user)
    return answer, hits
