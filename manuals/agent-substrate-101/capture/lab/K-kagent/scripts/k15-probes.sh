E=~/evidence/K-kagent/probes; mkdir -p "$E"; cd "$E"; . ~/scripts/lib.sh
k() { sg docker -c "kubectl $*"; }
k -n ate-system get svc -o wide > svc-ate-system.txt 2>&1; cut -c1-150 svc-ate-system.txt
k get networkpolicy -A -o yaml > networkpolicies.yaml 2>&1
k get networkpolicy -A 2>&1 | cut -c1-140
echo "--- mitm secret key names and sizes (no values)"
k -n ate-system get secret egress-mitm-ca-pool -o json | jq -r '.data | to_entries[] | .key + " " + ((.value|@base64d|length)|tostring) + " bytes; mentions private key: " + ((.value|@base64d|test("(?i)private"))|tostring)' | tee mitm-secret-shape.txt
echo "--- egress error lines (deduped by message shape)"
grep -P '\terror\t' ../session1/atenet-egress.log | cut -f3- | sed -E 's/[0-9a-f]{8}-[0-9a-f-]{27}/<uuid>/g; s/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+(:[0-9]+)?/<ip>/g' | cut -c1-260 | sort | uniq -c | sort -rn | head -8 | tee egress-errors-sample.txt
echo "--- egress access lines for the denied requests"
grep -E '1\.1\.1\.1|mock-llm\.kagent:8080|"mock-llm.kagent"' ../session1/atenet-egress.log | grep -v -E '\tdebug\t' | cut -c1-500 | head -6 | tee egress-deny-lines.txt
echo "--- tags"
sg docker -c "kubectl ate get tag -a kagent" 2>/dev/null | cut -c1-200 | head
# unauthenticated ingress probe: new session, actor SUSPENDED, then plain requests to the router from two namespaces
rm -f actor-trace.log; : > events.log; : > timings.tsv
SID=$(new_session lab-agent probe)
echo "probe session $SID"
start_tracer
cat > probe-pod.yaml <<EOF
apiVersion: v1
kind: Pod
metadata: {name: probe}
spec:
  restartPolicy: Never
  containers:
  - name: c
    image: curlimages/curl:8.11.1
    command: ["sleep","3600"]
EOF
for ns in default kagent; do
  k -n $ns apply -f probe-pod.yaml >/dev/null 2>&1
  k -n $ns wait --for=condition=Ready pod/probe --timeout=120s >/dev/null 2>&1
  for url in "http://atenet-router.ate-system.svc:80/" "http://atenet-router.ate-system.svc:8081/" "https://atenet-router.ate-system.svc:443/" "https://atenet-router.ate-system.svc:8444/" "https://api.ate-system.svc:443/" "http://atenet-egress.ate-system.svc:80/" "https://atenet-egress.ate-system.svc:443/"; do
    ev "probe ns=$ns url=$url"
    k -n $ns exec probe -- curl -sk -m 6 -o /dev/null -w "ns=$ns url=$url code=%{http_code} exit=%{exitcode} err=%{errormsg}\n" -H "ate-target-actor: kagent/session-$SID" "$url" 2>&1 | tail -1 | tee -a ingress-probe.txt
  done
done
sleep 3
stop_tracer
echo "--- actor trace during probes (any RESUMING means an unauthenticated request woke the actor)"
cut -c1-230 actor-trace.log
k -n default delete pod probe --wait=false >/dev/null 2>&1; k -n kagent delete pod probe --wait=false >/dev/null 2>&1
echo "--- rustfs usage"
k -n ate-system exec deploy/rustfs -- sh -c 'du -sh /data 2>/dev/null; find /data -maxdepth 4 -type d 2>/dev/null | head -20' 2>&1 | head -24 | tee rustfs-usage.txt
