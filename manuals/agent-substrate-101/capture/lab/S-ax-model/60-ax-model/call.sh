i=$1
t0=$(date +%s.%N)
curl -s -m 120 -o /tmp/resp.json -w "%{http_code} %{time_total}" "$MODEL_URL" -H 'Content-Type: application/json' -d "{\"model\":\"qwen2.5:3b\",\"seed\":$i,\"max_tokens\":80,\"messages\":[{\"role\":\"user\",\"content\":\"In one sentence, what does a file system snapshot keep?\"}]}"
echo " $(tr -d '\n' < /tmp/resp.json | sed 's/.*"usage":{\([^}]*\)}.*/\1/') $(tr -d '\n' < /tmp/resp.json | sed 's/.*"content":"\([^"]*\)".*/\1/' | cut -c1-120)"
