"""
文档解析器：提取文本 + 图片 + 图片内容理解。

PDF 用 PyMuPDF(fitz) 同时拿文字和内嵌图片；DOCX 用 zipfile 拿 word/media/ 图片。
每张图片提取后：
1. 保存到 UPLOAD_DIR
2. **并发**调用 Qwen-VL 生成图片内容描述（设备/结构/示意图/参数表等）
3. 在文本流中插入 ![](url) markdown + [图片内容] 描述段落
这样 RAG 检索能同时命中图片URL（前端渲染显示）和图片语义内容（LLM能讲解）。
"""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from app.core.config import settings


# 通用图片描述 prompt：让VL把图片里的关键信息文字化，方便RAG检索
VL_DESCRIBE_PROMPT = (
    "这是技术文档（设备检修手册/操作指南）中的一张配图。"
    "请用2-4句中文准确描述图中关键信息，重点包括："
    "1) 图的类型（如零件爆炸图/接线图/示意图/参数表/故障照片等）；"
    "2) 图中展示的具体内容（设备名称、零件、结构、流程、数值、标注等）；"
    "3) 与检修/操作相关的关键技术信息。"
    "不要写'这是一张图片'之类的开场白，直接进入描述。"
)

# 并发调用VL的线程数（DashScope同时可承受6-8并发；过高可能触发限流）
_VL_CONCURRENCY = 6


def _save_image(img_bytes: bytes, ext: str, doc_id_hint: str = "") -> tuple[str, str]:
    """把图片字节写到 UPLOAD_DIR，返回 (本地绝对路径, 前端访问URL)。"""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    fname = f"img_{doc_id_hint or uuid.uuid4().hex}.{ext}"
    path = os.path.join(settings.UPLOAD_DIR, fname)
    with open(path, "wb") as f:
        f.write(img_bytes)
    abs_path = os.path.abspath(path)
    url = f"/uploads/{fname}"
    return abs_path, url


def _describe_image(abs_path: str) -> str:
    """调用 Qwen-VL 描述图片内容；失败时返回空串（不阻塞上传）。"""
    try:
        # 延迟导入，避免循环依赖
        from app.services.llm import vl_describe
        # DashScope 接受 file:// URL 读取本地图片
        return vl_describe(f"file://{abs_path}", prompt=VL_DESCRIBE_PROMPT)
    except Exception as e:
        # VL 调用失败不致命：留个占位说明，至少不影响文档其余部分入库
        return f"（图像识别失败：{e}）"


def _format_image_block(url: str, label: str, description: str) -> str:
    """统一格式化图片markdown + 描述，确保两者会被切片到同一chunk附近。"""
    desc = (description or "").strip()
    if not desc or desc.startswith("（图像识别失败"):
        return f"\n![{label}]({url})\n"
    return (
        f"\n![{label}]({url})\n"
        f"【图片内容】{label}：{desc}\n"
    )


# ── PDF ──────────────────────────────────────────────

def read_pdf(path: str, doc_id: int = 0) -> str:
    """提取 PDF 全文 + 内嵌图片 + 每张图的VL描述（VL并发调用）。"""
    try:
        import fitz
    except ImportError:
        from pypdf import PdfReader
        reader = PdfReader(path)
        return "\n".join((p.extract_text() or "") for p in reader.pages)

    doc = fitz.open(path)
    hint = str(doc_id) if doc_id else uuid.uuid4().hex[:8]

    # 第一遍：扫所有页文字 + 收集所有图片任务（不立即调VL）
    # 结构: [("text", page_idx, content) | ("img", page_idx, abs_path, url, label)]
    timeline: list[tuple] = []
    seen_xrefs: set[int] = set()

    for page_idx, page in enumerate(doc):
        text = page.get_text("text") or ""
        if text.strip():
            timeline.append(("text", page_idx, text.strip()))

        for img_info in page.get_images(full=True):
            xref = img_info[0]
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)
            try:
                base = doc.extract_image(xref)
                img_bytes = base["image"]
                ext = base.get("ext", "png")
                abs_path, url = _save_image(img_bytes, ext, f"{hint}_p{page_idx+1}_x{xref}")
                label = f"文档图片-第{page_idx+1}页"
                timeline.append(("img", page_idx, abs_path, url, label))
            except Exception:
                continue

    doc.close()

    # 第二遍：并发调用VL生成描述
    img_jobs = [(i, item[2]) for i, item in enumerate(timeline) if item[0] == "img"]
    if img_jobs:
        with ThreadPoolExecutor(max_workers=_VL_CONCURRENCY) as ex:
            futures = {ex.submit(_describe_image, abs_path): idx for idx, abs_path in img_jobs}
            descriptions: dict[int, str] = {}
            for fut in futures:
                idx = futures[fut]
                try:
                    descriptions[idx] = fut.result(timeout=60)
                except Exception as e:
                    descriptions[idx] = f"（图像识别失败：{e}）"

    # 第三遍：按原顺序拼回文本流
    parts: list[str] = []
    for i, item in enumerate(timeline):
        if item[0] == "text":
            parts.append(item[2])
        else:  # img
            _, _, _abs, url, label = item
            desc = descriptions.get(i, "")
            parts.append(_format_image_block(url, label, desc))

    return "\n\n".join(parts) if parts else ""


# ── DOCX ─────────────────────────────────────────────

def read_docx(path: str, doc_id: int = 0) -> str:
    """提取 DOCX 全文 + 内嵌图片 + 每张图的VL描述（VL并发调用）。"""
    from docx import Document as Docx
    import zipfile

    doc = Docx(path)
    text_parts: list[str] = [p.text for p in doc.paragraphs if p.text.strip()]
    hint = str(doc_id) if doc_id else uuid.uuid4().hex[:8]

    # 收集所有图片
    img_meta: list[tuple[str, str, str]] = []  # (abs_path, url, label)
    try:
        with zipfile.ZipFile(path) as z:
            img_count = 0
            for name in z.namelist():
                if not name.startswith("word/media/"):
                    continue
                img_data = z.read(name)
                ext = name.rsplit(".", 1)[-1].lower() if "." in name else "png"
                if ext not in ("png", "jpg", "jpeg", "gif", "bmp", "webp"):
                    continue
                img_count += 1
                abs_path, url = _save_image(img_data, ext, f"{hint}_{img_count}")
                img_meta.append((abs_path, url, f"文档图片-{img_count}"))
    except Exception:
        pass

    # 并发调用VL
    img_blocks: list[str] = []
    if img_meta:
        with ThreadPoolExecutor(max_workers=_VL_CONCURRENCY) as ex:
            futs = [ex.submit(_describe_image, m[0]) for m in img_meta]
            for (abs_path, url, label), fut in zip(img_meta, futs):
                try:
                    desc = fut.result(timeout=60)
                except Exception as e:
                    desc = f"（图像识别失败：{e}）"
                img_blocks.append(_format_image_block(url, label, desc))

    return "\n\n".join(text_parts + img_blocks) if (text_parts or img_blocks) else ""


# ── 统一入口 ──────────────────────────────────────────

def read_any(path: str, doc_id: int = 0) -> str:
    p = path.lower()
    if p.endswith(".pdf"):
        return read_pdf(path, doc_id)
    if p.endswith(".docx"):
        return read_docx(path, doc_id)
    if p.endswith(".txt") or p.endswith(".md"):
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    raise ValueError(f"Unsupported file: {path}")
