. ~/scripts/t-lib.sh
echo "$(ts) setup-start" >> 00-run.log
free -g | sed -n 2p > 00-vm.txt; df -h / | tail -1 >> 00-vm.txt; nproc >> 00-vm.txt
mkdir -p ~/ballast-t && cd ~/ballast-t
cat > main.go <<'EOF'
package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"net/http"
	"strconv"
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
	http.HandleFunc("/slow", func(w http.ResponseWriter, r *http.Request) {
		s, _ := strconv.Atoi(r.URL.Query().Get("s"))
		time.Sleep(time.Duration(s) * time.Second)
		fmt.Fprintf(w, "slow=%d count=%d process_age_s=%.1f\n", s, count.Add(1), time.Since(started).Seconds())
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
CGO_ENABLED=0 go build -o ballast . || { echo BUILD-FAILED; exit 1; }
printf 'FROM scratch\nCOPY ballast /ballast\nENTRYPOINT ["/ballast"]\n' > Dockerfile
sg docker -c "docker build -q -t localhost:5001/ballast:t . && docker push -q localhost:5001/ballast:t" > /dev/null 2>&1
DIGEST=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/ballast:t")
echo "$DIGEST" > "$E/01-image-digest.txt"
[ -n "$DIGEST" ] || { echo NO-DIGEST; exit 1; }
cd "$E"
tmpl() {
  name=$1; mb=$2; cpu=$3; mem=$4
  cat > 02-tmpl-$name.yaml <<EOF
metadata:
  atespace: $S
  name: $name
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
    cpuMillicores: $cpu
    memoryBytes: $mem
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
EOF
  K create actor-template -f 02-tmpl-$name.yaml >> 03-templates.log 2>&1
}
: > 03-templates.log
tmpl tb-50 50 250 262144000
tmpl tb-0 0 250 262144000
tmpl tb-big 0 250 1992294400
tmpl tb-200 200 1000 471859200
tmpl tb-1000 1000 1000 1363148800
for i in $(seq 1 90); do [ "$(K get actor-templates -a $S | grep -c -E 'tb-[a-z0-9]+ +[0-9a-f-]{36}')" = 5 ] && break; sleep 4; done
K get actor-templates -a $S >> 03-templates.log
kc get pdb -A > 04-pdb-and-grace.txt 2>&1
kc -n $S get pods -o json | jq -r '.items[] | [.metadata.name, .spec.nodeName, (.spec.terminationGracePeriodSeconds|tostring), (.metadata.finalizers // [] | join(",")), (.metadata.ownerReferences[0].kind)] | @tsv' >> 04-pdb-and-grace.txt
kc -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args|join(" "))' > 05-atelet-args.txt
K create actor s1 -a $S --template tb-50 > /dev/null; proxy s1 8990
echo "smoke: $(call 8990 30) | $(call 8990 30 '/slow?s=2')" >> 03-templates.log
K suspend actor s1 -a $S --mode sync > /dev/null; K delete actor s1 -a $S > /dev/null; pkill -f "proxy actor s1 "
tail -9 03-templates.log | cut -c1-200
echo "$(ts) SETUP-DONE templates=$(K get actor-templates -a $S | grep -c -E 'tb-[a-z0-9]+ +[0-9a-f-]{36}')" >> 00-run.log; tail -1 00-run.log
