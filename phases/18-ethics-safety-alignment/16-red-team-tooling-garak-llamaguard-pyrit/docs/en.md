# Red-Team Tooling — Garak, Llama Guard, PyRIT

> 2026 年の red-team stack は3つの production tools で整理できます。Llama Guard (Meta) — 14の MLCommons hazard categories で fine-tune された Llama-3.1-8B classifier。2025 年の Llama Guard 4 は、Llama 4 Scout から pruned された 12B natively multimodal classifier です。Garak (NVIDIA) — hallucination、data leakage、prompt injection、toxicity、jailbreaks に対する static、dynamic、adaptive probes を備えた open-source LLM vulnerability scanner。PyRIT (Microsoft) — Crescendo、TAP、custom converter chains を使う multi-turn red-team campaigns で、深い exploitation を行います。Llama Guard 3 は Meta の "Llama 3 Herd of Models" (arXiv:2407.21783) に、Llama Guard 3-1B-INT4 は arXiv:2411.17713 に、Garak の probe architecture は github.com/NVIDIA/garak に記載されています。これらの tools は、red-team research (Lessons 12-15) と deployment (Lesson 17+) をつなぐ 2026 年の production interface です。

**種別:** 構築
**言語:** Python (stdlib, tool-architecture simulator and Llama Guard-style classifier mock)
**前提条件:** Phase 18 · 12-15 (jailbreaks and IPI)
**所要時間:** 約75分

## 学習目標

- safety stack における Llama Guard 3/4 の位置づけを説明する: input classifier、output classifier、またはその両方。
- 14の MLCommons hazard categories を挙げ、非自明なもの (Code Interpreter Abuse) を1つ述べる。
- Garak の probe architecture を説明する: probes、detectors、harnesses。
- PyRIT の multi-turn campaign structure と、それが Garak probes とどう組み合わさるかを説明する。

## 問題

Lessons 12-15 は attack surface を提示しました。Production deployments には、反復可能で scalable な evaluation が必要です。2026 年に中心となる3つの tools は Llama Guard (defense classifier)、Garak (scanner)、PyRIT (campaign orchestrator) です。それぞれ red-team lifecycle の異なる layer を対象にします。

## コンセプト

### Llama Guard (Meta)

Llama Guard 3 は、MLCommons AILuminate 14 categories にわたる input/output classification 用に fine-tune された Llama-3.1-8B model です。
- Violent crimes, non-violent crimes, sex-related, CSAM, defamation
- Specialized advice, privacy, IP, indiscriminate weapons, hate
- Suicide/self-harm, sexual content, elections, code-interpreter abuse

8言語を support します。使い方: LLM の前に置く (input moderation)、LLM の後に置く (output moderation)、または両方。2つの用途は異なる training distributions を生みます。Llama Guard 3 は単一モデルで両方を扱ります。

Llama Guard 3-1B-INT4 (arXiv:2411.17713, 440MB, mobile CPU で約30 tokens/s) は quantized edge variant です。

Llama Guard 4 (April 2025) は 12B、natively multimodal、Llama 4 Scout から pruned されています。8B text と 11B vision の predecessors を、text + images を取り込む1つの classifier で置き換えます。

### Garak (NVIDIA)

Open-source vulnerability scanner。architecture:
- **Probes。** hallucination、data leakage、prompt injection、toxicity、jailbreaks 向けの attack generators。static (fixed prompts)、dynamic (generated prompts)、adaptive (target output に応答)。
- **Detectors。** expected failure modes — toxic、leaked、jailbroken — に対して outputs を採点する。
- **Harnesses。** probe-detector pairs を管理し、campaigns を実行し、reports を生成する。

TrustyAI は Garak を Llama-Stack shields (Prompt-Guard-86M input classifier、Llama-Guard-3-8B output classifier) と統合し、end-to-end shielded-target evaluation を可能にします。Tier-based scoring (TBSA) は binary pass/fail を置き換えます。同じ probe で model が severity tier 3 では pass し、tier 5 では fail することがあります。

