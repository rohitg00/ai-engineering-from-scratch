export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
S=lab-c
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date -u +%FT%T.%3NZ; }
st() { kubectl ate get actor $1 -a $S -o json 2>/dev/null | jq -r '[.status.state, (.status.assignedNode // "-"), ((.status.snapshots // []) | map(.owner + ":" + (.durableSnapshot.state // "none") + ":gen" + (.generation|tostring) + ":" + (.locality // "-" | tostring)) | join(","))] | @tsv'; }
call() { curl -s -m 60 -o body.tmp -w '%{http_code}\t%{time_total}' "http://127.0.0.1:$1$2"; printf '\t%s' "$(tr -d '\n' < body.tmp | cut -c1-170)"; }
mk() { a=$1; tmpl=$2; port=$3; K create actor $a -a $S --template $tmpl > /dev/null; (kubectl ate proxy actor $a -a $S $port:80 > proxy-$a.log 2>&1 &); for t in $(seq 1 30); do grep -q Proxying proxy-$a.log 2>/dev/null && break; sleep 0.3; done; }
pkill -f "proxy actor d"; cd ~/evidence/D-durability
for a in d0 d50 d200 d500 d1000; do K delete actor $a -a $S > /dev/null; done

# ---------- ballast v2 with failure endpoints
cd ~/ballast
python3 - <<'EOF'
p='main.go'; s=open(p).read()
if '/exit' not in s:
    s=s.replace('import (','import (\n\t"os"',1)
    s=s.replace('\thttp.ListenAndServe(":80", nil)','''\thttp.HandleFunc("/exit", func(w http.ResponseWriter, r *http.Request) {
		go func() { time.Sleep(200 * time.Millisecond); os.Exit(3) }()
		fmt.Fprintln(w, "exiting with code 3")
	})
	http.HandleFunc("/oom", func(w http.ResponseWriter, r *http.Request) {
		go func() {
			var hog [][]byte
			for {
				b := make([]byte, 64<<20)
				rand.Read(b)
				hog = append(hog, b)
			}
		}()
		fmt.Fprintln(w, "allocating until killed")
	})
	http.ListenAndServe(":80", nil)''')
    open(p,'w').write(s)
EOF
CGO_ENABLED=0 go build -o ballast . || exit 1
sg docker -c "docker build -q -t localhost:5001/ballast:v2 . && docker push -q localhost:5001/ballast:v2" > /dev/null 2>&1
DIGEST=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/ballast:v2")
sed -e "s#name: ballast-50#name: fail-50#" -e "s#image: .*#image: $DIGEST#" tmpl-50.yaml > tmpl-fail-50.yaml
K create actor-template -f tmpl-fail-50.yaml > /dev/null
for i in $(seq 1 30); do K get actor-templates -a $S | awk '$2=="fail-50" && $3 ~ /-/' | grep -q . && break; sleep 2; done

# ---------- D1: node-local snapshot removed before upload
E=~/evidence/D-durability; cd "$E"; T=30-local-loss.tsv
echo "ts	case	event	detail" > $T
m() { echo "$(now)	$1	$2	$3" >> $T; }
mk x1 ballast-50 8301
for i in 1 2 3; do m x1 call "$(call 8301 /)"; done
K suspend actor x1 -a $S --mode sync > /dev/null; m x1 after-sync-suspend "$(st x1)"
for i in 4 5; do m x1 call "$(call 8301 /)"; done
K suspend actor x1 -a $S > /dev/null; m x1 after-async-suspend "$(st x1)"
uid=$(kubectl ate get actor x1 -a $S -o json 2>/dev/null | jq -r .metadata.uid)
sg docker -c "docker exec kind-control-plane sh -c 'ls -R /var/lib/ate/snapshots/$uid | head -20; rm -rf /var/lib/ate/snapshots/$uid'" > 31-x1-removed-local.txt 2>&1
m x1 removed-node-local-snapshot "uid $uid"
m x1 call-after-loss "$(call 8301 /)"
m x1 state "$(st x1)"
sleep 5; m x1 call-again "$(call 8301 /)"; m x1 state "$(st x1)"
K get actor x1 -a $S -o yaml > 32-x1-after-loss.yaml
K logs actor x1 -a $S --source=lifecycle > 33-x1-lifecycle.log 2>&1
m x1 revert "$(K revert actor x1 -a $S | tr '\n' ' ' | cut -c1-200)"
m x1 call-after-revert "$(call 8301 /)"; m x1 state "$(st x1)"

# ---------- D2: atelet restarted before upload
mk x2 ballast-50 8302
for i in 1 2 3; do m x2 call "$(call 8302 /)"; done
K suspend actor x2 -a $S > /dev/null; m x2 after-async-suspend "$(st x2)"
kubectl -n ate-system delete pod -l app=atelet --wait=true > 34-x2-atelet-restart.log 2>&1 || kubectl -n ate-system rollout restart ds/atelet >> 34-x2-atelet-restart.log 2>&1
kubectl -n ate-system rollout status ds/atelet --timeout=120s >> 34-x2-atelet-restart.log 2>&1
m x2 atelet-restarted "$(kubectl -n ate-system get pods -o wide | grep atelet | tr -s ' ' | cut -c1-80)"
m x2 state "$(st x2)"
m x2 call-after-atelet-restart "$(call 8302 /)"
m x2 state "$(st x2)"
sleep 3; m x2 call-again "$(call 8302 /)"; m x2 state "$(st x2)"

# ---------- J: process death inside a live sandbox
E=~/evidence/J-container-death; mkdir -p "$E"; cd "$E"; T=10-trace.tsv
echo "ts	case	event	detail" > $T
mk j1 fail-50 8311
for i in 1 2; do m j1 call "$(call 8311 /)"; done
K suspend actor j1 -a $S --mode sync > /dev/null; m j1 after-sync-suspend "$(st j1)"
m j1 call "$(call 8311 /)"
m j1 exit-request "$(call 8311 /exit)"
for i in 1 2 3 4 5 6; do sleep 2; m j1 state "$(st j1)"; m j1 call "$(call 8311 /)"; done
K get actor j1 -a $S -o yaml > 11-j1-after-exit.yaml
K logs actor j1 -a $S --source=lifecycle > 12-j1-lifecycle.log 2>&1
K logs actor j1 -a $S > 13-j1-logs.log 2>&1
m j1 suspend-attempt "$(K suspend actor j1 -a $S --mode sync | tr '\n' ' ' | cut -c1-220)"
m j1 state "$(st j1)"
m j1 call-after-suspend-attempt "$(call 8311 /)"; m j1 state "$(st j1)"
m j1 revert "$(K revert actor j1 -a $S | tr '\n' ' ' | cut -c1-200)"
m j1 call-after-revert "$(call 8311 /)"; m j1 state "$(st j1)"

mk j2 fail-50 8312
for i in 1 2; do m j2 call "$(call 8312 /)"; done
m j2 oom-request "$(call 8312 /oom)"
for i in 1 2 3 4 5 6; do sleep 2; m j2 state "$(st j2)"; m j2 call "$(call 8312 /)"; done
K get actor j2 -a $S -o yaml > 14-j2-after-oom.yaml
K logs actor j2 -a $S --source=lifecycle > 15-j2-lifecycle.log 2>&1
kubectl get pods -n lab-c -o wide > 16-pods.txt; K get workers -a $S >> 16-pods.txt
echo "=== D"; cut -c1-250 ~/evidence/D-durability/30-local-loss.tsv
echo "=== J"; cut -c1-250 $T
