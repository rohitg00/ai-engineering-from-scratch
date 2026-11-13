DP=__DP__
E=~/evidence/F-egress/$DP; cd "$E"
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
S=lab-f
WH=whoami.egress-target.svc.cluster.local
DR=drip.egress-target.svc.cluster.local
WIP=$(kubectl -n egress-target get svc whoami -o jsonpath='{.spec.clusterIP}')
DIP=$(kubectl -n egress-target get svc drip -o jsonpath='{.spec.clusterIP}')
TB=/run/ate/egress-trust-bundle/trust-bundle.pem
RES=20-results.txt; : > $RES
ts() { date -u +%T.%3N; }
# run <port> <label> <shell command inside the actor>
run() {
  p=$1; l=$2; shift 2
  jq -n --arg c "$*" '{command:["sh","-c",$c],timeout:"85s"}' > req.tmp
  curl -s -m 100 -X POST -H 'Content-Type: application/json' -d @req.tmp http://127.0.0.1:$p/process > "t-$l.json"
  { echo "### [$(ts)] $l"; echo "\$ $*"; jq -r '"exit=" + (.exitCode|tostring) + (if .error then " error=" + .error else "" end), (.stdout|.[0:1800]), (if .stderr != "" then "stderr: " + (.stderr|.[0:700]) else empty end)' "t-$l.json" 2>/dev/null || cat "t-$l.json"; echo; } >> $RES
}
pol() {
  a=$1; f=$2
  if K get egress-policy $a -a $S -o json > live.tmp 2>/dev/null && jq -e .metadata.uid live.tmp > /dev/null 2>&1; then
    { echo "metadata:"; echo "  uid: $(jq -r .metadata.uid live.tmp)"; echo "  version: \"$(jq -r .metadata.version live.tmp)\""; cat $f; } > "applied-$(basename $f)"
    verb=update
  else
    cp $f "applied-$(basename $f)"; verb=create
  fi
  echo "### [$(ts)] policy $verb $a <- $f" >> $RES
  K $verb egress-policy $a -a $S -f "applied-$(basename $f)" >> $RES 2>&1
  K get egress-policy $a -a $S -o yaml > "policy-$a-$(basename $f .yaml)-live.yaml" 2>&1
}

K create actor f-deny -a $S --template shell > /dev/null
K create actor f-main -a $S --template shell > /dev/null
(kubectl ate proxy actor f-deny -a $S 8201:80 > proxy-f-deny.log 2>&1 &)
(kubectl ate proxy actor f-main -a $S 8202:80 > proxy-f-main.log 2>&1 &)
sleep 5

cat > P1.yaml <<EOF
rules:
- http: {hostnames: ["$WH"]}
EOF
cat > P2.yaml <<EOF
rules:
- http: {hostnames: ["$WH"]}
- https: {hostnames: ["example.com"]}
- tlsPassthrough: {hostnames: ["example.org"], ports: {numbers: [443]}}
EOF
cat > P3.yaml <<EOF
rules:
- http: {hostnames: ["$WH", "$DR"]}
- tlsPassthrough: {hostnames: ["example.org"], ports: {numbers: [443]}}
EOF
cat > P4.yaml <<EOF
rules:
- http:
    hostnames: ["$WH"]
    effects:
      replaceHeaders:
      - header: Authorization
        prefix: "Bearer "
        credentialUri: ate-secret://k8s.io/default/cred-ns/api-token/token
      - header: X-Other-Token
        credentialUri: ate-secret://k8s.io/default/cred-ns-not-granted/api-token/token
      - header: X-Missing-Token
        credentialUri: ate-secret://k8s.io/default/cred-ns/does-not-exist/token
EOF

