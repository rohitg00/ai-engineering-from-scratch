# キャップストーン 15 — Constitutional Safety Harness + Red-Team Range

> Anthropic の Constitutional Classifiers、Meta の Llama Guard 4、Google の ShieldGemma-2、NVIDIA の Nemotron 3 Content Safety、多言語 coverage 用の X-Guard が 2026 年の safety-classifier stack を定義した。garak、PyRIT、NVIDIA Aegis、promptfoo は標準的な adversarial evaluation tool になった。NeMo Guardrails v0.12 はそれらを production pipeline に接続する。この capstone では、target app の周囲に layered safety harness を張り、自律 red-team agent で 6+ attack family を実行し、measurable harmlessness delta を出す constitutional self-critique run を行う。

**種類:** Capstone
**言語:** Python (safety pipeline, red team)、YAML (policy configs)
**前提:** Phase 10 (LLMs from scratch)、Phase 11 (LLM engineering)、Phase 13 (tools)、Phase 14 (agents)、Phase 18 (ethics, safety, alignment)
**演習対象フェーズ:** P10 · P11 · P13 · P14 · P18
**時間:** 25 時間

## 問題

2026 年の LLM safety の frontier は、classifier が動くかどうかではない (おおむね動く)。問題は、production app の周りで過剰拒否を起こさず、明らかな穴も残さずに正しく compose する方法である。Llama Guard 4 は English policy violation を扱う。X-Guard (132 languages) は multilingual jailbreak を扱う。ShieldGemma-2 は image-based prompt injection を検知する。NVIDIA Nemotron 3 Content Safety は enterprise category を cover する。Anthropic の Constitutional Classifiers は serving ではなく training 中に使われる別 approach である。

Attack の進化も重要だ。PAIR と TAP は jailbreak discovery を自動化する。GCG は gradient-based suffix attack を行う。Multi-turn と code-switch attack は agent memory を悪用する。Deploy された LLM には red-team range が必要である。garak と PyRIT が canonical driver であり、documented mitigation と CVSS-scored finding も必要になる。

あなたは target application (8B instruction-tuned model、または他 capstone の RAG chatbot) を harden し、6+ attack family を実行し、before/after harmlessness measurement を作成する。

## コンセプト

Safety pipeline は 5 層で構成する。**Input sanitize**: zero-width char を取り除き、base64/rot13 を decode し、Unicode を normalize する。**Policy layer**: NeMo Guardrails v0.12 rails (off-domain、toxicity、PII extraction)。**Classifier gate**: input に Llama Guard 4、non-English に X-Guard、image input に ShieldGemma-2。**Model**: target LLM。**Output filter**: output に Llama Guard 4、Presidio PII scrub、必要なら citation enforcement。**HITL tier**: high-risk と flag された output は Slack queue に送る。

Red-team range は scheduler で実行する。PAIR と TAP が自律的に jailbreak を発見する。GCG は gradient-based suffix attack を実行する。ASCII / base64 / rot13 encoding attack、multi-turn attack (persona adoption、memory exploitation)、code-switch attack (English と Swahili や Thai の混在) も含める。各 run は CVSS scoring と disclosure timeline を持つ structured findings file を生成する。

Constitutional-self-critique run は training-time intervention である。1k harmful-attempt prompts を取り、model に response を draft させ、written constitution (do-not-harm rules) に照らして critique し、その critique loop で retrain する。Held-out eval で before/after harmlessness delta を測る。

## アーキテクチャ

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## スタック

- Safety classifiers: Llama Guard 4、ShieldGemma-2、NVIDIA Nemotron 3 Content Safety、X-Guard
- Guardrail framework: NeMo Guardrails v0.12 + OPA
- Red-team drivers: garak (NVIDIA)、PyRIT (Microsoft Azure)、NVIDIA Aegis、promptfoo
- Jailbreak agents: PAIR (Chao et al., 2023)、Tree-of-Attacks (TAP)、GCG suffix
- Constitutional training: Anthropic-style self-critique loop + critique による SFT
- PII scrub: Presidio
- Target: 8B instruction-tuned model、または他 capstone の RAG chatbot

## 実装

