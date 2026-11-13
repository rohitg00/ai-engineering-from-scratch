set -u
E=~/evidence/S-ax-model/50-ax-v031
C=kind-demo; KC="kubectl --context $C"; NS=ax031-system
cd ~/ax-v031
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$E/$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> $E/steps.tsv; }
echo "our rendering renamed the ServiceAccount but not serviceAccountName; fixed with a patch. This is our error, not the release's." > $E/70-note-our-rename-error.txt
run 71-patch-sa "$KC -n $NS patch deploy ax031-controller -p '{\"spec\":{\"template\":{\"spec\":{\"serviceAccountName\":\"ax031-controller\"}}}}'; $KC -n $NS rollout status deploy/ax031-controller --timeout=90s"
sleep 12
$KC -n $NS get pods -o wide > $E/72-pods.txt 2>&1
$KC -n $NS logs deploy/ax031-controller --tail=60 > $E/73-controller.log 2>&1
$KC -n $NS get events --sort-by=.lastTimestamp 2>&1 | tail -8 > $E/74-events.txt
AXH="$HOME/ax/bin/ax --context $C -n ax-system"
AX="$PWD/bin/ax --context $C -n $NS"
run 75-tunnel-stop-head "$AXH tunnel stop"
run 76-describe "$AX describe task ax031-install-check; $AX get tasks"
run 77-resume "$AX resume task ax031-install-check"
sleep 6
run 78-describe-after-resume "$AX describe task ax031-install-check"
$KC -n $NS logs deploy/ax031-controller --since=2m > $E/79-controller-after.log 2>&1
$KC -n ate-system logs deploy/ate-api-server -c ate-api-server --since=3m 2>/dev/null | grep -i -E "ateapi\.Control|unimplemented|unknown service" | tail -5 | cut -c1-500 > $E/80-ateapi-side.log
run 81-tunnel-stop-v031 "$AX tunnel stop; $AXH get tasks"
tail -6 $E/steps.tsv; cat $E/72-pods.txt | cut -c1-110; cut -c1-300 $E/74-events.txt
for f in 71-patch-sa 73-controller 76-describe 77-resume 78-describe-after-resume 79-controller-after 80-ateapi-side; do echo "== $f"; cut -c1-700 $E/$f.log | tail -12; done
date -u +%T; tail -2 ~/evidence/S-ax-model/20-kagent/loop/events.log
