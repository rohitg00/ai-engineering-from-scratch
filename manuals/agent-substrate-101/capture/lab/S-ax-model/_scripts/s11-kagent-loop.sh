set -u
E=~/evidence/S-ax-model/20-kagent/loop; mkdir -p $E; cd $E
export KUBECONFIG=~/kagent.kubeconfig
. ~/scripts/lib.sh
sg() { shift 2; bash -c "$1"; }
: > timings.tsv; : > events.log; rm -f actor-trace.log
echo 'Run the command `cat /proc/uptime` with the bash tool and tell me the first number.' > prompt.txt
T0=$(date -u +%FT%TZ); echo $T0 > t0.txt
start_tracer
for m in 3b 1p5b; do
  S=$(new_session real-$m "A-$m"); echo "$m $S" >> sessions.txt
  for i in $(seq -w 1 20); do turn "A-$m-$i" "$S" prompt.txt >/dev/null; sleep 4; done
  for i in $(seq -w 1 5); do S2=$(new_session real-$m "C-$m-$i"); echo "$m-first $S2" >> sessions.txt; turn "C-$m-first-$i" "$S2" prompt.txt >/dev/null; sleep 3; done
done
sleep 5
stop_tracer
docker logs --since "$T0" -t ollama > ollama.log 2>&1
kubectl -n ate-system logs deploy/ate-api-server -c ate-api-server --since=40m --all-pods=true > ate-api.log 2>&1 || for p in $(kubectl -n ate-system get pods -o name | grep ate-api-server); do kubectl -n ate-system logs $p -c ate-api-server --since=40m; done > ate-api.log 2>&1
kubectl -n kagent logs deploy/kagent-controller --since=40m > kagent-controller.log 2>&1
kubectl ate get actor -a kagent 2>/dev/null | grep -v lab-agent > actors-final.txt
free -m | sed -n 2p > guest-mem.txt
echo DONE >> events.log
