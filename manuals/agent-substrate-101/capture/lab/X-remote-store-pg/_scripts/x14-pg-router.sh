. ~/scripts/x-pglib.sh
O=$EV/50-pg-tests; cd $O
S=x-lab
R() { PX "sh /tmp/req.sh $*"; }
t1=$(awk -F'\t' '$3=="pg-ready-on-its-guest"{print int($1)}' 30-timeline.tsv)
{
echo "### $(date -u +%FT%TZ) router check, $(( $(date +%s) - t1 )) s after Postgres was ready"
echo "request x-run (actor is SUSPENDED): $(R x-run 12)"
echo "request to another suspended actor x-s-046: $(R x-s-046 12)"
echo "--- router log for x-run, last 40 s"
kubectl -n ate-system logs deploy/atenet-router --all-containers --since=40s 2>/dev/null | grep -v -E '^\[20' | grep "x-run" | jq -r -c '[.time[11:23], .level, .msg, (.err // "-"), (.state // "-")] | @tsv' | tail -6
echo "--- api-server RPCs that name x-run, last 40 s"
for p in $(kubectl -n ate-system get pods -l app=ate-api-server -o name); do kubectl -n ate-system logs $p --all-containers --since=40s 2>&1 | grep '"x-run"' | jq -r -c '[.time[11:23], .method, ((.err // "-")|tostring|.[0:120]), (.["elapsed-time"] // "-")] | @tsv' 2>/dev/null | tail -4; done
echo "--- rollout restart of atenet-router"
t=$(now); kubectl -n ate-system rollout restart deploy/atenet-router > /dev/null; kubectl -n ate-system rollout status deploy/atenet-router --timeout=180s | tail -1; echo "restart took $(el $t) s"
sleep 3
echo "request x-run after the router restart: $(R x-run 15)"
echo "request x-run: $(R x-run 15)"
echo "state: $(kubectl ate get actor x-run -a $S -o json 2>/dev/null | jq -r .status.state)"
} > 42-x-run-router-restart.txt 2>&1
cat 42-x-run-router-restart.txt
