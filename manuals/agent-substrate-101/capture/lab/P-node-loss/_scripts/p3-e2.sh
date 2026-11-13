export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-multi; S=lab-n; V=multi-worker2; O=multi-worker
E=~/evidence/P-node-loss; mkdir -p "$E"; cd "$E"
pkill -f "context $C proxy actor" 2>/dev/null; true
kc() { kubectl --context $C "$@"; }
podsn() { kubectl --context $C get pods -n $S --no-headers -o custom-columns=N:.metadata.name,P:.status.phase,NODE:.spec.nodeName; }
K() { kubectl ate --context $C "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
ts() { date -u +%FT%T.%3NZ; }
now() { date +%s.%N; }
el() { echo "$(now) - $1" | bc -l | xargs printf '%.1f'; }
st() { kubectl ate --context $C get actor $1 -a $S -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-"), ((.status.snapshots // []) | map(.owner + ":" + (.durableSnapshot.state // "none") + ":gen" + (.generation|tostring) + ":" + (.locality // "-" | tostring)) | join(","))] | @tsv'; }
nodeof() { kubectl ate --context $C get actor $1 -a $S -o json 2>/dev/null | jq -r '.status.assignedNode // "-"'; }
wpod() { K get actor $1 -a $S | awk 'NR==2{print $5}'; }
call() { curl -s -m ${2:-12} -o body-$1.tmp -w '%{http_code}\t%{time_total}' "http://127.0.0.1:$1/"; printf '\t%s' "$(tr -d '\n' < body-$1.tmp | cut -c1-150)"; }
T=x.tsv; T0=0
m() { echo "$(ts)	t=$( [ "$T0" = 0 ] && echo - || el $T0 )	$1	$2" >> $T; }
snap() { { echo "### $1 $(ts)"; kc get nodes --no-headers | awk '{print $1,$2}'; kc get pods -n $S -o wide --no-headers | awk '{print $1,$3,$7}'; K get workers; } >> $2 2>&1; }
proxy() { pkill -f "proxy actor $1 " 2>/dev/null; (kubectl ate --context $C proxy actor $1 -a $S $2:80 > proxy-$1.log 2>&1 &); for t in $(seq 1 30); do grep -q Proxying proxy-$1.log 2>/dev/null && break; sleep 0.3; done; }
vworkers_active() { n=0; for p in $(podsn | awk -v v=$V '$3==v{print $1}'); do K get workers | grep "$S/$p" | grep -q WORKER_STATE_ACTIVE && n=$((n+1)); done; echo $n; }
wait_unavailable() { for i in $(seq 1 90); do [ "$(vworkers_active)" = "0" ] && break; sleep 2; done; m workers-of-stopped-node-not-active "$(K get workers | awk 'NR>1{print $3}' | sort | uniq -c | tr '\n' ' ')"; }
prober() { a=$1; port=$2; rm -f stop-probe-$a; (while [ ! -f stop-probe-$a ]; do r="$(call $port 10)"; case "$r" in 000*) proxy $a $port;; esac; m probe "$r	|	$(st $a)"; sleep 2; done &) ; }
okcount() { grep -c "	probe	200" $T; }
delall() { for a in $(K get actors -a $S | awk 'NR>1{print $2}'); do K revert actor $a -a $S > /dev/null 2>&1; K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1; done; }
mkon() {
  base=$1; tmpl=$2; port=$3; want=${4:-$V}; MADE=""
  for k in $(seq 1 40); do
    a=$base$k
    K create actor $a -a $S --template $tmpl > /dev/null; K resume actor $a -a $S > /dev/null
    if [ "$(nodeof $a)" = "$want" ]; then MADE=$a; [ "$port" != 0 ] && proxy $a $port; return 0; fi
    K suspend actor $a -a $S --mode sync > /dev/null; K delete actor $a -a $S > /dev/null
  done
  return 1
}
stopnode() { m node-stop "docker stop $V"; T0=$(now); sg docker -c "docker stop $V" > /dev/null 2>&1; m node-stopped "$V"; }
nodeup() {
  label=$1; shift; watch="$*"; R=return-$label.tsv; echo "ts	t	event	detail" > $R
  r() { echo "$(ts)	t=$(el $N0)	$1	$2" >> $R; }
  N0=$(now); sg docker -c "docker start $V" > /dev/null 2>&1; r node-start "$V after outage of $(el $T0) s"
  for i in $(seq 1 60); do [ "$(kc get node $V --no-headers | awk '{print $2}')" = "Ready" ] && break; sleep 2; done; r node-ready "$V"
  landed=0
  for i in $(seq 1 36); do
    pv=$(podsn | awk -v v=$V '$3==v && $2=="Running"' | wc -l); wa=$(vworkers_active)
    K create actor z$label$i -a $S --template ballast-0 > /dev/null; K resume actor z$label$i -a $S > /dev/null 2>&1; n=$(nodeof z$label$i)
    K suspend actor z$label$i -a $S --mode sync > /dev/null 2>&1; K delete actor z$label$i -a $S > /dev/null 2>&1
    line="pool-pods-running-on-node=$pv workers-active-on-node=$wa placement=$n"
    for a in $watch; do line="$line | $a: $(st $a | cut -f1,2 | tr '\t' ' ')"; done
    r watch "$line"
    if [ "$n" = "$V" ] && [ $landed = 0 ]; then landed=1; r first-actor-on-returned-node "no pods moved by hand"; fi
    [ $landed = 1 ] && [ $i -ge 12 ] && break
    sleep 4
  done
  [ $landed = 0 ] && r no-actor-on-returned-node "after $(el $N0) s, pool pods on node: $pv"
  for a in $watch; do r final-state "$a: $(st $a)"; done
  snap "after-return-$label" workers-$label.txt
  T0=0
  delall
  pv=$(podsn | awk -v v=$V '$3==v && $2=="Running"' | wc -l)
  if [ "$pv" -lt 2 ]; then
    kc cordon $O > /dev/null
    for pod in $(podsn | awk -v o=$O '$3==o{print $1}' | head -2); do kc delete pod -n $S $pod --wait=false > /dev/null; done
    sleep 5; kc -n $S rollout status deploy/ballast --timeout=180s > /dev/null 2>&1
    kc uncordon $O > /dev/null
    r rebalanced-by-hand "pool pods on $V now $(podsn | awk -v v=$V '$3==v' | wc -l) (setup for the next case)"
  fi
  for i in $(seq 1 60); do [ "$(vworkers_active)" -ge 2 ] && break; sleep 3; done
  r ready-for-next-case "workers active on $V: $(vworkers_active)"
}
revert_loop() {
  a=$1; from=$2; until=$3; want=${4:-3}
  while [ "$(echo "$(el $T0) < $from" | bc -l)" = 1 ]; do sleep 1; done
  while [ "$(echo "$(el $T0) < $until" | bc -l)" = 1 ]; do
    [ "$(okcount)" -ge $want ] && break
    s=$(st $a | cut -f1)
    case "$s" in ACTOR_STATE_RUNNING) : ;; esac
    out=$(K revert actor $a -a $S | tr '\n' ' ' | cut -c1-230); m revert-attempt "state-before=$s | $out"
    sleep 15
  done
}
sg docker -c "docker start $V" > /dev/null 2>&1
for i in $(seq 1 60); do [ "$(kc get node $V --no-headers | awk '{print $2}')" = "Ready" ] && break; sleep 2; done
kc uncordon $O > /dev/null 2>&1; kc uncordon $V > /dev/null 2>&1
delall
for i in 1 2 3; do
  nv=$(podsn | awk -v v=$V '$3==v' | wc -l); no=$(podsn | awk -v o=$O '$3==o' | wc -l)
  [ "$nv" = 2 ] && [ "$no" = 2 ] && break
  kc -n $S delete pods --all --wait=true > /dev/null 2>&1; sleep 3; kc -n $S rollout status deploy/ballast --timeout=180s > /dev/null 2>&1
