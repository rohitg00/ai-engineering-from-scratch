#!/usr/bin/env bash
set -u
SPACE=demo-drill
NODE=${KIND_NODE:-kind-control-plane}
REGISTRY=${REGISTRY:-localhost:5001}
HERE=$(cd "$(dirname "$0")" && pwd)
BODY=$(mktemp)

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
since() { awk -v a="$1" -v b="$(now)" 'BEGIN { printf "%.1f s", b - a }'; }
state() { kubectl ate get actor "$1" -a "$SPACE" -o json 2>/dev/null | jq -r .status.state; }
report() { printf '  %-9s %s\n' "$1" "$2"; }

call() {
  local code
  code=$(curl -s -m "${3:-20}" -o "$BODY" -w '%{http_code} in %{time_total} s' "http://127.0.0.1:$1$2")
  printf '%s: %s' "$code" "$(tr -d '\n' < "$BODY" | cut -c1-120)"
}

wait_state() {
  local start
  start=$(now)
  for _ in $(seq 1 240); do
    if [ "$(state "$1")" = "$2" ]; then
      echo "${2#ACTOR_STATE_} after $(since "$start")"
      return 0
    fi
    sleep 0.25
  done
  echo "no ${2#ACTOR_STATE_} state in $(since "$start"), state $(state "$1")"
  return 1
}

wait_ok() {
  local start
  start=$(now)
  for _ in $(seq 1 180); do
    if [ "$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$1/")" = "200" ]; then
      echo "$2 answers after $(since "$start")"
      return 0
    fi
    sleep 1
  done
  echo "$2 did not answer in $(since "$start")"
  return 1
}

actor() {
  must create actor "$1" -a "$SPACE" --template drill
  kubectl ate proxy actor "$1" -a "$SPACE" "$2:80" > "/tmp/drill-proxy-$1.log" 2>&1 &
  for _ in $(seq 1 40); do
    grep -q Proxying "/tmp/drill-proxy-$1.log" 2>/dev/null && break
    sleep 0.3
  done
}

drop() {
  for name in "$@"; do
    pkill -f "proxy actor $name " 2>/dev/null
    K delete actor "$name" -a "$SPACE" > /dev/null
  done
}

template_ready() { K get actor-templates -a "$SPACE" | awk '$2 == "drill" && $3 ~ /-/' | grep -q .; }

setup() {
  must docker build -q -t "$REGISTRY/drill-actor:v1" "$HERE" > /dev/null
  must docker push -q "$REGISTRY/drill-actor:v1" > /dev/null
  local image
  image=$(must docker inspect --format '{{index .RepoDigests 0}}' "$REGISTRY/drill-actor:v1") || exit 1
  must kubectl apply -f "$HERE/pool.yaml" > /dev/null
  must create atespace "$SPACE"
  sed "s#IMAGE#$image#" "$HERE/template.yaml" > /tmp/drill-template.yaml
  must create actor-template -f /tmp/drill-template.yaml
  must kubectl -n "$SPACE" rollout status deploy/drill --timeout=180s > /dev/null
  for _ in $(seq 1 60); do
    template_ready && break
    sleep 2
  done
  must template_ready
  echo "setup done: image $image"
}

worker_pod_deleted() {
  echo "== 1 worker pod deleted under a running actor"
  actor d1 8701
  call 8701 / > /dev/null
  call 8701 / > /dev/null
  local pod start
  pod=$(K get actor d1 -a "$SPACE" | awk 'NR == 2 { print $5 }' | cut -d/ -f2)
  kubectl -n "$SPACE" delete pod "$pod" --grace-period=0 --force > /dev/null 2>&1
  report detect "$(wait_state d1 ACTOR_STATE_CRASHED)"
  report symptom "$(call 8701 /)"
  report state "$(state d1)"
  start=$(now)
  K revert actor d1 -a "$SPACE" > /dev/null
  report fix "kubectl ate revert actor d1 -a $SPACE ($(since "$start"))"
  kubectl -n "$SPACE" rollout status deploy/drill --timeout=180s > /dev/null
  report recover "$(call 8701 /)"
  drop d1
}

