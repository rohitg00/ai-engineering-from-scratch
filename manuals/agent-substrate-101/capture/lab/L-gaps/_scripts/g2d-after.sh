export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/L-gaps/multinode; cd "$E"; S=lab-n
kubectl config use-context kind-multi > /dev/null
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
ts() { date -u +%FT%T.%3NZ; }
T=93-after-node-return.tsv; echo "ts	event	detail" > $T
echo "$(ts)	actors	$(K get actors -a $S | tr '\n' ';' | cut -c1-400)" >> $T
for a in $(K get actors -a $S | awk 'NR>1{print $2}'); do
  echo "$(ts)	$a-state	$(K get actor $a -a $S | awk 'NR==2{print $4, $5}')" >> $T
  echo "$(ts)	$a-revert	$(K revert actor $a -a $S | tr '\n' ' ' | cut -c1-220)" >> $T
  echo "$(ts)	$a-resume	$(K resume actor $a -a $S | tr '\n' ' ' | cut -c1-220)" >> $T
  n=$(kubectl ate get actor $a -a $S -o json 2>/dev/null | jq -r '.status.assignedNode // "-"')
  (kubectl ate proxy actor $a -a $S 8899:80 > /tmp/px.log 2>&1 &); sleep 4
  echo "$(ts)	$a-call	node=$n $(curl -s -m 20 -w ' -> %{http_code} %{time_total}s' http://127.0.0.1:8899/ | tr '\n' ' ')" >> $T
  pkill -f "proxy actor $a "; K suspend actor $a -a $S --mode sync > /dev/null; K delete actor $a -a $S > /dev/null
done
K get workers > 94-workers-final.txt; kubectl get pods -n lab-n -o wide --no-headers | awk '{print $1,$3,$7}' >> 94-workers-final.txt
grep -E "MarkWorkerUnavailable|DrainWorker|DeleteWorker" 96-controller-events.log | head -3 | cut -c1-200
for p in $(kubectl -n ate-system get pods -o name | grep ate-api-server); do kubectl -n ate-system logs $p -c ate-api-server --since=75m 2>/dev/null | grep -E "MarkWorkerUnavailable|DrainWorker|DeleteWorker" | cut -c1-140; done | sort | awk '{print substr($0,1,140)}' > 98-worker-state-rpcs.log
wc -l 98-worker-state-rpcs.log; cut -c1-250 $T
rm -f body.tmp; sudo fstrim -v / > /dev/null
