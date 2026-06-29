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
    chunks, i = [], 0
    while i < len(text):
        chunks.append(text[i:i + size])
        i += size - overlap
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


# 多模态问题修复（第4项）：相似度阈值
# cosine distance > MAX_SEARCH_DISTANCE 的结果视为不相关，不返回
MAX_SEARCH_DISTANCE = 0.5


def search(query: str, k: int = 5) -> List[dict]:
    """向量检索，返回 Top-k 结果。

    多模态问题修复：
    - 过滤掉 distance > MAX_SEARCH_DISTANCE 的低质量匹配
    - 返回实际匹配数（可能少于 k），前端据此判断是否显示 EmptyState
    """
    q_vec = embed([query])[0]
    res = _col.query(query_embeddings=[q_vec], n_results=k)
    out = []
    for i in range(len(res["ids"][0])):
        dist = res["distances"][0][i] if res.get("distances") else None
        # 相似度阈值过滤：cosine distance 过大说明语义不相关
        if dist is not None and dist > MAX_SEARCH_DISTANCE:
            continue
        out.append({
            "id": res["ids"][0][i],
            "content": res["documents"][0][i],
            "metadata": res["metadatas"][0][i],
            "distance": dist,
        })
    return out


SYSTEM_PROMPT = (
    "你是企业设备检修助手龙芯智修。请基于给定的【检修知识】片段回答用户问题，"
    "答案需要：1) 给出明确诊断与处置步骤；"
    "2) 若知识不足，明确说明并给出排查建议。"
    "不要在正文中插入任何 [数字] 形式的引用编号（如 [1][2] 等），"
    "引用由前端折叠面板统一展示。回答使用中文。"
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
    context = "\n\n".join([f"[{i+1}] {h['metadata'].get('title','')}: {h['content']}" for i, h in enumerate(hits)])
    user = f"【检修知识】\n{context}\n\n【用户问题】\n{enriched}"
    answer = chat_text(SYSTEM_PROMPT, user)
    return answer, hits
