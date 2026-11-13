. ~/scripts/z-lib.sh
O=$EV/10-run; mkdir -p $O/bursts $O/cpu; cd $O
N=$(cat $EV/N.txt); [ "$N" -ge 150 ] || { log "N=$N below 150, nothing to run"; echo STOPPED > 99-done; exit 1; }
T0=$(date +%s); LIMIT=${LIMIT:-3000}
over() { [ $(( $(date +%s) - T0 )) -gt $LIMIT ]; }
cat > sampler.py <<'PY'
import os, sys, time
INT = {'ateapi', 'atelet', 'envoy', 'postgres', 'kube-apiserver', 'etcd', 'kubelet', 'containerd', 'atenet', 'ate-controller', 'rustfs', 'containerd-shim', 'ateworker-gviso', 'curl'}
hz = os.sysconf('SC_CLK_TCK')
out = open(sys.argv[1], 'w')
out.write('t\tname\tcores\tmax_thread_cores\n')
def snap():
    procs, threads = {}, {}
    for p in os.listdir('/proc'):
        if not p.isdigit():
            continue
        try:
            s = open(f'/proc/{p}/stat').read()
            comm = s[s.index('(') + 1:s.rindex(')')]
            f = s[s.rindex(')') + 2:].split()
            procs[comm] = procs.get(comm, 0) + int(f[11]) + int(f[12])
            if comm in INT or comm.startswith('kube-'):
                for t in os.listdir(f'/proc/{p}/task'):
                    try:
                        s2 = open(f'/proc/{p}/task/{t}/stat').read()
                        g = s2[s2.rindex(')') + 2:].split()
                        threads[(comm, p, t)] = int(g[11]) + int(g[12])
                    except Exception:
                        pass
        except Exception:
            pass
    tot = [int(x) for x in open('/proc/stat').readline().split()[1:]]
    return time.time(), tot, procs, threads
prev = snap()
end = time.time() + float(sys.argv[2])
while time.time() < end and not os.path.exists(sys.argv[1] + '.stop'):
    time.sleep(1)
    cur = snap()
    dt = cur[0] - prev[0]
    tot = [b - a for a, b in zip(prev[1], cur[1])]
    busy = sum(tot) - tot[3] - tot[4]
    out.write(f'{cur[0]:.2f}\tNODE_BUSY\t{busy / hz / dt:.2f}\t\n')
    mt = {}
    for k, v in cur[3].items():
        if k in prev[3]:
            mt[k[0]] = max(mt.get(k[0], 0), (v - prev[3][k]) / hz / dt)
    d = {k: (v - prev[2].get(k, 0)) / hz / dt for k, v in cur[2].items()}
    for k, v in sorted(d.items(), key=lambda x: -x[1]):
        if v >= 0.05 or k in INT:
            m = f'{mt[k]:.2f}' if k in mt else ''
            out.write(f'{cur[0]:.2f}\t{k}\t{v:.2f}\t{m}\n')
    out.flush()
    prev = cur
PY
cat > burst.sh <<'EOF'
L=$1; PROCS=$2; HTTP=$3; shift 3
rm -f /tmp/cfg.$L.* /tmp/burst-$L.*
i=0
for a in "$@"; do
  f=/tmp/cfg.$L.$((i % PROCS))
  [ -s $f ] && echo next >> $f
  printf 'url = "https://atenet-router.ate-system.svc:443/"\nrequest = POST\nheader = "ate-target-actor: sc-lab/%s"\ncacert = /run/ca/trust-bundle.pem\ncert = /run/id/credential-bundle.pem\nkey = /run/id/credential-bundle.pem\nmax-time = 90\noutput = /dev/null\nwrite-out = "%s\\t%%{http_code}\\t%%{time_total}\\t%%{time_starttransfer}\\t%%{http_version}\\t%%{num_connects}\\n"\n' "$a" "$a" >> $f
  i=$((i+1))
done
X=""; [ "$HTTP" = h1 ] && X="--http1.1"
s=$(cut -d' ' -f1 /proc/uptime)
for p in $(seq 0 $((PROCS-1))); do
  [ -s /tmp/cfg.$L.$p ] && curl -s -Z --parallel-immediate --parallel-max 300 $X -K /tmp/cfg.$L.$p > /tmp/burst-$L.$p 2>/tmp/burst-$L.err.$p &
