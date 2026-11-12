. ~/scripts/t4f-store.sh none
log "resumed after a stop for low host memory: no more 1,000 MiB or 200 MiB cycles"
a=external-20-1000
log "leftover $a: $(st $a | cut -f1,2) | delete: $(K delete actor $a -a $S | tail -1 | cut -c1-160)"
if K get actor $a -a $S | grep -q " $a "; then K revert actor $a -a $S > /dev/null 2>&1; log "after revert: $(st $a | cut -f1) | delete: $(K delete actor $a -a $S | tail -1 | cut -c1-160)"; fi
netem 100; log "netem 100 ms set"
SIZES=0 cycles external 100 sb 5
netem 0
bash ~/scripts/t4f-store.sh down > ~/logs/t4f-down.log 2>&1
bash ~/scripts/t4f-store.sh restore > ~/logs/t4f-restore.log 2>&1
bash ~/scripts/t3c-full.sh > ~/logs/t3c-full.log 2>&1
cd ~/evidence/T-drain-store; echo "$(date -u +%FT%TZ) FINISH-DONE" >> 00-run.log
