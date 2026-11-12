E=~/evidence/A-quickstart
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
cd ~/substrate
cp "$E/20-deploy-ate-system.log" "$E/20-deploy-ate-system.FAILED-no-buildx.log"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker-buildx > "$E/21-install-buildx.log" 2>&1
docker buildx version >> "$E/21-install-buildx.log" 2>&1
step() {
  n="$1"; shift
  s=$(date +%s)
  sg docker -c "$*" > "$E/$n.log" 2>&1
  rc=$?
  e=$(date +%s)
  printf '%s\t%s\t%s\n' "$n" "$rc" "$((e-s))" | tee -a "$E/02-steps.tsv"
  return $rc
}
export ATE_INSTALL_KIND=true
step 22-deploy-ate-system-retry "go run ./cmd/ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client" || exit 1
step 30-deploy-counter "go run ./cmd/ate-setup deploy demo counter" || exit 1
step 40-install-cli "go install ./cmd/kubectl-ate" || exit 1
step 50-create-actor "kubectl ate create actor my-counter-1 -a ate-demo-counter --template counter" || exit 1
step 60-state "kubectl get nodes -o wide; kubectl get pods -A -o wide; kubectl ate get actor -A 2>&1; kubectl ate get worker -A 2>&1; kubectl get crd | grep -i ate; docker ps --format '{{.Names}} {{.Image}}'; docker system df; du -sh ~/go ~/.cache 2>/dev/null; df -h / | tail -1"
echo DONE | tee -a "$E/02-steps.tsv"
