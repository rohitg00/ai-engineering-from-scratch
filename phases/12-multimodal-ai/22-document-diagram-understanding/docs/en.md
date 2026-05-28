# Document and Diagram Understanding

> Documents は photos ではありません。PDF、scientific paper、invoice、handwritten form には、layout、tables、diagrams、footnotes、headers、semantic structure があり、plain image understanding だけでは捉えられません。pre-VLM stack は pipeline でした。Tesseract OCR + LayoutLMv3 + table-extraction heuristics です。VLM wave はこれを OCR-free models、つまり Donut (2022)、Nougat (2023)、DocLLM (2023) へ置き換え、structured markup を直接 emit しました。2026年の frontier では、「page image を 2576px native で Claude Opus 4.7 へ入れる」だけで、structured-markup output が自然に得られます。このレッスンでは document AI の 3-era arc を読みます。

**種別:** 構築
**言語:** Python (stdlib、layout-aware document parser skeleton)
**前提条件:** Phase 12 · 05 (LLaVA)、Phase 5 (NLP)
**所要時間:** 約180分

## 学習目標

- document AIの3つのera、OCR pipeline、OCR-free、VLM-nativeを説明する。
- LayoutLMv3の3 input streams、text、layout（bbox）、image patchesと、unified maskingを説明する。
- Donut（OCR-free、image -> markup）、Nougat（scientific paper -> LaTeX）、DocLLM（layout-aware generative）、PaliGemma 2（VLM-native）を比較する。
- new task（invoices、scientific papers、handwritten forms、Chinese receipts）向けのdocument modelを選ぶ。

## 問題

"Understand this PDF"は見かけより難しいtaskです。情報は次にあります。

- Text content（signalの90%）。
- Layout（headers、footnotes、sidebars、two-column format）。
- Tables（rows、columns、merged cells）。
- Figures and diagrams。
- Handwritten annotations。
- Fonts and typography（title vs body）。

raw OCRはtextだけを吐き、残りを失います。invoiceを扱うsystemでは、"Total: $1,245"がfootnoteではなくbottom-rightから来たと知る必要があります。

## コンセプト

### Era 1 — OCR pipeline（pre-2021）

classic stack:

1. PDF -> pageごとのimage。
2. Tesseract（またはcommercial OCR）がper-word bounding boxes付きtextをextractする。
3. Layout analyzerがblocks（header、table、paragraph）をidentifyする。
4. Table structure recognizerがtablesをparseする。
5. Domain rules + regexがfieldsをextractする。

clean printed textでは機能します。handwriting、skewed scans、complex tables、non-English scriptsでは壊れます。すべてのfailure modeにcustom exception pathが必要です。

### TrOCR (2021)

TrOCR（Li et al., arXiv:2109.10282）はTesseractのclassic CNN-CTCを、synthetic + real text imagesでtrainingしたtransformer encoder-decoderへ置き換えました。handwrittenとmultilingual textで明確に改善しました。依然としてpipeline（detector then TrOCR then layout）ですが、OCR stepは大きく改善しました。

### Era 2 — OCR-free（2022-2023）

最初のOCR-free modelsは、detectionを完全にskipし、image pixelsをstructured outputへ直接mapしました。

Donut（Kim et al., arXiv:2111.15664）:
- Encoder-decoder transformer。encoderはSwin-B。
- outputはform understandingではJSON、summarizationではmarkdown、またはtask-specific schema。
- OCRなし、layoutなし、detectionなし。

Nougat（Blecher et al., arXiv:2308.13418）:
- scientific papers専用にtraining。
- outputはLaTeX / markdown。
- equations、multi-column layout、figuresを扱う。
- arXiv-parserが呼び出すmodel。

これらはspecialistsであり、generalistsではありません。Donutはscientific paperで失敗し、Nougatはinvoiceで失敗します。

### LayoutLMv3 (2022)

別の流れです。LayoutLMv3（Huang et al., arXiv:2204.08387）はOCRを残しつつlayout understandingを追加します。

- 3 input streams: OCR text tokens、tokenごとの2D bounding boxes、image patches。
- 3 modalitiesすべてにまたがるmasked training objective（masked text、masked patches、masked layout）。
- Downstream: classification、entity extraction、table QA。

LayoutLMv3はOCR-based document understandingの頂点です。formsとinvoicesに強いです。upstream OCRが必要です。standardized document benchmarksではpre-VLM最高クラスのaccuracyです。

### DocLLM (2023)

DocLLM（Wang et al., arXiv:2401.00908）はLayoutLMのgenerative siblingです。layout tokensにconditionされたfree-form answersを生成します。document QAでは良いですが、依然としてOCR inputに依存します。

### Era 3 — VLM-native（2024+）

2024年のVLMsは、pipeline全体を置き換えられるほど良くなりました。full page imageをhigh resolutionでVLMへ入れ、questionを投げ、answerを得ます。

