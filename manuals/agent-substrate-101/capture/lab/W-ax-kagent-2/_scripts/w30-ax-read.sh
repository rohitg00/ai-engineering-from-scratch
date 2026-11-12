set -u
cd ~/ax
git log --oneline -1 | cut -c1-80
echo "== docs"; ls docs | tr '\n' ' '; echo; ls examples examples/* 2>/dev/null | head -40
echo "== files mentioning mcp or skill"
grep -rIl -i -E "\bmcp\b|mcpServers|skills?\b" --include='*.md' --include='*.yaml' --include='*.yml' --include='*.go' --include='*.json' --include='*.proto' . 2>/dev/null | grep -v -E "_test.go|/vendor/|node_modules|\.git/|go.sum" | head -40
echo "== spec fields"
grep -n -i -E "mcp|skill" api/ax/v1alpha1/*.proto 2>/dev/null | cut -c1-200 | head -40
ls api 2>/dev/null; find . -name "*.proto" -not -path "./.git/*" | head
echo "== claude-code example"
ls -la examples/claude-code 2>/dev/null
for f in examples/claude-code/README.md examples/claude-code/task.yaml examples/claude-code/workspace.yaml; do [ -f $f ] && { echo "---- $f"; cat $f | cut -c1-200 | head -90; }; done
