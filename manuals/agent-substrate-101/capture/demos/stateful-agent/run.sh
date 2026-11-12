#!/usr/bin/env bash
set -u
SPACE=demo-agent
REGISTRY=${REGISTRY:-localhost:5001}
OUT=${OUT:-./out}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"

K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }

setup() {
  docker build -q -t "$REGISTRY/stateful-agent:v1" "$HERE" > /dev/null
  docker push -q "$REGISTRY/stateful-agent:v1" > /dev/null
  local image
  image=$(docker inspect --format '{{index .RepoDigests 0}}' "$REGISTRY/stateful-agent:v1")
  sed "s#IMAGE#$image#" "$HERE/cluster.yaml" | kubectl apply -f - > /dev/null
  kubectl -n ate-system create configmap k8s-credential-provider-namespace-policy \
    --from-file=namespace-policy.yaml="$HERE/provider-policy.yaml" --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1
  kubectl -n ate-system rollout restart deploy/k8s-credential-provider > /dev/null
  kubectl -n ate-system rollout status deploy/k8s-credential-provider --timeout=120s > /dev/null
  kubectl -n "$SPACE" rollout status deploy/mock-llm --timeout=180s > /dev/null
  kubectl -n "$SPACE" rollout status deploy/agent --timeout=180s > /dev/null
  K create atespace "$SPACE" > /dev/null
  for pair in memory:SNAPSHOT_FIDELITY_MEMORY volumes:SNAPSHOT_FIDELITY_VOLUMES; do
    sed -e "s#IMAGE#$image#" -e "s#FIDELITY_NAME#${pair%%:*}#" -e "s#FIDELITY_VALUE#${pair##*:}#" "$HERE/template.yaml" > "/tmp/agent-${pair%%:*}.yaml"
    K create actor-template -f "/tmp/agent-${pair%%:*}.yaml" > /dev/null
  done
  sleep 30
  K get actor-templates -a "$SPACE"
}

post() {
  curl -s -m 60 -o /tmp/agent-body -w '%{http_code}\t%{time_total}' -X POST -H 'Content-Type: application/json' \
    -d "{\"message\": \"$3\"}" "http://127.0.0.1:$1$2"
}

session() {
  local kind=$1 port=$2 name=agent-$1-1 log="$OUT/session-$1.tsv"
  K create actor "$name" -a "$SPACE" --template "agent-$kind" > /dev/null
  K create egress-policy "$name" -a "$SPACE" -f "$HERE/egress-policy.yaml" > "$OUT/egress-policy-$kind.txt"
  kubectl ate proxy actor "$name" -a "$SPACE" "$port:80" > "/tmp/agent-proxy-$kind.log" 2>&1 &
  for _ in $(seq 1 40); do grep -q Proxying "/tmp/agent-proxy-$kind.log" 2>/dev/null && break; sleep 0.3; done
  printf 'step\thttp\tseconds\treply\n' > "$log"
  row() { printf '%s\t%s\t%s\n' "$1" "$2" "$(tr -d '\n' < /tmp/agent-body | cut -c1-400)" >> "$log"; }
  row "turn 1, new actor" "$(post "$port" /chat 'my name is Ada')"
  row "note, memory only" "$(post "$port" /note 'remember the number 42')"
  row "turn 2, warm" "$(post "$port" /chat 'what is my name')"
  for cycle in 1 2 3; do
    K suspend actor "$name" -a "$SPACE" --mode sync > /dev/null
    row "turn $((cycle + 2)), after suspend $cycle" "$(post "$port" /chat "message after suspend $cycle")"
    curl -s -m 30 "http://127.0.0.1:$port/history" > "$OUT/history-$kind-after-suspend-$cycle.json"
    row "turn $((cycle + 2))b, warm" "$(post "$port" /chat "warm message $cycle")"
  done
  K get actor "$name" -a "$SPACE" -o yaml > "$OUT/actor-$kind.yaml"
  K get egress-policy "$name" -a "$SPACE" -o yaml > "$OUT/egress-policy-$kind-live.yaml"
  K logs actor "$name" -a "$SPACE" --source=lifecycle > "$OUT/lifecycle-$kind.log" 2>&1
  K suspend actor "$name" -a "$SPACE" --mode sync > /dev/null
  pkill -f "proxy actor $name " 2>/dev/null
}

record() {
  session memory 8801
  session volumes 8802
  kubectl -n "$SPACE" logs deploy/mock-llm > "$OUT/mock-llm.log" 2>&1
}

case "${1:-}" in
  setup) setup ;;
  record) record ;;
  *) echo "usage: $0 setup | record" ;;
esac
