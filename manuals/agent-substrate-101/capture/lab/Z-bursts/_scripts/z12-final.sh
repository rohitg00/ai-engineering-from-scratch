. ~/scripts/z-lib.sh
O=$EV/10-run; cd $O
kubectl -n ate-system logs ds/atelet --since=60m 2>/dev/null | grep -E 'Restore timing breakdown|Checkpoint timing breakdown' > 50-atelet-timing.log
kubectl -n ate-system get pods -l app=atelet -o wide > 52-atelet-pod.txt 2>&1
kubectl -n ate-system get pods -o wide | grep atelet >> 52-atelet-pod.txt
bash ~/scripts/z9-conc.sh 2>/dev/null | tail -20
python3 - <<'PY'
rows = [l.rstrip('\n').split('\t') for l in open('21-sequential.tsv') if l.strip()]
import re
t = sorted(float(re.search(r'p50=([0-9.]+)', l[0] if len(l) == 1 else '\t'.join(l)).group(1)) for l in rows)
print(f"sequential single resumes: n={len(t)} median={t[len(t) // 2]:.3f} min={t[0]:.3f} max={t[-1]:.3f}")
PY
for f in bursts/*.tsv; do awk -F'\t' '$2!="200"{print FILENAME"\t"$0}' $f; done > 41-non-200-rows.tsv
wc -l < 41-non-200-rows.tsv
awk -F'\t' '{print $1"\t"$3}' 41-non-200-rows.tsv | sort | uniq -c
grep -P '\t000\t' 41-non-200-rows.tsv | cut -f1,2,4
kubectl -n ate-system exec postgres-0 -c postgres -- psql -U postgres -tAc "show max_connections;" > 42-postgres-max-connections.txt 2>&1
kubectl -n ate-system get deploy ate-api-server -o json | jq '[.spec.template.spec.containers[] | {name, args, env: [.env[]? | select(.name | test("POOL|CONN|PG"; "i"))]}]' > 43-ateapi-pool-settings.json 2>&1
cat 43-ateapi-pool-settings.json | head -30
df -h / | tail -1; free -m | sed -n 2p
