DP=__DP__
export KUBECONFIG=$HOME/.kube/kind-kind.config
E=~/evidence/Q-network/m-router-ports/$DP; mkdir -p "$E"; cd "$E"
kubectl -n ate-system get svc atenet-router -o yaml > 00-service.yaml
kubectl -n ate-system get networkpolicy -o yaml > 01-networkpolicies.yaml 2>&1
kubectl -n ate-system get networkpolicy > 01-networkpolicies.txt 2>&1
kubectl -n ate-system get deploy atenet-router -o json | jq -c '[.spec.template.spec.containers[]|{name, image:(.image|split("@")[0]), ports:(.ports//[]|map(.containerPort)), args:(.args//[]|join(" ")|.[0:300])}]' > 02-router-containers.json
for cm in $(kubectl -n ate-system get deploy atenet-router -o json | jq -r '.spec.template.spec.volumes[]|select(.configMap)|.configMap.name'); do kubectl -n ate-system get cm $cm -o json | jq -r '.data|to_entries[]|"## " + .key + "\n" + .value' > 03-router-config-$cm.yaml; done
grep -n -i -E "port:|binds|listeners|protocol:|^  - |name:" 03-router-config-*.yaml | cut -c1-140 | head -60 > 04-config-ports.txt
SVC=atenet-router.ate-system.svc.cluster.local
POD=$(kubectl -n ate-system get pods -l app=atenet-router -o jsonpath='{.items[0].status.podIP}' 2>/dev/null)
[ -z "$POD" ] && POD=$(kubectl -n ate-system get pods -o wide --no-headers | grep atenet-router | awk '{print $6}' | head -1)
echo "router pod address family recorded as POD (value not stored)" > 05-targets.txt
kubectl -n ate-system get pods -o wide --no-headers | grep atenet-router | awk '{print $1, $2, $3}' >> 05-targets.txt
kubectl -n ate-system get pod e-prober > /dev/null 2>&1 || echo "e-prober missing" >> 05-targets.txt
probe() {
  ns=$1; pod=$2; label=$3; host=$4; extra=$5
  for port in 80 8080 8081 443 8444 15020; do
    h=$(kubectl -n $ns exec $pod -- sh -c "curl -s -m 4 -o /tmp/o -w '%{http_code} exit=%{exitcode} err=%{errormsg}' http://$host:$port/ 2>/dev/null; echo; head -c 80 /tmp/o 2>/dev/null | tr '\n' ' '" 2>&1 | tr '\n' '|' | cut -c1-230)
    t=$(kubectl -n $ns exec $pod -- sh -c "curl -sk -m 4 -o /tmp/o -w '%{http_code} exit=%{exitcode} err=%{errormsg}' https://$host:$port/ 2>/dev/null; echo; head -c 80 /tmp/o 2>/dev/null | tr '\n' ' '" 2>&1 | tr '\n' '|' | cut -c1-230)
    c=""
    [ -n "$extra" ] && c=$(kubectl -n $ns exec $pod -- sh -c "curl -s -m 6 -o /tmp/o -w '%{http_code} exit=%{exitcode} err=%{errormsg}' $extra -X POST -H 'ate-target-actor: ate-demo-counter/my-counter-1' https://$SVC:$port/ 2>/dev/null; echo; head -c 80 /tmp/o 2>/dev/null | tr '\n' ' '" 2>&1 | tr '\n' '|' | cut -c1-230)
    printf '%s\t%s\t%s\tplain-http: %s\ttls-no-client-cert: %s\ttls-with-client-cert: %s\n' "$label" "$5" "$port" "$h" "$t" "$c"
  done
}
{
printf 'from\ttarget\tport\tplain_http\ttls_no_client_cert\ttls_with_allowed_client_cert\n'
probe model-gw client "pod-in-other-namespace to Service" $SVC "" | sed "s#\t\t#\tservice\t#"
probe model-gw client "pod-in-other-namespace to pod IP" $POD "" | sed "s#\t\t#\tpod-ip\t#"
if kubectl -n ate-system get pod e-prober > /dev/null 2>&1; then
  CC="--cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem"
  probe ate-system e-prober "pod-in-ate-system with atenet-client identity to Service" $SVC "$CC" | sed "s#\t--cacert[^\t]*\t#\tservice\t#"
  probe ate-system e-prober "pod-in-ate-system to pod IP" $POD "" | sed "s#\t\t#\tpod-ip\t#"
fi
} > 10-port-probes.tsv 2>&1
sed -i "s/$POD/<router-pod-ip>/g" 10-port-probes.tsv 2>/dev/null
cut -c1-330 10-port-probes.tsv
cat 04-config-ports.txt | head -40
cat 02-router-containers.json | cut -c1-500
grep -A12 "ports:" 00-service.yaml | head -30
cat 01-networkpolicies.txt
