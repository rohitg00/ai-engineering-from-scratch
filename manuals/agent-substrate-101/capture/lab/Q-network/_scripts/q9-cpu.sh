export KUBECONFIG=$HOME/.kube/kind-kind.config
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/Q-network/n-cpu-limit; mkdir -p "$E" ~/burn; cd ~/burn
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
S=lab-cpu
cat > main.go <<'EOF'
package main

import (
	"encoding/json"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type result struct {
	Threads   int     `json:"threads"`
	TargetCPU float64 `json:"target_cpu_s"`
	Wall      float64 `json:"wall_s"`
	User      float64 `json:"cpu_user_s"`
	Sys       float64 `json:"cpu_sys_s"`
	Running   bool    `json:"running"`
}

var (
	mu   sync.Mutex
	last result
)

func cpuNow() (float64, float64) {
	var ru syscall.Rusage
	syscall.Getrusage(syscall.RUSAGE_SELF, &ru)
	return float64(ru.Utime.Sec) + float64(ru.Utime.Usec)/1e6, float64(ru.Stime.Sec) + float64(ru.Stime.Usec)/1e6
}

func burn(threads int, target float64) {
	u0, s0 := cpuNow()
	start := time.Now()
	var done atomic.Bool
	var wg sync.WaitGroup
	for i := 0; i < threads; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runtime.LockOSThread()
			x := uint64(1)
			for !done.Load() {
				for j := 0; j < 200000; j++ {
					x = x*6364136223846793005 + 1442695040888963407
				}
				u, s := cpuNow()
				if (u-u0)+(s-s0) >= target {
					done.Store(true)
				}
			}
			_ = x
		}()
	}
	wg.Wait()
	u1, s1 := cpuNow()
	mu.Lock()
	last = result{Threads: threads, TargetCPU: target, Wall: time.Since(start).Seconds(), User: u1 - u0, Sys: s1 - s0}
	mu.Unlock()
}

func read(p string) string {
	b, err := os.ReadFile(p)
	if err != nil {
		return "unreadable"
	}
	return strings.TrimSpace(string(b))
}

func main() {
	runtime.GOMAXPROCS(8)
	http.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	http.HandleFunc("/info", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"num_cpu": runtime.NumCPU(), "cgroup_cpu_max": read("/sys/fs/cgroup/cpu.max"), "cgroup_v1_quota": read("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"), "proc_cpuinfo_processors": strings.Count(read("/proc/cpuinfo"), "processor\t")})
	})
	http.HandleFunc("/burn", func(w http.ResponseWriter, r *http.Request) {
		t, _ := strconv.Atoi(r.URL.Query().Get("threads"))
		c, _ := strconv.ParseFloat(r.URL.Query().Get("cpu"), 64)
		if t < 1 || c <= 0 {
			w.WriteHeader(400)
			return
		}
		mu.Lock()
		if last.Running {
			mu.Unlock()
			w.WriteHeader(409)
			return
		}
		last = result{Threads: t, TargetCPU: c, Running: true}
		mu.Unlock()
		go burn(t, c)
		w.Write([]byte("started\n"))
	})
	http.HandleFunc("/result", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		json.NewEncoder(w).Encode(last)
	})
	http.ListenAndServe(":80", nil)
}
EOF
printf 'module burn\n\ngo 1.27\n' > go.mod
CGO_ENABLED=0 go build -o burn . || { echo BUILD-FAILED; exit 1; }
printf 'FROM scratch\nCOPY burn /burn\nENTRYPOINT ["/burn"]\n' > Dockerfile
sg docker -c "docker build -q -t localhost:5001/burn:v1 . && docker push -q localhost:5001/burn:v1" > "$E/00-build.log" 2>&1
IMG=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/burn:v1")
cp main.go "$E/burn.go"; cd "$E"; echo "$IMG" > 00-image.txt
WI=$(kubectl get workerpool counter -n ate-demo-counter -o jsonpath='{.spec.workerImage}')
cat > pool.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata: {name: $S}
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata:
  name: burn
  namespace: $S
  labels: {workload: burn}
spec:
  replicas: 1
  workerImage: $WI
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits: {cpu: "6", memory: 2Gi}
      requests: {cpu: 500m, memory: 1Gi}
