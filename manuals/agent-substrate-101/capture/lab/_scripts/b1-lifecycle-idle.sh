export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/B-lifecycle; mkdir -p "$E"; cd "$E"
A=my-counter-1; S=ate-demo-counter
now() { date -u +%FT%T.%3NZ; }
state() { kubectl ate get actor $A -a $S -o json 2>/dev/null | jq -r '[.status.state, (.status.workerPod // .status.worker.pod // "-")] | @tsv'; }
kubectl ate get actor $A -a $S -o json > 00-actor-before.json 2>/dev/null
(kubectl ate proxy actor $A -a $S > 01-proxy.log 2>&1 &)
sleep 4
echo "ts	event	detail" > 10-trace.tsv
echo "$(now)	state	$(state)" >> 10-trace.tsv
for i in 1 2 3 4 5; do
  r=$(curl -s -o "11-call-$i.body" -w '%{http_code}\t%{time_total}' -X POST http://localhost:8000/)
  echo "$(now)	call-$i	$r	$(tr '\n' ' ' < 11-call-$i.body | cut -c1-160)" >> 10-trace.tsv
done
echo "$(now)	state	$(state)" >> 10-trace.tsv
kubectl ate get actor $A -a $S -o json > 12-actor-running.json 2>/dev/null
kubectl ate get worker -a $S > 13-workers.txt 2>&1
echo "$(now)	idle-watch-start	no requests for 900 s" >> 10-trace.tsv
for i in $(seq 1 60); do
  sleep 15
  echo "$(now)	state	$(state)" >> 10-trace.tsv
done
echo "$(now)	idle-watch-end" >> 10-trace.tsv
r=$(curl -s -o 14-call-after-idle.body -w '%{http_code}\t%{time_total}' -X POST http://localhost:8000/)
echo "$(now)	call-after-idle	$r	$(tr '\n' ' ' < 14-call-after-idle.body | cut -c1-160)" >> 10-trace.tsv
echo "$(now)	state	$(state)" >> 10-trace.tsv
echo DONE >> 10-trace.tsv
