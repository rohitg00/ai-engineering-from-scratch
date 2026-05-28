"""Minimal model-card, datasheet, system-card generator — stdlib Python.

toy deployment のために3つの canonical documents を生成する:
  - Model Card (Mitchell et al. 2019)
  - Datasheet (Gebru et al. 2018)
  - System Card (Sidhpurwala 2024 / "Blueprints of Trust" 2025)

各 document は stdout に出力される Markdown string である。
Sections は canonical templates に従う。

Usage: python3 code/main.py
"""

from __future__ import annotations


def model_card() -> str:
    return """
# Model Card: ToyClassifier-1.0

## Model Details
- Developer: ai-engineering-from-scratch / Phase 18 / Lesson 26
- Version: 1.0.0
- Type: binary logistic classifier (toy)
- License: MIT
- Contact: phase-18-lesson-26

## Intended Use
- Primary: 教育用 demonstration
- Out-of-scope: production decision 全般

## Factors
- Sensitive attributes: gender (toy では binary), age bucket
- Environment: controlled synthetic data

## Metrics
- Accuracy, demographic parity, equalized odds (Lesson 21 参照)

## Training Data
- Synthetic dataset。付属 Datasheet を参照

## Quantitative Analysis
- accuracy: overall 0.97
- demographic parity gap: +0.03 (group0 vs group1)
- equalized odds TPR gap: -0.01

## Ethical Considerations
- Toy classifier。real-world use では validated されていない。
- Bias metrics は placeholder。deployment 前に full audit を ship すること。

## Caveats and Recommendations
- deployment-specific data で retrain する。
- training data に PII が含まれる場合は Lesson 22 (DP) を適用する。
"""


def datasheet() -> str:
    return """
# Datasheet: ToyBinaryClassification-1.0

## Motivation
- Phase 18, Lesson 26 の教育用 demonstration として作成
- funding なし。production use 用ではない

## Composition
- 1,500 synthetic examples
- Features: 2-d continuous, 1 binary sensitive attribute
- Labels: binary, x[0] + x[1] > 0 rule から derived

## Collection Process
- fixed seed の Python random.gauss で synthetically generated
- human subjects は含まれない

## Labeling
- Labels は programmatically derived。annotation error はない

## Uses
- Intended: fairness metrics (Lesson 21) と bias probes (Lesson 20) の teaching
- Not to be used: production-scale dataset の proxy

## Distribution
- Phase 18 / Lesson 26 repository に含まれる

## Maintenance
- Static。fixed seed から every run で regenerated
"""


def system_card() -> str:
    return """
# System Card: ToyClassifier Service

## Deployment
- Scope: localhost pedagogical service
- Stack: ToyClassifier-1.0 behind a single-threaded HTTP server

## Security Capabilities
- Prompt-injection: N/A (non-generative)
- Data-exfiltration detection: basic egress rate limit
- Rate limiting: 100 req/min per client

## Alignment
- Model は synthetic-label rule だけを反映する
- RLHF なし。refusal policy なし

## Incident Response
- production SLA なし。escalation 先なし
- Issue tracker: Phase 18 / Lesson 26

## Regulatory Alignment
- EU AI Act: N/A (toy。EU deployment なし)
- GPAI Code of Practice: N/A (non-GPAI)
- Transparency Code: N/A (AI-generated content output なし)
"""


def main() -> None:
    print("=" * 74)
    print("CARDS GENERATOR (Phase 18, Lesson 26)")
    print("=" * 74)
    print(model_card())
    print(datasheet())
    print(system_card())
    print("=" * 74)
    print("TAKEAWAY: 3つの canonical cards は3つの scopes を cover する。model cards は")
    print("model を document し、datasheets は data を document し、system cards は")
    print("deployment を document する。2026年には EU AI Act GPAI Code of Practice が")
    print("compliance artifacts として model cards を要求する。verifiable attestations")
    print("(Laminator 2024) は次の段階である。")
    print("=" * 74)


if __name__ == "__main__":
    main()
