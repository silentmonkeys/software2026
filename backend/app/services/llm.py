"""统一封装 DashScope 调用：文本、图文、嵌入。
A（算法）在 ai/ 深耕，B（后端）通过这层薄封装调用。
"""
from typing import List
import dashscope
from dashscope import Generation, MultiModalConversation, TextEmbedding
from app.core.config import settings

dashscope.api_key = settings.DASHSCOPE_API_KEY


def chat_text(system: str, user: str) -> str:
    rsp = Generation.call(
        model=settings.LLM_TEXT_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        result_format="message",
    )
    return rsp.output.choices[0].message.content


def vl_describe(
    image_path_or_url: str,
    prompt: str | None = None,
    mode: str = "fault",
) -> str:
    """多模态：让 Qwen-VL 分析图片。

    Args:
        image_path_or_url: 本地文件路径（file:// 前缀）或 URL
        prompt: 自定义 prompt，优先级高于 mode
        mode: 预设模式（仅 prompt 为 None 时生效）
          - "fault": 现场设备照片 → 描述故障状态（默认，向后兼容）
          - "document": 维修手册/文档截图 → 结构化提取文字+关键词

    Returns:
        模型输出的文本内容
    """
    if prompt is None:
        if mode == "document":
            prompt = (
                "这是一张维修手册或技术文档的截图。请完成以下任务：\n"
                "1. **文字识别**：准确抄写图中所有可见文字（标题、正文、标注、图例），"
                "保持原文结构和顺序；\n"
                "2. **关键信息提取**：列出图中涉及的设备名称、型号、零件名称、"
                "故障代码、参数值、步骤编号等关键术语；\n"
                "3. **内容概要**：用一句话概括这页/这张图讲的是什么内容。\n"
                "输出格式：先列出识别的文字（用引号包裹），再列出关键术语列表，最后是概要。"
            )
        else:
            prompt = "请简要描述图片中的设备状态与可能故障"

    rsp = MultiModalConversation.call(
        model=settings.LLM_VL_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"image": image_path_or_url},
                {"text": prompt},
            ],
        }],
    )
    if rsp.output is None:
        raise RuntimeError(
            f"VL call failed: code={rsp.code}, message={rsp.message}, "
            f"status_code={getattr(rsp, 'status_code', 'N/A')}"
        )
    return rsp.output.choices[0].message.content[0]["text"]


def embed(texts: List[str]) -> List[List[float]]:
    """Embed texts in batches of at most 10 (DashScope limit)."""
    results: List[List[float]] = []
    batch_size = 10
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        rsp = TextEmbedding.call(model=settings.EMB_MODEL, input=batch)
        if rsp.output is None:
            raise RuntimeError(
                f"Embedding failed: code={rsp.code}, message={rsp.message}, "
                f"status_code={getattr(rsp, 'status_code', 'N/A')}"
            )
        results.extend(item["embedding"] for item in rsp.output["embeddings"])
    return results
