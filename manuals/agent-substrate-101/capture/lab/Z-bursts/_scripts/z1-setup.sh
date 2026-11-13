. ~/scripts/z-lib.sh
O=$EV/00-setup; mkdir -p $O; : > $O/steps.tsv
[ "$KIND_CLUSTER_NAME" = zb ] || { echo "cluster name is not zb, abort" | tee -a $O/00-run.log; exit 1; }
sudo sysctl -q -w fs.inotify.max_user_instances=8192 fs.inotify.max_user_watches=1048576
log "start disk=$(disk_mb)MB mem=$(mem_mb)MB inotify=$(sysctl -n fs.inotify.max_user_instances)"
cd $U/xs
git describe --tags > $O/01-checkout.txt; git diff > $O/02-kind-script-change.diff
export ATE_INSTALL_KIND=true
s=$(date +%s); sg docker -c "KIND_CLUSTER_NAME=zb hack/create-kind-cluster.sh" > $O/10-kind-cluster.log 2>&1; rc=$?
printf '10-kind-cluster\t%s\t%s\n' $rc $(( $(date +%s) - s )) >> $O/steps.tsv; [ $rc = 0 ] || { log "kind failed"; exit 1; }
kubectl config current-context > $O/11-context.txt
s=$(date +%s); sg docker -c "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0" > $O/20-deploy-ate-system.log 2>&1; rc=$?
printf '20-deploy-ate-system\t%s\t%s\n' $rc $(( $(date +%s) - s )) >> $O/steps.tsv; [ $rc = 0 ] || { log "deploy failed"; exit 1; }
kubectl get node -o json | jq '{podCIDRs: .items[0].spec.podCIDRs, allocatable: .items[0].status.allocatable}' > $O/21-node.json
kubectl -n ate-system get deploy -o wide > $O/22-system-deploy.txt
cd $O
IMG=localhost:5001/u-drill@sha256:374c724652995ef3083d8fe2592b551843d1dcaddb11b2a65eccce8022dfaae0
cat > pool.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata: {name: $S}
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata: {name: sc-pool, namespace: $S, labels: {workload: sc-pool}}
spec:
  replicas: 50
  workerImage: ghcr.io/agent-substrate/substrate/ateworker-gvisor:v1.0.0
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits: {cpu: "1", memory: 512Mi}
      requests: {cpu: 50m, memory: 64Mi}
EOF
cat > template.yaml <<EOF
metadata: {atespace: $S, name: sc-drill}
workerSelector:
  matchLabels: {workload: sc-pool}
containers:
- name: drill
  image: $IMG
  wakeupProbe:
    httpGet: {path: /readyz, port: 80}
resources:
  limits: {cpuMillicores: 500, memoryBytes: 134217728}
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
kubectl apply -f pool.yaml > 30-setup.log 2>&1
K create atespace $S >> 30-setup.log
K create actor-template -f template.yaml >> 30-setup.log
kubectl -n ate-system get sa atenet-client >/dev/null 2>&1 || kubectl -n ate-system create sa atenet-client >> 30-setup.log 2>&1
prober_yaml | kubectl apply -f - >> 30-setup.log 2>&1
kubectl -n ate-system wait --for=condition=Ready pod/u-prober --timeout=180s >> 30-setup.log 2>&1
api_ms() { a=""; for i in 1 2 3 4 5; do t=$(ms); kubectl get --raw /readyz >/dev/null 2>&1; a="$a $(( $(ms) - t ))"; done; echo $a | tr ' ' '\n' | sort -n | sed -n 3p; }
pods_ms() { t=$(ms); kubectl get pods -A --no-headers >/dev/null 2>&1; echo $(( $(ms) - t )); }
active() { K get workers -a $S | grep -c ACTIVE; }
nodemem() { docker stats --no-stream --format '{{.MemUsage}}' $NODE | cut -d/ -f1 | tr -d ' '; }
echo -e "replicas\tready_s\tactive_s\tactive\tapi_readyz_ms_median5\tget_pods_ms\tguest_mem_avail_mb\tnode_mem\tdisk_mb\tpods_total" > 20-growth.tsv
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
