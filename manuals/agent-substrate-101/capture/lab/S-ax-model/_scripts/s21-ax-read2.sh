cd ~/ax
echo "== callers of internal/model"; grep -rn "internal/model\"" --include=*.go . | cut -c1-160
grep -rn -E "\.Generate\(|model\.New|NewClient\(" --include=*.go internal cmd runner | grep -v _test | cut -c1-200 | head -20
echo "== client.go 30-130"; sed -n 30,130p internal/model/client.go
echo "== client.go 455-500"; sed -n 455,500p internal/model/client.go
echo "== example claude-code"; cat examples/claude-code/task.yaml; sed -n 1,80p examples/claude-code/README.md
echo "== simple"; cat examples/simple.yaml
echo "== Dockerfile.claude-code"; cat Dockerfile.claude-code
echo "== concepts model"; grep -n -i -B2 -A25 "^## .*model" docs/concepts.md | head -90
echo "== manifests model/task"; grep -n -i -A30 "kind: Model" docs/manifests.md | head -70
