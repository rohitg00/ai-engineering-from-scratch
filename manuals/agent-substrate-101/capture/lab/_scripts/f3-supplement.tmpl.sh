DP=__DP__
E=~/evidence/F-egress/$DP; cd "$E"
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
S=lab-f
WH=whoami.egress-target.svc.cluster.local
DR=drip.egress-target.svc.cluster.local
DIP=$(kubectl -n egress-target get svc drip -o jsonpath='{.spec.clusterIP}')
TB=/run/ate/egress-trust-bundle/trust-bundle.pem
RES=40-supplement.txt; : > $RES
ts() { date -u +%T.%3N; }
run() {
  p=$1; l=$2; shift 2
  jq -n --arg c "$*" '{command:["sh","-c",$c],timeout:"85s"}' > "req-$l.tmp"
  curl -s -m 100 -X POST -H 'Content-Type: application/json' -d @"req-$l.tmp" http://127.0.0.1:$p/process > "s-$l.json"
  { echo "### [$(ts)] $l"; echo "\$ $*"; jq -r '"exit=" + (.exitCode|tostring), (.stdout|.[0:2600]), (if .stderr != "" then "stderr: " + (.stderr|.[0:500]) else empty end)' "s-$l.json" 2>/dev/null || cat "s-$l.json"; echo; } >> $RES
  rm -f "req-$l.tmp"
}
pol() {
  a=$1; f=$2
  K get egress-policy $a -a $S -o json > "live-$f.tmp" 2>/dev/null
  { echo "metadata:"; echo "  uid: $(jq -r .metadata.uid "live-$f.tmp")"; echo "  version: \"$(jq -r .metadata.version "live-$f.tmp")\""; cat $f; } > "applied-$f"
  K update egress-policy $a -a $S -f "applied-$f" > "pol-$f.out" 2>&1
  echo "### [$(ts)] policy update $a <- $f : $(tail -1 pol-$f.out)" >> $RES
  rm -f "live-$f.tmp"
}
(kubectl ate proxy actor f-main -a $S 8202:80 > proxy-f-main-2.log 2>&1 &)
sleep 4
pol f-main P1.yaml; sleep 25

echo "## A. DNS propagation after a hostname is ADDED (P1 -> P2 adds example.com and example.org)" >> $RES
( run 8202 a-dns-poll-add "for i in \$(seq 1 40); do echo \"\$(date -u +%T) com=\$(dig +time=1 +tries=1 +noall +comments example.com | grep -o 'status: [A-Z]*') org=\$(dig +time=1 +tries=1 +noall +comments example.org | grep -o 'status: [A-Z]*')\"; sleep 1; done" ) &
sleep 5
pol f-main P2.yaml
wait
run 8202 a-https-default-store "curl -sS -m 15 -o /dev/null -w 'code=%{http_code} verify=%{ssl_verify_result}\n' https://example.com/"
run 8202 a-https-trust-bundle "curl -sS -m 15 -o /dev/null -w 'code=%{http_code} verify=%{ssl_verify_result} http=%{http_version}\n' --cacert $TB https://example.com/"
run 8202 a-https-ssl-cert-dir "SSL_CERT_FILE=$TB curl -sS -m 15 -o /dev/null -w 'code=%{http_code} verify=%{ssl_verify_result}\n' https://example.com/"
run 8202 a-https-chain "echo | openssl s_client -connect example.com:443 -servername example.com -showcerts 2>/dev/null | grep -E '^ *[0-9]+ s:|^ *i:|Verification|Verify return'"
run 8202 a-passthrough "curl -sS -m 15 -o /dev/null -w 'code=%{http_code} verify=%{ssl_verify_result} http=%{http_version}\n' https://example.org/"

echo "## B. tls_passthrough connection kept open across removal of its rule (P2 -> P1)" >> $RES
( run 8202 b-passthrough-one-conn "(printf 'GET / HTTP/1.1\r\nHost: example.org\r\n\r\n'; sleep 24; printf 'GET / HTTP/1.1\r\nHost: example.org\r\nConnection: close\r\n\r\n'; sleep 4) | openssl s_client -quiet -connect example.org:443 -servername example.org 2>/dev/null | grep -a -E '^HTTP/1.1 |^date:|^Date:' | head -6; echo end=\$(date -u +%T)" ) &
( run 8202 b-poll-new-conn "IP=\$(dig +short example.org | head -1); for i in \$(seq 1 26); do echo \"\$(date -u +%T) dns=\$(dig +time=1 +tries=1 +noall +comments example.org | grep -o 'status: [A-Z]*') newconn_certs=\$(echo | openssl s_client -connect \$IP:443 -servername example.org 2>/dev/null | grep -c 'BEGIN CERT')\"; sleep 1; done" ) &
sleep 4
pol f-main P1.yaml
wait

echo "## C. HTTP: gateway decision for NEW requests after a hostname is REMOVED (P3 -> P1), DNS bypassed with --resolve" >> $RES
pol f-main P3.yaml; sleep 25
( run 8202 c-poll-http-removed "for i in \$(seq 1 30); do echo \"\$(date -u +%T) dns=\$(dig +time=1 +tries=1 +noall +comments $DR | grep -o 'status: [A-Z]*') http=\$(curl -s -m 3 -o /dev/null -w '%{http_code}' --resolve $DR:80:$DIP 'http://$DR/drip?n=1')\"; sleep 1; done" ) &
( run 8202 c-keepalive-one-conn "curl -s -m 60 -o /dev/null -w 'first=%{http_code} ' 'http://$DR/drip?n=1' --next -s -o /dev/null -w 'second_same_conn_after_20s=%{http_code} conns=%{num_connects}\n' --resolve $DR:80:$DIP 'http://$DR/drip?n=21' ; echo" ) &
sleep 4
pol f-main P1.yaml
wait
pol f-main P4.yaml
K get egress-policy f-main -a $S -o yaml > 41-policy-after-supplement.yaml
pkill -f "proxy actor f-main"
cat $RES | cut -c1-200
