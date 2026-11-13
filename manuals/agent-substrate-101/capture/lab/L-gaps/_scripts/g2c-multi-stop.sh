export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
pkill -f "proxy actor"; sleep 1
E=~/evidence/L-gaps/multinode; cd "$E"; S=lab-n; V=multi-worker2
kubectl config use-context kind-multi > /dev/null
mkdir -p invalid; mv 80-stop-before-upload.tsv 81-workers.txt 82-actor-before-revert.yaml 90-* 91-* 92-* invalid/ 2>/dev/null
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
ts() { date -u +%FT%T.%3NZ; }
st() { kubectl ate get actor $1 -a $S -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-"), ((.status.snapshots // []) | map(.owner + ":" + (.durableSnapshot.state // "none") + ":gen" + (.generation|tostring) + ":" + (.locality // "-" | tostring)) | join(","))] | @tsv'; }
nodeof() { kubectl ate get actor $1 -a $S -o json 2>/dev/null | jq -r '.status.assignedNode // "-"'; }
wpod() { K get actor $1 -a $S | awk 'NR==2{print $5}'; }
call() { curl -s -m ${2:-15} -o body.tmp -w '%{http_code}\t%{time_total}' "http://127.0.0.1:$1/"; printf '\t%s' "$(tr -d '\n' < body.tmp | cut -c1-170)"; }
T=x.tsv
m() { echo "$(ts)	$1	$2" >> $T; }
snap() { { echo "### $1 $(ts)"; kubectl get nodes --no-headers | awk '{print $1,$2}'; K get workers; } >> $2 2>&1; }
proxy() { pkill -f "proxy actor $1 "; (kubectl ate proxy actor $1 -a $S $2:80 > proxy-$1.log 2>&1 &); for t in $(seq 1 30); do grep -q Proxying proxy-$1.log 2>/dev/null && break; sleep 0.3; done; }
cleanup() { for a in $(K get actors -a $S | awk 'NR>1{print $2}'); do K revert actor $a -a $S > /dev/null 2>&1; K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1; done; }
R=85-node-return.tsv; [ -f $R ] || echo "ts	event	detail" > $R
nodeup() {
  sg docker -c "docker start $V" > /dev/null 2>&1; s=$(date +%s)
  echo "$(ts)	node-start	$V" >> $R
  for i in $(seq 1 60); do [ "$(kubectl get node $V --no-headers | awk '{print $2}')" = "Ready" ] && break; sleep 2; done
  sleep 15
  pv=$(kubectl get pods -n lab-n -o wide --no-headers | grep -c " $V ")
  echo "$(ts)	pool-pods-on-returned-node	$pv of $(kubectl get pods -n lab-n --no-headers | wc -l)" >> $R
  if [ "$pv" -lt 2 ]; then
    kubectl cordon multi-worker > /dev/null
    for pod in $(kubectl get pods -n lab-n -o wide --no-headers | grep " multi-worker " | awk '{print $1}' | head -2); do kubectl delete pod -n lab-n $pod --wait=false > /dev/null; done
    sleep 5; kubectl -n lab-n rollout status deploy/ballast --timeout=180s > /dev/null 2>&1
    kubectl uncordon multi-worker > /dev/null
    echo "$(ts)	rebalanced	pool pods on $V now $(kubectl get pods -n lab-n -o wide --no-headers | grep -c " $V ")" >> $R
  fi
  for i in $(seq 1 200); do
    K create actor z$i -a $S --template ballast-0 > /dev/null; out=$(K resume actor z$i -a $S | tr '\n' ' ' | cut -c1-120); n=$(nodeof z$i)
    K suspend actor z$i -a $S --mode sync > /dev/null 2>&1; K delete actor z$i -a $S > /dev/null 2>&1
    [ "$n" = "$V" ] && break
    [ $((i % 10)) = 1 ] && echo "$(ts)	waiting	t=$(( $(date +%s) - s ))s node=$(kubectl get node $V --no-headers | awk '{print $2}') lastplacement=$n workers_active=$(K get workers | grep -c WORKER_STATE_ACTIVE)" >> $R
    sleep 2
  done
  echo "$(ts)	first-actor-on-returned-node	t=$(( $(date +%s) - s ))s after $i tries" >> $R
}
mkon() {
  base=$1; tmpl=$2; port=$3; MADE=""
  for k in $(seq 1 30); do
    a=$base$k
    K create actor $a -a $S --template $tmpl > /dev/null; K resume actor $a -a $S > /dev/null
    if [ "$(nodeof $a)" = "$V" ]; then MADE=$a; proxy $a $port; return 0; fi
    K suspend actor $a -a $S --mode sync > /dev/null; K delete actor $a -a $S > /dev/null
  done
  return 1
}
cleanup
nodeup

T=75-stop-after-upload-revert.tsv; echo "ts	event	detail" > $T
if mkon ub ballast-50 8812; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8812)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  m node-stop "docker stop $V"; sg docker -c "docker stop $V" > /dev/null 2>&1; m node-stopped "$V"
  m revert-while-node-down "$(K revert actor $A -a $S | tr '\n' ' ' | cut -c1-220)"; m state "$(st $A)"
  for i in $(seq 1 20); do r="$(call 8812 12)"; m probe "$r	|	$(st $A)"; case "$r" in 200*) break;; esac; sleep 2; done
  m final "$(st $A) pod $(wpod $A)"; snap end 76-workers.txt
