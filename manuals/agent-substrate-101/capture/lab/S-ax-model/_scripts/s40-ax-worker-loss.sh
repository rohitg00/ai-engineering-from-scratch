set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
E=~/evidence/S-ax-model/40-ax-worker-loss; mkdir -p $E; cd $E
echo "step	rc	seconds" > steps.tsv
T=s-loss
$KC get workerpool -A > 01-pools-before.txt 2>&1
$KA get worker > 02-workers-before.txt 2>&1
for a in default demo-agent demo-drill demo-idle demo-tools; do echo "## $a"; $KA get actor -a $a 2>&1 | grep -v Warning; done > 03-actors-before.txt
$AX suspend task s-clone > 04-suspend-others.log 2>&1; $AX suspend task ax-install-check >> 04-suspend-others.log 2>&1
for p in demo-agent/agent demo-drill/drill demo-idle/idle demo-tools/tools; do
  ns=${p%/*}; n=${p#*/}; r=$($KC -n $ns get workerpool $n -o jsonpath='{.spec.replicas}'); echo "$ns $n $r" >> 05-pool-replicas-saved.txt
  $KC -n $ns patch workerpool $n --type merge -p '{"spec":{"replicas":0}}' >> 06-scale-down.log 2>&1
done
for i in $(seq 60); do n=$($KC get pods -A --no-headers 2>/dev/null | grep -E "^demo-(agent|drill|idle|tools) +(agent|drill|idle|tools)-" | wc -l); [ "$n" = 0 ] && break; sleep 2; done
$KA get worker > 07-workers-after-scale.txt 2>&1
cat > 08-task.yaml <<'EOF'
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: s-loss
  atespace: default
spec:
  debug: true
  command: ["sleep", "infinity"]
EOF
run 09-apply "$AX apply -f 08-task.yaml"
run 10-resume-first "$AX resume task $T"
run 11-write-note "$AX ssh $T -- sh -c 'echo note-saved-by-suspend > /workspace/note.txt; ls -la /workspace'"
run 12-suspend "$AX suspend task $T"
sleep 2
run 13-resume "$AX resume task $T"
run 14-write-unsaved "$AX ssh $T -- sh -c 'echo written-after-last-suspend > /workspace/unsaved.txt; ls -la /workspace; cat /proc/uptime'"
run 15-describe-before "$AX describe task $T"
$KA get actor $T -a default -o yaml > 16-actor-before.yaml 2>&1
IP=$($AX describe task $T | awk '/Worker IP/ {print $3}')
$KC get pods -A -o wide | awk -v ip="$IP" '$7==ip {print $1 "\t" $2 "\t" $7}' > 17-worker-pod.tsv
NS=$(cut -f1 17-worker-pod.tsv); POD=$(cut -f2 17-worker-pod.tsv)
echo "worker pod: $NS/$POD"
if [ "$NS" != "ax-system" ]; then echo "skipped: task sits on $NS/$POD, not on ax-pool" > 18-SKIPPED.txt; cat 18-SKIPPED.txt; else
rm -f stop-poll
(while [ ! -f stop-poll ]; do echo "$(now)	$($KA get actor $T -a default -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-")] | @tsv')	$($AX get task $T 2>&1 | tail -1 | tr -s ' ' | cut -c1-90)"; sleep 1; done > 19-poll.tsv &)
(for i in $(seq 90); do s=$(date +%s.%N); o=$(timeout 8 $AX ssh $T -- cat /workspace/note.txt 2>&1 | tr '\n' ' ' | cut -c1-140); rc=$?; echo "$(now)	$rc	$(el $s)	$o"; sleep 1; done > 20-ssh-probe.tsv &)
sleep 5
echo "$(now)	delete-pod $NS/$POD" > 21-events.tsv
run 22-delete-worker-pod "$KC -n $NS delete pod $POD --wait=false"
sleep 40
echo "$(now)	after-40s" >> 21-events.tsv
run 23-describe-after-loss "$AX describe task $T; $KA get actor $T -a default -o json 2>/dev/null | jq -c '{state: .status.state, node: .status.assignedNode}'"
$KA get worker > 24-workers-after-loss.txt 2>&1
$KC -n ax-system get pods -o wide > 25-pods-after-loss.txt 2>&1
echo "$(now)	ax-resume-1" >> 21-events.tsv
run 26-resume-after-loss "$AX resume task $T"
sleep 4
run 27-describe-after-resume "$AX describe task $T; $KA get actor $T -a default -o json 2>/dev/null | jq -c '{state: .status.state}'"
run 28-ssh-after-resume "$AX ssh $T -- sh -c 'ls -la /workspace; cat /workspace/note.txt; cat /workspace/unsaved.txt; cat /proc/uptime'"
ST=$($KA get actor $T -a default -o json 2>/dev/null | jq -r '.status.state')
if [ "$ST" != "ACTOR_STATE_RUNNING" ]; then
  echo "$(now)	ax-suspend" >> 21-events.tsv
  run 29-suspend-after-loss "$AX suspend task $T"
  sleep 3
  echo "$(now)	ax-resume-2" >> 21-events.tsv
  run 30-resume-2 "$AX resume task $T"
  sleep 4
  run 31-describe-2 "$AX describe task $T; $KA get actor $T -a default -o json 2>/dev/null | jq -c '{state: .status.state}'"
  ST=$($KA get actor $T -a default -o json 2>/dev/null | jq -r '.status.state')
