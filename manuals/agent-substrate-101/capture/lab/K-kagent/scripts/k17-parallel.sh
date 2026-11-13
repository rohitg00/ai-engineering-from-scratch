E=~/evidence/K-kagent/parallel; mkdir -p "$E"; cd "$E"; . ~/scripts/lib.sh
: > timings.tsv; : > events.log; rm -f actor-trace.log workers-during.txt states-during.txt ingress-probe.txt
echo "--- earlier delete watch"; cat ../latency/delete.out 2>&1 | head -3; grep -v '^Warning' ../latency/delete-watch.txt 2>/dev/null | head -8 | cut -c1-160
echo "hello" > hello.txt
pgrep -f "port-forward svc/kagent-controller" >/dev/null || (setsid sg docker -c "kubectl -n kagent port-forward svc/kagent-controller 8083:8083" > $E/port-forward.log 2>&1 < /dev/null &)
sleep 2
s=$(now); sg docker -c "kagent agent list" > list.out 2> list.err; e=$(now); echo "cli with standing port-forward: $(echo "$e - $s" | bc)s rc=$?"; head -3 list.err
start_tracer
for N in 8 24; do
  for i in $(seq 1 $N); do new_session lab-agent "P$N-$i" > "p$N-$i.sid"; done
  sleep 2
  ev "P$N-start"
  pids=""
  for i in $(seq 1 $N); do ( turn "P$N-$(printf %02d $i)" "$(cat p$N-$i.sid)" hello.txt >/dev/null ) & pids="$pids $!"; done
  for t in 1 2 3; do
    sleep 0.4
    sg docker -c "kubectl ate get worker" 2>/dev/null | tail -1 | awk -v n="$N" -v t="$(iso)" '{print t, "N="n, "actors="$4, "cpu="$5, "mem="$6}' >> workers-during.txt
    sg docker -c "kubectl ate get actor -a kagent" 2>/dev/null | awk 'NR>1{print $4}' | sort | uniq -c | tr '\n' ' ' | sed "s/^/$(iso) N=$N /; s/$/\n/" >> states-during.txt
  done
  wait $pids
  ev "P$N-end"
  sleep 6
done
stop_tracer
cat workers-during.txt; cat states-during.txt
awk -F'\t' '$2!="session-create"{split($2,a,"-"); k=a[1]; n[k]++; if($5==0 && $6=="TASK_STATE_COMPLETED") ok[k]++; v[k]=v[k]" "$4} END{for(k in n) printf "%s n=%d ok=%d :%s\n",k,n[k],ok[k],v[k]}' timings.tsv
grep -l -i error P*.err 2>/dev/null | head -3; for f in $(ls P*.err | head -40); do [ -s "$f" ] && { echo "$f: $(head -c 300 $f)"; }; done | head -5
echo "--- clean ingress probe"
cat > probe.sh <<'EOF'
for url in http://atenet-router.ate-system.svc:80/ http://atenet-router.ate-system.svc:8081/ https://atenet-router.ate-system.svc:443/ https://atenet-router.ate-system.svc:8444/ http://atenet-router.ate-system.svc:15020/ https://api.ate-system.svc:443/ https://atenet-egress.ate-system.svc:443/; do
  curl -sk -m 5 -o /dev/null -H "ate-target-actor: kagent/SESSION" -w "$url code=%{http_code} curl_exit=%{exitcode} %{errormsg}\n" "$url"
done
EOF
PS=$(cat p8-1.sid); sed -i "s/SESSION/session-$PS/" probe.sh
cat > probe-pod.yaml <<EOF
apiVersion: v1
kind: Pod
metadata: {name: probe}
spec:
  restartPolicy: Never
  containers:
  - name: c
    image: curlimages/curl:8.11.1
    command: ["sleep","3600"]
EOF
for ns in default kagent; do
  sg docker -c "kubectl -n $ns apply -f probe-pod.yaml" >/dev/null 2>&1
  sg docker -c "kubectl -n $ns wait --for=condition=Ready pod/probe --timeout=120s" >/dev/null 2>&1
  echo "from namespace $ns:" | tee -a ingress-probe.txt
  sg docker -c "kubectl -n $ns exec -i probe -- sh" < probe.sh 2>&1 | tee -a ingress-probe.txt
  sg docker -c "kubectl -n $ns delete pod probe --wait=false" >/dev/null 2>&1
done
sg docker -c "kubectl ate get actor session-$PS -a kagent" 2>/dev/null | tail -1 | cut -c1-140 | tee -a ingress-probe.txt
echo "--- logs"
L=~/evidence/K-kagent/logs; mkdir -p "$L"
for p in $(sg docker -c "kubectl -n ate-system get pods -o name" | grep -E "ate-api-server|atelet|atenet-router|ate-controller"); do
  n=$(basename $p)
  sg docker -c "kubectl -n ate-system logs $p --all-containers --since=40m" > "$L/$n.log" 2>&1
done
sg docker -c "kubectl -n kagent logs deploy/kagent-controller --since=40m" > "$L/kagent-controller.log" 2>&1
sg docker -c "kubectl -n kagent logs deploy/mock-llm" > "$L/mock-llm.log" 2>&1
sg docker -c "kubectl -n kagent logs -l ate.dev/worker-pool=kagent-default --tail=3000" > "$L/worker.log" 2>&1
wc -l "$L"/*.log | tail -12
cat "$L"/ate-api-server-*.log | grep '"Actor state changed"' | jq -r '[.time, .["ate.actor.name"], .["ate.actor.operation.name"], .["ate.actor.state"]] | @tsv' 2>/dev/null | sort > "$L/actor-state-changes.tsv"
wc -l "$L/actor-state-changes.tsv"
python3 - "$L/actor-state-changes.tsv" <<'EOF'
import sys, csv, datetime, statistics as st, collections
def p(s):
    s = s.rstrip('Z'); a, _, b = s.partition('.'); return datetime.datetime.strptime(a + '.' + (b + '000000')[:6], '%Y-%m-%dT%H:%M:%S.%f')
start = {}; d = collections.defaultdict(list)
for t, name, op, state in csv.reader(open(sys.argv[1]), delimiter='\t'):
    k = (name, op)
    if state in ('resuming', 'suspending'):
        start[k] = p(t)
    elif state in ('running', 'suspended') and k in start:
        d[op].append((p(t) - start.pop(k)).total_seconds())
for op, v in d.items():
    v.sort(); q = lambda x: v[min(len(v) - 1, int(len(v) * x))]
    print(f"{op}: n={len(v)} min={v[0]:.3f} p50={st.median(v):.3f} p90={q(0.9):.3f} p99={q(0.99):.3f} max={v[-1]:.3f}")
EOF
echo "--- restore / checkpoint breakdown sample"
grep -h '"Restore timing breakdown"' "$L"/atelet-*.log | tail -1 | jq -c 'with_entries(select(.key|test("duration|kind|fidelity|bytes|size")))'
grep -h '"Checkpoint timing breakdown"' "$L"/atelet-*.log | tail -1 | jq -c 'with_entries(select(.key|test("duration|kind|fidelity|bytes|size")))'
grep -h '"Restore timing breakdown"' "$L"/atelet-*.log | jq -r '.["ate.snapshot.kind"]' | sort | uniq -c
echo "--- router parked / 503"
cat "$L"/atenet-router-*.log | grep -c -i -E "park|503"
sg docker -c "kubectl top pods -A" 2>&1 | head -30 > "$L/top.txt"; sg docker -c "kubectl ate top --help" 2>&1 | sed -n 1,12p
df -h / | tail -1; free -g | sed -n 2p
