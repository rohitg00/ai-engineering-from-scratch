. ~/scripts/vlib.sh
while ! grep -q DONE $V/04-fidelity/10-fidelity.tsv 2>/dev/null; do sleep 5; done
cycle() {
  a=$1; label=$2; port=$3; OUT=$4
  s=$(now); K create actor $a -a $S --template $label > /dev/null; echo "$label	create-actor	1	-	$(el $s)	cli" >> $OUT
  proxy $a $port
  echo "$label	first-call-golden	1	$(call $port)" >> $OUT
  echo "$label	warm-call	0	$(call $port)" >> $OUT
  for c in $(seq 1 10); do
    s=$(now); K suspend actor $a -a $S > /dev/null; echo "$label	suspend-async	$c	-	$(el $s)	cli" >> $OUT
    if [ $c = 1 ]; then echo "$label	local-snapshot-kib	1	-	$(localsize $a)	du" >> $OUT; fi
    sleep 1
    echo "$label	resume-local	$c	$(call $port)" >> $OUT
    echo "$label	warm-call	$c	$(call $port)" >> $OUT
  done
  for c in 1 2 3; do
    s=$(now); K suspend actor $a -a $S --mode sync > /dev/null; echo "$label	suspend-sync	$c	-	$(el $s)	cli" >> $OUT
    if [ $c = 1 ]; then echo "$label	store-snapshot-kib	1	-	$(storesize $a)	du-in-rustfs" >> $OUT; K get actor $a -a $S -o yaml > actor-$a-suspended.yaml; fi
    echo "$label	resume-after-sync	$c	$(call $port)" >> $OUT
  done
  K logs actor $a -a $S --source=lifecycle > lifecycle-$a.log 2>&1
  K suspend actor $a -a $S --mode sync > /dev/null
  pkill -f "proxy actor $a " ; K delete actor $a -a $S > /dev/null
}

mkdir -p $V/02-python-runtime/img; cd $V/02-python-runtime
cat > img/app.py <<'EOF'
import os, resource, sqlite3, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

started = time.time()
state = {"count": 0, "ready": False}
data = {i: os.urandom(100) for i in range(1_000_000)}
os.makedirs("/data", exist_ok=True)
db = sqlite3.connect("/data/app.db", check_same_thread=False)
db.execute("create table if not exists hits (n integer)")
db.commit()
state["ready"] = True


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/readyz":
            self.send_response(200 if state["ready"] else 503)
            self.end_headers()
            return
        state["count"] += 1
        db.execute("insert into hits values (?)", (state["count"],))
        db.commit()
        rows = db.execute("select count(*) from hits").fetchone()[0]
        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024
        body = f"python count={state['count']} sqlite_rows={rows} dict={len(data)} maxrss_mib={rss} pid={os.getpid()} process_age_s={time.time() - started:.1f}\n"
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body.encode())


ThreadingHTTPServer(("", 80), Handler).serve_forever()
EOF
printf 'FROM python:3.13-slim\nCOPY app.py /app/app.py\nCMD ["python", "/app/app.py"]\n' > img/Dockerfile
s=$(now); sg docker -c "docker build -q -t localhost:5001/pyagent:v1 img && docker push -q localhost:5001/pyagent:v1" > 00-build.log 2>&1; echo "build-and-push $(el $s)s" > 01-steps.txt
PIMG=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/pyagent:v1"); echo "$PIMG" > 02-image.txt
sg docker -c "docker image inspect localhost:5001/pyagent:v1 --format '{{.Size}}'" >> 02-image.txt
cat > tmpl-pyagent.yaml <<EOF
metadata:
  atespace: $S
  name: pyagent
workerSelector:
  matchLabels:
    workload: vpool
containers:
- name: app
  image: $PIMG
  command:
  - python
  - /app/app.py
  wakeupProbe:
    httpGet:
      path: /readyz
      port: 80
  volumeMounts:
  - name: data
    mountPath: /data
