E=~/evidence/G-dataplane/00-install; mkdir -p "$E"
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
cd ~/substrate
step() {
  n="$1"; shift
  s=$(date +%s)
  sg docker -c "$*" > "$E/$n.log" 2>&1
  rc=$?
  e=$(date +%s)
  printf '%s\t%s\t%s\n' "$n" "$rc" "$((e-s))" | tee -a "$E/steps.tsv"
  return $rc
}
: > "$E/steps.tsv"
export ATE_INSTALL_KIND=true
step 10-kind-cluster "hack/create-kind-cluster.sh" || exit 1
step 20-deploy-ate-system-prebuilt "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0" || exit 1
step 30-deploy-counter "go run ./cmd/ate-setup deploy demo counter" || exit 1
step 40-install-cli "go install ./cmd/kubectl-ate" || exit 1
step 50-create-actor "kubectl ate create actor my-counter-1 -a ate-demo-counter --template counter" || exit 1
step 60-state "kubectl get pods -A -o wide; docker system df; du -sh ~/go ~/.cache 2>/dev/null; df -h / | tail -1"
echo DONE | tee -a "$E/steps.tsv"
