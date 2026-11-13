export KUBECONFIG=$HOME/.kube/kind-kind.config
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/Q-network/i-model-gateway; cd "$E"
DP=${1:-agentgateway}; RES=20-results-$DP.txt; : > $RES
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
S=lab-f; NS=model-gw
WH=whoami.egress-target.svc.cluster.local
GW=modelgw.$NS.svc.cluster.local; GWP=modelgw-plain.$NS.svc.cluster.local; MA=mock-a.$NS.svc.cluster.local
TB=/run/ate/egress-trust-bundle/trust-bundle.pem
ts() { date -u +%T.%3N; }
run() {
  p=$1; l=$2; shift 2
  jq -n --arg c "$*" '{command:["sh","-c",$c],timeout:"85s"}' > req-$l.tmp
  curl -s -m 100 -X POST -H 'Content-Type: application/json' -d @req-$l.tmp http://127.0.0.1:$p/process > "t-$DP-$l.json"
  { echo "### [$(ts)] $l"; echo "\$ $*"; jq -r '"exit=" + (.exitCode|tostring) + (if .error then " error=" + .error else "" end), (.stdout|.[0:2500]), (if .stderr != "" then "stderr: " + (.stderr|.[0:700]) else empty end)' "t-$DP-$l.json" 2>/dev/null || { echo "raw reply:"; head -c 400 "t-$DP-$l.json"; }; echo; } >> $RES
}
pol() {
  a=$1; f=$2
  if K get egress-policy $a -a $S -o json > live.tmp 2>/dev/null && jq -e .metadata.uid live.tmp > /dev/null 2>&1; then
    { echo "metadata:"; echo "  uid: $(jq -r .metadata.uid live.tmp)"; echo "  version: \"$(jq -r .metadata.version live.tmp)\""; cat $f; } > "applied-$(basename $f)"; verb=update
  else cp $f "applied-$(basename $f)"; verb=create; fi
  echo "### [$(ts)] policy $verb $a <- $f : $(K $verb egress-policy $a -a $S -f "applied-$(basename $f)" | tr '\n' ' ' | cut -c1-200)" >> $RES
}
pkill -f "proxy actor f-main" 2>/dev/null; (kubectl ate proxy actor f-main -a $S 8202:80 > proxy-f-main.log 2>&1 &); for t in $(seq 1 30); do grep -q Proxying proxy-f-main.log 2>/dev/null && break; sleep 0.3; done
if ! kubectl -n cred-ns get secret gw-client-key > /dev/null 2>&1; then
  echo "lab-gw-client-credential-$(date +%s)" > 10-marker-client-credential.txt
  kubectl -n cred-ns create secret generic gw-client-key --from-file=token=10-marker-client-credential.txt > /dev/null
fi
M=$(cat 10-marker-client-credential.txt)
cat > Pgw.yaml <<EOF
rules:
- http: {hostnames: ["$WH", "$MA"]}
- http:
    hostnames: ["$GWP"]
    effects:
      replaceHeaders:
      - header: X-Lab
        credentialUri: ate-secret://k8s.io/default/cred-ns/gw-client-key/token
- https:
    hostnames: ["$GW"]
    effects:
      replaceHeaders:
      - header: X-Lab
        credentialUri: ate-secret://k8s.io/default/cred-ns/gw-client-key/token