else m mkon-failed "no actor on $V"; fi
cleanup; nodeup

T=80-stop-before-upload.tsv; echo "ts	event	detail" > $T
if mkon p ballast-50 8813; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8813)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  for i in 4 5; do m call "$(call 8813)"; done
  K suspend actor $A -a $S > /dev/null; m suspended-async "$(st $A)"
  m node-stop "docker stop $V"; sg docker -c "docker stop $V" > /dev/null 2>&1; m node-stopped "$V"; t0=$(date +%s)
  m first-request "$(call 8813 12)	|	$(st $A)"
  m revert-attempt-1 "$(K revert actor $A -a $S | tr '\n' ' ' | cut -c1-220)"; m state "$(st $A)"
  ok=0
  for i in $(seq 1 12); do r="$(call 8813 12)"; m probe "$r	|	$(st $A)"; case "$r" in 200*) ok=1; break;; esac; sleep 2; done
  if [ $ok = 0 ]; then
    for i in $(seq 1 100); do s="$(st $A)"; case "$s" in ACTOR_STATE_CRASHED*|ACTOR_STATE_SUSPENDED*) break;; esac; sleep 5; done
    m state-after-wait "t=$(( $(date +%s) - t0 ))s $(st $A)"
    m revert-attempt-2 "$(K revert actor $A -a $S | tr '\n' ' ' | cut -c1-220)"; m state "$(st $A)"
    for i in $(seq 1 20); do r="$(call 8813 12)"; m probe-after-revert "$r	|	$(st $A)"; case "$r" in 200*) break;; esac; sleep 2; done
  fi
  m final "$(st $A) pod $(wpod $A)"; snap end 81-workers.txt
  K get actor $A -a $S -o yaml > 82-actor-end.yaml
else m mkon-failed "no actor on $V"; fi
cleanup; nodeup

T=90-stop-while-running.tsv; echo "ts	event	detail" > $T
if mkon q ballast-50 8814; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8814)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  for i in 4 5; do m call "$(call 8814)"; done
  m running "$(st $A)"
  m node-stop "docker stop $V"; sg docker -c "docker stop $V" > /dev/null 2>&1; m node-stopped "$V"; t0=$(date +%s)
  crashed=0
  for i in $(seq 1 150); do
    s="$(st $A)"; r="$(call 8814 6)"; m probe "t=$(( $(date +%s) - t0 ))s	$r	|	$s"
    case "$s" in ACTOR_STATE_CRASHED*) crashed=$((crashed+1));; esac
    [ $crashed -ge 2 ] && break
    [ $i = 15 ] && snap during 91-workers.txt
    sleep 2
  done
  snap after-loop 91-workers.txt
  m revert "$(K revert actor $A -a $S | tr '\n' ' ' | cut -c1-220)"; m state "$(st $A)"
  for i in $(seq 1 20); do r="$(call 8814 12)"; m probe-after-revert "$r	|	$(st $A)"; case "$r" in 200*) break;; esac; sleep 2; done
  m final "$(st $A) pod $(wpod $A)"
else m mkon-failed "no actor on $V"; fi
cleanup; nodeup
snap final 91-workers.txt
kubectl get events -A --sort-by=.lastTimestamp 2>/dev/null | grep -i -E "NodeNotReady|Evict|Taint|deleting|NotReady" | tail -30 | cut -c1-200 > 97-k8s-node-events.txt
for p in $(kubectl -n ate-system get pods -o name | grep ate-controller); do kubectl -n ate-system logs $p --since=60m 2>/dev/null | grep -i -E "crash|unavailable|MarkWorker|DeleteWorker|node" | tail -60 | cut -c1-350; done > 96-controller-events.log
pkill -f "proxy actor"; sudo fstrim -v / > /dev/null
echo TESTS-DONE > 99-done.txt
