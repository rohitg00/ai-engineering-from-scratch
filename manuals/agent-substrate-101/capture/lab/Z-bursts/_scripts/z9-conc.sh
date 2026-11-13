cd ~/evidence/Z-bursts/10-run
python3 - <<'PY' | tee 51-restore-concurrency.txt
import json, datetime, collections
ev = []
for l in open('50-atelet-timing.log'):
    try:
        d = json.loads(l)
    except Exception:
        continue
    if d.get('msg') != 'Restore timing breakdown':
        continue
    end = datetime.datetime.fromisoformat(d['time'].replace('Z', '+00:00')[:26] + '+00:00').timestamp()
    tot = d['ate.actor.restore.duration.total']
    ev.append((end - tot, end, tot, d['ate.actor.restore.duration.worker_restore'], d['ate.snapshot.kind'], d['ate.actor.name']))
ev.sort()
print(f"restores in log: {len(ev)}, kinds: {dict(collections.Counter(e[4] for e in ev))}")
groups = []
for e in ev:
    if groups and e[0] - groups[-1][-1][1] < 3:
        groups[-1].append(e)
    else:
        groups.append([e])
print("burst_start_utc\tn\tspan_s\trate_per_s\tinflight_max\tinflight_median\trestore_total_median_s\trestore_total_p95_s\tworker_restore_median_s")
for g in groups:
    if len(g) < 40:
        continue
    pts = sorted([(s, 1) for s, *_ in g] + [(e, -1) for _, e, *_ in g])
    cur = 0; samples = []
    lo, hi = g[0][0], max(x[1] for x in g)
    for t, d in pts:
        cur += d
        samples.append(cur)
    t = lo; inflight = []
    while t < hi:
        inflight.append(sum(1 for s, e, *_ in g if s <= t < e))
        t += 0.05
    tots = sorted(x[2] for x in g); wr = sorted(x[3] for x in g)
    inf = sorted(inflight)
    print(f"{datetime.datetime.utcfromtimestamp(lo).strftime('%H:%M:%S')}\t{len(g)}\t{hi - lo:.2f}\t{len(g) / (hi - lo):.1f}\t{max(samples)}\t{inf[len(inf) // 2]}\t{tots[len(tots) // 2]:.3f}\t{tots[int(.95 * len(tots))]:.3f}\t{wr[len(wr) // 2]:.3f}")
PY