1. **Target setup.** vLLM 上に 8B instruction-tuned model を立てる (または他 capstone の RAG chatbot を再利用する)。これが app under test になる。

2. **Safety pipeline wrap.** Target の周りに 5-layer pipeline を配線する。各 layer が個別に observable であることを確認する (Langfuse に layer ごとの span)。

3. **Classifier coverage.** Llama Guard 4、X-Guard (multilingual)、ShieldGemma-2 (image) を load する。小さな labeled set で各 classifier を実行し baseline を作る。

4. **Red-team scheduler.** garak、PyRIT、PAIR agent、TAP agent、GCG runner、multi-turn attacker、code-switch attacker を schedule する。各 family は separate queue で走らせる。

5. **Attack suite.** 6 つの attack family: (1) PAIR automated jailbreak、(2) TAP tree-of-attacks、(3) GCG gradient suffix、(4) ASCII / base64 / rot13 encoding、(5) multi-turn persona、(6) multilingual code-switch。Family ごとの success rate を報告する。

6. **Constitutional self-critique.** 1k harmful-attempt prompt を curate する。各 prompt に対して target が response を draft する。Critic LLM が written constitution ("do no harm," "cite evidence," "refuse illegal requests") に照らして score する。Critic が objection した prompt は rewrite し、target は critique-improved pair で fine-tune される。Held-out eval で before/after harmlessness を測る。

7. **Over-refusal measurement.** Benign prompt suite (例: XSTest) で false-positive rate を追跡する。Target は benign question に対して helpful であり続ける必要がある。

8. **CVSS scoring.** 成功した jailbreak ごとに CVSS 4.0 (attack vector、complexity、impact) で score する。Disclosure timeline と mitigation plan を作る。

9. **Range automation.** 上記すべてを cron で動かす。Finding は queue に書き込む。Over-refusal regression alert は Slack に送る。

## 使ってみる

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## Ship It

`outputs/skill-safety-harness.md` が提出物である。Production-grade layered safety pipeline と、before/after harmlessness delta を持つ reproducible red-team range。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families を実行、2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate と XSTest benign pass rate |
| 20 | Self-critique delta | Held-out eval 上の before/after harmlessness |
| 20 | Documentation and disclosure | Timeline 付き CVSS-scored findings |
| 15 | Automation and repeatability | すべてが cron と alert で動く |
| **100** | | |

## 演習

1. RAG chatbot に対して garak の prompt-injection plugin を実行し、output-filter layer の有無で attack success rate を比較する。

2. 7 つ目の attack family を追加する: retrieved document 経由の indirect prompt injection。必要になる追加 defense を測る。

3. "refuse-with-help" mode を実装する: guardrail が block したとき、target が flat refusal ではなく安全な関連回答を提示する。XSTest delta を測る。

4. Multilingual coverage gap: X-Guard の性能が低い language を見つける。それを狙う fine-tune dataset を提案する。

5. Constitutional self-critique を 30B model で実行し、delta が scale するか測る。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| Layered safety | "Defense in depth" | Input、gate、output、HITL にまたがる複数 guardrail |
| Llama Guard 4 | "Meta's safety classifier" | 2026 年の参照 input/output content classifier |
| PAIR | "Jailbreak agent" | LLM-driven jailbreak discovery に関する論文 (Chao et al.) |
| TAP | "Tree-of-Attacks" | PAIR の tree-search variant |
| GCG | "Greedy coordinate gradient" | Gradient-based adversarial suffix attack |
| Constitutional self-critique | "Anthropic-style training" | Target drafts -> critic scores -> rewrite -> retrain |
| XSTest | "Benign probe set" | Over-refusal regression 用 benchmark |
| CVSS 4.0 | "Severity score" | Safety finding 用の標準 vulnerability scoring |

## 参考資料

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) — training-time reference
- [Meta Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 input/output classifier
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) — image + multimodal safety
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) — enterprise reference
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) — 132-language multilingual safety
- [garak](https://github.com/NVIDIA/garak) — NVIDIA red-team toolkit
- [PyRIT](https://github.com/Azure/PyRIT) — Microsoft red-team framework
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — rail framework
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — jailbreak agent paper
