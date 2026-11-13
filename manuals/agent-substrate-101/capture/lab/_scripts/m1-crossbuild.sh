export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
set -e
O=~/mac-kit; mkdir -p $O; cd ~/substrate
V=$(git describe --tags)
export CGO_ENABLED=0 GOOS=darwin GOARCH=arm64
go build -o $O/ate-setup ./cmd/ate-setup
go build -o $O/kubectl-ate ./cmd/kubectl-ate
(cd hack/tools/kind && go build -o $O/kind sigs.k8s.io/kind && go list -m sigs.k8s.io/kind > $O/kind.version)
export GOOS=linux GOARCH=arm64
go build -o $O/counter-linux-arm64 ./demos/counter
(cd ~/ballast && go build -o $O/ballast-linux-arm64 .)
sg docker -c "docker ps --format '{{.Names}} {{.Image}}'" > $O/vm-docker-ps.txt
echo "$V" > $O/substrate.version
cd $O && tar czf ~/mac-kit.tgz . && ls -la $O ~/mac-kit.tgz && cat kind.version vm-docker-ps.txt
tail -2 ~/evidence/B-lifecycle/10-trace.tsv