- LLaVA-NeXT 336-tile AnyResは小さなdocumentsで機能する。
- Qwen2.5-VL dynamic-resolutionは2048+ pixelsをnativeに扱う。
- Claude Opus 4.7は2576px documentsをsupportする。
- PaliGemma 2（2025年4月）はdocuments + handwriting向けにtrainingされている。

VLM-nativeとOCR-pipelineのgapは急速に閉じました。2026年にはVLM-nativeが次で勝ちます。

- Scene text（hand-written + printed、mixed scripts）。
- merged cellsを含むcomplex tables。
- text内に埋め込まれたmath equations。
- text annotations付きfigures。

OCR pipelinesがまだ勝つ領域:

- page latencyが重要なmassive scaleのpure-scan workloads。
- Pipeline reliability（deterministic failures vs VLM hallucinations）。
- auditable OCR outputを要求するregulated environments。

### Claude 4.7 / GPT-5 frontier

2576-pixel native inputでは、frontier VLMsはnear-human accuracyでdocument understandingを行います。2026年初頭のbenchmark numbers:

- DocVQA: Claude 4.7 ~95.1、PaliGemma 2 ~88.4、Nougat ~77.3、pipelined LayoutLMv3 ~83。
- ChartQA: Claude 4.7 ~92.2、GPT-4V ~78。
- VisualMRC: Claude 4.7 ~94。

closed-model gapの主因はresolutionとbase-LLM scaleです。open 7B modelsは数points behindですが追いつきつつあります。

### Math equations and LaTeX output

scientific papersにはequationsの正確なLaTeX outputが必要です。Nougatはこのためにtrainingされました。LaTeX targetsでtrainingされたVLMs（Qwen2.5-VL-Math、Nougat derivatives）はusable LaTeXを生成します。明示的なLaTeX trainingがないVLMsは、読めるが不正確なtranscriptionsを出します。

2026年のscientific-paper pipelineでは、PDFにNougatをかけ、難しいpagesだけVLMに渡します。

### Handwriting

いまも最難関のsub-taskです。printed + handwrittenが混在するdocuments（doctor notes、filled forms）では、cost面でOCR pipelinesがまだVLMsを上回ることがあります。handwritten-only VLMsは改善しています（Claude 4.7、PaliGemma 2）。

### 2026 recipe

new document-AI project向け:

- scaleの大きいpure-printed invoices: LayoutLMv3 + rules。cost-efficient。
- mixed documents（scientific + handwritten + forms）: VLM-native（PaliGemma 2またはQwen2.5-VL）。
- full arXiv ingestion: mathはNougat、figuresはVLM。
- regulatory: OCR pipeline + cross-check用VLM validator。

## 使ってみる

`code/main.py`:

- toy layout-aware tokenizer: (text, bbox) pairsからLayoutLMv3-style inputを作る。
- Donut-style task schema generator: forms向けJSON template。
- OCR-pipeline、Donut、Nougat、VLM-nativeのpageあたりtoken budgetsを比較する。

## 成果物

このレッスンは`outputs/skill-document-ai-stack-picker.md`を作ります。document-AI project（domain、scale、quality、regulatory）を受け取り、OCR pipeline、OCR-free specialist、VLM-nativeのどれを選ぶか決めます。

## 演習

1. projectが1日1000万invoicesを処理します。accuracyを落とさずcost-per-pageを最小にするstackはどれですか。

2. LayoutLMv3がform QAではpure-CLIP-VLMsを上回るのに、scene-textでは劣るのはなぜですか。bbox streamは何を諦めていますか。

3. NougatはLaTeXを生成します。VLM-native outputがLaTeX fidelityでNougatを上回るtest caseと、Nougatが勝つcaseを提案してください。

4. PaliGemma 2 paper（Google, 2024）を読んでください。PaliGemma 1に比べてdocument accuracyを上げたkey training-data additionは何でしたか。

5. regulatory-safe hybridを設計してください。OCR pipelineをprimary、VLMをsecondary cross-checkにします。不一致はどう解決しますか。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| OCR pipeline | "Tesseract-style" | detect -> OCR -> layout -> rulesのstage-wise stack。deterministicだが脆い |
| OCR-free | "Donut-style" | explicit OCRをskipするimage-to-output transformer。single model |
| Layout-aware | "LayoutLM" | inputにtokenごとのbbox coordinatesを含め、modalities横断でunified maskingする |
| VLM-native | "Frontier VLM" | page imageを高解像度でClaude/GPT/Qwen VLMへ直接入れる。pipelineなし |
| DocVQA | "Doc benchmark" | document VQA standard。最も引用されるscore |
| Markup output | "LaTeX / MD" | downstream automationを可能にする、free-form textではないstructured output format |

## 参考文献

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
