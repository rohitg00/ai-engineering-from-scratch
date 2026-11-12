. ~/scripts/x-pglib.sh
O=$EV/50-pg-tests; cd $O
S=x-lab
R() { PX "sh /tmp/req.sh $*"; }
{
echo "### $(date -u +%FT%TZ) follow-up after the outage"
echo "x-run state: $(kubectl ate get actor x-run -a $S -o json 2>/dev/null | jq -c '.status | {state, assignedNode}')"
for i in 1 2 3; do echo "request x-run: $(R x-run 12)"; done
echo "request to a running x-s-030: $(R x-s-030 12)"
echo "request to a running x-s-040: $(R x-s-040 12)"
t=$(now); K get actors -a $S | awk 'NR>1{print $4}' | sort | uniq -c | tr '\n' ' '; echo "get actors $(el $t) s"
kubectl -n ate-system get pods --no-headers | awk '{print $1,$2,$3,$4}' | tr '\n' ';'; echo
echo "select state, count(*), max(now()-state_change) from pg_stat_activity where usename like 'substrate%' group by 1" | pgq
kubectl -n ate-system logs deploy/atenet-router --all-containers --since=3m 2>/dev/null | grep -v '" 200 ' | tail -4 | cut -c1-300
kubectl -n ate-system logs deploy/ate-api-server --all-containers --since=6m 2>&1 | scrub | grep -i -E "x-run|timeout|deadline|broken pipe|reset|EOF" | tail -8 | cut -c1-360
} > 37-follow-up.txt 2>&1
cat 37-follow-up.txt
