# Compliance — SOC 2、HIPAA、GDPR、PCI-DSS、EU AI Act、ISO 42001

> Multi-framework coverage は 2026 年の enterprise deals では table stakes です。**EU AI Act**: 2024 年 8 月 1 日から in force。ほとんどの high-risk requirements は 2026 年 8 月 2 日に enforce されます。high-risk-system obligations (Art. 99(4)) では最大 €15M または global annual turnover の 3%、prohibited AI practices (Art. 99(3)) では最大 €35M または 7% の fines。EU users に提供するなら global に適用されます。**Colorado AI Act**: 2026 年 6 月 30 日 effective (SB25B-004 により 2026 年 2 月から延期) — high-risk systems の impact assessments、AI decisions に対する right to appeal。Virginia も credit/employment/housing/education で類似。**SOC 2 Type II**: B2B AI の事実上の requirement (fintech では Type I ではなく Type II)。**GDPR**: 文書化された最大の AI-specific fine は Clearview AI に対する €30.5M (Dutch DPA、2024 年 9 月)。Italy の Garante は 2024 年 12 月に OpenAI へ €15M を issued (のち 2026 年 3 月に appeal で overturned)。inference 時点の real-time PII redaction が defensible standard です。post-processing cleanup では足りません。**HIPAA**: healthcare では BAA なしに PHI を external AI services へ送れません。**PCI-DSS**: AI-interaction-layer coverage は configuration + contractual agreements が必要で、自動ではありません。**ISO 42001**: emerging AI governance standard で、ISO 27001 と並び procurement requirement として伸びています。Reference profile: OpenAI は SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA (BAA)/FERPA、ChatGPT payment components 向け PCI-DSS を維持しています。Cross-framework mapping は audit fatigue を減らします。access controls は ISO 27001 A.5.15-5.18、GDPR Art. 32、HIPAA §164.312(a) に map できます。

**種類:** Learn
**言語:** (Python optional — compliance は code ではなく policy + process)
**前提:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**時間:** 約 60 分

## 学習目標

- LLM products に関連する 2026 年の 7 つの frameworks を列挙し、それぞれを customer segment に対応づける。
- EU AI Act enforcement timeline (2024 年 8 月 in force、2026 年 8 月 high-risk enforcement) と two-tier fine ceiling (€15M / 3% for high-risk obligations、€35M / 7% for prohibited practices) を引用する。
- post-processing PII cleanup が GDPR で十分ではない理由を説明し、real-time inference-layer redaction が defensible standard であると述べる。
- cross-framework control mapping を説明する (例: access control は ISO 27001 A.5.15-5.18 + GDPR Art. 32 + HIPAA §164.312(a) に map される)。

## 問題

enterprise customer の procurement が SOC 2 Type II、GDPR、HIPAA BAA、ISO 27001、「EU AI Act compliance statement」を求めています。あなたの team は SOC 2 Type I しか持っていません。Type II までは 6 か月あり、GDPR Article 30 records には未着手です。

Multi-framework coverage は LLM だけの問題ではありません。LLM-specific overlays を持つ enterprise-SaaS problem です。2026 年の procurement teams が求めるのは PDF ではなく、framework ごとの row と control ごとの column を持つ matrix です。

## コンセプト

### 7 つの frameworks

| Framework | Scope | LLM-specific requirement |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS baseline | 6-12 か月運用された process controls の audit |
| HIPAA | US healthcare | BAA 必須。signed agreement なしに PHI は infrastructure を離れられない |
| GDPR | EU users | Real-time PII redaction、data subject rights、Article 30 records |
| PCI-DSS | Payment data | payment に触れる AI には configuration + contracts が必要 |
| EU AI Act | EU users への提供 | Risk tier classification。high-risk systems: conformity assessment、documentation、logging |
| Colorado AI Act | CO residents への提供 | Impact assessments、right to appeal |
| ISO 42001 | AI governance | emerging。ISO 27001 と組み合わせる |

### EU AI Act timeline

- 2024 年 8 月 1 日: in force。
- 2025 年 2 月 2 日: prohibited-AI practices enforced。
- 2026 年 8 月 2 日: high-risk systems enforced (conformity assessment、documentation、logging)。
- 2027 年 8 月: harmonized legislation 下の products に含まれる high-risk systems。

Risk tiers: Unacceptable (banned)、High-risk (conformity + logging)、Limited-risk (transparency)、Minimal-risk (no constraint)。多くの B2B LLM SaaS は limited-risk です。employment、credit、education、law enforcement、migration、essential services では high-risk になります。

Fines (Article 99): high-risk-system obligations の breaches (Art. 99(4)) では最大 €15M または global annual turnover の 3%。prohibited AI practices (Art. 99(3)) では最大 €35M または 7%。いずれも高い方が適用されます。

### GDPR — real-time redaction が標準

Post-processing cleanup (LLM が見た後に PII を redact すること) は defensible posture ではありません。model は既に data を見ています。Real-time inference-layer redaction が 2026 年の standard です:

