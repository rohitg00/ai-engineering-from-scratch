. ~/scripts/z-lib.sh
O=$EV/10-run; cd $O
log "deleting t-151..t-200 as well: 200 snapshots still to upload would take guest disk near 3 GB; the rest of the run uses 150 actors"
seq -f "t-%03g" 151 200 | xargs -P 24 -I{} sh -c "kubectl ate delete actor {} -a $S >/dev/null 2>&1 || echo fail {}" | wc -l
running=$(K get actors -a $S | awk 'NR>1 && $4 ~ /RUNNING/ {print $2}')
log "running before continuing: $running"
for a in $running; do kubectl ate suspend actor $a -a $S >/dev/null 2>&1; done
sleep 15
log "continue: $(K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c | tr '\n' ' ') disk=$(disk_mb)MB snap=$(docker exec $NODE du -sm /var/lib/ate 2>/dev/null | awk '{print $1}')MB"
eval "$(sed -n '/^burst() {/,/^}/p' ~/scripts/z2-run.sh)"
eval "$(sed -n '/^create_many()/,/^names()/p' ~/scripts/z2-run.sh)"
one() { c=$1; procs=$2; http=$3; tag=$4
  r=$(burst c$c-p$procs-$http-$tag $procs $http $(names $c)); echo -e "$c\t$procs\t$http\t$tag\t$r\t$(disk_mb)\t$(mem_mb)" | tee -a 20-concurrency.tsv
  [ "$(disk_mb)" -lt 3000 ] && { log "STOP: guest disk under 3000 MB"; echo STOPPED > 99-done; exit 1; }
  sleep 1; suspend_many $(names $c) > /dev/null; settle
}
one 150 4 h2 p4
R0=$(kubectl -n ate-system get deploy ate-api-server -o jsonpath='{.spec.replicas}')
log "ate-api-server replicas at start: $R0"
for R in 1 4; do
  kubectl -n ate-system scale deploy ate-api-server --replicas=$R >> 30-scale.log 2>&1
  kubectl -n ate-system rollout status deploy ate-api-server --timeout=180s >> 30-scale.log 2>&1; sleep 15
  log "ate-api-server replicas=$R ($(kubectl -n ate-system get deploy ate-api-server -o jsonpath='{.status.readyReplicas}') ready)"
  for rep in 1 2; do one 150 1 h2 api$R-r$rep; done
done
kubectl -n ate-system scale deploy ate-api-server --replicas=$R0 >> 30-scale.log 2>&1
kubectl -n ate-system rollout status deploy ate-api-server --timeout=180s >> 30-scale.log 2>&1
RR0=$(kubectl -n ate-system get deploy atenet-router -o jsonpath='{.spec.replicas}')
log "atenet-router replicas at start: $RR0"
kubectl -n ate-system scale deploy atenet-router --replicas=4 >> 30-scale.log 2>&1
kubectl -n ate-system rollout status deploy atenet-router --timeout=180s >> 30-scale.log 2>&1; sleep 15
log "atenet-router replicas=4 ($(kubectl -n ate-system get deploy atenet-router -o jsonpath='{.status.readyReplicas}') ready)"
for rep in 1 2; do one 150 1 h2 router4-r$rep; done
kubectl -n ate-system scale deploy atenet-router --replicas=$RR0 >> 30-scale.log 2>&1
kubectl -n ate-system rollout status deploy atenet-router --timeout=180s >> 30-scale.log 2>&1
log "replicas restored: ate-api-server=$R0 atenet-router=$RR0"
: > 21-sequential.tsv
for n in $(seq -f "t-%03g" 1 20); do burst seq-$n 1 h2 $n >> 21-sequential.tsv; kubectl ate suspend actor $n -a $S >/dev/null 2>&1; done
settle
docker exec $NODE crictl stats 2>/dev/null | awk 'NR==1 || /ate-api|postgres|rustfs|atelet|atenet|controller|etcd|apiserver/' > 32-crictl-stats-end.txt
kubectl -n ate-system get deploy,ds,sts -o wide > 33-system-objects.txt 2>&1
kubectl -n ate-system logs deploy/ate-api-server --since=5m 2>&1 | tail -300 > 35-ateapi-tail.log
kubectl -n ate-system logs ds/atelet --since=5m 2>&1 | tail -300 > 36-atelet-tail.log
kubectl -n ate-system logs deploy/atenet-router --since=20m 2>&1 | grep -i -E 'error|timeout|504|503' | tail -100 > 37-router-errors.log
log "end: $(K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c | tr '\n' ' ') disk=$(disk_mb)MB mem=$(mem_mb)MB"
echo DONE > 99-done
