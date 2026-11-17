#!/bin/bash
out=$1
{ echo "# uptime $(uptime)"; echo "# three identical /api/chat calls to qwen3:4b-instruct-2507-q4_K_M"; echo "call prompt_eval_count eval_count prompt_eval_ms total_ms"; } > "$out"
for i in 1 2 3; do
  curl -s localhost:11434/api/chat -d '{"model":"qwen3:4b-instruct-2507-q4_K_M","stream":false,"think":false,"options":{"temperature":0,"seed":42,"num_predict":20},"messages":[{"role":"system","content":"You are the support assistant for an outdoor gear shop. Use tools to look up orders and help-center answers; never invent order data. Refunds need human approval. Keep replies short."},{"role":"user","content":"How long do I have to return an item? Answer in five words."}]}' \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print($i, d.get('prompt_eval_count'), d.get('eval_count'), round(d['prompt_eval_duration']/1e6,1), round(d['total_duration']/1e6,1))" >> "$out"
done
cat "$out"