local_snapshot_removed() {
  echo "== 2 node-local snapshot removed before the upload"
  actor d2 8702
  for _ in 1 2 3; do call 8702 / > /dev/null; done
  K suspend actor d2 -a "$SPACE" --mode sync > /dev/null
  for _ in 4 5; do call 8702 / > /dev/null; done
  K suspend actor d2 -a "$SPACE" > /dev/null
  local uid start
  uid=$(kubectl ate get actor d2 -a "$SPACE" -o json 2>/dev/null | jq -r .metadata.uid)
  docker exec "$NODE" rm -rf "/var/lib/ate/snapshots/$uid"
  report symptom "$(call 8702 /)"
  report state "$(state d2)"
  start=$(now)
  K revert actor d2 -a "$SPACE" > /dev/null
  report fix "kubectl ate revert actor d2 -a $SPACE ($(since "$start"))"
  report recover "$(call 8702 /) (durable snapshot held count=3)"
  drop d2
}

process_exit() {
  echo "== 3 the actor process exits inside the sandbox"
  actor d3 8703
  call 8703 / > /dev/null
  K suspend actor d3 -a "$SPACE" --mode sync > /dev/null
  call 8703 / > /dev/null
  call 8703 /exit > /dev/null
  sleep 5
  report symptom "$(call 8703 /)"
  report state "$(state d3) (5 s after the exit)"
  local start
  start=$(now)
  K suspend actor d3 -a "$SPACE" --mode sync > /dev/null
  report detect "suspend fails, state $(state d3)"
  K revert actor d3 -a "$SPACE" > /dev/null
  report fix "kubectl ate suspend actor d3, then kubectl ate revert actor d3 ($(since "$start"))"
  report recover "$(call 8703 /) (durable snapshot held count=1)"
  drop d3
}

out_of_memory() {
  echo "== 4 the actor uses more memory than its limit"
  actor d4 8704
  call 8704 / > /dev/null
  call 8704 /oom > /dev/null
  report detect "$(wait_state d4 ACTOR_STATE_CRASHED)"
  report symptom "$(call 8704 /)"
  report state "$(state d4)"
  local start
  start=$(now)
  K revert actor d4 -a "$SPACE" > /dev/null
  report fix "kubectl ate revert actor d4 -a $SPACE ($(since "$start"))"
  report recover "$(call 8704 /) (new actor from the golden snapshot)"
  drop d4
}

full_pool() {
  echo "== 5 more running actors than the pool has room for"
  actor d5a 8705
  actor d5b 8706
  actor d5c 8707
  call 8705 / > /dev/null
  call 8706 / > /dev/null
  report symptom "$(call 8707 /)"
  report state "d5a $(state d5a), d5b $(state d5b), d5c $(state d5c)"
  local start
  start=$(now)
  K suspend actor d5a -a "$SPACE" > /dev/null
  report fix "kubectl ate suspend actor d5a -a $SPACE ($(since "$start"))"
  report recover "$(call 8707 /)"
  drop d5a d5b d5c
}

restore_postgres() { kubectl -n ate-system scale statefulset postgres --replicas=1 > /dev/null; }

postgres_down() {
  echo "== 6 Postgres is away for 30 s"
  actor d6 8708
  actor d6s 8709
  call 8708 / > /dev/null
  call 8709 / > /dev/null
  K suspend actor d6s -a "$SPACE" --mode sync > /dev/null
  trap 'restore_postgres; exit 1' INT TERM
  trap restore_postgres EXIT
  kubectl -n ate-system scale statefulset postgres --replicas=0 > /dev/null
  sleep 5
  report symptom "running actor: $(call 8708 / 12)"
  report symptom "suspended actor: $(call 8709 / 12)"
  report state "kubectl ate get actor fails: $(K get actor d6 -a "$SPACE" | tail -1 | cut -c1-90)"
  sleep 12
  local start
  start=$(now)
  restore_postgres
  kubectl -n ate-system rollout status statefulset/postgres --timeout=180s > /dev/null
  trap - INT TERM EXIT
  report fix "kubectl -n ate-system scale statefulset postgres --replicas=1 (ready after $(since "$start"))"
  report recover "$(wait_ok 8708 'running actor')"
  report recover "$(wait_ok 8709 'suspended actor')"
  report state "d6 $(state d6), d6s $(state d6s)"
  drop d6 d6s
}

run() {
  worker_pod_deleted
  local_snapshot_removed
  process_exit
  out_of_memory
  full_pool
  postgres_down
  rm -f "$BODY"
}

case "${1:-}" in
  setup) setup ;;
  run) run ;;
  *) echo "usage: $0 setup | run" ;;
esac
