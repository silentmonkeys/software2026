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


def vl_describe(image_path_or_url: str, prompt: str = "请简要描述图片中的设备状态与可能故障") -> str:
    """多模态：让 Qwen-VL 描述图片故障状态"""
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
    return rsp.output.choices[0].message.content[0]["text"]


def embed(texts: List[str]) -> List[List[float]]:
    rsp = TextEmbedding.call(model=settings.EMB_MODEL, input=texts)
    return [item["embedding"] for item in rsp.output["embeddings"]]
