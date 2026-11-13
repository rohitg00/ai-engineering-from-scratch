set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
ROOT=~/evidence/W-ax-kagent-2/20-ax-flight; mkdir -p $ROOT; cd $ROOT
$AX --help > 00-ax-help.txt 2>&1
$AX ssh --help > 00-ax-ssh-help.txt 2>&1
$KC get workerpool -A > 01-pools-before.txt 2>&1
$KA get worker > 02-workers-before.txt 2>&1
for p in demo-agent/agent demo-drill/drill demo-idle/idle demo-tools/tools; do
  ns=${p%/*}; n=${p#*/}; r=$($KC -n $ns get workerpool $n -o jsonpath='{.spec.replicas}'); [ -f 05-pool-replicas-saved.done ] || echo "$ns $n $r" >> 05-pool-replicas-saved.txt
  $KC -n $ns patch workerpool $n --type merge -p '{"spec":{"replicas":0}}' >> 06-scale-down.log 2>&1
done
for i in $(seq 60); do n=$($KC get pods -A --no-headers 2>/dev/null | grep -E "^demo-(agent|drill|idle|tools) +(agent|drill|idle|tools)-" | wc -l); [ "$n" = 0 ] && break; sleep 2; done
touch 05-pool-replicas-saved.done
$KA get worker > 07-workers-after-scale.txt 2>&1

one() {
  T=$1; WAIT=$2
  E=$ROOT/$T; mkdir -p $E; cd $E
  echo "step	rc	seconds" > steps.tsv
  cat > 08-task.yaml <<EOF
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: $T
  atespace: default
spec:
  debug: true
  command: ["sleep", "infinity"]
EOF
  run 09-apply "$AX apply -f 08-task.yaml"
  run 10-resume-first "$AX resume task $T"
  run 11-write-note "$AX ssh $T -- sh -c 'echo note-saved-by-suspend > /workspace/note.txt; ls -la /workspace'"
  run 12-suspend "$AX suspend task $T"
  echo "$(now)	suspended, waiting $WAIT s" > 21-events.tsv
  sleep $WAIT
  $KA get snapshot -a default 2>&1 | grep -E "NAME|$T" > 12b-snapshots-before-resume.txt
  $KA get actor $T -a default -o yaml > 12c-actor-suspended.yaml 2>&1
  run 13-resume "$AX resume task $T"
  run 15-describe-before "$AX describe task $T"
  IP=$($AX describe task $T | awk '/Worker IP/ {print $3}')
  $KC get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.status.podIP}{"\n"}{end}' | awk -F'\t' -v ip="$IP" '$3==ip' > 17-worker-pod.tsv
  NS=$(cut -f1 17-worker-pod.tsv); POD=$(cut -f2 17-worker-pod.tsv)
  echo "worker pod: $NS/$POD"
  if [ "$NS" != "ax-system" ]; then echo "skipped: task sits on $NS/$POD, not on ax-pool" > 18-SKIPPED.txt; cat 18-SKIPPED.txt; return; fi
  rm -f stop-poll
  (while [ ! -f stop-poll ]; do echo "$(now)	$($KA get actor $T -a default -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-")] | @tsv')	$($AX get task $T 2>&1 | tail -1 | tr -s ' ' | cut -c1-90)"; sleep 1; done > 19-poll.tsv &)
  ( s=$(date +%s.%N); $AX ssh $T -- sh -c 'i=0; while [ $i -lt 120 ]; do i=$((i+1)); echo "tick $i $(date -u +%T)"; echo $i > /workspace/progress.txt; sleep 1; done; echo finished-120' 2> 20-inflight-stream.err | while IFS= read -r line; do echo "$(now)	$line"; done > 20-inflight-stream.tsv; echo "$(now)	stream-ended	rc=${PIPESTATUS[0]}	after=$(el $s)" > 20-inflight-stream.end ) &
  ( s=$(date +%s.%N); timeout 200 $AX ssh $T -- sh -c 'sleep 120; echo slept-120-ok' > 20-inflight-sleep.out 2>&1; echo "$(now)	sleep-request-ended	rc=$?	after=$(el $s)" > 20-inflight-sleep.end ) &
  sleep 8
  echo "$(now)	delete-pod $NS/$POD" >> 21-events.tsv
  run 22-delete-worker-pod "$KC -n $NS delete pod $POD --wait=false"
  sleep 45
  echo "$(now)	after-45s" >> 21-events.tsv
  run 23-describe-after-loss "$AX describe task $T; $KA get actor $T -a default -o json 2>/dev/null | jq -c '{state: .status.state, node: .status.assignedNode}'"
  cat 20-inflight-stream.end 20-inflight-sleep.end > 23b-inflight-ends-at-45s.txt 2>&1
  $KA get worker > 24-workers-after-loss.txt 2>&1
  $KC -n ax-system get pods -o wide > 25-pods-after-loss.txt 2>&1
  run 25b-ssh-while-crashed "timeout 20 $AX ssh $T -- cat /workspace/note.txt"
  echo "$(now)	ax-resume-1" >> 21-events.tsv
  run 26-resume-after-loss "$AX resume task $T"
  sleep 4
  run 27-describe-after-resume "$AX describe task $T; $KA get actor $T -a default -o json 2>/dev/null | jq -c '{state: .status.state}'"
  run 28-files-after-resume "$AX ssh $T -- sh -c 'ls -la /workspace; cat /workspace/note.txt; echo progress:; cat /workspace/progress.txt; ps -o pid,etime,args 2>/dev/null | head -8; cat /proc/uptime'"
  IP2=$($AX describe task $T | awk '/Worker IP/ {print $3}')
  $KC get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.status.podIP}{"\n"}{end}' | awk -F'\t' -v ip="$IP2" '$3==ip' > 37-worker-pod-after.tsv
  sleep 3; touch stop-poll; sleep 2
  for i in $(seq 40); do [ -f 20-inflight-sleep.end ] && [ -f 20-inflight-stream.end ] && break; sleep 2; done
  awk -F'\t' '{k=$2 FS $3 FS $4; if (k!=p) {print; p=k}}' 19-poll.tsv > 19-poll-changes.tsv
  $KA logs actor $T -a default --source=lifecycle 2>/dev/null | tail -40 > 39-actor-lifecycle.log
  $KC -n ax-system logs deployment/ax-server --since=8m > 40-ax-server.log 2>&1
  run 43-suspend-end "$AX suspend task $T"
  echo "#### $T"; cat steps.tsv 17-worker-pod.tsv 21-events.tsv 19-poll-changes.tsv 37-worker-pod-after.tsv
  echo "== stream tail"; tail -4 20-inflight-stream.tsv; cat 20-inflight-stream.end; head -c 400 20-inflight-stream.err; echo
  echo "== sleep request"; cat 20-inflight-sleep.end; head -c 400 20-inflight-sleep.out; echo
  for f in 23-* 25b-* 26-* 27-* 28-*; do echo "== $f"; grep -v "^Warning: no --token" $f | cut -c1-300 | head -22; done
  for i in $(seq 60); do n=$($KC -n ax-system get pods --no-headers | grep ax-pool | grep -c Running); [ "$n" -ge 2 ] && break; sleep 2; done
  sleep 10
}
one w-fl1 3
one w-fl2 320
cd $ROOT
while read ns n r; do $KC -n $ns patch workerpool $n --type merge -p "{\"spec\":{\"replicas\":$r}}" >> 41-scale-restore.log 2>&1; done < 05-pool-replicas-saved.txt
sleep 25; $KC get workerpool -A > 42-pools-after.txt 2>&1; cat 42-pools-after.txt
echo DONE
