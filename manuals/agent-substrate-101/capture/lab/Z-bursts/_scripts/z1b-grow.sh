. ~/scripts/z-lib.sh
O=$EV/00-setup; cd $O
api_ms() { a=""; for i in 1 2 3 4 5; do t=$(ms); kubectl get --raw /readyz >/dev/null 2>&1; a="$a $(( $(ms) - t ))"; done; echo $a | tr ' ' '\n' | sort -n | sed -n 3p; }
pods_ms() { t=$(ms); kubectl get pods -A --no-headers >/dev/null 2>&1; echo $(( $(ms) - t )); }
active() { K get workers -n $S | grep -c WORKER_STATE_ACTIVE; }
nodemem() { docker stats --no-stream --format '{{.MemUsage}}' $NODE | cut -d/ -f1 | tr -d ' '; }
echo -e "replicas\tready_s\tactive_s\tactive\tapi_readyz_ms_median5\tget_pods_ms\tguest_mem_avail_mb\tnode_mem\tdisk_mb\tpods_total" > 20-growth.tsv
log "growth rerun: the first pass counted workers with -a, which lists none; the 50-worker pool was created with the cluster at about 06:35"
N=0; prev=0
for R in 50 100 150 200 250 300; do
  [ "$(mem_mb)" -lt 12000 ] && { log "STOP growth: guest memory available $(mem_mb) MB"; break; }
  [ "$(disk_mb)" -lt 5000 ] && { log "STOP growth: guest disk $(disk_mb) MB"; break; }
  s=$(date +%s)
  kubectl -n $S patch workerpool sc-pool --type merge -p "{\"spec\":{\"replicas\":$R}}" >> 30-setup.log 2>&1
  rdy=fail; for i in $(seq 1 300); do r=$(kubectl -n $S get deploy sc-pool -o jsonpath='{.status.readyReplicas}' 2>/dev/null); [ "${r:-0}" -ge $R ] && { rdy=$(( $(date +%s) - s )); break; }; sleep 1; done
  act=fail; for i in $(seq 1 120); do a=$(active); [ "$a" -ge $R ] && { act=$(( $(date +%s) - s )); break; }; sleep 1; done
  am=$(api_ms); pm=$(pods_ms)
  echo -e "$R\t$rdy\t$act\t$(active)\t$am\t$pm\t$(mem_mb)\t$(nodemem)\t$(disk_mb)\t$(kubectl get pods -A --no-headers 2>/dev/null | wc -l)" | tee -a 20-growth.tsv
  if [ "$rdy" = fail ] || [ "$act" = fail ]; then log "STOP growth at $R: not ready in time"; break; fi
  if [ "$am" -gt 1000 ] || [ "$pm" -gt 3000 ]; then log "STOP growth at $R: API slow ($am ms readyz, $pm ms get pods)"; N=$R; break; fi
  if [ $prev -gt 0 ] && [ "$rdy" -gt $(( prev * 3 + 30 )) ]; then log "STOP growth at $R: ready time $rdy s against $prev s before"; N=$R; break; fi
  N=$R; prev=$rdy
done
echo $N > $EV/N.txt
log "pool size N=$N"
kubectl get pods -A --no-headers | awk '{print $4}' | sort | uniq -c > 31-pod-states.txt
echo DONE >> steps.tsv