done
wait
e=$(cut -d' ' -f1 /proc/uptime)
cat /tmp/burst-$L.[0-9]* > /tmp/burst-$L.tsv
awk -v s=$s -v e=$e 'BEGIN{printf "%.2f\n", e-s}'
EOF
kubectl -n ate-system exec -i u-prober -- sh -c 'cat > /tmp/burst.sh' < burst.sh
burst() {
  local L=$1; local wall
  python3 sampler.py cpu/$L.tsv 300 & local sp=$!
  sleep 1
  wall=$(kubectl -n ate-system exec u-prober -- sh /tmp/burst.sh "$@" 2>/dev/null | tail -1)
  sleep 2; touch cpu/$L.tsv.stop; wait $sp; rm -f cpu/$L.tsv.stop
  kubectl -n ate-system exec u-prober -- cat /tmp/burst-$L.tsv > bursts/$L.tsv 2>/dev/null
  python3 - "$L" "$wall" bursts/$L.tsv <<'PY'
import sys
L, wall, f = sys.argv[1:4]
rows = [l.rstrip('\n').split('\t') for l in open(f) if l.strip()]
ok = sorted(float(r[2]) for r in rows if r[1] == '200')
q = lambda p: ok[min(len(ok) - 1, int(p * len(ok)))] if ok else float('nan')
codes = {}
for r in rows:
    codes[r[1]] = codes.get(r[1], 0) + 1
conns = sum(int(r[5]) for r in rows if r[5].isdigit())
print(f"{L}\tn={len(rows)}\tok={len(ok)}\twall={wall}\trate={len(ok) / max(float(wall or 0), 0.01):.1f}/s\tmin={(ok[0] if ok else float('nan')):.3f}\tp50={q(.5):.3f}\tp95={q(.95):.3f}\tmax={(ok[-1] if ok else float('nan')):.3f}\tcodes={codes}\tconnects={conns}\thttp={rows[0][4] if rows else ''}")
PY
}
create_many() { printf '%s\n' "$@" | xargs -P 24 -I{} sh -c "kubectl ate create actor {} -a $S --template sc-drill >/dev/null 2>&1 || echo fail {}"; }
suspend_many() { printf '%s\n' "$@" | xargs -P 24 -I{} sh -c "kubectl ate suspend actor {} -a $S >/dev/null 2>&1 || echo fail {}"; }
settle() { for i in $(seq 1 150); do [ "$(K get actors -a $S | grep -c -E 'RUNNING|SUSPENDING|RESUMING')" = 0 ] && break; sleep 2; done; }
states() { K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c | tr '\n' ' '; }
snap_mb() { docker exec $NODE du -sm /var/lib/ate 2>/dev/null | awk '{print $1}'; }
names() { seq -f "t-%03g" 1 $1; }
log "start N=$N disk=$(disk_mb)MB mem=$(mem_mb)MB snap=$(snap_mb)MB"
t=$(ms); f=$(create_many $(names $N) | wc -l); log "created $N actors in $(( $(ms) - t )) ms, $f failed"
echo -e "chunk\tresult" > 10-first-activation.tsv
for a in $(seq 1 150 $N); do b=$(( a + 149 )); [ $b -gt $N ] && b=$N
  r=$(burst first-$a 1 h2 $(seq -f "t-%03g" $a $b)); echo -e "$a-$b\t$r" | tee -a 10-first-activation.tsv; done
