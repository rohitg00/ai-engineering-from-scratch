. ~/scripts/x-pglib.sh
O=$EV/50-pg-tests; cd $O
{
echo "### $(date -u +%FT%TZ) before removal"
grep -h -i "worker cache" 34-api-server-log.excerpt.txt 34-api-server-log-run2.excerpt.txt | cut -c1-200 | tail -6
echo "select count(*) as actors from substrate.actors" | pgq
echo "select pg_size_pretty(pg_database_size('atepg'))" | pgq
kubectl -n ate-system get pods --no-headers | awk '{print $1,$2,$3,$4}'
} > 48-before-removal.txt 2>&1
for f in 34-api-server-log.excerpt.txt 34-api-server-log-run2.excerpt.txt; do n=$(grep -c "worker cache not ready" $f); echo "$f worker-cache-not-ready lines: $n"; done >> 48-before-removal.txt
kubectl -n ate-system logs deploy/ate-api-server --all-containers --since=12m 2>&1 | scrub | grep -i "worker cache" | cut -c1-220 | tail -12 > 47-worker-cache-lines.txt
pgdelay 0
sg docker -c "kind delete cluster --name xpg" > 49-removal.txt 2>&1
sg docker -c "docker rm -f x-pgc" >> 49-removal.txt 2>&1
rm -f $X/kc-xpg
sudo fstrim / 2>/dev/null
{ kind get clusters 2>&1 | tr '\n' ' '; df -h / | tail -1; free -g | sed -n 2p; } >> 49-removal.txt
cat 48-before-removal.txt | cut -c1-200; cat 47-worker-cache-lines.txt | cut -c1-200; cat 49-removal.txt
