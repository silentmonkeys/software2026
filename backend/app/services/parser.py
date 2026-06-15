from pypdf import PdfReader
from docx import Document as Docx


def read_pdf(path: str) -> str:
    reader = PdfReader(path)
    return "\n".join((p.extract_text() or "") for p in reader.pages)


def read_docx(path: str) -> str:
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
