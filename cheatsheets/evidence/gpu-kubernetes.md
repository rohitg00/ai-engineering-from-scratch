# Evidence: cheatsheets/gpu-kubernetes.md

Abbreviations: P17 = phases/17-infrastructure-and-production, L03 = P17/03-gpu-autoscaling-kubernetes, L10 = P17/10-cold-start-mitigation, L11 = P17/11-multi-region-kv-locality, d = docs/en.md, c = code/main.py, KES = projects/kubernetes-event-storyboard, S1 = projects/kubernetes-event-storyboard/stages/01-parse-snapshots, S2 = projects/kubernetes-event-storyboard/stages/02-group-occurrences, S3 = projects/kubernetes-event-storyboard/stages/03-connect-revisions, S4 = projects/kubernetes-event-storyboard/stages/04-export-storyboard.

## Tasks (task-table)
- consolidationPolicy: WhenEmpty: L03/d:39
- consolidateAfter: 1h: L03/d:40, 43
- WhenEmptyOrUnderutilized evicts: L03/d:33
- DCGM_FI_DEV_GPU_UTIL is the wrong signal: L03/d:59, 94
- min_workers=1 warm pool: L03/d:88, L10/d:46
- snapshot ID in EC2NodeClass: L10/d:34
- kv.cache.block_added routing: L11/d:33
- simulate(strategy, reqs): L03/c:55

## Safe disruption for GPU pools (annotated-code)
- disruption, consolidationPolicy: WhenEmpty, consolidateAfter: 1h: L03/d:37-41
- never evict a running job, empty nodes after an hour: L03/d:43

## Three autoscaling layers (architecture, 7 nodes, 7 edges)
- Pending pods, 8 H100s, Karpenter NodePool: L03/d:31
- ~45-60s: L03/d:31, 92
- KAI Scheduler gang, topology, queues: L03/d:47-53, 123
- NVLink domain: L03/d:51
- Dynamo Planner, llm-d WVA scale replicas: L03/d:70, 78
- Signals queue depth, KV cache utilization: L03/d:63-66
- vLLM replicas serve requests: L03/d:61, 13

## Scaling strategies in main.py (comparison)
- DUTY_CYCLE util > TARGET_GPU_UTIL, replicas_target += 1, util < 20: L03/c:90-101
- QUEUE_DEPTH qd > 5, max(1, qd // 5), qd == 0: L03/c:102-107
- KAI_GANG qd > 3, max(2, qd // 3), qd == 0: L03/c:108-113
- len(queue): L03/c:103, 109
- Results: L03/c:172-174

## Simulator constants (defaults)
- NODE_PROVISION_SEC 50: L03/c:18
- CLUSTER_AUTOSCALER_SEC 110: L03/c:19
- MODEL_LOAD_SEC 45: L03/c:20
- HPA_TICK_SEC 15: L03/c:26
- TARGET_GPU_UTIL 70: L03/c:27
- MAX_REPLICAS 16: L03/c:24
- CACHE_HIT_MS 80: L11/c:21
- CACHE_MISS_MS 800: L11/c:22

## Cache-aware routing (flow)
1. hash the prefix, first 512 tokens: L11/d:31
2. replicas publish KV-cache events: L11/d:31
3. vLLM Router kv.cache.block_added index: L11/d:33
4. pick the replica with the match: L11/d:31
5. least-queue-depth fallthrough: L11/d:33
6. GLOBAL adds rtt, falls back above CACHE_MISS_MS: L11/c:90-100
7. partition by residency boundary: L11/d:81

## Troubleshooting (troubleshooting)
- HPA never scales at 100%, 10 or 100 requests: L03/d:19, 59
- memory HPA never scales down, pre-allocated KV: L03/d:61
- 7 of 8 pods wait, gang scheduling: L03/d:23, 49
- WhenEmptyOrUnderutilized evicts running requests: L03/d:33, 95
- 2 a.m. timeout, 3 minutes provisioning: L03/d:21. Warm pool: L03/d:88
- hit rate 8% with round-robin: L11/d:19
- replica refuses to start, missing tokenizer and quant config: L11/d:23, 64-69. Three-file manifest: L11/d:71-75
- separate Services with per-role HPA: L03/d:84

## Event storyboard project (annotated-code)
- project_test.py --init, --stage 1 --strict, --all --solution --strict: KES/README.md:15-17
- cd solution, go run . --input fixtures/rollout.json --out /tmp/context-pack.json: KES/README.md:25-26
- node --experimental-strip-types cli.ts /tmp/context-pack.json /tmp/timeline.html: KES/README.md:27
- kubectl get events -A -o json: S1/docs/en.md:40

## Storyboard stages (flow)
1. Parse([]byte)(Bundle,error), observedAt, items arrays: S1/docs/en.md:25, KES/solution/main.go:93-98
2. Group(Bundle)([]Row,error), max count then sum: S2/docs/en.md:13, 25, KES/solution/main.go:142-167
3. ownerReferences, deployment.kubernetes.io/revision: S3/docs/en.md:13, 25, KES/solution/main.go:213
4. Export(Bundle)(Pack,error), schemaVersion 1, redactions: S4/docs/en.md:13, 25, KES/solution/main.go:238
5. parsePack(text) checks: S4/docs/en.md:25, KES/solution/main.ts:1-28
6. timeline(pack) escaped HTML, Warning filter: S4/docs/en.md:13, 25, KES/solution/main.ts:37-45

## Storyboard errors (command-table)
- bundle exceeds one MiB, 1<<20: KES/solution/main.go:82-83
- trailing JSON: KES/solution/main.go:91
- observedAt must be RFC3339: KES/solution/main.go:94
- invalid occurrence range or count: KES/solution/main.go:122-123
- event UID changed identity: KES/solution/main.go:139-140
- invalid or duplicate workload UID: KES/solution/main.go:128-129
- invalid context pack: KES/solution/main.ts:10

## Q&A (qa)
- Karpenter ~45-60s vs Cluster Autoscaler ~90-120s: L03/d:92
- prefill on queue depth, decode on KV pressure: L03/d:84
- 440 ms round-trip vs 800 to 80 ms, keep regional: L11/d:54
- 80 vs 800 ms, 10x: L11/d:42-45
- counts 2 and 4 give 4, not 6: S2/docs/en.md:17
- conflicting revisions stay unknown, not by name: S3/docs/en.md:13, 17

## Tips (tips)
- tokenizer.json, tokenizer.model: L11/d:66
- quantize_config.json, vllm_config.yaml: L11/d:67, 69
- DR drill quarterly: L11/d:77
- KAI secondary scheduler, annotate workloads: L03/d:55
- tensor-parallel on one NVLink domain: L03/d:51
- min_workers=1-2 for live chat, voice agent: L10/d:62
