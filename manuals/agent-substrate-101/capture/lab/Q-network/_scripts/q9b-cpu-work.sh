export KUBECONFIG=$HOME/.kube/kind-kind.config
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/Q-network/n-cpu-limit; cd ~/burn
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
S=lab-cpu
for i in $(seq 1 60); do grep -q CPU-DONE $E/10-burn.tsv && break; sleep 5; done
python3 - <<'EOF'
p = 'main.go'
s = open(p).read()
if '/work' not in s:
    s = s.replace('''	http.HandleFunc("/result",''', '''	http.HandleFunc("/work", func(w http.ResponseWriter, r *http.Request) {
		t, _ := strconv.Atoi(r.URL.Query().Get("threads"))
		c, _ := strconv.Atoi(r.URL.Query().Get("chunks"))
		if t < 1 || c < 1 {
			w.WriteHeader(400)
			return
		}
		mu.Lock()
		if last.Running {
			mu.Unlock()
			w.WriteHeader(409)
			return
		}
		last = result{Threads: t, TargetCPU: float64(c), Running: true}
		mu.Unlock()
		go work(t, c)
		w.Write([]byte("started\\n"))
	})
	http.HandleFunc("/result",''', 1)
    s = s.replace('''func read(p string) string {''', '''func work(threads, chunks int) {
	u0, s0 := cpuNow()
	start := time.Now()
	var wg sync.WaitGroup
	for i := 0; i < threads; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runtime.LockOSThread()
			x := uint64(1)
			for c := 0; c < chunks/threads; c++ {
				for j := 0; j < 200000; j++ {
					x = x*6364136223846793005 + 1442695040888963407
				}
			}
			_ = x
		}()
	}
	wg.Wait()
	u1, s1 := cpuNow()
	mu.Lock()
	last = result{Threads: threads, TargetCPU: float64(chunks), Wall: time.Since(start).Seconds(), User: u1 - u0, Sys: s1 - s0}
	mu.Unlock()
}

func read(p string) string {''', 1)
    open(p, 'w').write(s)
EOF
CGO_ENABLED=0 go build -o burn . || { echo BUILD-FAILED; exit 1; }
sg docker -c "docker build -q -t localhost:5001/burn:v2 . && docker push -q localhost:5001/burn:v2" > "$E/30-build-v2.log" 2>&1
IMG=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/burn:v2")
cp main.go "$E/burn.go"; cd "$E"
for l in 250 500 1000 2000; do
  sed -e "s#name: burn-$l#name: work-$l#" -e "s#image: .*#image: $IMG#" tmpl-$l.yaml > tmpl-work-$l.yaml
  K create actor-template -f tmpl-work-$l.yaml >> 31-setup-v2.log
done
for i in $(seq 1 40); do [ "$(K get actor-templates -a $S | grep -c -E 'work-[0-9]+ +[0-9a-f-]{36}')" = 4 ] && break; sleep 3; done
WP=$(kubectl -n $S get pods -o jsonpath='{.items[0].metadata.name}'); WU=$(kubectl -n $S get pod $WP -o jsonpath='{.metadata.uid}' | tr - _)
usage() { sg docker -c "docker exec kind-control-plane sh -c 'd=\$(find /sys/fs/cgroup -type d -name \"*$WU*\" | head -1); f=\$(find \$d -type d -name \"*-_sandbox\" | head -1); echo \"\$(cat \$f/cpu.max | tr \" \" \"/\") \$(grep -E \"^usage_usec|nr_periods|nr_throttled|throttled_usec\" \$f/cpu.stat | tr \"\\n\" \" \")\"'" 2>&1; }
wait_result() { for w in $(seq 1 300); do sleep 0.5; r=$(curl -s -m 10 http://127.0.0.1:$1/result); [ "$(echo "$r" | jq -r .running 2>/dev/null)" = "false" ] && break; done; echo "$r"; }
K create actor w2000cal -a $S --template work-2000 > /dev/null
(kubectl ate proxy actor w2000cal -a $S 8700:80 > proxy-cal.log 2>&1 &); for t in $(seq 1 30); do grep -q Proxying proxy-cal.log 2>/dev/null && break; sleep 0.3; done
curl -s -m 20 "http://127.0.0.1:8700/work?threads=1&chunks=4000" > /dev/null; r=$(wait_result 8700)
CAL=$(echo "$r" | jq -r .wall_s); CH=$(python3 -c "print(int(4000*5.0/$CAL/4)*4)")
echo "calibration on a 2000 millicore actor: 4000 chunks of 200000 steps in $CAL s; test uses $CH chunks (about 5 s of one unthrottled core)" > 32-calibration.txt
pkill -f "proxy actor w2000cal " 2>/dev/null; K suspend actor w2000cal -a $S --mode sync > /dev/null 2>&1; K delete actor w2000cal -a $S > /dev/null 2>&1
OUT=40-work.tsv; echo "limit_millicores	threads	run	chunks	wall_s	cpu_s_reported_inside	host_cpu_s_from_cgroup	host_cores_used	periods	throttled_periods" > $OUT
port=8700
for l in 250 500 1000 2000; do
  a=w$l; port=$((port+1))
  K create actor $a -a $S --template work-$l > /dev/null
  (kubectl ate proxy actor $a -a $S $port:80 > proxy-$a.log 2>&1 &)
  for t in $(seq 1 30); do grep -q Proxying proxy-$a.log 2>/dev/null && break; sleep 0.3; done
  curl -s -m 30 http://127.0.0.1:$port/info > 41-info-$l.json
  for thr in 1 4; do
    for n in 1 2 3; do
      u0=$(usage)
      curl -s -m 20 "http://127.0.0.1:$port/work?threads=$thr&chunks=$CH" > /dev/null; r=$(wait_result $port)
      u1=$(usage)
      python3 - "$l" "$thr" "$n" "$CH" "$r" "$u0" "$u1" >> $OUT <<'EOF'
import json, re, sys
l, thr, n, ch, r, u0, u1 = sys.argv[1:8]
j = json.loads(r)
def f(u, k):
    m = re.search(k + r" (\d+)", u)
    return int(m.group(1)) if m else 0
host = (f(u1, "usage_usec") - f(u0, "usage_usec")) / 1e6
print("\t".join(str(x) for x in [l, thr, n, ch, round(j["wall_s"], 3), round(j["cpu_user_s"] + j["cpu_sys_s"], 2), round(host, 2), round(host / j["wall_s"], 2), f(u1, "nr_periods") - f(u0, "nr_periods"), f(u1, "nr_throttled") - f(u0, "nr_throttled")]))
EOF
    done
  done
  echo "$l $(usage)" >> 42-cgroup-after.txt
  pkill -f "proxy actor $a " 2>/dev/null
  K suspend actor $a -a $S --mode sync > /dev/null 2>&1; K delete actor $a -a $S > /dev/null 2>&1
done
cat 32-calibration.txt; cat $OUT
echo WORK-DONE >> $OUT
