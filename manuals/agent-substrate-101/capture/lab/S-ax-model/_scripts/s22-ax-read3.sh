cd ~/ax
echo "== GEMINI injection"; grep -rn "GEMINI_API_KEY" --include=*.go . | grep -v _test | cut -c1-220 | head -20
echo "== proto model/task spec"; grep -n -A14 -E "^message (ModelSpec|TaskSpec|WorkspaceSpec|GitRepo|GatewaySpec) " -r api proto 2>/dev/null | cut -c1-170 | head -120
ls; ls api 2>/dev/null | head
echo "== workerpool example"; grep -v "^#" examples/workerpool.yaml
echo "== pool selection in server"; grep -rn -i -E "workerselector|WorkerPool|workerpool" --include=*.go internal cmd | grep -v _test | cut -c1-200 | head -20
echo "== kubectl ate help"; kubectl ate --help 2>&1 | head -40
kubectl ate create --help 2>&1 | head -30
kubectl ate set --help 2>&1 | head -30
kubectl ate get --help 2>&1 | head -30
echo "== kagent loop progress"; tail -2 ~/evidence/S-ax-model/20-kagent/loop/events.log; wc -l ~/evidence/S-ax-model/20-kagent/loop/timings.tsv
