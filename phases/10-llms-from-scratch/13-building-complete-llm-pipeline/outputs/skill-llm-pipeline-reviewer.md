---
name: llm-pipeline-reviewer
description: multi-million-dollar run の前に、end-to-end LLM training pipeline manifest を review する
version: 1.0.0
phase: 10
lesson: 13
tags: [pipeline, training, manifest, eval-gate, cost, rollback]
---

proposed training pipeline manifest (tokenizer、data、pre-training、SFT、alignment、eval、quantization、serving stages を記述した YAML または JSON) が与えられたら、以下を含む review を作成してください。

1. Stage graph。各 stage が typed inputs と typed outputs を持つことを確認する。missing dependencies、implicit state、named artifact hash ではなく bare directory を consume している stage を指摘する。
2. Hash chain。stage N の output_hash が、すべての downstream stage の input_hashes の 1つと一致することを verify する。不一致があれば manifest は incoherent であり、pipeline を start してはいけない。
3. Eval gate。gate list のすべての metric は numeric であり、operator、threshold、measurement source を持たなければならない。subjective ("looks good")、unbounded (threshold なし)、training data 上で測定される gate は reject する。
4. Regression guard。new model の core benchmarks (MMLU、MATH、HumanEval+、GPQA、または domain-specific equivalent) には baseline numbers が attached されていなければならない。baseline のない run は regression detection のない run である。
5. KL budget。alignment stages (RLHF、DPO、CAI、GRPO) は reference に対する cumulative KL cap を declare しなければならない。unbounded KL は unbounded drift である。
6. Contamination check。training data shards と eval sets には documented overlap check (exact match または 13-gram) が必要。required pass threshold は <0.1%。
7. Cost estimate。各 stage の pre-run estimate と total を budget gate と比較する。estimate > budget の場合、pipeline は start を拒否する。
8. Rollback plan。各 stage について、failure 時の named actions を示す: re-run、previous artifact への fall back、inputs を revise して downstream を re-run。expensive stages (pre-training) には warm checkpoint strategy が必要。
9. Artifact store。checkpoints、datasets、tokenizers、eval reports は content-addressed (SHA-256) でなければならない。filename-addressed artifacts ("latest.pt") は hard reject。
10. Observability。すべての stage は trace ID、stage name、input hashes、output hash、wall clock、cost を含む structured logs を emit しなければならない。trace ID がない場合、run は事後 debug できない。

review を halt する red flags:
- measurement source のない gate (どの stage も compute しない metric に対する gate)
- downstream stage と checkpoint を share する stage (separation of concerns がない)
- reference model のない alignment stage (KL の anchor がない)
- judge が policy と同じ model family である LLM-as-judge eval (contamination)
- budget を 20% 超えて上回る cost estimate
- "re-run from scratch" だけで構成された rollback plan

出力: gate ごとの PASS/HOLD、各 verdict を生んだ exact manifest field または missing field、HOLD を PASS に変えるための minimum change を含む 2ページの review。
