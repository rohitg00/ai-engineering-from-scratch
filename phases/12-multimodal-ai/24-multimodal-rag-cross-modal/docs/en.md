# Multimodal RAG and Cross-Modal Retrieval

> Vision-native document RAGは一部にすぎません。production multimodal RAGはもっと広く、text、images、audio、videoを横断してretrieveします。trip planning（「natural lightのある静かなvegan brunchを探して」）、medical triage（「この写真とnotesに合うinjuryは？」）、e-commerce（「このselfieに似たoutfitを自分のsizeで」）、field service（「このengine soundとpart photoから診断して」）のようなworkflowsです。2025年の3つのsurvey、Abootorabi et al.、Mei et al.、Zhao et al.は、sub-problemsを整理しました。cross-modal retrieval、retrieval fusion、generation grounding、multimodal evaluationです。このレッスンではsurveysを読み、production pipelineを設計します。

**種別:** 構築
**言語:** Python (stdlib、fusion + grounded generator 付き cross-modal retriever)
**前提条件:** Phase 12 · 23 (ColPali)、Phase 11 (RAG basics)
**所要時間:** 約180分

## 学習目標

- cross-modal retrievalを設計する。text -> image、image -> text、audio -> videoなど。
- 3つのfusion strategies、score fusion、attention-based fusion、MoE fusionを比較する。
- generation groundingを説明する。sourcesがmodalities混在のとき、"cite your sources"はどう見えるか。
- 2025年のcanonical multimodal RAG surveysを3つ挙げ、それぞれのsub-problem taxonomyを説明する。

## 問題

single-modality RAGは解けたpatternです。queryをembedし、chunksをembedし、retrieveし、LLMへ詰めます。Multimodal RAGには次が必要です。

1. 複数のretrieval heads（modalityごとにcompatible spaceのembeddingsが必要）。
2. modalitiesをまたぐretrieval resultsのfusion。
3. modalitiesをまたぐsourcesを引用するgeneration grounding。
4. cross-modal signalを覆うevaluation metrics。

2025年のsurveysはすべて同じtaxonomyに到達しています。

## コンセプト

### Cross-modal retrieval

modality Aのqueryからmodality Bのdocumentsをretrieveします。3つのpatternがあります。

1. Shared embedding space。CLIPとCLAPはtext + image / text + audio embeddingsをshared spaceに出します。modalitiesをまたいだcosine similarityが直接機能します。ただしCLIP-trained pairsに制約されます。

2. Per-modality encoder + translation。Text encoder + image encoder + spaces間をmapするsmall translator moduleです。Gupta et al.のSen2Senや他の2024 designsが該当します。柔軟ですがcomplexityが増えます。

3. VLM as encoder。VLM hidden statesをretrieval representationとして使います。VLMがsupportするmodalityならどれでも使えます。品質は高いが高コストです。

選択: text+imageにはCLIP / SigLIP 2、text+audioにはCLAP、frontier qualityのcross-modalにはVLM-hidden-states。

### Fusion strategies

10 resultsをretrieveしました。5 images、3 text passages、2 audio clipsです。どうmergeしますか。

Score fusion（最安）。各modalityにretrieverがあり、それぞれscoresを返します。modality内でnormalizeし、sumします。simpleで、多くの場合うまく動きます。

Attention-based fusion。retrieved itemsをすべてconcatenateし、small attention networkで重み付けします。trainingが必要です。

MoE fusion。gating networkがmodality-specific expertsへrouteします。query typeごとにrouteが変わり、visual questionではimagesのweightが高くなります。

production defaultは、queryのdominant modalityへ少しbiasをかけたscore fusionです。domainでA/B testが明確に勝つならMoEへupgradeします。

### Generation grounding

LLMは各claimをどのretrieved itemが支えたかをciteすべきです。multi-modalでは:

- Text source: standard citation `[1]`。
- Image source: short caption付き`[img 3]`。
- Audio: `[audio 2 at 0:34]`。

generatorはgrounding-aware dataでtrainingします。training target内の各claimにsource indexをtagします。inferenceではmodelが自然にcitationsをemitします。

### 2025年のsurveys

Abootorabi et al.（arXiv:2502.08826, "Ask in Any Modality"）: multimodal RAGのtaxonomy。retrieval、fusion、generationを扱う。coverageが最も広い。

Mei et al.（arXiv:2504.08748, "A Survey of Multimodal RAG"）: sub-task benchmarksとfailure modesに焦点。evaluation designに有用。

