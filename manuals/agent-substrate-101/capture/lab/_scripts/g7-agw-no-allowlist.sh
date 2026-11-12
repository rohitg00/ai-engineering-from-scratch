export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
export ATE_INSTALL_KIND=true
G=~/evidence/G-dataplane/02-agentgateway-without-ingress-allowlist; mkdir -p $G; cd $G
N=ate-system
listen() {
  pn=$(kubectl -n $N get pod -l app=atenet-router --field-selector=status.phase=Running -o jsonpath='{.items[0].metadata.name}')
  cid=$(kubectl -n $N get pod $pn -o json | jq -r '.status.containerStatuses[0].containerID' | sed 's#containerd://##')
  pid=$(sg docker -c "docker exec kind-control-plane crictl inspect -o go-template --template '{{.info.pid}}' $cid")
  sg docker -c "docker exec kind-control-plane nsenter -t $pid -n ss -ltnH" | awk '{print $4}' | sort -u
}
probe() {
  T="ate-demo-counter/my-counter-1"; R=atenet-router.ate-system.svc
  for t in "80-plain-http|curl -sS -m 8 -w ' code=%{http_code}' -X POST -H 'ate-target-actor: $T' http://$R:80/" \
           "8081-plain-connect|curl -sS -m 8 -w ' code=%{http_code}' --proxytunnel --proxy http://$R:8081 --proxy-header 'ate-target-actor: $T' -X POST http://actor:80/" \
           "443-nocert|curl -sS -m 8 -w ' code=%{http_code}' --cacert /run/ca/trust-bundle.pem -X POST -H 'ate-target-actor: $T' https://$R:443/" \
           "443-wrong-identity|curl -sS -m 8 -w ' code=%{http_code}' --cacert /run/ca/trust-bundle.pem --cert /run/id/credential-bundle.pem --key /run/id/credential-bundle.pem -X POST -H 'ate-target-actor: $T' https://$R:443/"; do
    echo "## ${t%%|*}"; kubectl -n probe exec wrong-id -- sh -c "${t#*|}" 2>&1 | tail -3; echo
  done
}
cd ~/substrate
s=$(date +%s)
sg docker -c "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids= --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0 --atenet-dataplane=agentgateway" > $G/10-deploy-no-allowlist.log 2>&1
echo "deploy-without-allowlist rc=$? seconds=$(( $(date +%s) - s ))" | tee $G/11-timing.txt
tail -3 $G/10-deploy-no-allowlist.log | cut -c1-250
cd $G
kubectl -n $N rollout status deploy/atenet-router --timeout=120s > /dev/null 2>&1; sleep 8
kubectl -n $N get cm atenet-router-agentgateway-config -o yaml > 12-router-config-no-allowlist.yaml 2>&1
listen > 13-listening-no-allowlist.txt; cat 13-listening-no-allowlist.txt | tr '\n' ' '; echo
probe > 14-probe-no-allowlist.txt 2>&1; cut -c1-200 14-probe-no-allowlist.txt
kubectl ate get actor my-counter-1 -a ate-demo-counter 2>&1 | grep -v Warning | tee 15-actor-after-probe.txt
cd ~/substrate
s=$(date +%s)
sg docker -c "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0 --atenet-dataplane=agentgateway" > $G/20-deploy-with-allowlist.log 2>&1
echo "deploy-with-allowlist rc=$? seconds=$(( $(date +%s) - s ))" | tee -a $G/11-timing.txt
cd $G
kubectl -n $N rollout status deploy/atenet-router --timeout=120s > /dev/null 2>&1; sleep 8
kubectl -n $N get cm atenet-router-agentgateway-config -o yaml > 22-router-config-with-allowlist.yaml 2>&1
listen > 23-listening-with-allowlist.txt; cat 23-listening-with-allowlist.txt | tr '\n' ' '; echo
probe > 24-probe-with-allowlist.txt 2>&1; cut -c1-200 24-probe-with-allowlist.txt
diff <(sed -n '/^data:/,/^kind:/p' 12-router-config-no-allowlist.yaml) <(sed -n '/^data:/,/^kind:/p' 22-router-config-with-allowlist.yaml) > 30-config-diff.txt; wc -l 30-config-diff.txt
echo G7-DONE
