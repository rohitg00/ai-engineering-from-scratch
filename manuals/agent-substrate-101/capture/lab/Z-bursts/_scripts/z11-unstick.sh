. ~/scripts/z-lib.sh
O=$EV/10-run
date -u +%T
K get actors -a $S | grep -v SUSPENDED > $O/40-errors/01-actors-before-unstick.txt
cat $O/40-errors/01-actors-before-unstick.txt
log "operator: t-023 stays ACTOR_STATE_RESUMING since about 06:49 and makes each settle wait 300 s; t-023 is deleted and the CRASHED actors are reverted so the run can finish"
K get actor t-023 -a $S -o yaml > $O/40-errors/02-t-023.yaml 2>&1
kubectl ate delete actor t-023 -a $S 2>&1 | tail -1
for a in $(K get actors -a $S | awk 'NR>1 && $4 ~ /CRASHED/ {print $2}'); do t=$(ms); kubectl ate revert actor $a -a $S >/dev/null 2>&1; echo "revert $a rc=$? $(( $(ms) - t )) ms"; done | tee -a $O/00-run.log
sleep 5
K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c
pgrep -af 'z4-rest' | grep -v pgrep | head -2
tail -2 $O/00-run.log
