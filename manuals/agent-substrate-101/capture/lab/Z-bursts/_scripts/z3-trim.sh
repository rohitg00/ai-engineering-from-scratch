. ~/scripts/z-lib.sh
O=$EV/10-run
pkill -f 'bash <home>/scripts/z0b-drive.sh'
pkill -f 'bash z2-run.sh'
pkill -f 'python3 sampler.py'
sleep 2
pgrep -af 'z0b-drive|z2-run|sampler.py' | grep -v pgrep
log "operator stopped the run in rep 3 after c150-r3: the delayed upload of 300 snapshots to the in-cluster bucket took guest disk from 4.9 to 4.0 GB in one minute; deleting actors t-201 to t-300 to keep the guest disk safe"
t=$(ms)
f=$(seq -f "t-%03g" 201 300 | xargs -P 24 -I{} sh -c "kubectl ate delete actor {} -a $S >/dev/null 2>&1 || echo fail {}" | wc -l)
log "deleted t-201..t-300 in $(( $(ms) - t )) ms, $f failed"
for i in 1 2 3 4 5 6; do sleep 10; echo "$(date -u +%T) disk=$(disk_mb)MB"; done
log "after delete: $(K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c | tr '\n' ' ') disk=$(disk_mb)MB snap=$(docker exec $NODE du -sm /var/lib/ate 2>/dev/null | awk '{print $1}')MB"
tail -3 $O/20-concurrency.tsv | cut -c1-120
