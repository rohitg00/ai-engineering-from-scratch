E=~/evidence/K-kagent; mkdir -p "$E/install"; cd "$E/install"
T="$E/install/steps.tsv"; : > "$T"
step() {
  n="$1"; shift
  s=$(date +%s.%N)
  echo "### $n: $*" >> "$E/install/commands.log"
  sg docker -c "$*" > "$E/install/$n.log" 2>&1
  rc=$?
  e=$(date +%s.%N)
  printf '%s\t%s\t%.1f\n' "$n" "$rc" "$(echo "$e - $s" | bc)" | tee -a "$T"
  return $rc
}
sudo apt-get install -y -q bc >/dev/null 2>&1
export OPENAI_API_KEY="sk-mock-not-a-real-key"
step 10-get-kind "curl -fsSL -o /tmp/kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64 && sudo install -m 755 /tmp/kind /usr/local/bin/kind && kind version" || exit 1
step 20-kind-create "kind create cluster --name kagent --image kindest/node:v1.37.0" || exit 1
step 21-api-resources "kubectl api-resources --api-group=certificates.k8s.io; kubectl version; kubectl get nodes -o wide"
step 30-get-kagent-cli "curl -fsSL https://raw.githubusercontent.com/kagent-dev/kagent/refs/heads/main/scripts/get-kagent | bash -s -- --version v1.0.0; kagent version" || exit 1
cat > kagent-values.yaml <<EOF
config:
  server:
    grpcReflection: true
EOF
cat > kagent-config.yaml <<EOF
install:
  kagent:
    valuesFiles: [kagent-values.yaml]
EOF
step 40-kagent-install "kagent --config kagent-config.yaml install --namespace kagent"
rc=$?
step 50-rollout "kubectl rollout status deployment/kagent-controller -n kagent --timeout=300s"
step 60-state "kubectl get ns; kubectl get pods -A -o wide; helm list -A; kubectl get workerpools -A; kubectl get crd | grep -E 'ate.dev|kagent'"
echo "DONE install_rc=$rc" | tee -a "$T"
