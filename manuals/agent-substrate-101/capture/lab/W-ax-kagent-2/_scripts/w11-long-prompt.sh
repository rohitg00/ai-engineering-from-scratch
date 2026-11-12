set -u
E=~/evidence/W-ax-kagent-2/11-long-prompt; mkdir -p $E; cd $E; rm -f results.tsv
ask() {
  n=$1; body=$2
  s=$(date +%s.%N)
  curl -s -m 75 -H 'Content-Type: application/json' -d "$body" http://172.18.0.5:11434/v1/chat/completions > "$n.json" 2> "$n.err"; rc=$?
  d=$(echo "$(date +%s.%N) - $s" | bc)
  printf '%s\trc=%s\t%.1fs\tfinish=%s\tcompletion_tokens=%s\tchars=%s\n' "$n" "$rc" "$d" "$(jq -r '.choices[0].finish_reason // "none"' "$n.json" 2>/dev/null)" "$(jq -r '.usage.completion_tokens // "none"' "$n.json" 2>/dev/null)" "$(jq -r '.choices[0].message.content // "" | length' "$n.json" 2>/dev/null)" | tee -a results.tsv
}
M='"model":"qwen2.5:1.5b","stream":false'
ask p1-count "{$M,\"messages\":[{\"role\":\"user\",\"content\":\"Count from 1 to 3000. Write every number on its own line. Do not skip any number and do not summarize.\"}]}"
ask p2-story "{$M,\"messages\":[{\"role\":\"user\",\"content\":\"Write a very long and detailed story of at least 4000 words about a ship that crosses an ocean. Do not stop early.\"}]}"
ask p3-count-bounded "{$M,\"max_tokens\":40,\"messages\":[{\"role\":\"user\",\"content\":\"Count from 1 to 3000. Write every number on its own line. Do not skip any number and do not summarize.\"}]}"
docker exec ollama ollama ps
cat results.tsv
