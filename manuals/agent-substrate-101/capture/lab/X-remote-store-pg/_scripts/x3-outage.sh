. ~/scripts/x1-store.sh none
STAGE=$1; MODE=$2
T=30-outage-$MODE.tsv; [ -f $T ] || echo "ts	t	event	detail" > $T
T0=0; [ -f t0-$MODE ] && T0=$(cat t0-$MODE)
tc_call() { s0=$(now); out="$("$@" 2>&1 | grep -v '^Warning: no --token-file' | tr '\n' ' ' | cut -c1-300)"; echo "$(el3 $s0) s | $out"; }
R=o-rem-$MODE; U=o-run-$MODE; AS=o-async-$MODE; L=o-live-$MODE; NW=o-new-$MODE
px() { proxy $R 9711; proxy $U 9712; proxy $AS 9713; proxy $L 9714; }
nodeprobe() { sg docker -c "docker exec $O curl -s -m 6 -o /dev/null -w 'code=%{http_code} total=%{time_total}' $EXT/" 2>&1; }
drop_on() { for ch in FORWARD OUTPUT; do sudo iptables -I $ch 1 -d $GWIP -p tcp -m multiport --dports 19000,19001 -j DROP; done; }
drop_off() { for ch in FORWARD OUTPUT; do sudo iptables -D $ch -d $GWIP -p tcp -m multiport --dports 19000,19001 -j DROP 2>/dev/null; done; }

if [ "$STAGE" = prep ]; then
  rm -f t0-$MODE
  for a in $R $U $AS $L; do K create actor $a -a $S --template xb-200 > /dev/null; done
  px
  for p in 9711 9712 9713 9714; do for i in 1 2 3; do r="$(call $p 120)"; done; m warm "port $p third call: $r"; done
  m suspend-sync-rem "$(tc_call kubectl ate --context $C suspend actor $R -a $S --mode sync)"
  for i in $(seq 1 200); do [ "$(nodeof $R)" = "-" ] && break; sleep 1; done
  m suspend-sync-run "$(tc_call kubectl ate --context $C suspend actor $U -a $S --mode sync)"
  m run-two-more-calls "$(call 9712 120) | $(call 9712 30)"
  m prepared "$R: $(st $R) | $U: $(st $U) | $AS: $(st $AS) | $L: $(st $L) | local MiB $(snapmb)"
fi

if [ "$STAGE" = during ]; then
  px
  [ "$MODE" = dropped ] && drop_on
  T0=$(now); echo $T0 > t0-$MODE; m store-down "$MODE"
  m probe-from-node "$(nodeprobe)"
  m live-request-1 "$(call 9714 30)	|	$(st $L)"
  m rem-request-1 "$(call 9711 240)	|	$(st $R)"
  m rem-request-2 "$(call 9711 60)	|	$(st $R)"
  m run-suspend-sync "$(tc_call kubectl ate --context $C suspend actor $U -a $S --mode sync)"
  m run-state-after-suspend-sync "$(st $U)"
  m run-request-after-suspend-sync "$(call 9712 30)	|	$(st $U)"
  m async-suspend-default "$(tc_call kubectl ate --context $C suspend actor $AS -a $S)"
  m async-state-now "$(st $AS)"
  sleep 20; m async-state-after-20s "$(st $AS)"
  m async-request-local-resume "$(call 9713 60)	|	$(st $AS)"
  m async-suspend-default-again "$(tc_call kubectl ate --context $C suspend actor $AS -a $S)"
  sleep 15; m async-state-15s-after-second-suspend "$(st $AS)"
  m new-create "$(tc_call kubectl ate --context $C create actor $NW -a $S --template xb-200)"
  proxy $NW 9715; m new-request "$(call 9715 60)	|	$(st $NW)"
  m live-request-2 "$(call 9714 30)	|	$(st $L)"
  m during-done "outage has lasted $(el $T0) s"
fi

if [ "$STAGE" = after ]; then
  px; proxy $NW 9715
  [ "$MODE" = dropped ] && drop_off
  s0=$(now); m store-back "$MODE after $(el $T0) s"
  for i in 1 2 3 4 5 6; do p="$(nodeprobe)"; m probe-from-node "$p"; case "$p" in code=403*|code=200*) break;; esac; sleep 3; done
  r="$(call 9711 120)"; m rem-request-no-revert "$(el $s0) s after store back	$r	|	$(st $R)"
  case "$r" in 200*) ;; *) A=$R; rv rem-revert; m rem-request-after-revert "$(call 9711 120)	|	$(st $R)";; esac
  r="$(call 9712 60)"; m run-request-no-revert "$r	|	$(st $U)"
  case "$r" in 200*) ;; *) A=$U; rv run-revert; m run-request-after-revert "$(call 9712 120)	|	$(st $U)";; esac
  m async-state "$(st $AS)"
  for i in $(seq 1 24); do s="$(st $AS)"; case "$s" in *STATE_COMPLETED*) break;; esac; sleep 5; done
  m async-state-after-wait "$(el $s0) s after store back: $s"
  m async-request "$(call 9713 120)	|	$(st $AS)"
  m live-suspend-sync "$(tc_call kubectl ate --context $C suspend actor $L -a $S --mode sync)"
  m live-request "$(call 9714 120)	|	$(st $L)"
  m new-request "$(call 9715 60)	|	$(st $NW)"
  for p in $(kc -n ate-system get pods -o name | grep -E "ate-api-server|atelet"); do kc -n ate-system logs $p --all-containers --since=20m 2>/dev/null | grep -i -E "19000|objectstore|upload|download|snapshot" | grep -i -E "error|fail|refused|timeout|deadline|reset" | tail -12 | cut -c1-330; done > 31-outage-$MODE-logs.log
  for a in $R $U $AS $L $NW; do K revert actor $a -a $S > /dev/null 2>&1; K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1; done
  pkill -f "context $C proxy actor" 2>/dev/null
  sudo fstrim / 2>/dev/null
  m after-done "guest disk free $(df -h / | awk 'NR==2{print $4}')"
fi
echo "$(ts) OUTAGE-$STAGE-$MODE-DONE" >> 00-run.log
