Q=~/evidence/Q-network
for i in $(seq 1 240); do
  grep -q ROTATION-agentgateway-DONE $Q/l-credential-rotation/agentgateway/20-rotations.tsv 2>/dev/null && grep -q WORK-DONE $Q/n-cpu-limit/40-work.tsv 2>/dev/null && break
  sleep 15
done
echo "chain: waited $i polls; $(date -u +%T)"
grep -q ROTATION-agentgateway-DONE $Q/l-credential-rotation/agentgateway/20-rotations.tsv || { echo CHAIN-ABORT-no-rotation-marker; exit 1; }
for n in q10 q8 q8b; do sed '1s/agentgateway/envoy/' ~/scripts/$n-agw.sh > ~/scripts/$n-envoy.sh; head -1 ~/scripts/$n-envoy.sh; done
bash ~/scripts/q4-switch-envoy.sh > ~/logs/q11-switch-envoy.log 2>&1; tail -3 ~/logs/q11-switch-envoy.log
grep -q SWITCH-DONE ~/logs/q11-switch-envoy.log || { echo CHAIN-ABORT-switch-envoy-failed; exit 1; }
sleep 20
bash ~/scripts/q8-envoy.sh > ~/logs/q8-envoy.sh.log 2>&1
bash ~/scripts/q8b-envoy.sh > ~/logs/q8b-envoy.sh.log 2>&1
bash ~/scripts/q10-envoy.sh > ~/logs/q10-envoy.sh.log 2>&1
tail -8 ~/logs/q10-envoy.sh.log
bash ~/scripts/q4-switch-agw.sh > ~/logs/q11-switch-agw.log 2>&1; tail -3 ~/logs/q11-switch-agw.log
echo "CHAIN-DONE $(date -u +%T)"
