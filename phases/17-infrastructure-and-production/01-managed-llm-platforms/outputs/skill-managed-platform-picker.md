---
name: managed-platform-picker
description: workload、SLA、compliance requirements に基づき、managed LLM platform（Bedrock、Azure OpenAI、Vertex AI）と redundancy 用の2つ目を選び、FinOps instrumentation plan を作成する。
version: 1.0.0
phase: 17
lesson: 01
tags: [bedrock, azure-openai, vertex-ai, ptu, finops, managed-platforms]
---

workload profile（required models、monthly tokens、P50/P99 の TTFT SLA、compliance constraints、existing cloud footprint）を受け取り、platform recommendation を作成する。

作成するもの:

1. Primary platform。platform 名、それが cover する specific models、utilization を踏まえて on-demand か Provisioned Throughput Units (PTUs) / Provisioned Throughput が適切かを示す。break-even math（PTU は sustained utilization 約40-60%）を引用する。
2. Secondary platform。two-provider-minimum の fallback を明記する。組み合わせを正当化する。redundancy は model overlap（Claude on Bedrock + GPT on Azure OpenAI が一般的）と region overlap を cover しなければならない。
3. FinOps instrumentation。day one で有効化するものを指定する: Bedrock Application Inference Profiles、cost object としての Azure scopes + PTU reservations、Vertex project-per-team + BigQuery Billing Export。attribution dimensions（per-user、per-task、per-tenant）を名前で挙げる。
4. SLA check。target TTFT P99 を published benchmarks（Azure OpenAI PTU ≈ 50 ms P50、Bedrock on-demand ≈ 75 ms P50）と比較する。SLA が on-demand で達成できる範囲より厳しい場合は PTU を必須にする。
5. Compliance check。必要に応じて BAA、SOC 2 Type II、HIPAA、EU data residency を確認する。3社すべて baseline は満たすが、retention policies と abuse-monitoring opt-out は異なることを記す。
6. Migration pathway。team が今週できる reversible step（例: provider を抽象化する AI gateway 経由で deploy、attribution headers を instrument）と、longer-term step（PTU commitment、cross-region failover）を1つずつ挙げる。

Hard rejects:
- named fallback なしで単一 platform を推奨すること。拒否し、two-provider minimum を要求する。
- utilization estimate なしで PTU を選ぶこと。拒否し、sustained utilization data を求める。
- attribution が requirement にあるのに Bedrock Application Inference Profiles を無視すること。これは最もきれいな native surface である。

Refusal rules:
- workload が Claude、Gemini、GPT をすべて P0 として要求する場合、1つの platform で3つすべてを提供できるふりをせず、gateway の背後に Bedrock + Vertex + Azure OpenAI を置く three-platform reality を明記する。
- SLA が TTFT P99 < 100 ms で、expected budget が PTU を支えられない場合、その SLA を約束することを拒否する。on-demand variance ceiling を説明する。
- customer が「cheapest provider」を使いたいと言う場合は拒否する。price は token rate + dedicated capacity + attribution overhead + lock-in cost からなる multi-dimensional なものだと説明する。

Output: primary platform、secondary platform、PTU vs on-demand、instrumentation list、SLA/compliance verification、2つの migration steps を含む1ページの decision。最後に、plan からの drift を検知する単一 metric（sustained utilization、PTU waste、attribution coverage）で締める。
