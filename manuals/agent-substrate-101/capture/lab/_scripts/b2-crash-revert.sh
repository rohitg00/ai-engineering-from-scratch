export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/B-lifecycle; cd "$E"
A=my-counter-1; S=ate-demo-counter; T=20-trace-ops.tsv
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date -u +%FT%T.%3NZ; }
mark() { echo "$(now)	$1	$2" >> $T; }
st() { kubectl ate get actor $A -a $S -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-"), (.metadata.version // "-"), ((.status.snapshots // []) | map(.owner + ":" + (.durableSnapshot.state // "none") + ":gen" + (.generation|tostring)) | join(","))] | @tsv'; }
call() { r=$(curl -s -m 60 -o body.tmp -w '%{http_code}\t%{time_total}' -X POST http://localhost:8000/); mark "$1" "$r	$(tr -d '\n' < body.tmp | cut -c1-140)"; }
timed() { l="$1"; shift; s=$(date +%s.%N); out=$("$@" 2>&1 | grep -v '^Warning' | tr '\n' ' ' | cut -c1-200); mark "$l" "$(echo "$(date +%s.%N) - $s" | bc -l | xargs printf '%.3f')s	$out"; }
echo "ts	event	detail" > $T
(while [ ! -f stop-poll ]; do echo "$(now)	state	$(st)" >> 21-state-poll.tsv; sleep 0.25; done &)
rm -f stop-poll 21-state-poll.tsv
pgrep -f "proxy actor $A" >/dev/null || (kubectl ate proxy actor $A -a $S > 01-proxy.log 2>&1 &)
sleep 3
call call-running
timed suspend-async K suspend actor $A -a $S
sleep 2; mark state "$(st)"
K get actor $A -a $S -o yaml > 22-actor-after-async-suspend.yaml
call call-resume-after-async
timed suspend-sync K suspend actor $A -a $S --mode sync
mark state "$(st)"
K get actor $A -a $S -o yaml > 23-actor-after-sync-suspend.yaml
timed resume-cli K resume actor $A -a $S
mark state "$(st)"
call call-a; call call-b; call call-c
POD=$(kubectl ate get actor $A -a $S -o json 2>/dev/null | jq -r '.. | strings | select(test("^ate-demo-counter/counter-"))' | head -1 | cut -d/ -f2)
[ -z "$POD" ] && POD=$(K get actor $A -a $S | awk 'NR==2{print $5}' | cut -d/ -f2)
mark crash-inject "kubectl delete pod $POD --grace-period=0 --force"
kubectl -n $S delete pod "$POD" --grace-period=0 --force > 24-delete-pod.log 2>&1
for i in $(seq 1 40); do s=$(st | cut -f1); [ "$s" != "ACTOR_STATE_RUNNING" ] && break; sleep 0.5; done
mark state-after-crash "$(st)"
call call-while-crashed
sleep 5; mark state "$(st)"
K get actor $A -a $S -o yaml > 25-actor-crashed.yaml
timed resume-while-crashed K resume actor $A -a $S
timed revert K revert actor $A -a $S
mark state "$(st)"
call call-after-revert
mark state "$(st)"
K get actor $A -a $S -o yaml > 26-actor-after-revert.yaml
K logs actor $A -a $S --source=lifecycle > 27-lifecycle.log 2>&1
kubectl get pods -n $S -o wide > 28-pods-after.txt
touch stop-poll
echo DONE >> $T
cat $T | cut -c1-260
