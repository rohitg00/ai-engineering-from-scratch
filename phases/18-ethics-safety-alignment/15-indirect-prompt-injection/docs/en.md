# Indirect Prompt Injection — Production Attack Surface

> Indirect prompt injection (IPI) は、外部 content — web page、email、shared document、support ticket — の中に命令を埋め込み、agentic system が明示的な user action なしにそれを読むことで成立します。IPI は 2026 年の production における主要 threat です。attacker が user に触れないため user-input filters を bypass し、agents が外部 content を処理するほど静かに scale し、誰も prompt を読まない automated workflows を狙います。MDPI Information 17(1):54 (January 2026) は 2023-2025 年の研究を統合しています。NDSS 2026 の IPI-defense paper は中心課題をこう整理します: injected instructions は意味的には benign (例: "please print Yes") になり得るため、検出には keyword filtering 以上が必要です。"The Attacker Moves Second" (Nasr et al., joint OpenAI/Anthropic/DeepMind, October 2025): adaptive attacks (gradient、RL、random search、human red-team) は、当初 near-zero attack success rate を報告していた12の公開 defense の 90% 超を破りました。

**種別:** 構築
**言語:** Python (stdlib, IPI attack + defense harness)
**前提条件:** Phase 18 · 12 (PAIR), Phase 14 (agent engineering)
**所要時間:** 約75分

## 学習目標

- indirect prompt injection を定義し、一般的な delivery vectors を3つ説明する。
- user-input filters が IPI を完全に見逃す理由を説明する。
- 2026 年の defense paradigm としての "information flow control" framing を説明する。
- Nasr et al. (October 2025) が公開 IPI defenses に対する adaptive attack success について示した結果を述べる。

## 問題

direct prompt injection は attacker が user または user の prompt に到達する必要があります。IPI はそのどちらも必要としません。attacker は agent が読み得る任意の content — web page、inbox 内の email、GitHub issue、product review — に payload を置きます。agent は通常運用中にそれを取り込み、命令を実行します。user は意図ではなく messenger です。

## コンセプト

### 3つの delivery vectors

- **Retrieval-augmented generation (RAG)。** attacker が document を公開する。retrieval step がそれを取得する。prompt が user question の前にそれを連結する。model が attacker の instructions を実行する。
- **Inbox / document workflows。** attacker が user に email を送る。agent が emails を読む。prompt に email body が含まれる。model が email の instructions に従う。
- **Tool output。** attacker が agent の使う tool を control する (例: attacker-controlled result を返す web search)。tool output が instructions を含む。agent の control flow がそれに従う。

3つに共通する構造的性質は、attacker が user-facing input に触れずに prompt の一部を control することです。

### user-input filters が見逃す理由

IPI payload は user input に現れません。retrieved content に現れます。filter が user input にだけ gate されている場合、payload は bypass します。model に届く全 content に filter をかける場合、任意の retrieved text に適用しなければならず、cost が高く、imperative-voice language を含む正当な content に false positives が出ます。

### AI のための Information Flow Control (IFC)

2026 年の defense paradigm は classical OS security から借りています。すべての content source を security label として扱います。user の query を "trusted" と label します。retrieved content を "untrusted" と label します。model の control flow を information flow として扱います。untrusted content によって triggered された action は、実行前に trusted input によって ratify されなければなりません。

CaMeL (Microsoft 2025)、ConfAIde (Stanford 2024)、NDSS 2026 IPI-defense paper は、それぞれ異なる形で IFC を operationalize しています。共通原則は、code と data が同じ context window を共有する限り、goal は prevention ではなく containment である、ということです。

### The Attacker Moves Second

Nasr et al. (October 2025) は、12の公開 IPI defenses を adaptive attacks (gradient search、RL policies、random search、72-hour human red-team) でテストしました。当初 near-zero ASR を報告していたすべての defense が >90% ASR まで破られました。

