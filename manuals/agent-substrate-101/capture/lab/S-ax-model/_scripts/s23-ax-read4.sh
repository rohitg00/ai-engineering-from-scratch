cd ~/ax
date -u +%T; tail -1 ~/evidence/S-ax-model/20-kagent/loop/events.log
echo "== api types"; ls pkg/apis/v1alpha1 | head; grep -n -E "^message |^  (repeated |optional |map<.*> )?[A-Za-z_.]+ [a-z_]+ = [0-9]+" pkg/apis/v1alpha1/*.proto 2>/dev/null | cut -c1-150 | sed -n 1,140p
echo "== server uses of Model in task creation"; grep -n -i -E "model" internal/server/server.go | cut -c1-170 | head -40
echo "== egress manifests in demos"; grep -rl -i "egress" ~/demos 2>/dev/null | head; f=$(grep -rl -i "kind: *ActorEgressPolicy\|egress-policy" ~/demos 2>/dev/null | head -1); echo "FILE $f"; [ -n "$f" ] && sed -n 1,60p "$f"
kubectl ate create egress-policy --help 2>&1 | head -30
kubectl --context kind-demo get workerpool -A -o yaml | grep -n -E "name:|namespace:|sandboxClasses|- name|replicas" | head -40
kubectl config current-context