done
for i in $(seq 1 60); do [ "$(vworkers_active)" -ge 2 ] && break; sleep 3; done
echo "$(ts) start-e2: pods on $V=$(podsn | awk -v v=$V '$3==v' | wc -l) on $O=$(podsn | awk -v o=$O '$3==o' | wc -l) active-on-$V=$(vworkers_active)" >> 00-run.log
echo "$(ts) start-e2-cases" >> 00-run.log
kc -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args|join(" "))' > 01-atelet-args.txt
snap start 02-start.txt


T=74-second-revert.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon i ballast-50 8931; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8931)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  for i in 4 5; do m call "$(call 8931)"; done
  m resume-on-running-table "$(K resume actor $A -a $S | tr '\n' ' ' | cut -c1-220)"
  m resume-on-running-json "$(kubectl ate --context $C resume actor $A -a $S -o json 2>&1 | grep -v '^Warning' | tr -d '\n' | cut -c1-400)"
  m call-after-resume-on-running "$(call 8931)"
  stopnode
  rv() { s1=$(now); out=$(K revert actor $A -a $S | tr '\n' ' ' | cut -c1-230); m "$1" "$(el $s1) s | $out"; m state "$(st $A)"; }
  rv revert-1-right-after-stop
  wait_unavailable
  rv revert-2-after-workers-unavailable
  sleep 20; rv revert-3-twenty-seconds-later
  m request "$(call 8931 12)	|	$(st $A)"
  pods_before=$(podsn | awk -v v=$V '$3==v{print $1}' | tr '\n' ' ')
  for i in $(seq 1 240); do gone=1; for p in $pods_before; do kc get pod -n $S $p --no-headers 2>/dev/null | grep -q -v Terminating && gone=0; done; [ $gone = 1 ] && break; sleep 3; done
  m pods-evicted "$(K get workers | awk 'NR>1{print $3}' | sort | uniq -c | tr '\n' ' ')"
  sleep 20; rv revert-4-after-eviction
  m request "$(call 8931 12)	|	$(st $A)"
  sg docker -c "docker start $V" > /dev/null 2>&1; m node-start "after $(el $T0) s"
  for i in $(seq 1 60); do [ "$(kc get node $V --no-headers | awk '{print $2}')" = "Ready" ] && break; sleep 2; done
  for i in $(seq 1 60); do kc -n ate-system get pods -o wide --no-headers | grep atelet | grep " $V " | grep -q Running && break; sleep 2; done
  sleep 10; m atelet-on-node-running "$(kc -n ate-system get pods -o wide --no-headers | grep atelet | awk '{print $1":"$3}' | tr '\n' ' ')"
  m state-before-revert-5 "$(st $A)"
  rv revert-5-after-node-return
  proxy $A 8931
  m request-after-revert-5 "$(call 8931 30)	|	$(st $A) pod $(wpod $A)"
  m request-after-revert-5 "$(call 8931 30)	|	$(st $A)"
  K get actor $A -a $S -o yaml > 75-second-revert-actor.yaml