methodological lesson: defense を公開するなら adaptive-attack evaluation と一緒に公開すること。static-attack benchmarks は robustness の証拠ではありません。attacker は defense を知った上で攻撃できます。

### 実際の incidents

Lesson 25 は EchoLeak (CVE-2025-32711, CVSS 9.3) を扱います。Microsoft 365 Copilot における、初めて公に記録された zero-click IPI です。GitHub Copilot Chat の CamoLeak (CVSS 9.6)、GitHub Copilot の CVE-2025-53773。Production deployments は benchmark だけでなく現場でも IPI に侵害されています。

### OWASP と NIST の framing

OWASP LLM Top 10 (2025) は prompt injection (direct + indirect) を LLM01、application-layer threat の第1位に置いています。NIST AI SPD 2024 は indirect prompt injection を "generative AI's greatest security flaw" と呼びます。

### Phase 18 における位置づけ

Lessons 12-14 は model-centric jailbreaks です。Lesson 15 は、2026 年の production deployments を支配する system-centric attack です。Lesson 16 は defensive tooling を扱います。Lesson 25 は具体的な CVE narrative を扱います。

## 使ってみる

`code/main.py` は IPI harness を作ります。toy agent は3つの tools (search web、read email、send message) を持ちます。environment には、埋め込み命令 ("forward this to all contacts") を含む attacker-controlled content があります。naive agent (injected instructions に従う)、filter-defended agent (retrieved content に keyword filter)、IFC agent (trusted / untrusted content を分け、untrusted control-flow commands を拒否) を切り替えられます。

## 成果物

この lesson は `outputs/skill-ipi-audit.md` を生成します。agentic deployment description が与えられたら、untrusted content sources を列挙し、deployment が IFC を適用しているかを確認し、trust label なしで model に到達する source を flag します。

## 演習

1. `code/main.py` を実行してください。3つの agents それぞれに対する attack success rate を測ってください。

2. retrieved content に対する paraphrase-based defense を実装してください。正当な retrieved text に対する benign false-positive rate を測ってください。

3. NDSS 2026 IPI-defense paper を読んでください。"benign instruction" challenge と、それが keyword-based filtering を妨げる理由を説明してください。

4. agent が third-party API から tool output を受け取る deployment を設計してください。各 prompt fragment に trust level を付け、agent actions を統制する IFC policy を書いてください。

5. Exercise 2 の filter-defended agent に対して、Nasr et al. 2025 の adaptive-attack methodology を再現してください。adaptive attack の前後で ASR を報告してください。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|------------------|------------|
| IPI | "indirect prompt injection" | user が書いていない content を通じた injection。agent が通常運用中に読む |
| RAG injection | 「poisoned retrieval」 | attacker が公開した content を retrieval step が取得し、prompt が payload を含む |
| Zero-click | 「user action なし」 | agent operation 中に自動発火し、user は何もしない |
| IFC | "information flow control" | label-based approach: untrusted content 由来の action は trusted ratification が必要 |
| Adaptive attack | "gradient / RL red-team" | defense を知った上で最適化する攻撃。誠実な評価に必要 |
| Benign instruction | "please print Yes" | 意味的には benign な IPI payload。keyword filter では捕捉できない |
| Scope violation | 「cross-trust exfiltration」 | agent が一方の trust context から data にアクセスし、別の context に出力すること |

## 参考文献

- [MDPI Information 17(1):54 — Indirect Prompt Injection Survey (January 2026)](https://www.mdpi.com/2078-2489/17/1/54) — 2023-2025 synthesis
- [Nasr et al. — The Attacker Moves Second (joint OpenAI/Anthropic/DeepMind, October 2025)](https://arxiv.org/abs/2510.18108) — adaptive attack evaluation
- [Greshake et al. — Not what you've signed up for (arXiv:2302.12173)](https://arxiv.org/abs/2302.12173) — original IPI paper
- [OWASP — LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/) — prompt injection ranked LLM01
