set -u
E=~/evidence/S-ax-model/50-ax-v031
C=kind-demo; KC="kubectl --context $C"; NS=ax031-system
AXH="$HOME/ax/bin/ax --context $C -n ax-system"
AX="$HOME/ax-v031/bin/ax --context $C -n $NS"
$KC label ns $NS ate.dev/api-access=true > $E/90-label-namespace.log 2>&1
T0=$(date -u +%FT%TZ)
$AXH tunnel stop > /dev/null 2>&1
$AX resume task ax031-install-check > $E/91-resume.log 2>&1
for i in $(seq 14); do sleep 3; $KC -n $NS logs deploy/ax031-controller --since-time=$T0 2>/dev/null | grep -q -E "ERROR|resumed|successfully" && break; done
sleep 2
$KC -n $NS logs deploy/ax031-controller --since-time=$T0 > $E/92-controller-after-label.log 2>&1
$AX describe task ax031-install-check > $E/93-describe.log 2>&1
$KC -n ate-system logs deploy/ate-api-server -c ate-api-server --since-time=$T0 --all-containers=false 2>/dev/null | grep -v "Handle RPC" | tail -5 | cut -c1-400 > $E/94-ateapi-side.log
$AX tunnel stop > /dev/null 2>&1; $AXH get tasks > $E/95-head-still-works.log 2>&1
cat $E/90-label-namespace.log; cut -c1-900 $E/92-controller-after-label.log | tail -6; cat $E/93-describe.log; cat $E/94-ateapi-side.log; cat $E/95-head-still-works.log
