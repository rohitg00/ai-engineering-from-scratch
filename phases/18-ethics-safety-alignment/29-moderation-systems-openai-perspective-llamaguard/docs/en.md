# Moderation Systems — OpenAI, Perspective, Llama Guard

> Production moderation systems は Lessons 12-16 で定義した safety policies を operationalize する。OpenAI Moderation API: `omni-moderation-latest` (2024) は GPT-4o ベースで text + images を1 call で classify する。multilingual test set では prior version より 42% better。response schema は 13 category booleans を返す — harassment、harassment/threatening、hate、hate/threatening、illicit、illicit/violent、self-harm、self-harm/intent、self-harm/instructions、sexual、sexual/minors、violence、violence/graphic。most developers には free。Layered patterns: Input moderation (pre-generation)、Output moderation (post-generation)、Custom moderation (domain rules)。Async parallel calls で latency を隠す。flag 時は placeholder response。Llama Guard 3/4 (Lesson 16): 14 MLCommons hazards、Code Interpreter Abuse、8 languages (v3)、multi-image (v4)。Perspective API (Google Jigsaw): LLM-as-moderator wave 以前からある toxicity scoring。主に single-dimension toxicity と severe-toxicity/insult/profanity variants。content-moderation research の baseline。Deprecations: Azure Content Moderator は 2024年2月 deprecated、2027年2月 retired、Azure AI Content Safety に replaced。

**種別:** 構築
**言語:** Python (stdlib, three-layer moderation harness)
**前提条件:** Phase 18 · 16 (Llama Guard / Garak / PyRIT)
**所要時間:** 約60分

## Learning Objectives

- OpenAI Moderation API の category taxonomy と、Llama Guard 3 の MLCommons set との違いを説明する。
- three moderation-layer pattern (input, output, custom) を説明し、それぞれの failure mode を1つ挙げる。
- Perspective API が pre-LLM-era baseline として位置付けられる理由と、研究で使われ続ける理由を説明する。
- Azure deprecation timeline を述べる。

## 問題

Lessons 12-16 は attacks と defense tooling を説明した。Lesson 29 は、users が product に触れる surface で defense を operationalize する deployed moderation systems を扱う。three-layer pattern は 2026年の default configuration である。

## The Concept

### OpenAI Moderation API

`omni-moderation-latest` (2024)。GPT-4o ベース。text + images を1 call で classify。most developers には free。

Categories (response schema の 13 booleans):
- harassment, harassment/threatening
- hate, hate/threatening
- self-harm, self-harm/intent, self-harm/instructions
- sexual, sexual/minors
- violence, violence/graphic
- illicit, illicit/violent

Multimodal support は `violence`、`self-harm`、`sexual` に適用されるが `sexual/minors` には適用されない。その他は text-only。

`code/main.py` の code harness では、pedagogical simplicity のため `/threatening`、`/intent`、`/instructions`、`/graphic` の sub-categories を top-level parents に collapse している。production code では full 13-category schema を使うべきである。

prior-generation moderation endpoint と比べ、multilingual test set で 42% better。per-category scores が返り、applications が thresholds を設定する。

### Llama Guard 3/4

Lesson 16 で扱った。14 MLCommons hazard categories (OpenAI の 13 response-schema booleans とは異なる構成)。8 languages を support (v3)。Llama Guard 4 (2025年4月) は natively multimodal, 12B。

OpenAI と Llama Guard の taxonomies は重なるが diverge する。OpenAI には broad category として "illicit" がある。Llama Guard は "violent crimes" と "non-violent crimes" を別に持つ。deployments は policy-taxonomy fit に基づいて選ぶ。

### Perspective API (Google Jigsaw)

LLM-as-moderator wave (pre-2020) より前からある toxicity scoring system。Categories: TOXICITY, SEVERE_TOXICITY, INSULT, PROFANITY, THREAT, IDENTITY_ATTACK。primary score は single-dimension (TOXICITY) で、sub-dimension variants を持つ。

