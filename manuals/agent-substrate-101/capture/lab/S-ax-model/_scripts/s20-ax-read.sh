cd ~/ax
git log -1 --format='%H %cd' ; git tag | tail -5; git status --short | head
echo "== examples"; find examples -maxdepth 3 | head -60
echo "== docs"; ls docs
echo "== model usage"; grep -rn -i "provider" --include=*.go internal pkg runner cmd 2>/dev/null | grep -v _test | grep -v "pb.go" | cut -c1-220 | head -50
echo "== task spec fields"; grep -n -E "^\s+[A-Z][A-Za-z]+ .*json:\"" pkg/api/v1alpha1/*.go 2>/dev/null | cut -c1-200 | head -80
ls pkg pkg/* | head -40
