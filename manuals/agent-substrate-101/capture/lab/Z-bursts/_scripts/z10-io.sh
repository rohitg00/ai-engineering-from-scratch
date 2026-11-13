cd ~/evidence/Z-bursts/10-run
tail -3 00-run.log
tail -3 20-concurrency.tsv | cut -c1-200
cd cpu
for f in c150-p1-h2-api1-r1.tsv c150-p1-h2-api1-r2.tsv c150-p1-h2-api4-r1.tsv c150-p1-h2-api4-r2.tsv c150-p1-h2-router4-r1.tsv; do
  [ -f $f ] || continue
  python3 - $f <<'PY'
import sys
rows = [l.rstrip('\n').split('\t') for l in open(sys.argv[1])][1:]
b = {r[0]: float(r[2]) for r in rows if r[1] == 'NODE_BUSY'}
w = {r[0]: float(r[2]) for r in rows if r[1] == 'NODE_IOWAIT'}
act = [t for t, v in b.items() if v > 3]
print(sys.argv[1], 'per second busy/iowait cores during burst:', ' '.join(f"{b[t]:.1f}/{w.get(t, float('nan')):.1f}" for t in sorted(act)))
PY
done
cat /proc/pressure/memory /proc/pressure/io /proc/pressure/cpu 2>/dev/null
vmstat 1 3 | tail -2
