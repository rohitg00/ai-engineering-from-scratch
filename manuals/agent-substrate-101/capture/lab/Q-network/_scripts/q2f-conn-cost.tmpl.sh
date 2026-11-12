DP=__DP__
export KUBECONFIG=$HOME/.kube/kind-kind.config
E=~/evidence/Q-network/i-model-gateway; cd "$E"
S=lab-f; NS=model-gw
GW=modelgw.$NS.svc.cluster.local; GWP=modelgw-plain.$NS.svc.cluster.local; MA=mock-a.$NS.svc.cluster.local
TB=/run/ate/egress-trust-bundle/trust-bundle.pem
RES=50-connection-cost-$DP.txt; : > $RES
ts() { date -u +%T.%3N; }
run() {
  p=$1; l=$2; shift 2
  jq -n --arg c "$*" '{command:["sh","-c",$c],timeout:"85s"}' > req-$l.tmp
  curl -s -m 100 -X POST -H 'Content-Type: application/json' -d @req-$l.tmp http://127.0.0.1:$p/process > "t-$DP-$l.json"
  { echo "### [$(ts)] $l"; echo "\$ $*"; jq -r '"exit=" + (.exitCode|tostring), (.stdout|.[0:3500]), (if .stderr != "" then "stderr: " + (.stderr|.[0:500]) else empty end)' "t-$DP-$l.json" 2>/dev/null; echo; } >> $RES
}
pgrep -f "proxy actor f-main" > /dev/null || { (kubectl ate proxy actor f-main -a $S 8202:80 > proxy-f-main.log 2>&1 &); sleep 4; }
B='{"model":"fast","messages":[{"role":"user","content":"hi"}]}'
HD="-H 'content-type: application/json' -H 'X-Lab: placeholder-from-actor'"
W='%{http_code} total=%{time_total} dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} first_byte=%{time_starttransfer} new_conns=%{num_connects}\n'
run 8202 c1-tls-gw-new-connection-each "for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -m 10 -o /dev/null --cacert $TB -w '$W' $HD -d '$B' https://$GW/v1/chat/completions; done"
run 8202 c2-tls-gw-one-connection "curl -s -m 60 -o /dev/null --cacert $TB -w '$W' $HD -d '$B' 'https://$GW/v1/chat/completions?i=[1-30]'"
run 8202 c3-plain-gw-new-connection-each "for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -m 10 -o /dev/null -w '$W' $HD -d '$B' http://$GWP/v1/chat/completions; done"
run 8202 c4-plain-gw-one-connection "curl -s -m 60 -o /dev/null -w '$W' $HD -d '$B' 'http://$GWP/v1/chat/completions?i=[1-30]'"
run 8202 c5-direct-mock-one-connection "curl -s -m 60 -o /dev/null -w '$W' -H 'content-type: application/json' -d '$B' 'http://$MA/v1/chat/completions?i=[1-30]'"
run 8202 c6-public-https-new-connection-each "for i in 1 2 3 4 5; do curl -s -m 15 -o /dev/null --cacert $TB -w '$W' https://example.com/; done"
python3 - "$DP" <<'EOF' | tee 51-connection-cost-$DP.tsv
import json, re, statistics as st, sys, glob
dp = sys.argv[1]
print("case\tn_ok\tn\tmedian_total_ms\tmedian_tls_ms\tmedian_first_byte_ms\tnew_connections")
for f in sorted(glob.glob("t-%s-c[0-9]-*.json" % dp)):
    out = json.load(open(f)).get("stdout", "")
    rows = []
    for line in out.splitlines():
        m = re.match(r"(\d+) total=([\d.]+) dns=([\d.]+) connect=([\d.]+) tls=([\d.]+) first_byte=([\d.]+) new_conns=(\d+)", line)
        if m:
            rows.append(m.groups())
    ok = [r for r in rows if r[0] == "200"]
    name = f[len("t-%s-" % dp):-5]
    if ok:
        print("%s\t%d\t%d\t%.1f\t%.1f\t%.1f\t%d" % (name, len(ok), len(rows), st.median(float(r[1]) for r in ok) * 1000, st.median(float(r[4]) for r in ok) * 1000, st.median(float(r[5]) for r in ok) * 1000, sum(int(r[6]) for r in rows)))
    else:
        print("%s\t0\t%d\tcodes=%s" % (name, len(rows), ",".join(sorted(set(r[0] for r in rows)))))
EOF
head -8 $RES | cut -c1-260
