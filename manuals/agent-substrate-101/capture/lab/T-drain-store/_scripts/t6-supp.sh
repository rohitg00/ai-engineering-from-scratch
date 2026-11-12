for p in $(pgrep -f "scripts/t5-finish"); do kill $p 2>/dev/null; done
. ~/scripts/t4f-store.sh none
while ! grep -q DOWN-DONE 80-store-run.log; do sleep 5; done
log "supplement: recovery after a store outage"
T=97-store-unreachable-recovery.tsv; echo "ts	t	event	detail" > $T; T0=0
tc_call() { s0=$(now); out="$("$@" 2>&1 | grep -v '^Warning: no --token-file' | tr '\n' ' ' | cut -c1-300)"; echo "$(el3 $s0) s | $out"; }
proxy u-remote 9703; proxy u-run 9701
for a in u-remote u-run; do
  p=9703; [ $a = u-run ] && p=9701
  m "leftover-state" "$a: $(st $a)"
  m "leftover-request-store-is-back" "$a: $(call $p 30)	|	$(st $a)"
  A=$a; rv "leftover-revert-$a"
  m "leftover-request-after-revert" "$a: $(call $p 30)	|	$(st $a)"
done
down() { if [ $1 = refused ]; then sg docker -c "docker stop t-store" > /dev/null; else sudo iptables -I INPUT -p tcp --dport 9100 -j DROP; fi; T0=$(now); m store-down "$1"; }
up() { if [ $1 = refused ]; then sg docker -c "docker start t-store" > /dev/null; else sudo iptables -D INPUT -p tcp --dport 9100 -j DROP; fi; m store-back "$1 after $(el $T0) s"; sleep 4; }
for mode in blackhole refused; do
  r=w-rem-$mode; u=w-run-$mode
  K create actor $r -a $S --template sb-0 > /dev/null; K create actor $u -a $S --template sb-0 > /dev/null
  proxy $r 9711; proxy $u 9712
  for i in 1 2 3; do call 9711 30 > /dev/null; done; for i in 1 2 3; do call 9712 30 > /dev/null; done
  K suspend actor $r -a $S --mode sync > /dev/null; for i in $(seq 1 120); do [ "$(nodeof $r)" = "-" ] && break; sleep 1; done
  K suspend actor $u -a $S --mode sync > /dev/null; m "$mode-prepared" "$r: $(st $r) | $u (durable snapshot at count=3): $(st $u)"
  m "$mode-run-calls" "$(call 9712 30) | $(call 9712 30)"
  down $mode
  m "$mode-resume-remote-only" "$(call 9711 90)	|	$(st $r)"
  m "$mode-suspend-sync-running" "$(tc_call kubectl ate --context $C suspend actor $u -a $S --mode sync)"
  m "$mode-state-after-failed-suspend" "$(st $u)"
  up $mode
  m "$mode-remote-only-request-no-revert" "$(call 9711 30)	|	$(st $r)"
  A=$r; rv "$mode-remote-only-revert"
  m "$mode-remote-only-request-after-revert" "$(call 9711 60)	|	$(st $r)"
  m "$mode-run-request-no-revert" "$(call 9712 30)	|	$(st $u)"
  A=$u; rv "$mode-run-revert"
  m "$mode-run-request-after-revert" "$(call 9712 60)	|	$(st $u)"
  T0=0
done
log "SUPP-DONE"
bash ~/scripts/t4f-store.sh restore > ~/logs/t4f-restore.log 2>&1
bash ~/scripts/t3c-full.sh > ~/logs/t3c-full.log 2>&1
cd ~/evidence/T-drain-store; echo "$(date -u +%FT%TZ) FINISH-DONE" >> 00-run.log