EOF
kubectl apply -f pool.yaml > 01-setup.log 2>&1
K create atespace $S >> 01-setup.log
for l in 250 500 1000 2000; do
cat > tmpl-$l.yaml <<EOF
metadata:
  atespace: $S
  name: burn-$l
workerSelector:
  matchLabels: {workload: burn}
containers:
- name: burn
  image: $IMG
  wakeupProbe:
    httpGet: {path: /readyz, port: 80}
resources:
  limits:
    cpuMillicores: $l
    memoryBytes: 134217728
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
K create actor-template -f tmpl-$l.yaml >> 01-setup.log
done
kubectl -n $S rollout status deploy/burn --timeout=180s >> 01-setup.log 2>&1
for i in $(seq 1 40); do [ "$(K get actor-templates -a $S | grep -c -E 'burn-[0-9]+ +[0-9a-f-]{36}')" = 4 ] && break; sleep 3; done
K get actor-templates -a $S > 02-templates.txt; K get workers -a $S >> 02-templates.txt; K get workers | grep burn >> 02-templates.txt
WP=$(kubectl -n $S get pods -o jsonpath='{.items[0].metadata.name}'); WU=$(kubectl -n $S get pod $WP -o jsonpath='{.metadata.uid}' | tr - _)
kubectl -n $S get pod $WP -o json | jq '{resources:.spec.containers[0].resources, qos:.status.qosClass}' > 03-worker-pod-resources.json
cg() {
  sg docker -c "docker exec kind-control-plane sh -c 'for d in \$(find /sys/fs/cgroup -type d -name \"*$WU*\" | head -1); do find \$d -name cpu.max | while read f; do dd=\$(dirname \$f); echo \"\${dd#\$d} cpu.max=\$(cat \$f) procs=\$(wc -l < \$dd/cgroup.procs 2>/dev/null) \$(grep -E \"nr_periods|nr_throttled|throttled_usec|usage_usec\" \$dd/cpu.stat | tr \"\\n\" \" \")\"; done; done'" 2>&1
}
OUT=10-burn.tsv; echo "limit_millicores	threads	run	target_cpu_s	wall_s	cpu_user_s	cpu_sys_s	effective_cores" > $OUT
port=8600
for l in 250 500 1000 2000; do
  a=c$l; port=$((port+1))
  K create actor $a -a $S --template burn-$l > /dev/null
  (kubectl ate proxy actor $a -a $S $port:80 > proxy-$a.log 2>&1 &)
  for t in $(seq 1 30); do grep -q Proxying proxy-$a.log 2>/dev/null && break; sleep 0.3; done
  curl -s -m 30 http://127.0.0.1:$port/info > 20-info-$l.json
  K get workers | grep burn > 21-worker-booked-$l.txt
  { echo "### before limit=$l"; cg; } > 22-cgroup-$l.txt
  sg docker -c "docker exec kind-control-plane sh -c 'ps -eo pid,nlwp,pcpu,args | grep -E \"runsc|burn\" | grep -v grep | cut -c1-180 | head -12'" > 23-node-processes-$l.txt 2>&1
  for thr in 1 4; do
    for n in 1 2 3; do
      curl -s -m 20 "http://127.0.0.1:$port/burn?threads=$thr&cpu=10" > /dev/null
      for w in $(seq 1 200); do
        sleep 1
        r=$(curl -s -m 10 http://127.0.0.1:$port/result)
        [ "$(echo "$r" | jq -r .running 2>/dev/null)" = "false" ] && break
      done
      echo "$r" | jq -r --arg l $l --arg n $n '[$l, .threads, $n, .target_cpu_s, (.wall_s*1000|round/1000), (.cpu_user_s*1000|round/1000), (.cpu_sys_s*1000|round/1000), (((.cpu_user_s+.cpu_sys_s)/.wall_s)*100|round/100)] | @tsv' >> $OUT
      if [ $thr = 4 ] && [ $n = 1 ]; then sg docker -c "docker exec kind-control-plane sh -c 'top -b -n 1 -H | grep -E \"runsc|burn|exe\" | head -8'" > 24-top-during-$l.txt 2>&1; fi
    done
    { echo "### after threads=$thr limit=$l"; cg; } >> 22-cgroup-$l.txt
  done
  pkill -f "proxy actor $a " 2>/dev/null
  K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1
done
cat $OUT
echo CPU-DONE >> $OUT