### PyRIT (Microsoft)

Python Risk Identification Toolkit。Multi-turn red-team campaigns。中心要素:
- **Converters。** seed prompt を変換する — paraphrase、encode、translate、roleplay。
- **Orchestrators。** campaign を実行する: Crescendo (escalation)、TAP (branching)、RedTeaming (custom loop)。
- **Scoring。** LLM-as-judge または classifier-as-judge。

PyRIT は Garak の重い cousin です。Garak は何千もの single-turn probes を走らせます。PyRIT は特定の failure mode を破るための深い multi-turn campaigns を走らせます。

### stack

Llama Guard を model の両側に置きます。Garak を nightly regression に使います。PyRIT を pre-release campaigns に使います。これが多くの production deployments における 2026 年の default configuration です。

### evaluation pitfalls

- **Judge identity。** 3つの tools はいずれも LLM judge を使えます。judge calibration が reported ASRs を左右します (Lesson 12)。tool と一緒に judge を明記してください。
- **Probe staleness。** Garak probes は model が patch されるにつれて古くなります。adaptive probes (PAIR-shaped) は static probes より古くなりにくいです。
- **Llama Guard FPR on benign content。** 初期の Llama Guard versions は政治的 content や LGBTQ+ content を過剰に flag しました。Llama Guard 3/4 の calibration は改善されていますが、deployment ごとに calibration されているわけではありません。

### Phase 18 における位置づけ

Lessons 12-15 は attack families です。Lesson 16 は production tooling です。Lesson 17 (WMDP) は dual-use capability の evaluation です。Lesson 18 は、これら tools を policy structure で包む frontier safety frameworks です。

## 使ってみる

`code/main.py` は toy Llama Guard-style classifier (14 categories に対する keyword + semantic features)、toy Garak harness (probe-detector loop)、PyRIT-style multi-turn converter chain を作ります。mock target に対して3つの tools を走らせ、coverage signature の違いを観察できます。

## 成果物

この lesson は `outputs/skill-red-team-stack.md` を生成します。deployment description が与えられたら、3つの tools のうちどれが適切か、それぞれに何を configure するか、どの regression cadence で実行するかを名前で示します。

## 演習

1. `code/main.py` を実行してください。Llama-Guard-style classifier の single-turn attacks と multi-turn attacks に対する detection rate を比較してください。

2. 新しい Garak probe を実装してください: base64-encoded harmful request。Llama-Guard-style classifier による detection を測ってください。

3. PyRIT-style converter chain に「フランス語へ翻訳し、その後 paraphrase する」converter を追加してください。attack success を再測定してください。

4. Llama Guard 3 の hazard-category list を読んでください。正当な developer content に対して high false-positive rates を現実的に生みそうな categories を2つ特定してください。

5. Garak と PyRIT の design principles を比較してください。それぞれが正しい tool になる deployment を論じてください。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|------------------|------------|
| Llama Guard | 「classifier」 | 14 hazard categories を持つ fine-tuned Llama-3.1-8B/4-12B safety classifier |
| Garak | 「scanner」 | NVIDIA の open-source vulnerability scanner。probes、detectors、harnesses |
| PyRIT | 「campaign tool」 | Microsoft の multi-turn red-team orchestrator。converters、orchestrators、scoring |
| Prompt-Guard | 「small classifier」 | Llama Guard と組み合わせる Meta の 86M prompt-injection classifier |
| TBSA | "tier-based scoring" | binary outcome を置き換える Garak の tier-based pass/fail |
| Converter chain | 「paraphrase + encode + ...」 | multi-step attacks を作る PyRIT の composition primitive |
| MLCommons hazard categories | 「14の taxonomies」 | Llama Guard が対象にする industry-standard taxonomy |

## 参考文献

- [Meta — Llama Guard 3 (in Llama 3 Herd paper, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) — 8B classifier
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) — quantized mobile classifier
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) — scanner repo and documentation
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) — campaign toolkit