echo "## T1 default deny: actor f-deny has no EgressPolicy" >> $RES
K get egress-policy f-deny -a $S -o yaml >> $RES 2>&1
run 8201 t1-resolv   "cat /etc/resolv.conf; ip -4 addr 2>/dev/null | grep inet; ip route 2>/dev/null; ls -la /run/ate/egress-trust-bundle/; grep -c BEGIN $TB"
run 8201 t1-dns-incluster "dig +time=2 +tries=1 +noall +comments +answer $WH | grep -E 'status|IN'"
run 8201 t1-dns-public "dig +time=2 +tries=1 +noall +comments +answer example.com | grep -E 'status|IN'; curl -sS -m 6 -o /dev/null -w 'code=%{http_code}\n' http://example.com/"
run 8201 t1-dns-other-server "dig @8.8.8.8 +time=2 +tries=1 example.com | grep -E 'status|timed out|refused|unreachable' ; echo rc=\$?"
run 8201 t1-http-direct-ip "curl -sS -m 8 -i http://$WIP/ | head -12"
run 8201 t1-https-direct-ip "curl -sS -k -m 8 -o /dev/null -w 'code=%{http_code}\n' https://1.1.1.1/"
run 8201 t1-tcp-other "(echo hello | nc -w 3 $WIP 80 | head -3); echo nc_rc=\$?"

echo "## T2 allowed host: f-main with P1" >> $RES
pol f-main P1.yaml
sleep 12
run 8202 t2-dns-allowed "dig +time=2 +tries=1 +noall +comments +answer $WH | grep -E 'status|IN'"
run 8202 t2-http-allowed "curl -sS -m 8 -i http://$WH/ | head -24"
run 8202 t2-http-ip-not-in-policy "curl -sS -m 8 -i http://$WIP/ | head -8"
run 8202 t2-dns-not-allowed "dig +time=2 +tries=1 +noall +comments +answer $DR | grep -E 'status|IN'; curl -sS -m 6 -o /dev/null -w 'code=%{http_code}\n' 'http://$DR/drip?n=1'"
run 8202 t2-other-ip-direct "curl -sS -m 8 -i 'http://$DIP/drip?n=1' | head -8"
run 8202 t2-host-header-spoof "curl -sS -m 8 -i -H 'Host: $WH' 'http://$DIP/drip?n=1' | head -14"

echo "## T3 https interception against tls_passthrough: P2" >> $RES
pol f-main P2.yaml
sleep 12
run 8202 t3-https-default-store "curl -sS -m 15 -o /dev/null -w 'code=%{http_code} verify=%{ssl_verify_result}\n' https://example.com/"
run 8202 t3-https-trust-bundle "curl -sS -m 15 -o /dev/null -w 'code=%{http_code} verify=%{ssl_verify_result} http=%{http_version}\n' --cacert $TB https://example.com/"
run 8202 t3-https-cert-seen "echo | openssl s_client -connect example.com:443 -servername example.com 2>/dev/null | openssl x509 -noout -issuer -subject -dates -ext subjectAltName 2>&1"
run 8202 t3-passthrough-default-store "curl -sS -m 15 -o /dev/null -w 'code=%{http_code} verify=%{ssl_verify_result} http=%{http_version}\n' https://example.org/"
run 8202 t3-passthrough-cert-seen "echo | openssl s_client -connect example.org:443 -servername example.org 2>/dev/null | openssl x509 -noout -issuer -subject -dates 2>&1"
run 8202 t3-sni-unlisted "IP=\$(dig +short example.com | head -1); echo ip=\$IP; curl -sS -m 10 -o /dev/null -w 'code=%{http_code}\n' --resolve www.iana.org:443:\$IP https://www.iana.org/"
run 8202 t3-trust-bundle-subjects "grep -c BEGIN $TB; openssl crl2pkcs7 -nocrl -certfile $TB | openssl pkcs7 -print_certs -noout | grep -i -E 'ate|substrate|egress|mitm' | head -5"
run 8202 t3-websocket "curl -sS -m 8 -i -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' http://$WH/ | head -6"

