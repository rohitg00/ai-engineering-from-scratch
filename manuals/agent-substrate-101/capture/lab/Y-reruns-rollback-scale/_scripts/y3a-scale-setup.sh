. ~/scripts/y-lib.sh
O=$EV/30-scale/00-setup; mkdir -p $O; : > $O/steps.tsv
[ -d $U/xs ] || git clone -q --branch v1.0.0 ~/substrate $U/xs
cd $U/xs
python3 - <<'PY'
import re
p='hack/create-kind-cluster.sh'; t=open(p).read()
if 'maxPods' not in t:
    t=t.replace("  maxParallelImagePulls: 4\nEOF\n", "  maxParallelImagePulls: 4\n  maxPods: 700\nEOF\n",1)
    mark='echo "Deleting existing kind cluster'
    add='''cat <<EOF >> "${ROOT}/bin/kind-config.yaml"
kubeadmConfigPatchesJSON6902:
- group: kubeadm.k8s.io
  version: v1beta4
  kind: ClusterConfiguration
  patch: |
    - op: add
      path: /controllerManager/extraArgs/-
      value: {name: node-cidr-mask-size, value: "22"}
EOF
'''
    assert mark in t
    t=t.replace(mark, add+mark,1)
    open(p,'w').write(t)
PY
git diff --stat > $O/00-kind-script-change.txt; git diff >> $O/00-kind-script-change.txt
usecluster ysc
export ATE_INSTALL_KIND=true
df -h / | tail -1 > $O/00-disk-before.txt; free -m | sed -n 2p >> $O/00-disk-before.txt
step 10-kind-cluster "hack/create-kind-cluster.sh" || { echo "DONE FAIL" >> $O/steps.tsv; exit 1; }
step 20-deploy-ate-system "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0" || { echo "DONE FAIL" >> $O/steps.tsv; exit 1; }
export PATH=$U/bin-new:$PATH
kubectl get node -o json | jq '{podCIDRs: .items[0].spec.podCIDRs, allocatable: .items[0].status.allocatable}' > $O/32-node.json
mkdir -p $U/tiny && cd $U/tiny
cat > main.go <<'EOF'
package main

import (
	"fmt"
	"net/http"
	"sync/atomic"
	"time"
)

func main() {
	var count atomic.Int64
	started := time.Now()
	http.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintln(w, "ok") })
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "count=%d process_age_s=%.1f\n", count.Add(1), time.Since(started).Seconds())
	})
	http.ListenAndServe(":80", nil)
}
EOF
printf 'module tiny\n\ngo 1.22\n' > go.mod
CGO_ENABLED=0 go build -o tiny . > $O/25-image.log 2>&1
printf 'FROM scratch\nCOPY tiny /tiny\nENTRYPOINT ["/tiny"]\n' > Dockerfile
sg docker -c "docker build -q -t localhost:5001/y-tiny:v1 . && docker push -q localhost:5001/y-tiny:v1" >> $O/25-image.log 2>&1
IMG=$(docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/y-tiny:v1); echo "$IMG" >> $O/25-image.log
S=sc-lab; cd $O
WORKERS=${WORKERS:-520}
cat > pool.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata: {name: $S}
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata: {name: sc-pool, namespace: $S, labels: {workload: sc-pool}}
spec:
  replicas: $WORKERS
  workerImage: ghcr.io/agent-substrate/substrate/ateworker-gvisor:v1.0.0
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits: {cpu: "1", memory: 256Mi}
      requests: {cpu: 20m, memory: 32Mi}
EOF
cat > template.yaml <<EOF
metadata: {atespace: $S, name: sc-tiny}
workerSelector:
  matchLabels: {workload: sc-pool}
containers:
- name: tiny
  image: $IMG
  wakeupProbe:
    httpGet: {path: /readyz, port: 80}
resources:
  limits: {cpuMillicores: 500, memoryBytes: 67108864}
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
s=$(date +%s)
kubectl apply -f pool.yaml > 30-setup.log 2>&1
K create atespace $S >> 30-setup.log
K create actor-template -f template.yaml >> 30-setup.log
kubectl -n $S rollout status deploy/sc-pool --timeout=1500s >> 30-setup.log 2>&1
echo "pool of $WORKERS workers ready after $(( $(date +%s) - s )) s" >> 30-setup.log
for i in $(seq 1 90); do K get actor-templates -a $S | grep -q -E 'sc-tiny +[0-9a-f-]{36}' && break; sleep 2; done
K get actor-templates -a $S >> 30-setup.log
mkprober >> 30-setup.log 2>&1
kubectl get pods -A --no-headers | awk '{print $4}' | sort | uniq -c > 31-pod-states.txt
K get workers -a $S 2>&1 | awk 'NR>1{print $NF}' | sort | uniq -c > 33-worker-states.txt
df -h / | tail -1 > 34-disk-after-setup.txt; free -m | sed -n 2p >> 34-disk-after-setup.txt
echo "DONE" >> $O/steps.tsv; tail -5 30-setup.log; cat 31-pod-states.txt 34-disk-after-setup.txt
