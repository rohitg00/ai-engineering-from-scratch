set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
K() { kubectl ate --context $C "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
export -f K
E=~/evidence/S-ax-model/30-ax-clone; mkdir -p $E; cd $E
echo "step	rc	seconds" > steps.tsv
T=s-clone
cat > 01-workspace-and-task.yaml <<'EOF'
apiVersion: ax.io/v1alpha1
kind: Workspace
metadata:
  name: s-ws
  atespace: default
spec:
  git:
    - name: origin
      repo: "https://github.com/pallets/itsdangerous.git"
      branch: "main"
  files:
    - path: "AGENTS.md"
      content: |
        # Project Guidelines
        - Keep dependencies minimal.
---
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: s-clone
  atespace: default
spec:
  debug: true
  command: ["sleep", "infinity"]
  workspace:
    name: s-ws
EOF
cat > 02-egress-policy.yaml <<'EOF'
rules:
- https:
    hostnames: ["github.com"]
EOF
run 03-apply "$AX apply -f 01-workspace-and-task.yaml"
run 04-actor-after-apply "kubectl ate --context $C get actor $T -a default -o json | jq -c '{state: .status.state, template: .actorTemplate.name}'"
run 05-egress-before "kubectl ate --context $C get egress-policy $T -a default -o yaml"
run 06-create-egress "kubectl ate --context $C create egress-policy $T -a default -f 02-egress-policy.yaml"
run 07-egress-after "kubectl ate --context $C get egress-policy $T -a default -o yaml"
run 08-resume-first "$AX resume task $T"
sleep 3
run 09-describe "$AX describe task $T"
run 10-ssh-clone-state "$AX ssh $T -- sh -c 'ls -la /workspace /workspace/* | head -40; git -C /workspace/itsdangerous log -1 --format=%H%n%cd%n%s 2>&1 || true; for d in /workspace/*/; do git -C \$d log -1 --format=%H 2>&1; done; du -sh /workspace; cat /ax/git-error.log 2>&1 | tail -5'"
run 11-ssh-egress-probe "$AX ssh $T -- sh -c 'curl -s -m 8 -o /dev/null -w \"github %{http_code}\n\" https://github.com/; curl -s -m 8 -o /dev/null -w \"api.github %{http_code} %{errormsg}\n\" https://api.github.com/; curl -s -m 8 -o /dev/null -w \"example %{http_code} %{errormsg}\n\" https://example.com/'"
run 12-actor-logs "kubectl ate --context $C logs actor $T -a default | grep -v -E 'cli.go|config.go|namespace.go|container.go|cpulimits.go' | cut -c1-400 | tail -40"
run 13-suspend "$AX suspend task $T"
sleep 2
run 14-resume-second "$AX resume task $T"
run 15-ssh-after-second "$AX ssh $T -- sh -c 'ls /workspace; for d in /workspace/*/; do git -C \$d log -1 --format=%H 2>&1; git -C \$d status --short | head -5; done; cat /ax/git-error.log 2>&1 | tail -5'"
run 16-egress-after-cycle "kubectl ate --context $C get egress-policy $T -a default -o yaml"
run 17-describe-final "$AX describe task $T"
IP=$($AX describe task $T | awk '/Worker IP/ {print $3}')
kubectl --context $C get pods -A -o wide | awk -v ip="$IP" '$7==ip {print $1 "\t" $2 "\t" $7}' > 18-worker-pod.tsv
cat steps.tsv; for f in 04* 05* 06* 07* 08* 09* 10* 11* 12* 14* 15* 16* 18*; do echo "== $f"; cut -c1-300 $f | head -45; done