fi
if [ "$ST" != "ACTOR_STATE_RUNNING" ]; then
  echo "$(now)	substrate-revert" >> 21-events.tsv
  run 32-substrate-revert "$KA revert actor $T -a default"
  sleep 3
  run 33-state-after-revert "$KA get actor $T -a default -o json 2>/dev/null | jq -c '{state: .status.state}'; $AX describe task $T"
  echo "$(now)	ax-resume-3" >> 21-events.tsv
  run 34-resume-3 "$AX resume task $T"
  sleep 4
  run 35-describe-3 "$AX describe task $T; $KA get actor $T -a default -o json 2>/dev/null | jq -c '{state: .status.state}'"
fi
run 36-files-after-recovery "$AX ssh $T -- sh -c 'ls -la /workspace; cat /workspace/note.txt; cat /workspace/unsaved.txt; cat /proc/uptime'"
IP2=$($AX describe task $T | awk '/Worker IP/ {print $3}')
$KC get pods -A -o wide | awk -v ip="$IP2" '$7==ip {print $1 "\t" $2 "\t" $7}' > 37-worker-pod-after.tsv
sleep 3; touch stop-poll; sleep 2
awk -F'\t' '{k=$2 FS $3 FS $4; if (k!=p) {print; p=k}}' 19-poll.tsv > 19-poll-changes.tsv
$KA get worker > 38-workers-after.txt 2>&1
$KA logs actor $T -a default --source=lifecycle 2>/dev/null | tail -40 > 39-actor-lifecycle.log
$KC -n ax-system logs deployment/ax-server --since=4m > 40-ax-server.log 2>&1
fi
while read ns n r; do $KC -n $ns patch workerpool $n --type merge -p "{\"spec\":{\"replicas\":$r}}" >> 41-scale-restore.log 2>&1; done < 05-pool-replicas-saved.txt
sleep 20; $KC get workerpool -A > 42-pools-after.txt 2>&1
cat steps.tsv; cat 17-worker-pod.tsv 21-events.tsv 19-poll-changes.tsv 37-worker-pod-after.tsv 2>/dev/null
for f in 23* 26* 27* 28* 29* 30* 31* 32* 33* 34* 35* 36*; do [ -f $f ] && { echo "== $f"; cut -c1-300 $f | grep -v "^Warning: no --token" | head -22; }; done
echo "== ssh probe"; awk -F'\t' '{k=$2 FS $4; if (k!=p) {print; p=k}}' 20-ssh-probe.tsv | cut -c1-220 | head -30
cat 42-pools-after.txt
