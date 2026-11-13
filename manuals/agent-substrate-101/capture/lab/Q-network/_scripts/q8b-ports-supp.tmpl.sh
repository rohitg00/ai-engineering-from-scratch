DP=__DP__
export KUBECONFIG=$HOME/.kube/kind-kind.config
E=~/evidence/Q-network/m-router-ports/$DP; cd "$E"
sed -n '76,100p' 03-router-config-*.yaml > 06-config-binds.txt 2>/dev/null
grep -n -B1 -A3 -E "^- port:|^  port:|port: [0-9]+" 03-router-config-*.yaml | cut -c1-120 | head -60 > 06-config-all-ports.txt
POD=$(kubectl -n ate-system get pods -o wide --no-headers | grep atenet-router | grep Running | awk '{print $6}' | head -1)
S=atenet-router.ate-system.svc
CC="--cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem"
x() { kubectl -n $1 exec $2 -- sh -c "$3" 2>&1 | tr '\n' '|' | cut -c1-260; }
{
for port in 8443 15021 15000; do
  echo "pod-ip $port plain: $(x model-gw client "curl -s -m 4 -o /tmp/o -w '%{http_code} exit=%{exitcode} err=%{errormsg}' http://$POD:$port/; echo; head -c 60 /tmp/o")"
  echo "pod-ip $port tls:   $(x model-gw client "curl -sk -m 4 -o /tmp/o -w '%{http_code} exit=%{exitcode} err=%{errormsg}' https://$POD:$port/; echo; head -c 60 /tmp/o")"
done
echo "stats 15020 /metrics from another namespace: $(x model-gw client "curl -s -m 4 -o /tmp/o -w '%{http_code}' http://$S:15020/metrics; echo; wc -c < /tmp/o; grep -c '^# TYPE' /tmp/o; grep -m3 -E 'actor|spiffe|atespace' /tmp/o | cut -c1-160")"
echo "stats 15020 /stats/prometheus: $(x model-gw client "curl -s -m 4 -o /tmp/o -w '%{http_code}' http://$S:15020/stats/prometheus; echo; wc -c < /tmp/o")"
for port in 443 8444; do
  echo "service $port with allowed client cert, POST with routing header: $(x ate-system e-prober "curl -s -m 8 -o /tmp/o -w '%{http_code} exit=%{exitcode} err=%{errormsg}' $CC -X POST -H 'ate-target-actor: ate-demo-counter/my-counter-1' https://$S:$port/; echo; head -c 100 /tmp/o")"
done
echo "service 443 with allowed client cert, no routing header: $(x ate-system e-prober "curl -s -m 8 -o /tmp/o -w '%{http_code}' $CC https://$S:443/; echo; head -c 100 /tmp/o")"
} > 11-port-probes-supplement.txt 2>&1
sed -i "s/$POD/<router-pod-ip>/g" 11-port-probes-supplement.txt
cat 11-port-probes-supplement.txt; echo; cat 06-config-binds.txt | cut -c1-110
