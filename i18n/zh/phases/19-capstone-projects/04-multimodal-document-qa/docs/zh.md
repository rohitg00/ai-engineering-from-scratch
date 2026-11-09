#                                          

> 2026年,文件-QA界限从OCR转移到视觉-第一的后期互动.  ColPali, ColQwen2.5 和 ColQwen3-omni将每个 PDF 页面视为图像,将其嵌入多向量迟交互, 在金融10K,科学论文和手写的笔记上, 建立一个终端的管道,在10万页,并将其发布一边对抗OCR-then-text.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI, retrieval scaffold)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子
**Time:** 30 hours

## 问题

企业使用OCR管道破碎的PDF文件:扫描10K的轮换表, 让这些信息成为第一条短信意味着失去一半的信号. 2026年答案是在原始页面图像上进行迟到互动的多向量检索. 科尔帕利 (伊利科技) 推出了它;科尔2.5v0.2和科尔3omni推进了精度. 在 ViDoRe v3 中,视觉首先检索的分数比OCR然后是文字高出了有意义的边缘,图表,表格和手写的差距扩大.

交换是存储和延迟.一个 ColQwen 嵌入式是每页的 ~2048个补丁向量,而不是单个1024维度向量.原料存储气球.docPruner (2026) 带来50%的剪裁,没有可测量的精度损失.您将索引10k页面,测量ViDoRe v3 nDCG@5,提供2秒以下的答案,并直接与OCR然后文本基线进行比较.

## 概念

晚交互意味着每个查询代币对每个补丁代币进行分数,每个查询代币的最大分数被总和.你得到了细粒度匹配,而不需要单个聚合向量.一个多向量指数 (Vespa,Qdrant多向量,或AstraDB) 存储每个补丁嵌入式,并在检索时运行MaxSim.

答案器是一个视觉语言模型,将查询加上上-k获取的页面作为图像,并用证据区域 (边框或页面引用) 写出答案.Qwen3-VL-30B,Gemini 2.5 Pro和InternVL3是2026年边界选择.对于方程和科学符号,OCR倒退 (Nougat,dots.ocr) 是作为可选的文本频道.

评估是一个二维矩阵.一个轴:内容类型 (平文段,密集表,条/行图,手写笔记,方程).另一个轴:检索方法 (视觉-第一晚交互与OCR-然后-文字对混合).每个细胞得到nDCG@5和答案准确性.报告是可交付的.

## 建筑

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## 堆

- 页面染:PyMuPDF (fitz) 180 DPI,肖像正常化
- 后期交互模型:ColQwen2.5-v0.2或ColQwen3-omni (在拥抱面上的视频团队)
- 索引:Vespa与多向量场,或Qdrant多向量,或AstraDB与MaxSim
- 切割: DocPruner 2026 政策 (保持高变量补丁,50%的压缩在<0.5%的精度损失)
- 转移 (方程/密集表):dots.ocr或Nougat
- 维LM响应器:Qwen3-VL-30B自主托管或双子 2.5 Pro托管;InternVL3作为倒退
- 评估:ViDoRe v3基准,M3DocVQA用于多页推理
- 浏览器UI: Next.js 15 具有证据区域的帆布覆盖

```figure
ce-late-interaction
```

## 建立它

1. **Ingest.**通过10万页的PDF文件,科学论文和扫描文件进行散步.将每个页面呈现为1536x2048 PNG. 坚持`{doc_id, page_num, image_path}`现在,我们要去.

2. **Embed.**在每个页面图像上运行ColQwen2.5-v0.2.输出形状 ~2048 补丁嵌入式的低128.应用 DocPruner 保持最高信号半.写到Vespa 多向量场或Qdrant 多向量.

3. **Query.**对于每一个接入查询,嵌入查询塔 (代币级嵌入). 运行MaxSim对索引:对于每一个查询代币,取 max dot-产品在页面补丁嵌入,总和.返回顶级k页面.

4. **Synthesize.**随着查询和前5页面图像,请调用Qwen3-VL-30B. 提示:"只使用提供的页面回答.以 (doc_id,页面) 引用每个索赔,并命名区域 (图,表,段落)."

5. **Evidence regions.**如果VLM发射边框 (Qwen3-VL是这样的),将它们作为观众中的叠加.

6. **OCR fallback.**对于被确定为方程密度 (图像变异的论) 的页面,运行Nougat或dots.ocr,并将OCR文本作为图像旁边的额外频道.

7. **Eval.**运行 ViDoRe v3 (检索 nDCG@5) 和 M3DocVQA (多页QA精度).同时运行同一个合成器的OCR-then-text管道.生成内容类型 ×方法矩阵.

8. **UI.**首先是流光原型; Next.js 15 制作观看器,面对面的证据区域覆盖.

## 用它

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## 运送它

`outputs/skill-doc-qa.md`描述可交付的产品:一个视觉先多模文件QA系统,调整到特定的体积,并与ViDoRe v3的OCR然后文本基线进行评估.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | Benchmark numbers vs OCR-text baseline and published leaderboard |
| 20 | Evidence-region grounding | Fraction of cited regions that actually contain the answer span |
| 20 | Storage and latency engineering | DocPruner compression ratio, index p95, answer p95 |
| 20 | Multi-page reasoning | Accuracy on a hand-labeled 100-question multi-page set |
| 15 | Source-inspection UX | Viewer clarity, overlay fidelity, side-by-side comparison tools |
| **100** | | |

## 运动

1. 在同一体积上测量ColQwen2.5-v0.2vsColQwen3-omni.哪些页面一个是正确的,另一个是错误的?添加一个"内容类"标签到索引中以按类型进行路由.

2. 除嵌的方法 (75%, 90%). 找到压缩悬崖: ViDoRe nDCG@5 落在OCR基线以下的地方.

3. 构建一个混合动力:并行运行OCR-then-text和ColQwen,并并并并与RRF,再使用一个跨编码器.混合动力单独打败了任何一个?它最有帮助的地方?

4. 换取一个较小的VLM (Qwen2.5-VL-7B) 的Qwen3-VL-30B. 测量每美元的精度曲线.

5. 添加手写笔记支持. 递交手写体,嵌入ColQwen,测量检索. 与手写OCR管道进行比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColPali-style retrieval" | Query tokens score against page patches independently; MaxSim aggregates |
| Multi-vector | "Per-patch embedding" | Each document has many vectors, not one pooled vector |
| MaxSim | "Late-interaction scoring" | For every query token, take max similarity over document vectors; sum |
| DocPruner | "Patch compression" | 2026 pruning that keeps 50% of patches with negligible accuracy loss |
| ViDoRe v3 | "Document-retrieval benchmark" | The 2026 standard for measuring visual-document retrieval |
| Evidence region | "Cited bounding box" | A bbox on the source page that localizes the answer span |
| OCR fallback | "Equation channel" | Text pipeline used alongside vision for equation- or table-heavy pages |

## 进一步阅读

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) 参考后期交互文件检索
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)基础方法论文
- [ColQwen family on Hugging Face](https://huggingface.co/vidore)生产准备的检查站
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952)多页多模拟RAG基线
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html)参考服务堆
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors)替代指数
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html)替代管理指数
- [Nougat OCR](https://github.com/facebookresearch/nougat)可方程的OCR倒退
