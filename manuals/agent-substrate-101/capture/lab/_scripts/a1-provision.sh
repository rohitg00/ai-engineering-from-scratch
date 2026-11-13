set -eu
E=~/evidence/A-quickstart; mkdir -p "$E"
exec > >(tee "$E/01-provision.log") 2>&1
date -u +"start %FT%TZ"
sudo DEBIAN_FRONTEND=noninteractive apt-get update -q >/dev/null
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker.io git make jq >/dev/null
sudo usermod -aG docker lab
curl -fsSL -o /tmp/go.tgz https://go.dev/dl/go1.27.3.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf /tmp/go.tgz && rm /tmp/go.tgz
KV=$(curl -fsSL https://dl.k8s.io/release/stable-1.37.txt)
sudo curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/$KV/bin/linux/amd64/kubectl"
sudo chmod 755 /usr/local/bin/kubectl
grep -q GOPATH ~/.profile || echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> ~/.profile
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
[ -d ~/substrate ] || git clone -q --branch v1.0.0 https://github.com/agent-substrate/substrate.git ~/substrate
cd ~/substrate
echo "versions:"
go version; docker --version; kubectl version --client | head -1; git describe --tags; git rev-parse HEAD
sudo sysctl -w fs.inotify.max_user_instances=8192 fs.inotify.max_user_watches=1048576 >/dev/null
date -u +"end %FT%TZ"