resources:
  limits:
    cpuMillicores: 1000
    memoryBytes: 805306368
snapshotConfig:
  preferredFidelity: SNAPSHOT_FIDELITY_MEMORY
volumes:
- name: data
  durableDir: {}
EOF
OUT=10-python.tsv; echo "template	phase	i	http	value	detail" > $OUT
s=$(now); K create actor-template -f tmpl-pyagent.yaml > create-tmpl.txt 2>&1
waitgold pyagent; echo "pyagent	template-to-golden-ready	1	-	$(el $s)	includes image pull, boot, dict load, snapshot" >> $OUT
K get actor-template pyagent -a $S -o yaml > template-pyagent.yaml
cycle py1 pyagent 9201 $OUT
for i in 2 3 4 5; do
  s=$(now); K create actor py$i -a $S --template pyagent > /dev/null
  proxy py$i 920$i
  echo "pyagent	first-call-golden	$i	$(call 920$i)" >> $OUT
  K suspend actor py$i -a $S --mode sync > /dev/null; pkill -f "proxy actor py$i "; K delete actor py$i -a $S > /dev/null
done
echo DONE >> $OUT

mkdir -p $V/03-parallel-resume; cd $V/03-parallel-resume
OUT=10-parallel.tsv; echo "n	round	actor	http	seconds	detail" > $OUT
tmpl par-50 50 MEMORY --fill=random; waitgold par-50
for i in $(seq -w 1 32); do
  K create actor q$i -a $S --template par-50 > /dev/null
  proxy q$i 93$i
done
for i in $(seq -w 1 16); do call 93$i > /dev/null; K suspend actor q$i -a $S --mode sync > /dev/null; done
burst() {
  n=$1; round=$2; list=$3
  for i in $list; do
    ( r=$(curl -s -m 60 -o b-$i.tmp -w '%{http_code}\t%{time_total}' http://127.0.0.1:93$i/); echo "$n	$round	q$i	$r	$(tr -d '\n' < b-$i.tmp | cut -c1-90)" >> $OUT ) &
  done
  wait
}
for n in 1 2 4 8 16; do
  list=$(seq -w 1 $n | tr '\n' ' ')
  for round in 1 2 3 4 5; do
    burst $n $round "$list"
    for i in $list; do K suspend actor q$i -a $S > /dev/null & done; wait
    sleep 2
  done
done
K get workers -n lab-v > 11-workers-before-32.txt
kubectl -n ate-system logs deploy/ate-api-server -c ate-api-server --since=5m 2>/dev/null | grep -c -i error > 12-ateapi-error-lines-during-bursts.txt
date -u +%FT%TZ > 13-burst32-start.txt
burst 32 1 "$(seq -w 1 32 | tr '\n' ' ')"
K get workers -n lab-v > 14-workers-after-32.txt
K get actors -a $S > 15-actors-after-32.txt
sleep 2
for i in $(seq -w 1 32); do K suspend actor q$i -a $S > /dev/null 2>&1 & done; wait
burst 32-with-release 1 "$(seq -w 1 32 | tr '\n' ' ')" &
sleep 1.5
for i in $(seq -w 1 16); do K suspend actor q$i -a $S > /dev/null 2>&1 & done
wait
kubectl -n ate-system logs deploy/atenet-router -c atenet-router --since=3m 2>/dev/null | grep -i -E "park" | tail -40 > 16-router-parking-lines.log
for i in $(seq -w 1 32); do K logs actor q$i -a $S --source=lifecycle 2>/dev/null | tail -4; done > 17-lifecycle-tails.log
pkill -f "proxy actor q"
for i in $(seq -w 1 32); do K delete actor q$i -a $S > /dev/null 2>&1 & done; wait
rm -f b-*.tmp
echo DONE >> $OUT
sudo fstrim -v / > /dev/null
