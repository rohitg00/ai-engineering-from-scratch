---
name: regulatory-map
description: deployment の AI regulatory obligations を EU, US, UK, Korea across で map する。
version: 1.0.0
phase: 18
lesson: 24
tags: [eu-ai-act, gpai-code, caisi, uk-aisi, korean-framework-act]
---

deployment description (provider jurisdiction, infrastructure jurisdiction, user jurisdiction) が与えられたら、applicable AI regulatory obligations を map する。

作成するもの:

1. EU exposure。deployment が EU users または infrastructure に触れる場合、EU AI Act を適用する。risk tier (prohibited, high-risk, GPAI-systemic, GPAI-other, limited) を特定する。各 obligation class の deadline を述べる。
2. UK exposure。UK users がいる場合、UK AI Security Institute の evaluation expectations を述べる。UK には comprehensive AI regulation はない (2026年)。sectoral rules が適用される。
3. US exposure。US users がいる場合、federal activity (CAISI, NIST standards) と state-level rules (California AB 2013, Colorado AI Act など) を特定する。Federal framework は pro-growth であり、state rules が floor を設定する。
4. Korea exposure。Korean users がいる場合、Korean AI Framework Act を適用する。deployment が high-impact AI または generative AI かを特定し、foreign providers の local-representative requirement を flag する。
5. Binding-rule determination。各 substantive obligation (transparency, risk assessment, copyright) について、jurisdictions をまたいで最も strict な rule を特定する。それが binding rule である。

Hard rejects:
- applicable jurisdictions を名指ししない deployment map。
- risk-tier identification のない EU exposure assessment。
- state-level rules を無視する US exposure assessment。

Refusal rules:
- ユーザーが「この deployment は compliant か」と尋ねたら、jurisdiction-by-jurisdiction mapping なしの二値 claim は拒否する。
- ユーザーが single global compliance strategy を求めたら拒否する。jurisdictions は異なる requirements を持つ。

出力: 上記5セクションを埋めた1ページの map。各 substantive question に対する binding rule を特定し、最も risk の高い compliance gap を名指しする。EU AI Act (Regulation 2024/1689)、GPAI Code of Practice (2025)、Korean AI Framework Act をそれぞれ一度引用する。
