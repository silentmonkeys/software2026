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
    "答案需要：1) 给出明确诊断与处置步骤；"
    "2) 若知识不足，明确说明并给出排查建议。"
    "不要在正文中插入任何 [数字] 形式的引用编号（如 [1][2] 等），"
    "引用由前端折叠面板统一展示。回答使用中文。"
)


def rag_answer(question: str, image_desc: str = "") -> Tuple[str, List[dict]]:
    enriched = question if not image_desc else f"{question}\n（图片观察：{image_desc}）"
    hits = search(enriched, k=5)
    context = "\n\n".join([f"[{i+1}] {h['metadata'].get('title','')}: {h['content']}" for i, h in enumerate(hits)])
    user = f"【检修知识】\n{context}\n\n【用户问题】\n{enriched}"
    answer = chat_text(SYSTEM_PROMPT, user)
    return answer, hits
