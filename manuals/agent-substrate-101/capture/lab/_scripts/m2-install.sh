#!/bin/bash
M=$HOME/.cache/aiefs-manuals-wip/substrate-research/mac-run
E=$HOME/.cache/aiefs-manuals-wip/substrate-research/evidence/M-mac-arm64
SRC=$HOME/.cache/aiefs-manuals-wip/substrate-research/repos/substrate
mkdir -p "$E"; cd "$M"
export PATH="$M/kit:$PATH"
: > "$E/02-steps.tsv"
{
sw_vers; uname -m; sysctl -n machdep.cpu.brand_string
docker version --format 'docker server {{.Server.Version}} {{.Server.Os}}/{{.Server.Arch}}'
docker info --format 'docker vm cpus {{.NCPU}} mem {{.MemTotal}}'
kind version; kubectl version --client 2>/dev/null | head -1; cat kit/substrate.version
df -h /System/Volumes/Data | tail -1
} > "$E/00-host.txt" 2>&1
if [ ! -d substrate ]; then
  git clone -q --local --branch v1.0.0 "$SRC" substrate 2> "$E/01-clone.log"
  printf '#!/bin/sh\nexec "%s/kit/kind" "$@"\n' "$M" > substrate/hack/kind.sh
fi
cd substrate
step() {
  n="$1"; shift
  s=$(date +%s)
  bash -c "$*" > "$E/$n.log" 2>&1
  rc=$?
  printf '%s\t%s\t%s\n' "$n" "$rc" "$(( $(date +%s) - s ))" | tee -a "$E/02-steps.tsv"
  return $rc
}
export ATE_INSTALL_KIND=true
step 10-kind-cluster "hack/create-kind-cluster.sh" || exit 1
df -h /System/Volumes/Data | tail -1 >> "$E/00-host.txt"
step 20-deploy-ate-system "ate-setup deploy ate-system --credential-provider='{\"name\":\"k8s.io\"}' --ingress-allowed-spiffe-ids=spiffe://cluster.local/ns/ate-system/sa/atenet-client --image-repo ghcr.io/agent-substrate/substrate --image-tag v1.0.0" || exit 1
step 60-state "kubectl get nodes -o wide; kubectl get pods -A -o wide; docker system df; docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}'"
df -h /System/Volumes/Data | tail -1 >> "$E/00-host.txt"
echo DONE >> "$E/02-steps.tsv"