else m mkon-failed "no actor on $V"; fi
T0=$(now); nodeup rev $A
T=72-e2-survivor-full-then-scale.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon h ballast-50 8908; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8908)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  filled=0
  for k in $(seq 1 120); do
    [ $filled -ge 16 ] && break
    f=fill$k; K create actor $f -a $S --template ballast-0 > /dev/null; K resume actor $f -a $S > /dev/null 2>&1
    if [ "$(nodeof $f)" = "$O" ] && [ "$(st $f | cut -f1)" = "ACTOR_STATE_RUNNING" ]; then filled=$((filled+1)); else K suspend actor $f -a $S --mode sync > /dev/null 2>&1; K delete actor $f -a $S > /dev/null 2>&1; fi
  done
  m survivor-filled "$filled running actors on $O"; snap e2-filled workers-e2.txt
  stopnode; wait_unavailable
  out=$(K revert actor $A -a $S | tr '\n' ' ' | cut -c1-230); m revert "$out"; m state "$(st $A)"
  m request-no-spare "$(call 8908 30)	|	$(st $A)"
  m request-no-spare "$(call 8908 30)	|	$(st $A)"
  s0=$(now); m scale-up "$(kc -n $S scale workerpool ballast --replicas=6 2>&1 | tr '\n' ' ')"
  for i in $(seq 1 120); do r="$(call 8908 12)"; m probe-after-scale "$(el $s0) s after scale	$r	|	$(st $A)"; case "$r" in 200*) break;; esac; sleep 2; done
  m pods "$(kc get pods -n $S -o wide --no-headers | awk '{print $1":"$3":"$7}' | tr '\n' ' ')"
  snap e2-after-scale workers-e2.txt
  m final "$(st $A) pod $(wpod $A)"
else m mkon-failed "no actor on $V"; fi
nodeup e2scale $A
kc -n $S scale workerpool ballast --replicas=4 > /dev/null 2>&1
sleep 25
for i in 1 2 3; do
  nv=$(podsn | awk -v v=$V '$3==v' | wc -l); no=$(podsn | awk -v o=$O '$3==o' | wc -l)
  [ "$nv" = 2 ] && [ "$no" = 2 ] && break
  kc -n $S delete pods --all --wait=true > /dev/null 2>&1; sleep 3; kc -n $S rollout status deploy/ballast --timeout=180s > /dev/null 2>&1
done
snap final 95-final.txt
kc get events -A --sort-by=.lastTimestamp 2>/dev/null | grep -i -E "NodeNotReady|Evict|Taint|NotReady" | tail -40 | cut -c1-200 > 91-k8s-node-events.txt
for p in $(kc -n ate-system get pods -o name | grep -E "ate-api-server|ate-controller"); do kc -n ate-system logs $p --all-containers --since=150m 2>/dev/null | grep -i -E "MarkWorkerUnavailable|crash|Detach|DeleteWorker" | tail -80 | cut -c1-330; done > 92-control-plane-events.log
pkill -f "context $C proxy actor"; sudo fstrim -v / > /dev/null
echo "$(ts) E2-DONE" >> 00-run.log
