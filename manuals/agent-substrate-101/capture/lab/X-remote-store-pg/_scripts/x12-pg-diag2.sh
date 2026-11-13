. ~/scripts/x-pglib.sh
O=$EV/50-pg-tests; cd $O
S=x-lab
R() { PX "sh /tmp/req.sh $*"; }
{
echo "### $(date -u +%FT%TZ) second diagnosis of x-run"
echo "request: $(R x-run 12)"
echo "--- leases table"
echo "select * from substrate.leases" | pgq "" "-x" 2>&1 | head -30 | cut -c1-200
echo "--- postgres sessions of substrate users"
echo "select pid, state, wait_event_type, wait_event, now()-backend_start as age, now()-state_change as since, left(query,70) from pg_stat_activity where usename like 'substrate%' order by backend_start" | pgq "" "" 2>&1 | head -40 | cut -c1-200
echo "--- locks not granted"
echo "select locktype, mode, granted, pid from pg_locks where not granted" | pgq "" "" 2>&1 | head
echo "--- TCP connections to Postgres as seen in each api-server pod"
for p in $(kubectl -n ate-system get pods -l app=ate-api-server -o name); do
  id=$(sg docker -c "docker exec xpg-control-plane crictl pods --name ${p#pod/} -q" | head -1)
  pid=$(sg docker -c "docker exec xpg-control-plane crictl inspectp $id" | jq -r '.info.pid')
  echo "$p sandbox pid $pid"
  sg docker -c "docker exec xpg-control-plane nsenter -n -t $pid ss -tnoi dst 10.0.2.2" | grep -v '^State' | paste - - | awk '{print $1, $4, $5, $6, $7}' | sort | uniq -c | head -40
done
} > 39-x-run-diagnosis-2.txt 2>&1
cat 39-x-run-diagnosis-2.txt
