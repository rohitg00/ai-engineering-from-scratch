cd ~/evidence/Z-bursts/10-run/cpu
for f in c300-p1-h2-r1.tsv c300-p1-h2-r2.tsv c200-p1-h2-r1.tsv c150-p1-h2-r2.tsv; do
  [ -f $f ] || continue
  echo "== $f"
  python3 - $f <<'PY'
import sys, collections
rows = [l.rstrip('\n').split('\t') for l in open(sys.argv[1])][1:]
busy = [(float(r[0]), float(r[2])) for r in rows if r[1] == 'NODE_BUSY']
active = [t for t, v in busy if v > 3]
lo, hi = (min(active), max(active)) if active else (0, 0)
print(f"samples={len(busy)} active_window_s={hi - lo:.0f} node_busy_peak={max(v for _, v in busy):.1f} node_busy_mean_active={sum(v for t, v in busy if lo <= t <= hi) / max(1, len([1 for t, v in busy if lo <= t <= hi])):.1f}")
by = collections.defaultdict(list); th = collections.defaultdict(list)
for r in rows:
    if r[1] == 'NODE_BUSY':
        continue
    t = float(r[0])
    if lo <= t <= hi:
        by[r[1]].append(float(r[2]))
        if r[3]:
            th[r[1]].append(float(r[3]))
for k, v in sorted(by.items(), key=lambda x: -sum(x[1]) / len(x[1]))[:14]:
    m = max(th[k]) if th[k] else float('nan')
    print(f"{k:18s} mean={sum(v) / len(v):5.2f} peak={max(v):5.2f} max_thread_peak={m:4.2f}")
PY
done
