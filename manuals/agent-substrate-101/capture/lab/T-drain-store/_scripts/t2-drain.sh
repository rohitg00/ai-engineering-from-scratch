. ~/scripts/t-lib.sh
pkill -f "context $C proxy actor" 2>/dev/null
DR="--ignore-daemonsets --delete-emptydir-data --force --timeout=600s"
drain_bg() { L=$1; rm -f drain-done-$L; m drain-start "kubectl drain $V $DR"; T0=$(now); ( kc drain $V $DR > drain-$L.log 2>&1; rc=$?; m drain-returned "rc=$rc | $(tail -3 drain-$L.log | tr '\n' ' ' | cut -c1-260)"; touch drain-done-$L ) & }
wait_drain() { for i in $(seq 1 330); do [ -f drain-done-$1 ] && break; sleep 2; done; }
wait_pods_settled() { for i in $(seq 1 60); do [ "$(podsn | awk '$4!="<none>" || $2!="Running"' | wc -l)" = 0 ] && break; sleep 2; done; m pods-settled "pods: $(podline)| workers: $(workline)"; }
undrain() {
  label=$1; shift; watch="$*"; R=return-$label.tsv; echo "ts	t	event	detail" > $R
  r() { echo "$(ts)	t=$(el $N0)	$1	$2" >> $R; }
  N0=$(now); r uncordon "$(kc uncordon $V 2>&1 | tr '\n' ' ') after $(el $T0) s cordoned"
  landed=0
  for i in $(seq 1 15); do
    pv=$(podsn | awk -v v=$V '$3==v && $2=="Running"' | wc -l); wa=$(vworkers_active)
    K create actor z$label$i -a $S --template tb-0 > /dev/null; K resume actor z$label$i -a $S > /dev/null 2>&1; n=$(nodeof z$label$i)
    K suspend actor z$label$i -a $S --mode sync > /dev/null 2>&1; K delete actor z$label$i -a $S > /dev/null 2>&1
    line="pool-pods-running-on-node=$pv workers-active-on-node=$wa placement=$n"
    for a in $watch; do line="$line | $a: $(st $a | cut -f1,2 | tr '\t' ' ')"; done
    r watch "$line"
    if [ "$n" = "$V" ] && [ $landed = 0 ]; then landed=1; r first-actor-on-returned-node "no pods moved by hand"; fi
    sleep 4
  done
  [ $landed = 0 ] && r no-actor-on-returned-node "after $(el $N0) s, pool pods on node: $pv"
  for a in $watch; do
    r final-state "$a: $(st $a)"
    if K get actor $a -a $S | grep -q " $a "; then
      proxy $a 8990
      r request-after-uncordon "$a: $(call 8990 30)	|	$(st $a)"
      pkill -f "proxy actor $a " 2>/dev/null
    fi
  done
  snap "after-uncordon-$label" workers-$label.txt
  T0=0; delall; rebalance
  r ready-for-next-case "pods: $(podline)| workers: $(workline)"
}
recover() {
  port=$1
  if [ "$(lastok 4)" -ge 3 ]; then m serving "last probes ok; no command sent"; return; fi
  rv revert-1; sleep 12
  if [ "$(lastok 4)" -ge 3 ]; then m serving "after one revert"; return; fi
  rv revert-2; sleep 12
  if [ "$(lastok 4)" -ge 3 ]; then m serving "after two reverts"; return; fi
  m resume-attempt "$(K resume actor $A -a $S | tr '\n' ' ' | cut -c1-230)"; sleep 12
  m still-not-serving "$(st $A)"
}
delall; rebalance
echo "$(ts) drain-cases-start" >> 00-run.log
snap start 09-start.txt

T=10-a-running.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon a tb-50 8911; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8911)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  for i in 4 5; do m call "$(call 8911)"; done
  m running "$(st $A)"
  watcher; prober $A 8911 1; sleep 5
  drain_bg a; wait_drain a
  sleep 60; wait_pods_settled
  recover 8911
  sleep 8; touch stop-probe-$A stop-watch; sleep 3
  m final "$(st $A) pod $(wpod $A) ok-probes=$(grep -c '	probe	200' $T)"
  K get actor $A -a $S -o yaml > 11-a-actor.yaml 2>&1
else m mkon-failed "no actor on $V"; fi
undrain a $A
echo "$(ts) case-a-done" >> 00-run.log

