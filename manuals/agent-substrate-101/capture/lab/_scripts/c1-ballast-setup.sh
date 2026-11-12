export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/C-resume-vs-size; mkdir -p "$E" ~/ballast; cd ~/ballast
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
	fill := flag.String("fill", "random", "random or zero")
	flag.Parse()
	var ready atomic.Bool
	var count atomic.Int64
	started := time.Now()
	buf := make([]byte, *mb<<20)
	go func() {
		if *fill == "random" {
			rand.Read(buf)
		} else {
			for i := 0; i < len(buf); i += 4096 {
				buf[i] = 0
			}
		}
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
		fmt.Fprintf(w, "count=%d mb=%d fill=%s sum=%d process_age_s=%.1f\n", count.Add(1), *mb, *fill, sum, time.Since(started).Seconds())
	})
	http.ListenAndServe(":80", nil)
}
EOF
cat > go.mod <<'EOF'
module ballast

go 1.27
EOF
CGO_ENABLED=0 go build -o ballast . || exit 1
printf 'FROM scratch\nCOPY ballast /ballast\nENTRYPOINT ["/ballast"]\n' > Dockerfile
sg docker -c "docker build -q -t localhost:5001/ballast:v1 . && docker push -q localhost:5001/ballast:v1" 2>&1 | tail -2
DIGEST=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/ballast:v1")
echo "image $DIGEST" | tee "$E/00-image.txt"
WI=$(kubectl get workerpool counter -n ate-demo-counter -o jsonpath='{.spec.workerImage}')
cat > pool.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: lab-c
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata:
  name: ballast
  namespace: lab-c
  labels:
    workload: ballast
spec:
  replicas: 2
  workerImage: $WI
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits:
        cpu: "2"
        memory: 3Gi
      requests:
        cpu: 500m
        memory: 3Gi
EOF
kubectl apply -f pool.yaml
kubectl ate create atespace lab-c 2>&1 | tail -1
for mb in 0 50 200 500 1000; do
  cat > tmpl-$mb.yaml <<EOF
metadata:
  atespace: lab-c
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
    cpuMillicores: 1000
    memoryBytes: $(( (mb + 256) * 1048576 ))
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
  s=$(date +%s.%N)
  kubectl ate create actor-template -f tmpl-$mb.yaml 2>&1 | grep -v Warning | tail -2
  echo "create-template ballast-$mb $(echo "$(date +%s.%N) - $s" | bc)s"
done 2>&1 | tee "$E/01-create-templates.log"
kubectl -n lab-c rollout status deploy/ballast --timeout=120s 2>&1 | tail -1
sleep 20
kubectl ate get actor-templates -a lab-c 2>&1 | grep -v Warning | tee "$E/02-templates.txt"
kubectl ate get workers -a lab-c 2>&1 | grep -v Warning
kubectl get pods -n lab-c
cp pool.yaml tmpl-*.yaml main.go Dockerfile "$E/"
