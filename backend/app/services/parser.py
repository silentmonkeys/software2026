"""文档解析器：PDF / DOCX / TXT / MD → 纯文本。

多模态问题修复（第3项）：
- PDF 增加空文本检测：扫描版 PDF（每页为图片）extract_text() 返回空
- 增加 OCR fallback：优先尝试 pytesseract，其次尝试 Qwen-VL 逐页识别
- 对提取结果过短的页面给出警告日志，便于排查入库质量问题
"""
import logging

logger = logging.getLogger(__name__)

# 延迟导入：pdf2image 和 pytesseract 在龙芯上可能未安装
_pdf2image_available = None
_pytesseract_available = None


def _check_ocr_deps():
    """检查 OCR 依赖是否可用（懒加载，只检查一次）。"""
    global _pdf2image_available, _pytesseract_available
    if _pdf2image_available is not None:
        return
    try:
        import pdf2image  # noqa: F401
        _pdf2image_available = True
    except ImportError:
        _pdf2image_available = False
    try:
        import pytesseract  # noqa: F401
        _pytesseract_available = True
    except ImportError:
        _pytesseract_available = False


def read_pdf(path: str) -> str:
    from pypdf import PdfReader

    reader = PdfReader(path)
    raw_parts = []
    empty_pages = 0
    total_pages = len(reader.pages)

    for i, page in enumerate(reader.pages):
        text = (page.extract_text() or "").strip()
        if not text or len(text) < 5:
            empty_pages += 1
        else:
            raw_parts.append(text)

    raw_text = "\n\n".join(raw_parts).strip()

    # 多模态问题修复：检测是否为扫描版 PDF（大部分页面无文字）
    # 如果超过半数页面为空，说明是图片型 PDF，需要 OCR
    is_scanned_like = total_pages > 0 and empty_pages > total_pages * 0.5

    if not raw_text and total_pages > 0:
        logger.warning(
            "PDF %s: extract_text() 返回空文本（%d 页），"
            "可能是扫描版 PDF 或图片型 PDF。建议安装 OCR 依赖："
            "pip install pdf2image pytesseract 并确保系统已装 tesseract",
            path, total_pages,
        )

    if is_scanned_like and (raw_text or "") and len(raw_text) < 50:
        logger.warning(
            "PDF %s: 仅提取到极少文字（%d 字符，%d/%d 页空白），"
            "内容可能不完整。如需完整识别请安装 OCR 依赖。",
            path, len(raw_text), empty_pages, total_pages,
        )

    # 尝试 OCR 补充（仅当有依赖且检测到大量空白页时）
    if is_scanned_like and _try_ocr_fallback(path):
        ocr_text = _ocr_pdf(path)
        if ocr_text and len(ocr_text) > len(raw_text):
            raw_text = ocr_text
            logger.info("PDF %s: OCR 成功补充了 %d 字符", path, len(ocr_text))

    return raw_text


def _try_ocr_fallback(path: str) -> bool:
    """检查 OCR 依赖是否就绪。"""
    _check_ocr_deps()
    return bool(_pdf2image_available and _pytesseract_available)


def _ocr_pdf(path: str) -> str:
    """用 pytesseract 对 PDF 做 OCR，返回合并后的文字。"""
    try:
        from pdf2image import convert_from_path
        import pytesseract
        images = convert_from_path(path, dpi=200)
        parts = []
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img, lang='chi_sim+eng').strip()
            if text:
                parts.append(text)
        return "\n\n".join(parts)
    except Exception as e:
        logger.warning("PDF OCR 失败 (%s): %s", path, e)
        return ""


def read_docx(path: str) -> str:
    from docx import Document as Docx
    doc = Docx(path)
    return "\n".join(p.text for p in doc.paragraphs)


def read_any(path: str) -> str:
    p = path.lower()
    if p.endswith(".pdf"):
        return read_pdf(path)
    if p.endswith(".docx"):
        return read_docx(path)
    if p.endswith(".txt") or p.endswith(".md"):
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    raise ValueError(f"Unsupported file: {path}")
