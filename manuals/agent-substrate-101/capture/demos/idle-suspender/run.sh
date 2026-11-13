#!/usr/bin/env bash
set -u
SPACE=demo-idle
REGISTRY=${REGISTRY:-localhost:5001}
OUT=${OUT:-./out}
IDLE=${IDLE:-30}
MINUTES=${MINUTES:-10}
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
stamp() { date -u +%FT%T.%3NZ; }

template_ready() { K get actor-templates -a "$SPACE" | awk '$2 == "counter" && $3 ~ /-/' | grep -q .; }

setup() {
  local image
  image=$(must docker inspect --format '{{index .RepoDigests 0}}' "$REGISTRY/drill-actor:v1") || exit 1
  must kubectl apply -f "$HERE/pool.yaml" > /dev/null
  must create atespace "$SPACE"
  sed "s#IMAGE#$image#" "$HERE/template.yaml" > /tmp/idle-template.yaml
  must create actor-template -f /tmp/idle-template.yaml
  must kubectl -n "$SPACE" rollout status deploy/idle --timeout=180s > /dev/null
  for _ in $(seq 1 60); do
    template_ready && break
    sleep 2
  done
  must template_ready
  for name in busy bursty rare; do must create actor "$name" -a "$SPACE" --template counter; done
}

request() {
  local reply
  reply=$(curl -s -m 30 -o "/tmp/idle-body-$2" -w '%{http_code}\t%{time_total}' "http://127.0.0.1:$1/$2/")
  printf '%s\t%s\t%s\t%s\n' "$(stamp)" "$2" "$reply" "$(tr -d '\n' < "/tmp/idle-body-$2" | cut -c1-80)" >> "$OUT/$3"
}

traffic() {
  local port=$1 file=$2 seconds=$3 start pids=()
  start=$(date +%s)
  printf 'ts\tactor\thttp\tseconds\tbody\n' > "$OUT/$file"
  ( while [ $(( $(date +%s) - start )) -lt "$seconds" ]; do request "$port" busy "$file"; sleep 5; done ) &
  pids+=($!)
  ( while [ $(( $(date +%s) - start )) -lt "$seconds" ]; do
      for _ in 1 2 3 4 5; do request "$port" bursty "$file"; sleep 1; done
      sleep 145
    done ) &
  pids+=($!)
  ( sleep 60; request "$port" rare "$file"; if [ "$seconds" -gt 420 ]; then sleep 340; request "$port" rare "$file"; fi ) &
  pids+=($!)
  printf 'ts\tworker_actors\tworker_millicores\tbursty\tbusy\trare\n' > "$OUT/capacity-$file"
  while [ $(( $(date +%s) - start )) -lt "$seconds" ]; do
    printf '%s\t%s\t%s\n' "$(stamp)" \
      "$(K get workers -n "$SPACE" | awk 'NR == 2 { print $4 "\t" $5 }')" \
      "$(K get actors -a "$SPACE" -o json | jq -r '[.. | objects | select(.actorTemplate? != null)] | sort_by(.metadata.name) | map(.status.state | sub("ACTOR_STATE_"; "")) | join("\t")')" >> "$OUT/capacity-$file"
    sleep 10
  done
  wait "${pids[@]}"
}

with_suspender() {
  python3 "$HERE/suspender.py" --atespace "$SPACE" --idle "$IDLE" --listen 8080 busy bursty rare > "$OUT/suspender.tsv" 2>&1 &
  local pid=$!
  sleep 8
  traffic 8080 requests-with-suspender.tsv $(( MINUTES * 60 ))
  kill "$pid"
  pkill -f "proxy actor (busy|bursty|rare) " 2>/dev/null
}

without_suspender() {
  for name in busy bursty rare; do K suspend actor "$name" -a "$SPACE" > /dev/null; done
  python3 "$HERE/suspender.py" --atespace "$SPACE" --idle "$IDLE" --listen 8081 --first-port 18180 --dry-run busy bursty rare > "$OUT/suspender-dry-run.tsv" 2>&1 &
  local pid=$!
  sleep 8
  traffic 8081 requests-without-suspender.tsv 120
  kill "$pid"
  pkill -f "proxy actor (busy|bursty|rare) " 2>/dev/null
}

case "${1:-}" in
  setup) setup ;;
  record) with_suspender; without_suspender ;;
  control) without_suspender ;;
  *) echo "usage: $0 setup | record | control" ;;
esac
