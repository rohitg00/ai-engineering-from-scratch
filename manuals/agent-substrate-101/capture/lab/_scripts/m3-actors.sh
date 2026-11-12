#!/bin/bash
M=$HOME/.cache/aiefs-manuals-wip/substrate-research/mac-run
E=$HOME/.cache/aiefs-manuals-wip/substrate-research/evidence/M-mac-arm64
export PATH="$M/kit:$PATH"; export KUBECONFIG=$M/kind.kubeconfig
mkdir -p "$M/ballast-img" "$E"; cd "$M/ballast-img"
S=lab-c
K() { kubectl-ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { perl -MTime::HiRes=time -e 'printf "%.3f\n", time'; }
el() { perl -MTime::HiRes=time -e 'printf "%.3f", time - $ARGV[0]' "$1"; }
call() { curl -s -m 180 -o body.tmp -w '%{http_code}\t%{time_total}' http://127.0.0.1:$1/; printf '\t%s' "$(tr -d '\n' < body.tmp)"; }
kubectl get pods -A --no-headers | grep -v -E "Running|Completed" > "$E/70-not-running-before.txt"
cp ../kit/ballast-linux-arm64 ballast
printf 'FROM scratch\nCOPY ballast /ballast\nENTRYPOINT ["/ballast"]\n' > Dockerfile
docker build -q -t localhost:5001/ballast:v1 . > "$E/71-build.log" 2>&1 && docker push -q localhost:5001/ballast:v1 >> "$E/71-build.log" 2>&1
DIGEST=$(docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/ballast:v1)
cat > pool.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: lab-c
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata:
  name: ballast
  namespace: lab-c
  labels:
    workload: ballast
spec:
  replicas: 1
  workerImage: ghcr.io/agent-substrate/substrate/ateworker-gvisor:v1.0.0
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits:
        cpu: "2"
        memory: 1500Mi
      requests:
        cpu: 500m
        memory: 1500Mi
EOF
kubectl apply -f pool.yaml > "$E/72-pool.log" 2>&1
K create atespace $S >> "$E/72-pool.log"
for mb in 0 50 200; do
  cat > tmpl-$mb.yaml <<EOF
metadata:
  atespace: lab-c
  name: ballast-$mb
workerSelector:
  matchLabels:
    workload: ballast
containers:
- name: ballast
  image: $DIGEST
  command:
  - /ballast
  - --mb=$mb
  wakeupProbe:
    httpGet:
      path: /readyz
      port: 80
resources:
  limits:
    cpuMillicores: 1000
    memoryBytes: $(( (mb + 256) * 1048576 ))
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
  K create actor-template -f tmpl-$mb.yaml >> "$E/72-pool.log"
done
kubectl -n lab-c rollout status deploy/ballast --timeout=300s >> "$E/72-pool.log" 2>&1
for i in $(seq 1 30); do
  n=$(K get actor-templates -a $S | awk 'NR>1 && $3 ~ /-/' | wc -l | tr -d ' ')
  [ "$n" = "3" ] && break; sleep 5
done
K get actor-templates -a $S > "$E/73-templates.txt"
K get actor-template ballast-50 -a $S -o yaml > "$E/73-template-50.yaml"
kubectl get pods -n lab-c -o wide >> "$E/73-templates.txt"
kubectl -n lab-c describe pods | tail -25 >> "$E/73-templates.txt"
OUT="$E/80-local.tsv"
echo "mb	phase	i	http	seconds	detail" > "$OUT"
port=8100
for mb in 0 50 200; do
  a=m$mb; port=$((port+1))
  s=$(now); K create actor $a -a $S --template ballast-$mb > "$E/81-create-$a.txt"; echo "$mb	create-actor	1	-	$(el $s)	cli" >> "$OUT"
  (kubectl-ate proxy actor $a -a $S $port:80 > proxy-$a.log 2>&1 &)
  for t in $(seq 1 30); do grep -q Proxying proxy-$a.log 2>/dev/null && break; sleep 0.3; done
  echo "$mb	first-call-golden	1	$(call $port)" >> "$OUT"
  echo "$mb	warm-call	1	$(call $port)" >> "$OUT"
  for c in $(seq 1 10); do
    s=$(now); K suspend actor $a -a $S > /dev/null; echo "$mb	suspend-async	$c	-	$(el $s)	cli" >> "$OUT"
    sleep 1
    echo "$mb	resume-local	$c	$(call $port)" >> "$OUT"
    echo "$mb	warm-call	$c	$(call $port)" >> "$OUT"
  done
  K get actor $a -a $S -o yaml > "$E/82-actor-$a.yaml"
  K logs actor $a -a $S --source=lifecycle > "$E/83-lifecycle-$a.log" 2>&1
  K suspend actor $a -a $S --mode sync > /dev/null
done
K get actors -a $S > "$E/84-actors-end.txt"
kubectl -n ate-system logs ds/atelet -c atelet --tail=400 > "$E/85-atelet-tail.log" 2>&1
pkill -f "kubectl-ate proxy actor m"
echo DONE >> "$OUT"
