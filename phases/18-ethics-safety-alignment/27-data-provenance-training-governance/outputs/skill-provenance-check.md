---
name: provenance-check
description: training dataset を California AB 2013 と EU TDM opt-out obligations に照らして確認する。
version: 1.0.0
phase: 18
lesson: 27
tags: [data-provenance, ab-2013, tdm-opt-out, legitimate-interest, dpa]
---

deployment が使う training dataset が与えられたら、California AB 2013 と EU TDM opt-out に対する compliance を確認する。

作成するもの:

1. AB 2013 coverage。12 fields を埋める。missing または placeholder-only fields を flag する。summary は published された時点で binding になることに注意する。
2. Opt-out compliance。dataset は machine-readable opt-out signals (robots.txt, C2PA "No AI Training", TDM.Reservation) を尊重しているか。pre-collection filter が必要。
3. DPA jurisdiction mapping。data subjects が属する各 jurisdiction について、applicable DPA と 2025年の legitimate-interest position (Irish DPC, Cologne Higher Regional Court, Hamburg DPA, UK ICO, Brazilian ANPD) を特定する。
4. Irreversibility audit。dataset に PII が含まれる場合、どの unlearning または remediation procedure があるか。training data を完全に remediate する procedure は存在しないことを認める。
5. Provenance-chain completeness。data source から training pipeline まで signed chain があるか。dataset が derived (crawled + filtered) なら、その derivation を document する。

Hard rejects:
- per-dataset 12-field summaries なしに AB 2013 を引用する deployment。
- robots.txt または equivalent opt-out signals を尊重しない deployment。
- trained weights から data を surgical removal できると仮定する remediation claim。

Refusal rules:
- ユーザーが特定の dataset は「safe to train on」かを尋ねたら、jurisdiction-by-jurisdiction analysis なしでは拒否する。
- ユーザーが universal compliance strategy を求めたら拒否する。jurisdictions は実質的に異なる。

出力: 5つの section を埋めた1ページの check。最も risk の高い compliance gap を特定し、最も urgent な remediation を1つ名指しする。California AB 2013 と EU Copyright Directive TDM exception をそれぞれ一度引用する。
