export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/L-gaps/multinode; mkdir -p "$E"; cd ~/substrate
S="$E/02-steps.tsv"; : > $S
step() { n="$1"; shift; s=$(date +%s); sg docker -c "$*" > "$E/$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(( $(date +%s) - s ))" >> $S; return $rc; }
free -g | sed -n 2p > "$E/00-vm.txt"; nproc >> "$E/00-vm.txt"
cat > "$E/01-kind-multi.yaml" <<'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
- role: worker
  extraMounts:
  - hostPath: /dev/kvm
    containerPath: /dev/kvm
- role: worker
  extraMounts:
  - hostPath: /dev/kvm
    containerPath: /dev/kvm
featureGates:
  ClusterTrustBundle: true
  ClusterTrustBundleProjection: true
  PodCertificateRequest: true
runtimeConfig:
  "certificates.k8s.io/v1beta1": "true"
networking:
  ipFamily: ipv4
kubeadmConfigPatches:
- |
  kind: KubeletConfiguration
  serializeImagePulls: false
  maxParallelImagePulls: 4
EOF
step 10-kind-create "hack/kind.sh create cluster --name multi --config $E/01-kind-multi.yaml" || exit 1
for node in $(sg docker -c "hack/kind.sh get nodes --name multi"); do
  sg docker -c "docker exec $node sysctl net.ipv4.conf.all.proxy_arp=1" > /dev/null
  sg docker -c "docker exec $node chmod 666 /dev/kvm" 2>/dev/null
  sg docker -c "docker exec $node mkdir -p /etc/containerd/certs.d/localhost:5001"
  echo '[host."http://kind-registry:5000"]' | sg docker -c "docker exec -i $node cp /dev/stdin /etc/containerd/certs.d/localhost:5001/hosts.toml"
done
sg docker -c "docker network connect kind kind-registry" 2>/dev/null
kubectl --context kind-multi apply -f - > /dev/null <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:5001"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF
kubectl config use-context kind-multi > /dev/null
kubectl get nodes -o wide > "$E/11-nodes.txt"
kubectl cordon multi-worker2 > /dev/null
export ATE_INSTALL_KIND=true KIND_CLUSTER_NAME=multi
step 20-deploy-ate-system "ATE_INSTALL_KIND=true KIND_CLUSTER_NAME=multi go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0 --sandbox-classes=gvisor" || { tail -25 "$E/20-deploy-ate-system.log"; exit 1; }
kubectl uncordon multi-worker2 > /dev/null
[ -x ~/go/bin/kubectl-ate ] || go install ./cmd/kubectl-ate
kubectl get pods -A -o wide > "$E/21-pods.txt"
mkdir -p ~/ballast && cd ~/ballast
if [ ! -f main.go ]; then
cat > main.go <<'EOF'
package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"
)

func main() {
	mb := flag.Int("mb", 0, "MiB of memory to hold")
	flag.Parse()
	var ready atomic.Bool
	var count atomic.Int64
	started := time.Now()
	buf := make([]byte, *mb<<20)
	go func() {
		rand.Read(buf)
		ready.Store(true)
	}()
	http.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if !ready.Load() {
			w.WriteHeader(503)
			return
		}
		w.WriteHeader(200)
	})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		var sum uint64
		for i := 0; i < len(buf); i += 1 << 20 {
			sum += uint64(buf[i])
		}
		fmt.Fprintf(w, "count=%d mb=%d sum=%d process_age_s=%.1f\n", count.Add(1), *mb, sum, time.Since(started).Seconds())
	})
	http.ListenAndServe(":80", nil)
}
EOF
printf 'module ballast\n\ngo 1.27\n' > go.mod
fi
CGO_ENABLED=0 go build -o ballast . || exit 1
printf 'FROM scratch\nCOPY ballast /ballast\nENTRYPOINT ["/ballast"]\n' > Dockerfile
sg docker -c "docker build -q -t localhost:5001/ballast:multi . && docker push -q localhost:5001/ballast:multi" > /dev/null 2>&1
DIGEST=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/ballast:multi")
cat > "$E/30-pool.yaml" <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: lab-n
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata:
  name: ballast
  namespace: lab-n
  labels:
    workload: ballast
spec:
  replicas: 4
  workerImage: ghcr.io/agent-substrate/substrate/ateworker-gvisor:v1.0.0
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits:
        cpu: "2"
        memory: 2Gi
      requests:
        cpu: 250m
        memory: 2Gi
EOF
kubectl apply -f "$E/30-pool.yaml" > "$E/31-apply.log" 2>&1
kubectl ate create atespace lab-n >> "$E/31-apply.log" 2>&1
for mb in 0 50; do
cat > "$E/32-tmpl-$mb.yaml" <<EOF
metadata:
  atespace: lab-n
  name: ballast-$mb
workerSelector:
  matchLabels:
    workload: ballast
containers:
- name: ballast
  image: $DIGEST
  command:
  - /ballast
  - --mb=$mb
  wakeupProbe:
    httpGet:
      path: /readyz
      port: 80
resources:
  limits:
    cpuMillicores: 250
    memoryBytes: $(( (mb + 200) * 1048576 ))
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
kubectl ate create actor-template -f "$E/32-tmpl-$mb.yaml" >> "$E/31-apply.log" 2>&1
done
kubectl -n lab-n rollout status deploy/ballast --timeout=300s >> "$E/31-apply.log" 2>&1
for i in $(seq 1 60); do n=$(kubectl ate get actor-templates -a lab-n 2>/dev/null | awk 'NR>1 && $3 ~ /-/' | wc -l); [ "$n" = "2" ] && break; sleep 4; done
kubectl ate get actor-templates -a lab-n 2>&1 | grep -v Warning > "$E/33-templates.txt"
kubectl get pods -n lab-n -o wide > "$E/34-pool-pods.txt"
kubectl get pods -A -o wide --no-headers | awk '{print $8}' | sort | uniq -c > "$E/35-pods-per-node.txt"
kubectl get pods -n ate-system -o wide --no-headers | awk '{print $1, $8}' > "$E/36-system-pods-nodes.txt"
kubectl ate get workers 2>&1 | grep -v Warning > "$E/37-workers.txt"
kubectl -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | .name + " " + (.args // [] | join(" "))' > "$E/38-atelet-args.txt"
echo SETUP-DONE >> $S
cat $S; cat "$E/35-pods-per-node.txt" "$E/34-pool-pods.txt" "$E/33-templates.txt"; free -g | sed -n 2p
