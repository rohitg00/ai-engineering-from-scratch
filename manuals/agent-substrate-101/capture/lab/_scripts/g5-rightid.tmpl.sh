DP=__DP__
E=~/evidence/G-dataplane/$DP/ingress-auth; cd "$E"
kubectl -n ate-system create sa atenet-client > 50-create-sa.log 2>&1
sed -n '/^kind: Pod/,$p' probe.yaml | awk 'BEGIN{p=0} /name: right-id/{p=1} {a[NR]=$0} END{}' >/dev/null
awk 'BEGIN{RS="---\n"} /name: right-id/{printf "%s", $0}' probe.yaml > right-id.yaml
kubectl apply -f right-id.yaml >> 50-create-sa.log 2>&1
kubectl -n ate-system wait --for=condition=Ready pod/right-id --timeout=120s >> 50-create-sa.log 2>&1
tail -2 50-create-sa.log
T="ate-demo-counter/my-counter-1"; R=atenet-router.ate-system.svc
kubectl -n ate-system exec right-id -- cat /run/id/credential-bundle.pem | openssl x509 -noout -subject -ext subjectAltName 2>/dev/null | tr '\n' ' ' > cert-right-id.txt
{
echo "cert right-id: $(cat cert-right-id.txt)"
echo "### 23-rightid-https-443"
kubectl -n ate-system exec right-id -- sh -c "curl -sS -m 20 -w ' code=%{http_code} t=%{time_total}\n' --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST -H 'ate-target-actor: $T' https://$R:443/" 2>&1
echo "### 26-rightid-connect-8444"
kubectl -n ate-system exec right-id -- sh -c "curl -sS -m 20 -w ' code=%{http_code} t=%{time_total}\n' --proxytunnel --proxy https://$R:8444 --proxy-cacert /run/ca/trust-bundle.pem --proxy-cert /run/id/credential-bundle.pem --proxy-key /run/id/credential-bundle.pem --proxy-header 'ate-target-actor: $T' -X POST http://actor:80/" 2>&1
echo "### 27-rightid-unknown-actor"
kubectl -n ate-system exec right-id -- sh -c "curl -sS -m 20 -w ' code=%{http_code} t=%{time_total}\n' --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST -H 'ate-target-actor: ate-demo-counter/does-not-exist' https://$R:443/" 2>&1
echo "### 28-rightid-no-header"
kubectl -n ate-system exec right-id -- sh -c "curl -sS -m 20 -w ' code=%{http_code} t=%{time_total}\n' --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST https://$R:443/" 2>&1
} > 51-rightid-results.txt 2>&1
cat 51-rightid-results.txt | cut -c1-260
kubectl -n ate-system logs deploy/atenet-router -c $(kubectl -n ate-system get deploy atenet-router -o jsonpath='{.spec.template.spec.containers[0].name}') --tail=40 > 52-router-log-after.log 2>&1
for c in $(kubectl -n ate-system get deploy atenet-router -o jsonpath='{.spec.template.spec.containers[*].name}'); do kubectl -n ate-system logs deploy/atenet-router -c $c --tail=60 > 52-router-log-$c.log 2>&1; done
grep -h -i -E "ate-target|my-counter|certificate|san=|spiffe" 52-router-log-*.log | tail -6 | cut -c1-420