API が stable、documented、長年の calibration data を持つため、content-moderation research baseline として広く使われる。modern LLM-adjacent use cases では、通常 Llama Guard または OpenAI Moderation の方が適している。

### The three-layer pattern

1. **Input moderation.** generation 前に user's prompt を classify。flag されたら reject。Latency: classifier call 1回。
2. **Output moderation.** delivery 前に model output を classify。flag されたら refusal に置き換える。Latency: generation 後に classifier call 1回。
3. **Custom moderation.** domain-specific rules (regex, allowlists, business policy)。input または output で実行。

3 layers は設計上 sequential である。input moderation は generation 前に完了し、output moderation は generation 後に実行される。Parallelism は layer 内で適用する。同じ text に複数 classifiers (例: OpenAI Moderation + Llama Guard + Perspective) を同時に走らせると per-classifier latency を隠せる。optional optimization として、input moderation が完了し token-1 streaming を遅らせている間、placeholder response ("one moment, checking...") を表示してもよい。Flag behaviour は configurable: refuse、sanitize、human review に escalate。

### Failure modes

- **Input only.** output hallucinations を catch しない (Lessons 12-14 の encoding attacks は input classifiers を bypass する)。
- **Output only.** 任意の input を model に到達させる。cost を増やす。internal reasoning を attacker に surface する。
- **Custom only.** categories across に robust ではない。regexes は brittle。

Layered が default。belt-and-suspenders。

### Azure deprecation

Azure Content Moderator: 2024年2月 deprecated、2027年2月 retired。Azure AI Content Safety に replaced。Azure AI Content Safety は LLM-based で Azure OpenAI と integrate する。この migration は Azure deployments にとって 2024-2027年の field-level project である。

### Where this fits in Phase 18

Lesson 16 は red-team context で moderation tooling を扱う。Lesson 29 は deployed moderation を扱う。Lesson 30 は current dual-use capability evidence で締める。

## Use It

`code/main.py` は three-layer moderation harness を構築する: input moderator (keyword + category score)、output moderator (同じ classifier を output に適用)、custom moderator (domain rules)。inputs を通して、どの layer が何を catch するか観察できる。

## Ship It

この lesson では `outputs/skill-moderation-stack.md` を作る。deployment が与えられたとき、moderation stack configuration を推奨する。input にどの classifier、output にどの classifier、どの custom rules、edge cases にどの judge を使うか。

## Exercises

1. `code/main.py` を実行する。benign、borderline、harmful input を all three layers に通す。それぞれでどの layer が fire するか報告する。

2. Perspective-API-style toxicity scoring を特定 category に追加して harness を拡張する。その threshold behaviour を category score と比較する。

3. OpenAI Moderation API docs と Llama Guard 3 category list を読む。OpenAI category を最も近い Llama Guard categories に map する。cleanly map しない categories を3つ特定する。

4. code-assistant deployment (例: GitHub Copilot) の moderation stack を設計する。最も relevant な categories と最も relevant でない categories を特定し、custom rules を提案する。

5. Azure Content Moderator は 2027年2月に retire する。Azure AI Content Safety への migration を計画する。migration の最も risk が高い element を特定する。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OpenAI Moderation | 「omni-moderation-latest」 | GPT-4o-based の 13-category (text) classifier。partial multimodal support |
| Perspective API | 「Google Jigsaw toxicity」 | pre-LLM-era toxicity scoring baseline |
| Llama Guard | 「MLCommons 14-category」 | Meta の hazard classifier (v3: 8B text, 8 langs; v4: 12B multimodal) |
| Input moderation | 「pre-generation filter」 | model call 前の user prompt classifier |
| Output moderation | 「post-generation filter」 | delivery 前の model output classifier |
| Custom moderation | 「domain rules」 | deployment-specific rules (regex, allowlist, policy) |
| Layered moderation | 「all three layers」 | standard production deployment pattern |

## 参考文献

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations) — omni-moderation endpoint
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) — Llama Guard repo
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) — toxicity scoring
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) — Azure replacement
