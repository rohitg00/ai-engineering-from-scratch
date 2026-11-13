set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
E=~/evidence/S-ax-model/41-ax-worker-loss-durable; mkdir -p $E; cd $E
echo "step	rc	seconds" > steps.tsv
T=s-loss2
$AX suspend task s-loss > 04-suspend-others.log 2>&1
for p in demo-agent/agent demo-drill/drill demo-idle/idle demo-tools/tools; do
  ns=${p%/*}; n=${p#*/}; r=$($KC -n $ns get workerpool $n -o jsonpath='{.spec.replicas}'); echo "$ns $n $r" >> 05-pool-replicas-saved.txt
  $KC -n $ns patch workerpool $n --type merge -p '{"spec":{"replicas":0}}' >> 06-scale-down.log 2>&1
done
for i in $(seq 60); do n=$($KC get pods -A --no-headers 2>/dev/null | grep -E "^demo-(agent|drill|idle|tools) +(agent|drill|idle|tools)-" | wc -l); [ "$n" = 0 ] && break; sleep 2; done
sed 's/s-loss/s-loss2/' ../40-ax-worker-loss/08-task.yaml > 08-task.yaml
run 09-apply "$AX apply -f 08-task.yaml"
run 10-resume-first "$AX resume task $T"
run 11-write-note "$AX ssh $T -- sh -c 'echo note-saved-by-suspend > /workspace/note.txt; ls -la /workspace'"
run 12-suspend "$AX suspend task $T"
echo "$(now)	suspended" > 21-events.tsv
for i in $(seq 240); do st=$($KA get actor $T -a default -o json 2>/dev/null | jq -r '[.status.snapshots[]? | .durableSnapshot.state] | join(",")'); echo "$(now)	$st" >> 12b-durable-poll.tsv; case "$st" in *COMPLETED*) break;; esac; sleep 3; done
awk -F'\t' '$2!=p {print; p=$2}' 12b-durable-poll.tsv > 12c-durable-changes.tsv
echo "$(now)	durable=$st" >> 21-events.tsv
run 13-resume "$AX resume task $T"
run 14-write-unsaved "$AX ssh $T -- sh -c 'echo written-after-last-suspend > /workspace/unsaved.txt; ls -la /workspace; cat /proc/uptime'"
$KA get actor $T -a default -o yaml > 16-actor-before.yaml 2>&1
IP=$($AX describe task $T | awk '/Worker IP/ {print $3}')
$KC get pods -A -o wide | awk -v ip="$IP" '$7==ip {print $1 "\t" $2 "\t" $7}' > 17-worker-pod.tsv
NS=$(cut -f1 17-worker-pod.tsv); POD=$(cut -f2 17-worker-pod.tsv)
if [ "$NS" != "ax-system" ]; then echo "skipped: task sits on $NS/$POD, not on ax-pool" > 18-SKIPPED.txt; else
rm -f stop-poll
(while [ ! -f stop-poll ]; do echo "$(now)	$($KA get actor $T -a default -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-")] | @tsv')	$($AX get task $T 2>&1 | tail -1 | tr -s ' ' | cut -c1-90)"; sleep 1; done > 19-poll.tsv &)
sleep 4
echo "$(now)	delete-pod $NS/$POD" >> 21-events.tsv
run 22-delete-worker-pod "$KC -n $NS delete pod $POD --wait=false"
sleep 300
echo "$(now)	after-300s-no-command" >> 21-events.tsv
run 23-describe-after-loss "$AX describe task $T; $KA get actor $T -a default -o json 2>/dev/null | jq -c '{state: .status.state, node: .status.assignedNode}'"
echo "$(now)	ax-resume-1" >> 21-events.tsv
run 26-resume-after-loss "$AX resume task $T"
sleep 3
run 27-describe-after-resume "$AX describe task $T; $KA get actor $T -a default -o json 2>/dev/null | jq -c '{state: .status.state}'"
run 28-files-after-resume "$AX ssh $T -- sh -c 'ls -la /workspace; cat /workspace/note.txt; cat /workspace/unsaved.txt; cat /proc/uptime'"
IP2=$($AX describe task $T | awk '/Worker IP/ {print $3}')
$KC get pods -A -o wide | awk -v ip="$IP2" '$7==ip {print $1 "\t" $2 "\t" $7}' > 37-worker-pod-after.tsv
touch stop-poll; sleep 2
awk -F'\t' '{k=$2 FS $3 FS $4; if (k!=p) {print; p=k}}' 19-poll.tsv > 19-poll-changes.tsv
$KC -n ax-system logs deployment/ax-server --since=8m | grep s-loss2 > 40-ax-server.log 2>&1
fi
while read ns n r; do $KC -n $ns patch workerpool $n --type merge -p "{\"spec\":{\"replicas\":$r}}" >> 41-scale-restore.log 2>&1; done < 05-pool-replicas-saved.txt
sleep 20; $KC get workerpool -A > 42-pools-after.txt 2>&1
echo LOSS2-DONE >> 21-events.tsv
