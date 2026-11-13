cd ~/evidence/X-remote-store-pg/50-pg-tests
t0=$(awk -F'\t' '$3=="pg-stopped"{print int($1)}' 30-timeline-run2.tsv)
t1=$(awk -F'\t' '$3=="pg-ready-on-its-guest"{print int($1)}' 30-timeline-run2.tsv)
echo "stopped at $t0, ready at $t1, outage $((t1-t0)) s"
echo "--- running stream by 10 s bucket relative to stop: bucket ok fail"
awk -F'\t' -v t0=$t0 '$2=="running"{b=int(($1-t0)/10)*10; if($4==200) ok[b]++; else bad[b]++; seen[b]=1} END{for(b in seen) print b, ok[b]+0, bad[b]+0}' 33-probe-run2.tsv | sort -n | tr '\n' ';'; echo
echo "--- running failures: code and time"
awk -F'\t' '$2=="running" && $4!=200{print $4, substr($5,1,4)}' 33-probe-run2.tsv | sort | uniq -c | sort -rn | head -6
awk -F'\t' -v t0=$t0 -v t1=$t1 '$2=="running"{if($4!=200){if(first=="")first=$1-t0; last=$1-t1; n++} else if($1>=t1 && firstok=="") firstok=$1-t1; tot++} END{print "running: failed", n, "of", tot, "first failure at", first, "s after stop; last failure", last, "s after ready"}' 33-probe-run2.tsv
awk -F'\t' -v t1=$t1 '$2=="running" && $4==200 && $1>=t1{print "first success after ready:", $1-t1, "s"; exit}' 33-probe-run2.tsv
echo "--- suspended stream: t-rel-stop code time body"
awk -F'\t' -v t0=$t0 '$2=="suspended"{print $1-t0, $4, $5, substr($6,1,70)}' 33-probe-run2.tsv | tr '\n' ';' | cut -c1-2600; echo
awk -F'\t' -v t0=$t0 -v t1=$t1 '$2=="suspended"{tot++; if($4!=200){n++; last=$1-t1; if($1<t0) pre++}} END{print "suspended: failed", n, "of", tot, "(before the stop:", pre+0, "); last failure", last, "s after ready"}' 33-probe-run2.tsv
head -3 33-probe-run2.tsv | cut -c1-160
grep -c . 34-api-server-log-run2.excerpt.txt; grep -i "worker cache" 34-api-server-log-run2.excerpt.txt | head -4 | cut -c1-260
tail -3 31-pg-ready-run2.tsv | cut -c1-120; awk -F'\t' -v t0=$t0 '$2 ~ /accepting/ && $1>t0+5{print "pg_isready from this guest first ok at", $1-t0, "s after stop"; exit}' 31-pg-ready-run2.tsv
cat 36-actor-states-after-run2.txt
. ~/scripts/x-pglib.sh
S=x-lab
R() { PX "sh /tmp/req.sh $*"; }
{
echo "### $(date -u +%FT%TZ) run 2 follow-up, $(( $(date +%s) - t1 )) s after Postgres was ready"
for i in 1 2; do echo "request y-run: $(R y-run 12)"; done
echo "request to a running y-s-030: $(R y-s-030 12)"
echo "y-run state: $(kubectl ate get actor y-run -a $S -o json 2>/dev/null | jq -r .status.state)"
echo "--- router log for y-run, last 30 s"
kubectl -n ate-system logs deploy/atenet-router --all-containers --since=30s 2>/dev/null | grep -v -E '^\[20' | grep "y-run" | jq -r -c '[.time[11:23], .level, .msg, (.err // "-"), (.state // "-")] | @tsv' | tail -5
echo "--- api-server RPCs that name y-run, last 30 s"
for p in $(kubectl -n ate-system get pods -l app=ate-api-server -o name); do kubectl -n ate-system logs $p --all-containers --since=30s 2>&1 | grep '"y-run"' | jq -r -c '[.time[11:23], .method, ((.err // "-")|tostring|.[0:120]), (.["elapsed-time"] // "-")] | @tsv' 2>/dev/null | tail -4; done
} > 43-run2-follow-up.txt 2>&1
cat 43-run2-follow-up.txt
