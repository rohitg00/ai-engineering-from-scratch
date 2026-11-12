. ~/scripts/t-lib.sh
pkill -f "context $C proxy actor" 2>/dev/null
stopnode() { m node-stop "docker stop $V"; T0=$(now); sg docker -c "docker stop $V" > /dev/null 2>&1; m node-stopped "$V"; }
nodeback() {
  m node-start "docker start $V after $(el $T0) s"; sg docker -c "docker start $V" > /dev/null 2>&1
  for i in $(seq 1 60); do [ "$(kc get node $V --no-headers | awk '{print $2}')" = "Ready" ] && break; sleep 2; done
  for i in $(seq 1 60); do kc -n ate-system get pods -o wide --no-headers | grep atelet | grep " $V " | grep -q Running && break; sleep 2; done
  sleep 10; m node-ready "$(kc get nodes --no-headers | awk '{print $1":"$2}' | tr '\n' ' ')"
  T0=0; delall; rebalance
}
fill() {
  FILLERS=""
  for n in 1 2; do
    if mkon fill$n- tb-big 0 $O; then FILLERS="$FILLERS $MADE"; else m fill-failed "filler $n did not land on $O"; fi
  done
  m survivor-filled "fillers on $O:$FILLERS | workers: $(workline)"
}
reqloop() {
  label=$1; rport=$2; max=$3; s0=$4
  for i in $(seq 1 $max); do r="$(call $rport 12)"; m "$label" "$(el $s0) s	$r	|	$(st $A)"; case "$r" in 200*) return 0;; esac; sleep 2; done
  return 1
}
setup_case() {
  cport=$1
  for i in 1 2 3; do m call "$(call $cport)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  m create-tag "$(K create tag keep-$A -a $S --actor $A | tr '\n' ' ' | cut -c1-200)"
  fill; snap "$A-filled" workers-full.txt
  stopnode; wait_unavailable; snap "$A-unavailable" workers-full.txt
  rv revert-after-unavailable
  m request-1 "$(call $cport 30)	|	$(st $A)"
  m request-2 "$(call $cport 30)	|	$(st $A)"
  m resume-command "$(K resume actor $A -a $S | tr '\n' ' ' | cut -c1-260)"
  m state "$(st $A)"
  s1=$(now); m create-from-tag "$(K create actor ${A}r -a $S --template tb-50 --tag keep-$A | tr '\n' ' ' | cut -c1-220)"
  proxy ${A}r $((cport+50))
  m request-new-actor-1 "$(call $((cport+50)) 30)	|	$(st ${A}r)"
  m request-new-actor-2 "$(call $((cport+50)) 30)	|	$(st ${A}r)"
  m workers-before-unblock "$(workline)"
}
delall; rebalance
echo "$(ts) fullb-cases-start" >> 00-run.log

T=52-f1b-survivor-full-then-free-a-worker.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon j tb-50 8921; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  setup_case 8921
  F1=$(echo $FILLERS | awk '{print $1}')
  s0=$(now); m free-a-worker "suspend --mode sync of filler $F1: $(K suspend actor $F1 -a $S --mode sync | tail -1 | cut -c1-160)"
  m free-a-worker-done "$(el $s0) s | workers: $(workline)"
  reqloop request-after-free 8921 40 $s0
  reqloop request-new-actor-after-free 8971 20 $s0
  m final "$A: $(st $A) pod $(wpod $A) | ${A}r: $(st ${A}r) | workers: $(workline)"
  K get actor $A -a $S -o yaml > 53-f1b-actor.yaml 2>&1
else m mkon-failed "no actor on $V"; fi
nodeback
echo "$(ts) case-f1-done" >> 00-run.log

T=62-f2b-survivor-full-then-scale-pool.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon k tb-50 8922; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  setup_case 8922
  s0=$(now); m scale-up "$(kc -n $S scale workerpool ballast --replicas=6 2>&1 | tr '\n' ' ')"
  reqloop request-after-scale 8922 90 $s0
  m pods "$(podline)"
  reqloop request-new-actor-after-scale 8972 30 $s0
  m final "$A: $(st $A) pod $(wpod $A) | ${A}r: $(st ${A}r) | workers: $(workline)"
  K get actor $A -a $S -o yaml > 63-f2b-actor.yaml 2>&1
else m mkon-failed "no actor on $V"; fi
nodeback
echo "$(ts) case-f2-done" >> 00-run.log

for p in $(kc -n ate-system get pods -o name | grep -E "ate-api-server"); do kc -n ate-system logs $p --all-containers --since=60m 2>/dev/null | grep -i -E "no worker has room|DetachFromFullNode|unavailable worker|ResourceExhausted" | tail -40 | cut -c1-330; done > 77-control-plane-events.log
snap final 76-final.txt
pkill -f "context $C proxy actor"
echo "$(ts) FULLB-DONE" >> 00-run.log
