for p in $(pgrep -f "scripts/x4-chain.sh"); do kill $p; done
for p in $(pgrep -f "scripts/x1-store.sh rtt100"); do kill $p; done
sleep 1
cd ~/evidence/X-remote-store-pg
. ~/scripts/x1-store.sh none
log "the 100 ms phase at 1,000 MiB was stopped by hand after cycle 1: one cycle takes about 11 minutes on this path"
shape 0 0
pkill -f "context $C proxy actor" 2>/dev/null
delall
log "RTT100-DONE (cut short)"
sudo tc qdisc show dev ens3 | tr '\n' ';'; echo
bash ~/scripts/x6-pg-tests.sh lifecycle 20 2>&1 | tail -11
tail -8 ~/evidence/X-remote-store-pg/50-pg-tests/05-pg-round-trip.txt | cut -c1-330
sudo tc qdisc show dev ens3 | tr '\n' ';'; echo
(PHASES="rate" nohup bash ~/scripts/x4-chain.sh > ~/logs/x4-chain-rate.log 2>&1 &)
echo started rate chain
