E=~/evidence/K-kagent/agent; cd "$E"
A() { sg docker -c "kubectl ate $*"; }
( time A get atespace ) 2>&1 | tail -12
A get actor-template -a kagent 2>&1 | cut -c1-220
A get actor-template -a kagent -o yaml > actor-templates.yaml 2>&1; wc -l actor-templates.yaml
A get actor -a kagent 2>&1 | cut -c1-220
A get worker 2>&1 | cut -c1-220
A get worker --help 2>&1 | sed -n 1,25p
echo ---PG
sg docker -c "kubectl -n kagent get pod -l app.kubernetes.io/name=postgresql -o name; kubectl -n kagent get deploy kagent-postgresql -o json" | jq -r '.spec.template.spec.containers[]? | .name + " " + .image + " env=" + ([.env[]?.name]|join(","))' 2>/dev/null
sg docker -c "kubectl -n kagent exec deploy/kagent-postgresql -c postgresql -- psql -U postgres -Atc '\\l'" 2>&1 | head
sg docker -c "kubectl -n kagent exec deploy/kagent-postgresql -c postgresql -- env" 2>&1 | grep -i -E "^POSTGRES|^PG" | sed 's/PASSWORD=.*/PASSWORD=<redacted>/'
ps aux | grep -E "port-forward|kagent " | grep -v grep | cut -c1-160
ss -ltnp 2>/dev/null | grep -E ":808[0-9]" | cut -c1-140
