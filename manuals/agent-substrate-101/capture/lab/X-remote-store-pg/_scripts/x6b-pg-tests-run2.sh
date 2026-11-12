. ~/scripts/x-pglib.sh
O=$EV/50-pg-tests; mkdir -p $O; cd $O
S=x-lab
STAGE=$1
tl() { echo "$(date +%s.%N | cut -c1-14)	$(date -u +%T)	$*" | tee -a 30-timeline-run2.tsv; }
R() { PX "sh /tmp/req.sh $*"; }
st() { kubectl ate get actor "$1" -a $S -o json 2>/dev/null | jq -r .status.state; }
pgrtt() {
  { echo "### $1 $(date -u +%FT%TZ)"; sudo tc qdisc show dev $WAN | tr '\n' ';'; echo
    pgc "PGPASSWORD=\$POSTGRES_PASSWORD psql \"$ADMIN\" -At -c \"\\timing on\" $(printf -- '-c "select 1" %.0s' $(seq 1 20))" 2>&1 | grep Time | tr '\n' ' '; echo
    for i in 1 2 3 4 5; do s=$(now); pgc "PGPASSWORD=\$POSTGRES_PASSWORD psql \"$ADMIN\" -Atc \"select 1\"" > /dev/null; echo "new connection over TLS plus one query, with docker exec: $(el $s) s"; done
  } >> 05-pg-round-trip.txt 2>&1
}

if [ "$STAGE" = setup ]; then
  mkdir -p $X/img && cd $X/img
  cat > drill_actor.py <<'EOF'
import http.server, os, time
count = 0
started = time.time()
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        global count
        if self.path != "/readyz": count += 1
        b = f"count={count} process_age_s={time.time()-started:.1f}\n".encode()
        self.send_response(200); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    do_POST = do_GET
http.server.ThreadingHTTPServer(("", 80), H).serve_forever()
EOF
  printf 'FROM python:3.12-alpine\nCOPY drill_actor.py /app/drill_actor.py\nENTRYPOINT ["python3","-u","/app/drill_actor.py"]\n' > Dockerfile
  sg docker -c "docker build -q -t localhost:5001/x-drill:v1 . && docker push -q localhost:5001/x-drill:v1" > $O/00-image.log 2>&1
  IMG=$(sg docker -c "docker inspect --format '{{index .RepoDigests 0}}' localhost:5001/x-drill:v1"); echo "$IMG" >> $O/00-image.log
  cd $O
  cat > pool.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata: {name: $S}
---
apiVersion: ate.dev/v1
kind: WorkerPool
metadata: {name: x-pool, namespace: $S, labels: {workload: x-pool}}
spec:
  replicas: 50
  workerImage: ghcr.io/agent-substrate/substrate/ateworker-gvisor:v1.0.0
  sandboxClasses:
  - name: gvisor
  template:
    resources:
      limits: {cpu: "1", memory: 1Gi}
      requests: {cpu: 100m, memory: 128Mi}
EOF
  cat > template.yaml <<EOF
metadata: {atespace: $S, name: x-drill}
workerSelector:
  matchLabels: {workload: x-pool}
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
  [ -x ~/go/bin/kubectl-ate ] || (cd $X/src && go install ./cmd/kubectl-ate)
  kubectl apply -f pool.yaml > 01-setup.log 2>&1
  K create atespace $S >> 01-setup.log
  K create actor-template -f template.yaml >> 01-setup.log
  kubectl -n $S rollout status deploy/x-pool --timeout=400s >> 01-setup.log 2>&1
  for i in $(seq 1 90); do K get actor-templates -a $S | grep -q -E 'x-drill +[0-9a-f-]{36}' && break; sleep 2; done
  K get actor-templates -a $S | tee -a 01-setup.log
  mkprober >> 01-setup.log 2>&1
  cat > req.sh <<'EOF'
curl -s -m ${2:-20} -o /tmp/r.$$ -w '%{http_code}\t%{time_total}\t' --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST -H "ate-target-actor: x-lab/$1" https://atenet-router.ate-system.svc:443/
head -c 140 /tmp/r.$$ | tr '\n\t' '  '; echo; rm -f /tmp/r.$$
EOF
  kubectl -n ate-system exec -i x-prober -- sh -c 'cat > /tmp/req.sh' < req.sh
  K get workers | awk 'NR>1{print $3}' | sort | uniq -c >> 01-setup.log
  tail -4 01-setup.log
fi

