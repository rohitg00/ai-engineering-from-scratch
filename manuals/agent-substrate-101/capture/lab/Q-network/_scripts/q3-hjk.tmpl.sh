DP=__DP__
export KUBECONFIG=$HOME/.kube/kind-kind.config
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
Q=~/evidence/Q-network
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
S=lab-f
WH=whoami.egress-target.svc.cluster.local
DR=drip.egress-target.svc.cluster.local
TB=/run/ate/egress-trust-bundle/trust-bundle.pem
ts() { date -u +%T.%3N; }
RES=results.txt
run() {
  p=$1; l=$2; shift 2
  jq -n --arg c "$*" '{command:["sh","-c",$c],timeout:"85s"}' > req-$l.tmp
  curl -s -m 100 -X POST -H 'Content-Type: application/json' -d @req-$l.tmp http://127.0.0.1:$p/process > "t-$l.json"
  { echo "### [$(ts)] $l"; echo "\$ $*"; jq -r '"exit=" + (.exitCode|tostring) + (if .error then " error=" + .error else "" end), (.stdout|.[0:2500]), (if .stderr != "" then "stderr: " + (.stderr|.[0:700]) else empty end)' "t-$l.json" 2>/dev/null || { echo "raw reply:"; head -c 400 "t-$l.json"; }; echo; } >> $RES
}
pol() {
  a=$1; f=$2
  if K get egress-policy $a -a $S -o json > live.tmp 2>/dev/null && jq -e .metadata.uid live.tmp > /dev/null 2>&1; then
    { echo "metadata:"; echo "  uid: $(jq -r .metadata.uid live.tmp)"; echo "  version: \"$(jq -r .metadata.version live.tmp)\""; cat $f; } > "applied-$(basename $f)"; verb=update
  else cp $f "applied-$(basename $f)"; verb=create; fi
  echo "### [$(ts)] policy $verb $a <- $f : $(K $verb egress-policy $a -a $S -f "applied-$(basename $f)" | tr '\n' ' ' | cut -c1-160)" >> $RES
}
proxy() { pkill -f "proxy actor f-main" 2>/dev/null; (kubectl ate proxy actor f-main -a $S 8202:80 > proxy-f-main.log 2>&1 &); for t in $(seq 1 30); do grep -q Proxying proxy-f-main.log 2>/dev/null && break; sleep 0.3; done; }
mkpol() {
cat > Pall.yaml <<EOF
rules:
- http: {hostnames: ["$WH", "$DR"]}
- https: {hostnames: ["example.com"]}
EOF
cat > Pnone.yaml <<EOF
rules:
- http: {hostnames: ["unused.egress-target.svc.cluster.local"]}
EOF
}

if [ "$DP" = agentgateway ]; then
  E=$Q/j-log-level; mkdir -p $E; cd $E; : > $RES; mkpol; proxy
  K get actor f-main -a $S > 00-actor.txt; pol f-main Pall.yaml; sleep 4
  run 8202 warm "curl -s -o /dev/null -w '%{http_code}\n' http://$WH/"
  for lvl in debug info warn; do
    if [ $lvl != debug ]; then
      kubectl -n ate-system set env deploy/atenet-egress RUST_LOG=$lvl > set-$lvl.log 2>&1
      kubectl -n ate-system rollout status deploy/atenet-egress --timeout=120s >> set-$lvl.log 2>&1
      sleep 8
      for w in 1 2 3 4 5 6; do run 8202 warm-$lvl-$w "curl -s -m 5 -o /dev/null -w '%{http_code}\n' http://$WH/"; grep -q '^200' <(jq -r .stdout t-warm-$lvl-$w.json 2>/dev/null) && break; sleep 3; done
    fi
    kubectl -n ate-system get deploy atenet-egress -o json | jq -c '[.spec.template.spec.containers[0].env[]|select(.name=="RUST_LOG")]' > env-$lvl.txt
    t0=$(date -u +%FT%TZ); sleep 1
    run 8202 hundred-$lvl "ok=0; for i in \$(seq 1 100); do c=\$(curl -s -m 5 -o /dev/null -w '%{http_code}' -H 'X-Lab-Marker: lab-header-marker-123' -H 'Authorization: Bearer lab-auth-marker-456' http://$WH/); [ \$c = 200 ] && ok=\$((ok+1)); done; echo ok=\$ok of 100"
    sleep 3
    kubectl -n ate-system logs deploy/atenet-egress --all-containers --since-time=$t0 > log-$lvl.full 2>&1
    echo "$lvl	lines=$(wc -l < log-$lvl.full)	bytes=$(wc -c < log-$lvl.full)	lines_with_header_marker=$(grep -c 'lab-header-marker-123' log-$lvl.full)	lines_with_auth_marker=$(grep -c 'lab-auth-marker-456' log-$lvl.full)	lines_with_header_name=$(grep -c -i 'x-lab-marker' log-$lvl.full)	requests_ok=$(jq -r .stdout t-hundred-$lvl.json | tr -d '\n')" >> 10-volume.tsv
    head -c 6000 log-$lvl.full > log-$lvl.excerpt.log; grep -m 3 'lab-header-marker-123' log-$lvl.full | cut -c1-1500 > log-$lvl-marker-lines.txt
    rm -f log-$lvl.full
  done
  cat 10-volume.tsv
