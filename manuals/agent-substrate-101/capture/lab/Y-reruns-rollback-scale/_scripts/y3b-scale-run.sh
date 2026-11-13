. ~/scripts/y-lib.sh
usecluster ysc
export PATH=$U/bin-new:$PATH
O=$EV/30-scale/10-run; mkdir -p $O/bursts $O/cpu; cd $O
S=sc-lab; N=${N:-500}
log() { echo "$(date -u +%T) $*" | tee -a 00-run.log; }
disk_mb() { df -m / | awk 'NR==2{print $4}'; }
mem_mb() { free -m | awk 'NR==2{print $7}'; }
cat > cpusnap.py <<'PY'
import os, sys, json, time
procs = {}
for p in os.listdir('/proc'):
    if not p.isdigit():
        continue
    try:
        s = open(f'/proc/{p}/stat').read()
        comm = s[s.index('(') + 1:s.rindex(')')]
        f = s[s.rindex(')') + 2:].split()
        procs[comm] = procs.get(comm, 0) + int(f[11]) + int(f[12])
    except Exception:
        pass
tot = [int(x) for x in open('/proc/stat').readline().split()[1:]]
json.dump({'t': time.time(), 'total': tot, 'procs': procs}, open(sys.argv[1], 'w'))
PY
cat > cpudiff.py <<'PY'
import sys, json, os
a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
hz = os.sysconf('SC_CLK_TCK'); dt = b['t'] - a['t']
tot = [y - x for x, y in zip(a['total'], b['total'])]
busy = sum(tot) - tot[3] - tot[4]
print(f"window_s\t{dt:.2f}")
print(f"node_busy_cores\t{busy / hz / dt:.2f}\tof {os.cpu_count()}")
d = {k: (v - a['procs'].get(k, 0)) / hz / dt for k, v in b['procs'].items()}
for k, v in sorted(d.items(), key=lambda x: -x[1])[:14]:
    print(f"{k}\t{v:.2f}")
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
  python3 cpusnap.py cpu/$L.a.json
  wall=$(kubectl -n ate-system exec u-prober -- sh /tmp/burst.sh "$@" 2>/dev/null | tail -1)
  python3 cpusnap.py cpu/$L.b.json
  python3 cpudiff.py cpu/$L.a.json cpu/$L.b.json > cpu/$L.tsv 2>&1
  kubectl -n ate-system exec u-prober -- cat /tmp/burst-$L.tsv > bursts/$L.tsv 2>/dev/null
  python3 - "$L" "$wall" bursts/$L.tsv <<'PY'
import sys
L,wall,f=sys.argv[1:4]
rows=[l.rstrip('\n').split('\t') for l in open(f) if l.strip()]
ok=sorted(float(r[2]) for r in rows if r[1]=='200')
q=lambda p: ok[min(len(ok)-1,int(p*len(ok)))] if ok else float('nan')
codes={}
for r in rows: codes[r[1]]=codes.get(r[1],0)+1
conns=sum(int(r[5]) for r in rows if r[5].isdigit())
print(f"{L}\tn={len(rows)}\tok={len(ok)}\twall={wall}\trate={len(ok)/max(float(wall),0.01):.1f}/s\tmin={(ok[0] if ok else float('nan')):.3f}\tp50={q(.5):.3f}\tp95={q(.95):.3f}\tp99={q(.99):.3f}\tmax={(ok[-1] if ok else float('nan')):.3f}\tcodes={codes}\tconnects={conns}\thttp={rows[0][4] if rows else ''}")
PY
}
create_many() { printf '%s\n' "$@" | xargs -P 24 -I{} sh -c "kubectl ate create actor {} -a $S --template sc-tiny >/dev/null 2>&1 || echo fail {}"; }
suspend_many() { printf '%s\n' "$@" | xargs -P 24 -I{} sh -c "kubectl ate suspend actor {} -a $S >/dev/null 2>&1 || echo fail {}"; }
settle() { for i in $(seq 1 120); do [ "$(K get actors -a $S | grep -c -E 'RUNNING|SUSPENDING|RESUMING')" = 0 ] && break; sleep 2; done; }
states() { K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c | tr '\n' ' '; }
snap_mb() { docker exec $NODE du -sm /var/lib/ate 2>/dev/null | awk '{print $1}'; }
ALL=$(seq -f "t-%03g" 1 $N)
log "start disk=$(disk_mb)MB mem=$(mem_mb)MB snap=$(snap_mb)MB"
t=$(now); f=$(create_many $ALL | wc -l); log "created $N actors in $(el $t) s, $f failed"
echo -e "level\trep\tresult" > 10-first-activation.tsv
r=$(burst first-250a 1 h2 $(seq -f "t-%03g" 1 250)); echo -e "250\tfirst\t$r" | tee -a 10-first-activation.tsv
r=$(burst first-250b 1 h2 $(seq -f "t-%03g" 251 $N)); echo -e "250\tfirst\t$r" | tee -a 10-first-activation.tsv
log "after first activation: $(states) disk=$(disk_mb)MB mem=$(mem_mb)MB"
t=$(now); f=$(suspend_many $ALL | wc -l); log "suspend commands for $N in $(el $t) s, $f failed"; settle
log "after suspend: $(states) disk=$(disk_mb)MB snap=$(snap_mb)MB"
docker exec $NODE crictl stats 2>/dev/null | awk 'NR==1 || /ate-api|postgres|rustfs|atelet|atenet|controller/' > 12-crictl-stats-system.txt
echo -e "level\tprocs\thttp\trep\tresult" > 20-concurrency.tsv
one() { c=$1; procs=$2; http=$3; rep=$4
  names=$(seq -f "t-%03g" 1 $c)
  r=$(burst c$c-p$procs-$http-r$rep $procs $http $names); echo -e "$c\t$procs\t$http\t$rep\t$r\tdisk=$(disk_mb)\tmem=$(mem_mb)" | tee -a 20-concurrency.tsv
  [ "$(disk_mb)" -lt 3000 ] && { log 'STOP: guest disk under 3000 MB'; echo STOPPED > 99-done; exit 1; }
  sleep 1; suspend_many $names > /dev/null; settle
}
for rep in 1 2 3; do
  for c in 50 100 150 200 300; do one $c 1 h2 $rep; done
  one 500 2 h2 $rep
done
log "main series end: $(states) disk=$(disk_mb)MB snap=$(snap_mb)MB"
for rep in 1 2; do
  one 300 4 h2 $rep
  one 500 5 h2 $rep
  one 150 1 h1 $rep
  one 300 1 h1 $rep
done
: > 21-sequential.tsv
for n in $(seq -f "t-%03g" 401 430); do burst seq 1 h2 $n >> 21-sequential.tsv; kubectl ate suspend actor $n -a $S >/dev/null 2>&1; done
settle
docker exec $NODE crictl stats 2>/dev/null | awk 'NR==1 || /ate-api|postgres|rustfs|atelet|atenet|controller/' > 32-crictl-stats-system-end.txt
kubectl -n ate-system get deploy,ds,sts -o wide > 33-system-objects.txt 2>&1
kubectl -n ate-system get deploy ate-api-server atenet-router -o json | jq '.items[]|{name: .metadata.name, replicas: .spec.replicas, resources: [.spec.template.spec.containers[]|{name, resources}]}' > 34-system-resources.json 2>&1
kubectl -n ate-system logs deploy/ate-api-server --since=3m 2>&1 | tail -200 > 35-ateapi-tail.log
log "end: $(states) disk=$(disk_mb)MB mem=$(mem_mb)MB snap=$(snap_mb)MB"
echo DONE > 99-done