if [ "$STAGE" = lifecycle ]; then
  D=${2:-0}; pgdelay $D; pgrtt "added delay $D ms toward Postgres"
  A=lc$D
  {
  t=$(now); K create actor $A -a $S --template x-drill; echo "create $(el $t) s state $(st $A)"
  echo "first request: $(R $A)"; echo "state $(st $A)"
  for i in 2 3; do echo "request: $(R $A)"; done
  t=$(now); K suspend actor $A -a $S --mode sync; echo "suspend sync $(el $t) s state $(st $A)"
  echo "resume request: $(R $A)"
  echo "request: $(R $A)"
  t=$(now); K suspend actor $A -a $S; echo "suspend default $(el $t) s state $(st $A)"; sleep 3; echo "state after 3 s $(st $A)"
  echo "resume request: $(R $A)"
  K get actor $A -a $S
  } > 10-lifecycle-delay$D.txt 2>&1
  : > 11-cycles-delay$D.tsv
  for i in $(seq 1 10); do t=$(now); K suspend actor $A -a $S --mode sync >/dev/null; s=$(el $t); printf '%s\t%s\t%s\n' $i $s "$(R $A)" >> 11-cycles-delay$D.tsv; done
  : > 12-running-requests-delay$D.tsv
  for i in $(seq 1 10); do printf '%s\t%s\n' $i "$(R $A)" >> 12-running-requests-delay$D.tsv; done
  echo "select count(*) from pg_stat_activity where usename like 'substrate%'" | pgq > 13-pg-conns-delay$D.txt 2>&1
  pgdelay 0
  cat 11-cycles-delay$D.tsv
fi

if [ "$STAGE" = outage-start ]; then
  pgdelay 0
  K create actor y-run -a $S --template x-drill >> 01-setup.log
  for n in $(seq 1 46); do K create actor $(printf 'y-s-%03d' $n) -a $S --template x-drill > /dev/null; done
  K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c >> 01-setup.log
  R y-run >> 01-setup.log
  cat > loop.sh <<'EOF'
C="--cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem"
U=https://atenet-router.ate-system.svc:443/
i=0; n=0
while [ ! -f /tmp/stop ]; do
  t=$(date +%s)
  ( r=$(curl -s -m 9 -o /tmp/b.$t -w '%{http_code}\t%{time_total}' $C -X POST -H 'ate-target-actor: x-lab/y-run' $U); printf '%s\trunning\ty-run\t%s\t%s\n' "$t" "$r" "$(head -c 140 /tmp/b.$t | tr '\n\t' '  ')" >> /tmp/probe.tsv; rm -f /tmp/b.$t ) &
  if [ $((i % 5)) -eq 0 ]; then
    n=$((n+1)); a=$(printf 'y-s-%03d' $n)
    ( r=$(curl -s -m 14 -o /tmp/f.$t -w '%{http_code}\t%{time_total}' $C -X POST -H "ate-target-actor: x-lab/$a" $U); printf '%s\tsuspended\t%s\t%s\t%s\n' "$t" "$a" "$r" "$(head -c 140 /tmp/f.$t | tr '\n\t' '  ')" >> /tmp/probe.tsv; rm -f /tmp/f.$t ) &
  fi
  i=$((i+1)); sleep 1
done
EOF
  kubectl -n ate-system exec -i x-prober -- sh -c 'cat > /tmp/loop.sh; rm -f /tmp/stop /tmp/probe.tsv' < loop.sh
  : > 30-timeline-run2.tsv; rm -f stop
  ( nohup sh -c "while [ ! -f $O/stop ]; do printf '%s\t%s\n' \"\$(date +%s.%N | cut -c1-14)\" \"\$(sg docker -c 'docker exec x-pgc pg_isready -t 1 -h $PGHOST_IP -p $PGPORT_N -d atepg' 2>&1 | tr '\n' ' ')\"; sleep 0.5; done" > 31-pg-ready-run2.tsv 2>&1 & )
  ( nohup sh -c "while [ ! -f $O/stop ]; do printf '%s\t%s\n' \"\$(date +%s)\" \"\$(kubectl --kubeconfig $KUBECONFIG -n ate-system get pods -l app=ate-api-server --no-headers 2>&1 | awk '{print \$1,\$2,\$3,\$4}' | tr '\n' ';')\"; sleep 2; done" > 32-api-server-pods-run2.tsv 2>&1 & )
  kubectl -n ate-system exec x-prober -- sh -c 'nohup sh /tmp/loop.sh > /tmp/loop.log 2>&1 &'
  tl start-baseline
fi

if [ "$STAGE" = mark ]; then tl "$2"; fi

if [ "$STAGE" = outage-collect ]; then
  tl end
  kubectl -n ate-system exec x-prober -- touch /tmp/stop; touch stop; sleep 12
  kubectl -n ate-system exec x-prober -- cat /tmp/probe.tsv | sort -n > 33-probe-run2.tsv
  kubectl -n ate-system logs deploy/ate-api-server --since=6m 2>&1 | scrub | grep -i -E "worker cache|postgres|error|fail" | cut -c1-400 | head -150 > 34-api-server-log-run2.excerpt.txt
  kubectl -n ate-system get pods -o wide > 35-pods-after-run2.txt
  K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c > 36-actor-states-after-run2.txt
  rm -f stop
  wc -l 33-probe-run2.tsv; cat 30-timeline-run2.tsv
  awk -F'\t' '{k=$2" "$4; c[k]++} END{for(k in c) print c[k], k}' 33-probe-run2.tsv | sort -k2
fi