echo "## T4 policy change against open connections: P3 then back to P1" >> $RES
pol f-main P3.yaml
sleep 12
run 8202 t4-pre-drip "curl -sS -m 6 'http://$DR/drip?n=2'"
T0=$(date +%s)
( run 8202 t4-bg-http-stream "curl -sS -N -m 75 'http://$DR/drip?n=45' | tee /tmp/drip.out | wc -l; head -1 /tmp/drip.out; tail -1 /tmp/drip.out" ) &
( run 8202 t4-bg-passthrough-one-conn "(printf 'GET / HTTP/1.1\r\nHost: example.org\r\n\r\n'; sleep 22; printf 'GET / HTTP/1.1\r\nHost: example.org\r\nConnection: close\r\n\r\n'; sleep 4) | openssl s_client -quiet -connect example.org:443 -servername example.org 2>&1 | grep -a -c '^HTTP/1.1 200'" ) &
sleep 5
echo "### [$(ts)] +$(( $(date +%s) - T0 ))s policy changed to P1 (drip and example.org removed)" >> 21-t4-timeline.txt
pol f-main P1.yaml
for at in 8 13 20 30; do
  while [ $(( $(date +%s) - T0 )) -lt $at ]; do sleep 0.5; done
  jq -n --arg c "curl -sS -m 5 -o /dev/null -w 'code=%{http_code}' 'http://$DR/drip?n=1'; echo; dig +time=1 +tries=1 +noall +comments $DR | grep -o 'status: [A-Z]*'; echo | openssl s_client -connect example.org:443 -servername example.org 2>&1 | grep -c 'BEGIN CERT'" '{command:["sh","-c",$c],timeout:"12s"}' > req2.tmp
  echo "[$(ts)] +$(( $(date +%s) - T0 ))s new requests: $(curl -s -m 20 -X POST -d @req2.tmp http://127.0.0.1:8202/process | jq -c '[.stdout,.stderr[0:160]]')" >> 21-t4-timeline.txt
done
wait
echo "[$(ts)] +$(( $(date +%s) - T0 ))s background jobs done" >> 21-t4-timeline.txt
cat 21-t4-timeline.txt >> $RES
kubectl -n egress-target logs deploy/drip --tail=20 > 22-drip-server.log 2>&1

echo "## T5 credential placeholder swap: P4" >> $RES
pol f-main P4.yaml
sleep 12
run 8202 t5-with-placeholder "curl -sS -m 8 -i -H 'Authorization: placeholder-from-actor' http://$WH/ | grep -i -E 'HTTP/|authorization|x-forwarded|RemoteAddr|egress'"
run 8202 t5-without-header "curl -sS -m 8 -i http://$WH/ | grep -i -E 'HTTP/|authorization'"
run 8202 t5-not-granted-namespace "curl -sS -m 8 -i -H 'X-Other-Token: placeholder' http://$WH/ | head -12"
run 8202 t5-missing-secret "curl -sS -m 8 -i -H 'X-Missing-Token: placeholder' http://$WH/ | head -12"
run 8202 t5-actor-env "env | sort | cut -c1-80; grep -r -l 'marker' /run /etc /tmp 2>/dev/null | head -3; echo grep_done"

echo "## end state" >> $RES
K get egress-policy f-main -a $S -o yaml > 30-policy-final.yaml 2>&1
K get actors -a $S >> $RES
for d in atenet-egress k8s-credential-provider; do
  for c in $(kubectl -n ate-system get deploy $d -o jsonpath='{.spec.template.spec.containers[*].name}' 2>/dev/null); do
    kubectl -n ate-system logs deploy/$d -c $c --since=20m > "31-log-$d-$c.log" 2>&1
  done
done
M1=$(cat 03-marker-granted.txt); M2=$(cat 03-marker-ungranted.txt)
{ echo "## marker (the real credential value) occurrences in logs"; for f in 31-log-*.log; do echo "$f granted=$(grep -c -F "$M1" $f) ungranted=$(grep -c -F "$M2" $f) placeholder=$(grep -c -F 'placeholder-from-actor' $f) lines=$(wc -l < $f)"; done; } | tee 32-marker-in-logs.txt >> $RES
sed -i "s/$M1/<GRANTED-MARKER>/g; s/$M2/<UNGRANTED-MARKER>/g" 31-log-*.log 2>/dev/null
pkill -f "proxy actor f-"
wc -l $RES
