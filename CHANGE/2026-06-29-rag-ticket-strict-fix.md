# 2026-06-29 RAG / 文档解析 / 工单生成严格修复记录

来源：`2026.6.29问题分析.txt` 中列出的 4 个问题。本文记录本次按问题分析逐项修改的范围、原因与验证结果。

## 问题 1：回答没有准确引用文本，且存在幻觉

### 根因
- `rag.py` 的系统 Prompt 禁止正文插入 `[数字]` 引用编号；
- 未硬性约束“只能使用给定知识”；
- 检索为空时仍继续调用 LLM；
- `llm.py` 未设置 `temperature/top_p`。

### 修改
- `backend/app/services/llm.py`
  - `chat_text()` 新增 `temperature=0.2`、`top_p=0.8` 默认参数；
  - RAG / SOP 调用显式使用 `temperature=0.1, top_p=0.7`。
- `backend/app/services/rag.py`
  - 重写 `SYSTEM_PROMPT`：强制只依据【检修知识】回答；
  - 允许并要求答案中使用 `[1]`、`[2]` 来源编号；
  - 要求关键判断附带“原文依据”；
  - `hits` 为空时不再调用 LLM，直接返回“知识库未提供足够依据”。

## 问题 2：上传文档中的照片不存在

### 根因
- DOCX 只提取 paragraph 文本，图片/表格丢弃；
- PDF 只提取文字层，内嵌图片未进入可检索文本；
- 图片内容没有入向量库。

### 修改
- `backend/app/services/parser.py`
  - DOCX：提取段落、表格；
  - DOCX：检测内嵌图片，最多自动识别前 12 张；
  - 图片识别优先用 `pytesseract`，失败后尝试 `Qwen-VL document` 模式；
  - PDF：对每页内嵌图片/图表写入可检索标记，避免用户问“文档里的图片”时系统误判不存在；
  - 扫描版 PDF 仍保留 OCR fallback。

> 说明：文本型 PDF 内嵌图片的完整视觉理解依赖底层库能否导出图片；当前先保证“图片存在性”不再丢失。DOCX 图片已支持 OCR/VL 描述入库。

## 问题 3：对文档上下文理解存在问题

### 根因
- 原 `split_text()` 是 500/50 字符滑窗，容易切断语义；
- 检索 top-k 固定 5，缺少相邻 chunk 上下文。

### 修改
- `backend/app/services/rag.py`
  - `split_text()` 改为段落/句子边界优先切片；
  - 切片大小从 500 提升到 900，重叠从 50 提升到 180；
  - 向量库 metadata 增加 `total`；
  - `search()` 默认拉取命中 chunk 的前后相邻 chunk 拼入上下文。

## 问题 4：工单生成没有按上传手册来

### 根因
- `ticket.py` 创建工单只传 `device + fault`，没有检索手册；
- 关联手册接口仅用于事后展示，不参与生成。

### 修改
- `backend/app/api/ticket.py`
  - 新增 `_build_manual_context()`，创建工单前先检索手册；
  - `SOP_SYSTEM` 强约束只能依据【相关手册】生成；
  - 手册为空时不再让模型自由生成，而是创建“手册依据不足”的安全提示工单；
  - 生成步骤要求关键子步骤带来源编号；
  - 创建事件记录本次引用到的 `manual_doc_ids`；
  - 创建接口返回 `manuals`，便于前端展示生成依据。

## 追加修复：PDF/DOCX 图片可检索、可返回、可展示

用户实测《摩托车发动机维修手册.pdf》后发现：手册中有图片且已上传知识库，但提问“输出安装气缸与活塞照片/图片是什么”时仍回答不知道。根因是上一版只记录图片存在性，没有把图片文件抽出保存、没有把图片路径挂到检索结果、前端也没有展示图片证据。

### 修改
- `backend/app/core/config.py`
  - 新增 `EXTRACTED_IMAGE_DIR=./uploads/extracted_images`。
- `backend/app/services/parser.py`
  - PDF：从 `page.images` 抽取内嵌图片，保存到 `uploads/extracted_images/...`；
  - PDF/DOCX：图片 OCR/VL 描述与 `[图片文件] 路径` 一起写入入库文本；
  - DOCX：图片不再只放临时目录，而是保存到可访问的抽取图片目录；
  - 新增 `parse_any()` 返回 `ParsedDocument(text, images)`。
- `backend/app/services/rag.py`
  - 入库时从 chunk 中提取 `[图片文件]`，写入 metadata `image_paths`；
  - 检索时把命中 chunk 及相邻 chunk 的图片路径返回到 `image_paths`。
- `backend/app/api/chat.py`
  - sources 每条引用新增 `images` 字段，包含图片访问 URL。
- `backend/app/api/kb.py`
  - 新增 `/api/kb/image/{image_name}`，用于返回抽取图片文件；
  - 上传附件时改用 `parse_any()`。
- 前端：
  - `src/api/search.ts`、`src/stores/chatHistory.ts` 支持 source images；
  - `src/views/search/Pc.vue`、`src/views/search/Mobile.vue` 在引用折叠面板中展示相关图片缩略图，点击可打开原图。

### 注意
- 已上传的旧 PDF 必须重新上传或重新审核入库，才能抽取图片并生成 `image_paths`。
- 如果只重启服务但不重建旧文档向量库，仍然查不到图片。

## 验证结果

- Python 语法检查通过：
  - `backend/app/services/llm.py`
  - `backend/app/services/rag.py`
  - `backend/app/services/parser.py`
  - `backend/app/api/ticket.py`
  - `backend/app/api/chat.py`
  - `backend/app/api/kb.py`
  - `backend/app/core/config.py`
- 前端类型检查通过：`npm run typecheck -- --noEmit`

## 后续注意

- 已有旧文档需要重新审核/重新入库，才能使用新的切片、表格、DOCX 图片识别逻辑。
- 若要充分识别扫描版 PDF 和 DOCX 图片文字，部署环境需要安装 `tesseract`、`chi_sim` 语言包、`poppler-utils` 以及 Python 包 `pdf2image`、`pytesseract`。