- LLM call 前の entity recognition。
- Consistent tokenization (Mesh approach) により semantics を保持する。
- redacted prompts と、consent された opt-in raw のみを保存する。

Recent enforcement: Clearview AI に対する €30.5M (Dutch DPA、2024 年 9 月) は、現時点で文書化された最大の AI-specific GDPR fine です。OpenAI に対する €15M (Italy's Garante、2024 年 12 月) は最大の LLM-specific fine でしたが、2026 年 3 月に appeal で overturned され、ruling は further review 中です。post-processing claims は audit で失敗しています。

### HIPAA — BAA は optional ではない

signed Business Associate Agreement なしに PHI を external AI services へ送ることはできません。3 つの hyperscaler LLM platforms (Bedrock、Azure OpenAI、Vertex) はすべて BAAs を提供しています。OpenAI direct API も BAA を提供します。Anthropic direct API も BAA を提供します。PHI を送る前に確認してください。

### SOC 2 Type II

Type I: controls が design され、document されていること。
Type II: controls が 6-12 か月にわたって有効に operate していること。

B2B procurement は 2026 年には Type II が default です。Type I は starter、Type II が gate です。

common audit drivers: access logs (誰が何を見たか)、change management (どう deploy されたか)、risk assessments (quarterly)、incident response (tested?)。Phase 17 · 25 の audit log は直接再利用できます。

### Cross-framework mapping

1 つの access control policy が複数 framework controls を満たします:

| Control | Frameworks |
|---------|-----------|
| Access logging | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Change management | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Encryption in transit | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Secrets management | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

Compliance tools (Drata、Vanta、Secureframe) はこの mapping を自動化します。scale すると費用に見合います。

### ISO 42001 — emerging

2023 年末に発行されました。ISO 27001 と並んで procurement requirement として伸びています。risk management、data quality、transparency、human oversight を含む AI governance の framework です。

### OpenAI の reference profile

OpenAI は SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA (BAA)/FERPA、ChatGPT payment components 向け PCI-DSS を維持しています。これがおおむね 2026 年の enterprise table stakes です。

### 覚えておくべき数字

- EU AI Act fines: 最大 €15M / 3% (high-risk obligations、Art. 99(4))。最大 €35M / 7% (prohibited practices、Art. 99(3))。
- EU AI Act high-risk enforcement: 2026 年 8 月 2 日。
- 文書化された最大の AI-specific GDPR fine: €30.5M、Clearview AI (Dutch DPA、2024 年 9 月)。
- 最大の LLM-specific GDPR fine: €15M、OpenAI (Italy's Garante、2024 年 12 月。2026 年 3 月に appeal で overturned)。
- SOC 2 Type II window: 6-12 か月の operated controls。
- Colorado AI Act effective date: 2026 年 6 月 30 日 (SB25B-004 により 2026 年 2 月から延期)。

## 使ってみる

`code/main.py` は Python で書いた compliance-mapping spreadsheet です。control を受け取り、それが満たす frameworks を列挙します。

## 成果物

この lesson では `outputs/skill-compliance-matrix.md` を作ります。customer segment と geography を受け取り、required frameworks と controls を指定します。

## 演習

1. 最初の enterprise customer が SOC 2 Type II、HIPAA BAA、EU AI Act statement を要求しています。deal を勝ち取るための minimum viable compliance posture は何ですか。
2. 3 つの仮想 LLM products を EU AI Act risk tiers で分類してください。high-risk では何が変わりますか。
3. BAA なしの provider に誤って PHI を送ってしまいました。incident response を順に説明してください。
4. mid-market AI vendor にとって ISO 42001 が「2026 年に必要」かどうかを論じてください。
5. 自分の LLM audit log fields (Phase 17 · 25) を少なくとも 3 つの framework controls に map してください。

## 重要語句

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------------------|
| SOC 2 Type II | 「audited controls」 | 6-12 か月運用された controls の independent attestation |
| HIPAA BAA | 「healthcare contract」 | Business Associate Agreement。PHI に必須 |
| GDPR | 「EU privacy」 | real-time PII redaction が 2026 年の defensible standard |
| EU AI Act | 「EU AI rules」 | high-risk enforcement は 2026 年 8 月。€15M / 3% (high-risk obligations) — €35M / 7% (prohibited practices) |
| Colorado AI Act | 「US AI state law」 | 2026 年 6 月 30 日 effective (SB25B-004 で延期)。impact assessments |
| ISO 42001 | 「AI governance」 | AI risk + transparency の emerging framework |
| ISO 27001 | 「security ISMS」 | Information Security Management System baseline |
| Conformity assessment | 「EU AI doc package」 | high-risk requirement: docs、testing、logging |
| Cross-framework mapping | 「one control, many frames」 | 単一 policy が複数 framework controls を満たす |

## 参考資料

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) — reference compliance profile.
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) — primary source.
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) — primary source.
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) — AI management system standard.
