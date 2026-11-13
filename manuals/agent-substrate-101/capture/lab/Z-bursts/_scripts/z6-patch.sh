cd ~/evidence/Z-bursts/10-run
python3 - <<'PY'
p = 'sampler.py'
t = open(p).read()
old = "    out.write(f'{cur[0]:.2f}\\tNODE_BUSY\\t{busy / hz / dt:.2f}\\t\\n')\n"
new = old + "    out.write(f'{cur[0]:.2f}\\tNODE_IOWAIT\\t{tot[4] / hz / dt:.2f}\\t\\n')\n"
if 'NODE_IOWAIT' not in t:
    assert old in t
    t = t.replace(old, new)
    open(p, 'w').write(t)
print('patched' if 'NODE_IOWAIT' in t else 'not patched')
PY
echo "$(date -u +%T) sampler patched to also record NODE_IOWAIT; bursts before this line have no iowait" >> 00-run.log
cd cpu
for f in c300-p1-h2-r1.tsv c300-p1-h2-r2.tsv c200-p1-h2-r1.tsv c150-p1-h2-r2.tsv; do
  echo "== $f"
  python3 - $f <<'PY'
import sys, collections
rows = [l.rstrip('\n').split('\t') for l in open(sys.argv[1])][1:]
busy = [(float(r[0]), float(r[2])) for r in rows if r[1] == 'NODE_BUSY']
active = [t for t, v in busy if v > 3]
lo, hi = min(active), max(active)
n = len([1 for t, v in busy if lo <= t <= hi])
names = ['ateapi', 'atelet', 'envoy', 'atenet', 'postgres', 'kube-apiserver', 'etcd', 'kubelet', 'containerd', 'containerd-shim', 'curl', 'rustfs', 'gvisor_sentry', 'ateworker-gviso', 'kworker*']
tot = collections.defaultdict(float); peak = collections.defaultdict(float); th = collections.defaultdict(float); per = collections.defaultdict(lambda: collections.defaultdict(float))
for r in rows:
    if r[1] == 'NODE_BUSY':
        continue
    t = float(r[0])
    if not lo <= t <= hi:
        continue
    k = 'kworker*' if r[1].startswith('kworker') else r[1]
    per[k][t] += float(r[2])
    if r[3]:
        th[k] = max(th[k], float(r[3]))
for k in names:
    v = list(per[k].values())
    if not v:
        print(f"{k:16s} not seen")
        continue
    print(f"{k:16s} mean_over_window={sum(v) / n:5.2f} peak={max(v):5.2f} busiest_thread_peak={th.get(k, float('nan')):4.2f}")
PY
done
