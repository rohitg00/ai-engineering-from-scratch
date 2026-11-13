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
  for a in $watch; do
    if K get actor $a -a $S | grep -q " $a "; then
      s1=$(now); out=$(K revert actor $a -a $S | tr '\n' ' ' | cut -c1-200); r revert-after-node-return "$a: $(el $s1) s | $out"
      proxy $a 8990
      r request-after-revert "$a: $(call 8990 30)	|	$(st $a)"
      r request-after-revert "$a: $(call 8990 30)	|	$(st $a)"
      pkill -f "proxy actor $a " 2>/dev/null
    else r actor-gone "$a"; fi
  done
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
echo "$(ts) start-tag-cases: pods on $V=$(podsn | awk -v v=$V '$3==v' | wc -l) on $O=$(podsn | awk -v o=$O '$3==o' | wc -l) active-on-$V=$(vworkers_active)" >> 00-run.log
echo "$(ts) start-tags" >> 00-run.log
kc -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args|join(" "))' > 01-atelet-args.txt
snap start 02-start.txt



T=80-tag-rescue.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon t ballast-50 8911; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8911)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  s0=$(now); m create-tag-while-suspended "$(el $s0) s | $(K create tag keep-$A -a $S --actor $A | tr '\n' ' ' | cut -c1-220)"
  K get tags -a $S > 81-tags.txt 2>&1
  stopnode; prober $A 8911
  for w in 30 60 120 240 400; do
    while [ "$(echo "$(el $T0) < $w" | bc -l)" = 1 ]; do sleep 1; done
    m tag-attempt-on-stuck-actor "state=$(st $A | cut -f1) | $(K create tag late-$A-$w -a $S --actor $A | tr '\n' ' ' | cut -c1-220)"
    if [ $w = 60 ]; then
      s0=$(now); m create-from-tag "$(K create actor ${A}r -a $S --template ballast-50 --tag keep-$A | tr '\n' ' ' | cut -c1-220)"
      proxy ${A}r 8912
      m rescue-first-request "$(el $s0) s after create | $(call 8912 30)	|	$(st ${A}r)"
      m rescue-second-request "$(call 8912 30)	|	$(st ${A}r) pod $(wpod ${A}r)"
      K get actor ${A}r -a $S -o yaml > 82-rescued-actor.yaml
    fi
  done
  touch stop-probe-$A; sleep 3
  m original-final "$(st $A)"
else m mkon-failed "no actor on $V"; fi
nodeup tag $A

T=85-tag-rescue-running-and-pending.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon u ballast-50 8913; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8913)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  m create-tag "$(K create tag keep-$A -a $S --actor $A | tr '\n' ' ' | cut -c1-200)"
  for i in 4 5; do m call "$(call 8913)"; done
  K suspend actor $A -a $S > /dev/null; m suspended-async "$(st $A)"
  m tag-attempt-on-pending-snapshot "$(K create tag pend-$A -a $S --actor $A | tr '\n' ' ' | cut -c1-220)"
  for i in 6 7; do m call "$(call 8913)"; done
  m running "$(st $A)"
  stopnode; prober $A 8913
  while [ "$(echo "$(el $T0) < 60" | bc -l)" = 1 ]; do sleep 1; done
  for tg in keep-$A pend-$A; do
    if K get tags -a $S | grep -q " $tg "; then
      s0=$(now); m create-from-tag "$tg | $(K create actor r-$tg -a $S --template ballast-50 --tag $tg | tr '\n' ' ' | cut -c1-200)"
      proxy r-$tg 8914
      m rescue-first-request "$tg | $(el $s0) s after create | $(call 8914 30)	|	$(st r-$tg)"
      pkill -f "proxy actor r-$tg " 2>/dev/null
    else m tag-missing "$tg"; fi
  done
  touch stop-probe-$A; sleep 3
  m original-final "$(st $A)"
  K get tags -a $S > 86-tags.txt 2>&1
else m mkon-failed "no actor on $V"; fi
nodeup tag2 $A
T=88-pending-snapshot-node-returns.tsv; echo "ts	t	event	detail" > $T; T0=0
ok=1; mkon v ballast-50 8921 || ok=0; AV=$MADE; mkon w ballast-50 8922 || ok=0; AW=$MADE
if [ $ok = 1 ]; then
  for A in $AV $AW; do
    port=8921; [ $A = $AW ] && port=8922
    m actor "$A on $(nodeof $A)"
    for i in 1 2 3; do m "$A-call" "$(call $port)"; done
    K suspend actor $A -a $S --mode sync > /dev/null
    for i in 4 5; do m "$A-call" "$(call $port)"; done
    K suspend actor $A -a $S > /dev/null; m "$A-suspended-async" "$(st $A)"
  done
  stopnode
  sleep 80; m state-while-down "$AV: $(st $AV | cut -f1,2 | tr '\t' ' ') | $AW: $(st $AW | cut -f1,2 | tr '\t' ' ')"
  sg docker -c "docker start $V" > /dev/null 2>&1; m node-start "after $(el $T0) s"
  for i in $(seq 1 60); do [ "$(kc get node $V --no-headers | awk '{print $2}')" = "Ready" ] && break; sleep 2; done
  for i in $(seq 1 60); do [ "$(vworkers_active)" -ge 2 ] && break; sleep 3; done
  m workers-active-again "$(vworkers_active) on $V"
  proxy $AW 8922
  m "$AW-request-without-revert" "$(call 8922 30)	|	$(st $AW)"
  m "$AW-second-request" "$(call 8922 30)	|	$(st $AW)"
  s1=$(now); m "$AV-revert" "$(el $s1) s | $(K revert actor $AV -a $S | tr '\n' ' ' | cut -c1-200)"
  proxy $AV 8921
  m "$AV-request-after-revert" "$(call 8921 30)	|	$(st $AV)"
  K get actor $AW -a $S -o yaml > 89-w-actor.yaml; K get actor $AV -a $S -o yaml > 89-v-actor.yaml
else m mkon-failed "no two actors on $V"; fi
T0=$(now); nodeup pend
for tg in $(K get tags -a $S | awk 'NR>1{print $2}'); do K delete tag $tg -a $S > /dev/null 2>&1; done
pkill -f "context $C proxy actor"; sudo fstrim -v / > /dev/null
echo "$(ts) TAG-TESTS-DONE" >> 00-run.log
