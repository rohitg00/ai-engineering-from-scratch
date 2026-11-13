cd ~/evidence/K-kagent/latency
tail -2 events.log
echo "--- D details"
grep -P '\tD-par' timings.tsv
for i in 1 2 3 4 5 6 7 8; do echo "D$i: $(head -c 300 D-par-$i.json) ERR: $(head -c 300 D-par-$i.err)"; done | cut -c1-520
echo "--- during D"; cat D-actors-during.txt | cut -c1-200; cat D-workers-during.txt | cut -c1-200; cut -c1-150 D-pods-during.txt
echo "--- final"; cat actors-final.txt | awk '{print $2, $4, $7}' | sort | uniq -c | head -40; cat workers-final.txt | cut -c1-200
echo "--- delete"; cat delete.out | head -5; head -12 delete-watch.txt | cut -c1-200
echo "--- server-side turn time (first user message timeline-position -> task completed timestamp), seconds"
for f in A-spaced-*.json B-b2b-*.json C-first-*.json; do
  jq -r --arg f "$f" '[$f, (.task.history[0].metadata["kagent.dev/a2a/timeline-position"] // ""), (.task.status.timestamp // "")] | @tsv' "$f"
done > server-times.tsv
python3 - <<'EOF'
import csv, datetime, statistics as st, collections
def p(s):
    s = s.rstrip('Z')
    if '.' in s:
        a, b = s.split('.'); s = a + '.' + (b + '000000')[:6]
    else:
        s += '.000000'
    return datetime.datetime.strptime(s, '%Y-%m-%dT%H:%M:%S.%f')
g = collections.defaultdict(list)
for f, a, b in csv.reader(open('server-times.tsv'), delimiter='\t'):
    if a and b:
        g[f.rsplit('-', 1)[0]].append((p(b) - p(a)).total_seconds())
for k, v in sorted(g.items()):
    v.sort()
    print(f"{k}: n={len(v)} min={v[0]:.3f} p50={st.median(v):.3f} max={v[-1]:.3f}")
cli = collections.defaultdict(list)
for row in csv.reader(open('timings.tsv'), delimiter='\t'):
    if row[1] == 'session-create':
        cli['session-create'].append(float(row[3]))
    else:
        cli[row[1].rsplit('-', 1)[0]].append(float(row[3]))
print('client wall time:')
for k, v in sorted(cli.items()):
    v.sort()
    print(f"{k}: n={len(v)} min={v[0]:.3f} p50={st.median(v):.3f} max={v[-1]:.3f}")
EOF
echo "--- trace line count and state counts"
wc -l actor-trace.log
grep -o -E 'ACTOR_STATE_[A-Z]+' actor-trace.log | sort | uniq -c
echo "--- ate-api log shape"
sg docker -c "kubectl -n ate-system logs deploy/ate-api-server -c ate-api-server --since=3m" 2>/dev/null > ate-api.log; wc -l ate-api.log; grep -i -E "resume|suspend" ate-api.log | head -4 | cut -c1-500
sg docker -c "kubectl -n ate-system logs ds/atelet -c atelet --since=3m" 2>/dev/null > atelet.log; wc -l atelet.log; grep -i -E "restore|resume|checkpoint|suspend" atelet.log | head -6 | cut -c1-500
