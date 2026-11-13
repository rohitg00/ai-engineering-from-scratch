export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/L-gaps/restart; mkdir -p "$E"; cd "$E"; S=lab-c
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
ts() { date -u +%FT%T.%3NZ; }
T=10-poll.tsv; echo "ts	t_s	node	pods_not_running	workers_active	ballast_workers	resume_result" > $T
K create actor w1 -a $S --template ballast-50 > /dev/null
K resume actor w1 -a $S > /dev/null; K suspend actor w1 -a $S --mode sync > /dev/null
K get actor w1 -a $S > 01-actor-before.txt; K get workers > 02-workers-before.txt
kubectl get pods -A -o wide > 03-pods-before.txt
echo "$(ts) docker restart kind-control-plane" > 04-events.txt
t0=$(date +%s)
sg docker -c "docker restart kind-control-plane" > /dev/null 2>&1
echo "$(ts) restart returned after $(( $(date +%s) - t0 ))s" >> 04-events.txt
ok=0; allrun=""; firstok=""
for i in $(seq 1 170); do
  t=$(( $(date +%s) - t0 ))
  node=$(kubectl get nodes --no-headers 2>/dev/null | awk '{print $2}' | head -1)
  nr=$(kubectl get pods -A --no-headers 2>/dev/null | grep -v -E "Running|Completed" | wc -l)
  tot=$(kubectl get pods -A --no-headers 2>/dev/null | wc -l)
  w=$(K get workers 2>/dev/null)
  wa=$(echo "$w" | grep -c WORKER_STATE_ACTIVE)
  wb=$(echo "$w" | awk '$2=="ballast"{printf "%s:%s:%s ", $3, $4, $5}')
  echo "### t=$t $(ts)" >> 11-workers-each-poll.txt; echo "$w" | cut -c1-200 >> 11-workers-each-poll.txt
  r=$(K resume actor w1 -a $S | tr '\n' ' ' | cut -c1-230)
  case "$r" in *ACTOR_STATE_RUNNING*) res="RUNNING"; ok=$((ok+1)); [ -z "$firstok" ] && firstok=$t && echo "$(ts) first successful resume at t=$t" >> 04-events.txt; K suspend actor w1 -a $S --mode sync > /dev/null;; *) res="$r";; esac
  echo "$(ts)	$t	${node:--}	$nr/$tot	$wa	$wb	$res" >> $T
  if [ -z "$allrun" ] && [ "$tot" -gt 20 ] && [ "$nr" = "0" ]; then allrun=$t; echo "$(ts) all pods Running at t=$t" >> 04-events.txt; fi
  [ $ok -ge 5 ] && break
  sleep 2
done
kubectl get pods -A -o wide > 05-pods-after.txt
AT=$(kubectl -n ate-system get pods -o name | grep atelet | head -1)
kubectl -n ate-system logs $AT -c atelet --since=10m 2>/dev/null | cut -c1-500 > 20-atelet-since-restart.log
kubectl -n ate-system logs $AT -c atelet --previous 2>/dev/null | tail -40 | cut -c1-500 > 21-atelet-previous-tail.log
for p in $(kubectl -n lab-c get pods -o name); do echo "### $p"; kubectl -n lab-c logs $p --since=10m 2>/dev/null | cut -c1-500 | head -120; echo "### previous"; kubectl -n lab-c logs $p --previous 2>/dev/null | tail -15 | cut -c1-400; done > 22-worker-pods.log
for p in $(kubectl -n ate-system get pods -o name | grep ate-api-server); do echo "### $p"; kubectl -n ate-system logs $p -c ate-api-server --since=10m 2>/dev/null | grep -i -E "no worker|room|RESOURCE_EXHAUSTED|worker|epoch|lease|cache|resync|relist" | cut -c1-500 | head -150; done > 23-ateapi.log
kubectl -n ate-system get pods -o wide > 24-system-pods.txt
kubectl get events -A --sort-by=.lastTimestamp 2>/dev/null | tail -40 | cut -c1-220 > 25-events.txt
K suspend actor w1 -a $S --mode sync > /dev/null; K delete actor w1 -a $S > /dev/null
K revert actor r1 -a $S > /dev/null 2>&1
echo DONE >> 04-events.txt
cat 04-events.txt