T=20-b-suspended-sync-quiet.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon b tb-50 8912; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8912)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  m local-snapshots "$(sg docker -c "docker exec $V du -sm /var/lib/ate/snapshots" | cut -f1) MiB on $V"
  watcher; sleep 3
  drain_bg b; wait_drain b
  wait_pods_settled; touch stop-watch; sleep 3
  m state-after-drain "$(st $A)"
  m request-1-no-revert "$(call 8912 40)	|	$(st $A) pod $(wpod $A)"
  m request-2 "$(call 8912 40)	|	$(st $A)"
  if ! grep -q "request-2	200" $T; then rv revert-after-drain; m request-after-revert "$(call 8912 40)	|	$(st $A) pod $(wpod $A)"; fi
  m local-snapshots "$(sg docker -c "docker exec $V du -sm /var/lib/ate/snapshots" | cut -f1) MiB on $V, $(sg docker -c "docker exec $O du -sm /var/lib/ate/snapshots" | cut -f1) MiB on $O"
  K get actor $A -a $S -o yaml > 21-b-actor.yaml 2>&1
else m mkon-failed "no actor on $V"; fi
undrain b $A
echo "$(ts) case-b-done" >> 00-run.log

T=25-b2-suspended-sync-requests-during-drain.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon e tb-50 8915; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8915)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  watcher
  drain_bg b2; sleep 2; prober $A 8915 1
  wait_drain b2; sleep 30; wait_pods_settled
  recover 8915
  sleep 6; touch stop-probe-$A stop-watch; sleep 3
  m final "$(st $A) pod $(wpod $A) ok-probes=$(grep -c '	probe	200' $T)"
  K get actor $A -a $S -o yaml > 26-b2-actor.yaml 2>&1
else m mkon-failed "no actor on $V"; fi
undrain b2 $A
echo "$(ts) case-b2-done" >> 00-run.log

T=30-c-suspended-async-pending.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon c tb-50 8913; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8913)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  for i in 4 5; do m call "$(call 8913)"; done
  K suspend actor $A -a $S > /dev/null; m suspended-async "$(st $A)"
  watcher; sleep 3
  drain_bg c; wait_drain c
  wait_pods_settled; touch stop-watch; sleep 3
  m state-after-drain "$(st $A)"
  m request-1-no-revert "$(call 8913 40)	|	$(st $A) pod $(wpod $A)"
  m request-2 "$(call 8913 40)	|	$(st $A)"
  if ! grep -q "request-2	200" $T; then rv revert-after-drain; m request-after-revert "$(call 8913 40)	|	$(st $A) pod $(wpod $A)"; fi
  K get actor $A -a $S -o yaml > 31-c-actor.yaml 2>&1
else m mkon-failed "no actor on $V"; fi
undrain c $A
echo "$(ts) case-c-done" >> 00-run.log

T=40-d-mid-request.tsv; echo "ts	t	event	detail" > $T; T0=0
if mkon d tb-50 8914; then A=$MADE; m actor "$A on $(nodeof $A) pod $(wpod $A)"
  for i in 1 2 3; do m call "$(call 8914)"; done
  K suspend actor $A -a $S --mode sync > /dev/null; m suspended-sync "$(st $A)"
  for i in 4 5; do m call "$(call 8914)"; done
  m running "$(st $A)"
  rm -f slow-done; s0=$(now)
  ( r="$(curl -s -m 200 -o body-slow.tmp -w '%{http_code}\t%{time_total}' 'http://127.0.0.1:8914/slow?s=120')"; m slow-request-returned "$r	$(tr -d '\n' < body-slow.tmp | cut -c1-150)	|	$(st $A)"; touch slow-done ) &
  m slow-request-sent "GET /slow?s=120, client timeout 200 s"
  watcher; sleep 3
  drain_bg d
  for i in $(seq 1 110); do [ -f slow-done ] && break; sleep 2; done
  wait_drain d
  prober $A 8914 1; sleep 20; wait_pods_settled
  recover 8914
  sleep 6; touch stop-probe-$A stop-watch; sleep 3
  m final "$(st $A) pod $(wpod $A) ok-probes=$(grep -c '	probe	200' $T)"
  K get actor $A -a $S -o yaml > 41-d-actor.yaml 2>&1
else m mkon-failed "no actor on $V"; fi
undrain d $A
echo "$(ts) case-d-done" >> 00-run.log

snap final 49-final.txt
kc get events -A --sort-by=.lastTimestamp 2>/dev/null | grep -i -E "drain|evict|cordon|Killing|NodeNotSchedulable|NodeSchedulable" | tail -60 | cut -c1-220 > 47-k8s-events.txt
for p in $(kc -n ate-system get pods -o name | grep -E "ate-api-server|ate-controller"); do kc -n ate-system logs $p --all-containers --since=90m 2>/dev/null | grep -i -E "MarkWorkerUnavailable|crash|DetachFromFullNode|unavailable worker|DeleteWorker|drain|terminat" | tail -80 | cut -c1-330; done > 48-control-plane-events.log
pkill -f "context $C proxy actor"
echo "$(ts) DRAIN-DONE" >> 00-run.log