log "after first activation: $(states) disk=$(disk_mb)MB mem=$(mem_mb)MB"
t=$(ms); f=$(suspend_many $(names $N) | wc -l); log "suspend commands for $N in $(( $(ms) - t )) ms, $f failed"; settle
log "after suspend: $(states) disk=$(disk_mb)MB snap=$(snap_mb)MB"
docker exec $NODE crictl stats 2>/dev/null | awk 'NR==1 || /ate-api|postgres|rustfs|atelet|atenet|controller|etcd|apiserver/' > 12-crictl-stats-before.txt
kubectl -n ate-system get deploy ate-api-server atenet-router -o json | jq '.items[]|{name: .metadata.name, replicas: .spec.replicas, resources: [.spec.template.spec.containers[]|{name, resources}]}' > 13-system-resources.json 2>&1
echo -e "level\tprocs\thttp\trep\tresult\tdisk_mb\tmem_mb" > 20-concurrency.tsv
one() { c=$1; procs=$2; http=$3; tag=$4
  r=$(burst c$c-p$procs-$http-$tag $procs $http $(names $c)); echo -e "$c\t$procs\t$http\t$tag\t$r\t$(disk_mb)\t$(mem_mb)" | tee -a 20-concurrency.tsv
  [ "$(disk_mb)" -lt 3000 ] && { log "STOP: guest disk under 3000 MB"; echo STOPPED > 99-done; exit 1; }
  [ "$(mem_mb)" -lt 6000 ] && { log "STOP: guest memory under 6000 MB"; echo STOPPED > 99-done; exit 1; }
  sleep 1; suspend_many $(names $c) > /dev/null; settle
}
LEVELS="150 200"; [ $N -gt 200 ] && LEVELS="$LEVELS $N"
for rep in 1 2 3; do for c in $LEVELS; do one $c 1 h2 r$rep; done; over && { log "time limit after rep $rep"; break; }; done
log "main series end: $(states) disk=$(disk_mb)MB snap=$(snap_mb)MB"
over || one 200 4 h2 p4
R0=$(kubectl -n ate-system get deploy ate-api-server -o jsonpath='{.spec.replicas}')
for R in 1 4; do over && break
  kubectl -n ate-system scale deploy ate-api-server --replicas=$R >> 30-scale.log 2>&1
  kubectl -n ate-system rollout status deploy ate-api-server --timeout=180s >> 30-scale.log 2>&1; sleep 15
  log "ate-api-server replicas=$R ($(kubectl -n ate-system get deploy ate-api-server -o jsonpath='{.status.readyReplicas}') ready)"
  for rep in 1 2; do one 150 1 h2 api$R-r$rep; done
done
kubectl -n ate-system scale deploy ate-api-server --replicas=$R0 >> 30-scale.log 2>&1
kubectl -n ate-system rollout status deploy ate-api-server --timeout=180s >> 30-scale.log 2>&1
RR0=$(kubectl -n ate-system get deploy atenet-router -o jsonpath='{.spec.replicas}')
if ! over; then
  kubectl -n ate-system scale deploy atenet-router --replicas=4 >> 30-scale.log 2>&1
  kubectl -n ate-system rollout status deploy atenet-router --timeout=180s >> 30-scale.log 2>&1; sleep 15
  log "atenet-router replicas=4"
  for rep in 1 2; do one 150 1 h2 router4-r$rep; done
  kubectl -n ate-system scale deploy atenet-router --replicas=$RR0 >> 30-scale.log 2>&1
  kubectl -n ate-system rollout status deploy atenet-router --timeout=180s >> 30-scale.log 2>&1
fi
log "replicas restored: ate-api-server=$R0 atenet-router=$RR0"
: > 21-sequential.tsv
for n in $(seq -f "t-%03g" 1 20); do burst seq-$n 1 h2 $n >> 21-sequential.tsv; kubectl ate suspend actor $n -a $S >/dev/null 2>&1; done
settle
docker exec $NODE crictl stats 2>/dev/null | awk 'NR==1 || /ate-api|postgres|rustfs|atelet|atenet|controller|etcd|apiserver/' > 32-crictl-stats-end.txt
kubectl -n ate-system get deploy,ds,sts -o wide > 33-system-objects.txt 2>&1
kubectl -n ate-system logs deploy/ate-api-server --since=5m 2>&1 | tail -300 > 35-ateapi-tail.log
kubectl -n ate-system logs ds/atelet --since=5m 2>&1 | tail -300 > 36-atelet-tail.log
log "end: $(states) disk=$(disk_mb)MB mem=$(mem_mb)MB snap=$(snap_mb)MB"
echo DONE > 99-done