EOF
pol f-main Pgw.yaml; sleep 6
K get egress-policy f-main -a $S -o yaml > 21-policy-live-$DP.yaml 2>&1
B() { echo "{\"model\":\"$1\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"; }
HD="-H 'content-type: application/json' -H 'Authorization: Bearer placeholder-from-actor' -H 'X-Lab: placeholder-from-actor'"
t0=$(date -u +%FT%TZ)
run 8202 a1-plain-gw-fast "curl -sS -m 15 -w '\ncode=%{http_code} t=%{time_total}\n' $HD -d '$(B fast)' http://$GWP/v1/chat/completions"
run 8202 a2-plain-gw-smart "curl -sS -m 15 -w '\ncode=%{http_code} t=%{time_total}\n' $HD -d '$(B smart)' http://$GWP/v1/chat/completions"
run 8202 a3-plain-gw-unknown-model "curl -sS -m 15 -w '\ncode=%{http_code}\n' $HD -d '$(B other)' http://$GWP/v1/chat/completions"
run 8202 b1-tls-gw-fast "curl -sS -m 15 --cacert $TB -w '\ncode=%{http_code} t=%{time_total} verify=%{ssl_verify_result}\n' $HD -d '$(B fast)' https://$GW/v1/chat/completions"
run 8202 b2-tls-gw-smart "curl -sS -m 15 --cacert $TB -w '\ncode=%{http_code} t=%{time_total}\n' $HD -d '$(B smart)' https://$GW/v1/chat/completions"
run 8202 b3-tls-gw-cert-seen-by-actor "echo | openssl s_client -connect $GW:443 -servername $GW 2>/dev/null | openssl x509 -noout -subject -issuer -dates 2>&1"
run 8202 b4-tls-gw-verbose "curl -sS -m 15 -v --cacert $TB -o /dev/null $HD -d '$(B fast)' https://$GW/v1/chat/completions 2>&1 | grep -E '^\* |^< HTTP|^< ' | tail -25"
sleep 2
kubectl -n ate-system logs deploy/atenet-egress --all-containers --since-time=$t0 2>/dev/null | grep -i -E "modelgw|certificate|tls|handshake|unknown ?issuer|UnknownIssuer|invalid peer" | tail -30 | cut -c1-600 > 22-egress-log-tls-$DP.excerpt.log
kubectl -n $NS logs deploy/mock-a --since-time=$t0 > 23-mock-a-received-$DP.log 2>&1
kubectl -n $NS logs deploy/mock-b --since-time=$t0 > 23-mock-b-received-$DP.log 2>&1
{ echo "marker (the injected client credential) seen by backends: mock-a=$(grep -c -F "$M" 23-mock-a-received-$DP.log) mock-b=$(grep -c -F "$M" 23-mock-b-received-$DP.log)"; echo "placeholder seen by backends: $(cat 23-mock-*-received-$DP.log | grep -c placeholder-from-actor)"; } > 24-marker-counts-$DP.txt
N=30
run 8202 l1-direct-mock "for i in \$(seq 1 $N); do curl -s -m 10 -o /dev/null -w '%{http_code} %{time_total}\n' -H 'content-type: application/json' -d '$(B small-1)' http://$MA/v1/chat/completions; done"
run 8202 l2-via-plain-gw "for i in \$(seq 1 $N); do curl -s -m 10 -o /dev/null -w '%{http_code} %{time_total}\n' $HD -d '$(B fast)' http://$GWP/v1/chat/completions; done"
run 8202 l3-via-tls-gw "for i in \$(seq 1 $N); do curl -s -m 10 -o /dev/null --cacert $TB -w '%{http_code} %{time_total}\n' $HD -d '$(B fast)' https://$GW/v1/chat/completions; done"
pc() { kubectl -n $NS exec client -- sh -c "$1" 2>&1; }
pc "for i in \$(seq 1 $N); do curl -s -m 10 -o /dev/null -w '%{http_code} %{time_total}\n' -H 'content-type: application/json' -d '$(B small-1)' http://$MA/v1/chat/completions; done" > 30-pod-direct-mock-$DP.txt
pc "for i in \$(seq 1 $N); do curl -s -m 10 -o /dev/null -w '%{http_code} %{time_total}\n' -H 'content-type: application/json' -d '$(B fast)' http://$GWP/v1/chat/completions; done" > 30-pod-via-plain-gw-$DP.txt
pc "for i in \$(seq 1 $N); do curl -s -m 10 -o /dev/null --cacert /ca/ca.crt -w '%{http_code} %{time_total}\n' -H 'content-type: application/json' -d '$(B fast)' https://$GW/v1/chat/completions; done" > 30-pod-via-tls-gw-$DP.txt
for l in l1-direct-mock l2-via-plain-gw l3-via-tls-gw; do jq -r .stdout t-$DP-$l.json > 30-actor-$l-$DP.txt; done
python3 - "$DP" <<'EOF' | tee 31-latency-$DP.tsv
import sys, statistics as st, glob
dp = sys.argv[1]
print("path\tn_ok\tn\tmedian_ms\tmin_ms\tmax_ms")
for f in sorted(glob.glob("30-*-%s.txt" % dp)):
    rows = [l.split() for l in open(f) if len(l.split()) == 2]
    ok = [float(t) * 1000 for c, t in rows if c == "200"]
    name = f[3:-(len(dp) + 5)]
    if ok:
        print("%s\t%d\t%d\t%.1f\t%.1f\t%.1f" % (name, len(ok), len(rows), st.median(ok), min(ok), max(ok)))
    else:
        codes = sorted(set(c for c, t in rows))
        print("%s\t0\t%d\tcodes=%s\t-\t-" % (name, len(rows), ",".join(codes)))
EOF
cut -c1-420 $RES | head -90
cat 24-marker-counts-$DP.txt; tail -8 22-egress-log-tls-$DP.excerpt.log | cut -c1-400
echo "Q2B-$DP-DONE"
