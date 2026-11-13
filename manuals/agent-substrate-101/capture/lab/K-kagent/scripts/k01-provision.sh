set -eu
E=~/evidence/K-kagent; mkdir -p "$E/docs"
exec > >(tee "$E/01-provision.log") 2>&1
date -u +"start %FT%TZ"
sudo DEBIAN_FRONTEND=noninteractive apt-get update -q >/dev/null
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker.io git jq >/dev/null
sudo usermod -aG docker lab
KV=$(curl -fsSL https://dl.k8s.io/release/stable-1.37.txt)
sudo curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/$KV/bin/linux/amd64/kubectl"
sudo chmod 755 /usr/local/bin/kubectl
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | sudo bash >/dev/null 2>&1 || true
sudo sysctl -w fs.inotify.max_user_instances=8192 fs.inotify.max_user_watches=1048576 >/dev/null
echo "kind releases:"
curl -fsSL https://api.github.com/repos/kubernetes-sigs/kind/releases | jq -r '.[0:4][] | .tag_name + " " + .published_at'
echo "kagent releases:"
curl -fsSL https://api.github.com/repos/kagent-dev/kagent/releases | jq -r '.[0:6][] | .tag_name + " " + .published_at'
echo "kagent v1.0.0 assets:"
curl -fsSL https://api.github.com/repos/kagent-dev/kagent/releases/tags/v1.0.0 | jq -r '.assets[] | .name + " " + (.size|tostring)'
echo "substrate fork v1.0.0 assets:"
curl -fsSL https://api.github.com/repos/kagent-dev/substrate/releases/tags/v1.0.0 | jq -r '.assets[] | .name + " " + (.size|tostring)'
cd "$E/docs"
for p in setup/installation setup/quickstart operations/upgrade-from-0x; do
  curl -fsSL -o "$(echo $p | tr / _).md" "https://kagent.dev/docs/kagent/latest/$p.md" || echo "fetch failed $p"
done
ls -la
echo versions:; docker --version; kubectl version --client | head -1; helm version --short
date -u +"end %FT%TZ"
