E=~/evidence/A-quickstart; mkdir -p "$E"
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
cd ~/substrate
step() {
  n="$1"; shift
  s=$(date +%s)
  echo "### $n: $*" | tee -a "$E/02-steps.tsv.log"
  sg docker -c "$*" > "$E/$n.log" 2>&1
  rc=$?
  e=$(date +%s)
  printf '%s\t%s\t%s\n' "$n" "$rc" "$((e-s))" | tee -a "$E/02-steps.tsv"
  return $rc
}
: > "$E/02-steps.tsv"
export ATE_INSTALL_KIND=true
step 10-kind-cluster "hack/create-kind-cluster.sh" || exit 1
step 20-deploy-ate-system "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client" || exit 1
step 30-deploy-counter "go run ./cmd/ate-setup deploy demo counter" || exit 1
step 40-install-cli "go install ./cmd/kubectl-ate" || exit 1
step 50-create-actor "kubectl ate create actor my-counter-1 -a ate-demo-counter --template counter" || exit 1
step 60-state "kubectl get nodes -o wide; kubectl get pods -A -o wide; kubectl ate get actors -A 2>&1; kubectl get crd | grep -i ate; docker ps --format '{{.Names}} {{.Image}}'; df -h / | tail -1"
echo DONE | tee -a "$E/02-steps.tsv"
