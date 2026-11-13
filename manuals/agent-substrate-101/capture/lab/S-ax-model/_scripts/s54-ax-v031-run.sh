set -u
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/S-ax-model/50-ax-v031
C=kind-demo; KC="kubectl --context $C"; NS=ax031-system
cd ~/ax-v031
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$E/$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> $E/steps.tsv; }
mv $E/52-apply-task.log $E/52x-v031-cli-against-head-server.log; mv $E/53-describe.log $E/53x-v031-cli-against-head-server.log
echo "== task runner build log"; tail -8 $E/21-task-runner-image.log | cut -c1-300
grep -v "^#" Dockerfile.task-runner | grep -v "^$" | head -30
$KC -n $NS get pods -o wide > $E/44-pods.txt 2>&1; cat $E/44-pods.txt
$KC -n $NS logs deploy/ax031-controller --tail=40 > $E/45-controller-start.log 2>&1; echo "== controller"; cut -c1-500 $E/45-controller-start.log | tail -15
DIG=$(cat ~/ax/bin/ax-task-runner.digest)
cat > $E/50-task.yaml <<EOF
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: ax031-install-check
  atespace: default
spec:
  image: "localhost:5002/ax-task-runner@$DIG"
  command: ["sleep", "infinity"]
EOF
AXH="$HOME/ax/bin/ax --context $C -n ax-system"
AX="$PWD/bin/ax --context $C -n $NS"
run 60-tunnel-stop-head "$AXH tunnel stop; $AXH tunnel list"
run 61-ax-ctx "$AX version; $AX ctx"
run 62-apply-task "$AX apply -f $E/50-task.yaml"
sleep 10
run 63-describe "$AX describe task ax031-install-check; $AX get tasks"
$KC -n $NS logs deploy/ax031-controller --since=3m > $E/64-controller-after-apply.log 2>&1
$KC -n $NS logs deploy/ax-server --since=3m > $E/65-server-after-apply.log 2>&1
run 66-tunnel-stop-v031 "$AX tunnel stop; $AXH get tasks"
tail -8 $E/steps.tsv
for f in 61-ax-ctx 62-apply-task 63-describe 64-controller-after-apply 65-server-after-apply 66-tunnel-stop-v031; do echo "== $f"; cut -c1-600 $E/$f.log | tail -14; done
date -u +%T; tail -2 ~/evidence/S-ax-model/20-kagent/loop/events.log; tail -3 ~/evidence/S-ax-model/41-ax-worker-loss-durable/21-events.tsv