fi

E=$Q/h-keepalive/$DP; mkdir -p $E; cd $E; : > $RES; mkpol; proxy
pol f-main Pall.yaml; sleep 5
run 8202 warm "curl -s -o /dev/null -w '%{http_code}\n' http://$WH/; curl -s -o /dev/null --cacert $TB -w '%{http_code} http=%{http_version}\n' https://example.com/"
( run 8202 h1-http11-keepalive "date -u +start=%T.%N; curl -sS -m 70 --rate 30/m -o /dev/null -w '%{http_code} http=%{http_version} new_conns=%{num_connects} lport=%{local_port} t=%{time_total}\n' 'http://$WH/?i=[1-20]' 2>&1; date -u +end=%T.%N" ) &
sleep 13; pol f-main Pnone.yaml; wait
K get egress-policy f-main -a $S -o yaml > policy-after-h1.yaml 2>&1
run 8202 h1-new-connection-after "curl -sS -m 8 -o /dev/null -w '%{http_code}\n' http://$WH/ 2>&1"
pol f-main Pall.yaml; sleep 6
run 8202 warm2 "curl -s -o /dev/null --http2 --cacert $TB -w '%{http_code} http=%{http_version}\n' https://example.com/"
( run 8202 h2-https-rule-http2 "date -u +start=%T.%N; curl -sS -m 70 --http2 --cacert $TB --rate 30/m -o /dev/null -w '%{http_code} http=%{http_version} new_conns=%{num_connects} lport=%{local_port} t=%{time_total}\n' 'https://example.com/?i=[1-20]' 2>&1; date -u +end=%T.%N" ) &
sleep 13; pol f-main Pnone.yaml; wait
run 8202 h2-new-connection-after "curl -sS -m 8 -o /dev/null --cacert $TB -w '%{http_code}\n' https://example.com/ 2>&1"
pol f-main Pall.yaml; sleep 6
cat $RES | cut -c1-200

E=$Q/k-suspend-cutoff/$DP; mkdir -p $E; cd $E; : > $RES; mkpol; proxy
run 8202 warm "curl -s -o /dev/null -w '%{http_code}\n' http://$WH/"
t0=$(date -u +%FT%TZ)
( run 8202 k1-open-stream "curl -sS -m 80 -N 'http://$DR/drip?n=70' 2>&1 | tail -4" ) &
sleep 10
echo "$(date -u +%FT%T.%3NZ)	suspend-call-start" > 10-events.tsv
K suspend actor f-main -a $S > 11-suspend.txt 2>&1
echo "$(date -u +%FT%T.%3NZ)	suspend-call-returned	$(K get actor f-main -a $S | awk 'NR==2{print $4}')" >> 10-events.tsv
wait
sleep 6
kubectl -n egress-target logs deploy/drip --timestamps --since-time=$t0 > 12-drip-server-after-suspend.log 2>&1
echo "$(date -u +%FT%T.%3NZ)	drip-log-read	$(tail -1 12-drip-server-after-suspend.log | cut -c1-120)" >> 10-events.tsv
sleep 20
kubectl -n egress-target logs deploy/drip --timestamps --since-time=$t0 > 13-drip-server-26s-later.log 2>&1
echo "$(date -u +%FT%T.%3NZ)	state-before-resume	$(K get actor f-main -a $S | awk 'NR==2{print $4}')" >> 10-events.tsv
proxy
run 8202 k2-after-resume "date -u +%T; ps | grep -c '[c]url' ; echo curl-processes-above"
echo "$(date -u +%FT%T.%3NZ)	resumed-by-request	$(K get actor f-main -a $S | awk 'NR==2{print $4}')" >> 10-events.tsv
sleep 8
kubectl -n egress-target logs deploy/drip --timestamps --since-time=$t0 > 14-drip-server-after-resume.log 2>&1
run 8202 k3-after-resume-later "ps | grep -c '[c]url'; echo curl-processes-above"
cat 10-events.tsv; tail -3 12-drip-server-after-suspend.log; echo; cat $RES | cut -c1-220
echo "Q3-$DP-DONE"