Zhao et al.（arXiv:2503.18016）: vision-focused survey。ColPali-family workに強い。

3つすべてを読むと、2025年春時点のstate of the artが分かります。多くのsub-problemsはいまも未解決です。

### MuRAG — foundational paper

MuRAG（Chen et al., 2022）は最初のmultimodal RAGでした。multimodal KBからimage + textをretrieveし、answersをgenerateしました。VLM wave前にfeasibilityを示しました。modern systems（REACT、VisRAG、M3DocRAG）はこれを土台にしています。

### production trip-planner example

Query: "find me a quiet vegan brunch with natural light."

Pipeline:

1. Queryをdecomposeする。"quiet" -> audio/review keyword、"vegan brunch" -> menu item、"natural light" -> image feature。
2. modalityごとにretrieveする。
   - reviews上のtext retrieval: "vegan brunch, quiet ambiance."
   - restaurant photos上のimage retrieval: "natural light, airy."
   - ambient-sound clips上のaudio retrieval: "low decibel, no music."
3. Scoresをfuseする。各restaurantがcomposite scoreを持つ。
4. top-k restaurants -> all evidence付きでVLM generatorへ -> citations付きanswer。

これはtext-RAGを大きく超えています。各modalityがtextだけでは欠けるsignalを追加します。

### Agentic multimodal RAG

Multi-hopです。最初のretrievalでhigh-confidence answersが返らない場合、LLMがreformulateして再retrieveします。Phase 14のAgentic RAG patternがここでも使えます。例:

- initial top-10をretrieve -> LLMが「too noisy, filter for <40 dB」と判断 -> re-retrieve。
- imagesをretrieve -> LLMがmenuが写っていると見る -> menu textをretrieve -> answer。

complexityは増えますが、single-shot retrievalでは扱えないqueriesを処理できます。

### Evaluation

Cross-modal evaluationはまだ未成熟です。よく使うproxy:

- modalityごとのRecall@k。
- Fused top-k accuracy。
- human-judged end-to-end satisfaction。
- task-specific metrics（bookings completed、purchases made）。

すべてのmodalitiesを横断するstandard benchmarkはありません。多くのpapersはdomain-specific tasksで評価します。

## 使ってみる

`code/main.py`:

- restaurantsのshared corpus上で動く3つのmock retrievers（text、image、audio）。
- configurable weightsでmodality scoresをcombineするscore fusion。
- citations付きfinal answerをemitするgenerator stub。
- confidenceが低い場合にqueryをreformulateするsimple agentic loop。

## 成果物

このレッスンは`outputs/skill-multimodal-rag-designer.md`を作ります。multimodal query flowを持つproduct specを受け取り、retrievers、fusion、generator、evaluationを設計します。

## 演習

1. medical-triage multimodal RAGを提案してください。query = injury photo + text symptoms。どのmodalityがどのKBからretrieveしますか。

2. Score fusionはsimple weighted sumです。MoE fusionが避けられるがscore fusionでは起きるfailure modeは何ですか。

3. Abootorabi et al.のtaxonomy（Section 3）を読んでください。3つのcanonical sub-problemsは何で、あなたのproductにどうmapされますか。

4. trip-planner multimodal RAG向けのeval specを設計してください。image recall、audio recall、composite correctnessを覆うmetricsは何ですか。

5. Agentic multi-hop RAGはround-tripごとにlatency taxがあります。どの程度のquery difficultyなら、accuracy gainがlatencyを正当化しますか。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Cross-modal retrieval | "Query one modality, retrieve another" | text queryがimagesをretrieveし、image queryがtextをretrieveする。shared spaceまたはtranslatorが必要 |
| Score fusion | "Combine scores" | modalityごとのretrieval scoresをweighted sumする最も単純なfusion |
| MoE fusion | "Modality-routed experts" | queryごとにどのmodality scoreを信じるかをgating networkが選ぶ |
| Grounded generation | "Cite your sources" | answer内の各claimにsource indexをtagする |
| MuRAG | "First multimodal RAG" | multimodal RAG patternを確立した2022年paper |
| Agentic multi-hop | "Reformulate and retry" | first-pass confidenceが低いとき、LLMがretrieversへ再queryする |

## 参考文献

- [Abootorabi et al. — Ask in Any Modality (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei et al. — A Survey of Multimodal RAG (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao et al. — Vision RAG Survey (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen et al. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu et al. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
