set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
KC="kubectl --context $C"
KA="kubectl ate --context $C"
now() { date -u +%FT%T.%3NZ; }
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
IMG=$(cut -d' ' -f1 ~/evidence/S-ax-model/70-agent-image/03-image.txt)

E=~/evidence/W-ax-kagent-2/50-ax-clone-2; mkdir -p $E; cd $E
echo "step	rc	seconds" > steps.tsv
cat > 01-objects.yaml <<'Y'
apiVersion: ax.io/v1alpha1
kind: Workspace
metadata:
  name: w-ws-clone
  atespace: default
spec:
  git:
    - name: origin
      repo: "https://github.com/pallets/itsdangerous.git"
      branch: "main"
---
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: w-clone2
  atespace: default
spec:
  debug: true
  command: ["sleep", "infinity"]
  workspace:
    name: w-ws-clone
Y
cat > 02-egress.yaml <<'Y'
rules:
- tlsPassthrough:
    hostnames: ["github.com"]
    ports:
      numbers: [443]
Y
T=w-clone2
run 03-apply "$AX apply -f 01-objects.yaml"
run 04-actor-after-apply "$KA get actor $T -a default -o json | jq -c '{state: .status.state}'"
run 05-create-egress "$KA create egress-policy $T -a default -f 02-egress.yaml"
run 06-resume-first-with-clone "$AX resume task $T"
run 07-clone-state "$AX ssh $T -- sh -c 'ls /workspace; git -C /workspace/itsdangerous log -1 --format=%H 2>&1; du -sh /workspace; ls -la /ax; cat /ax/git-error.log 2>/dev/null | tail -3'"
run 08-actor-logs "$KA logs actor $T -a default | grep -E 'git|workspace|maiden|clone' | cut -c1-300 | tail -8"
run 09-describe "$AX describe task $T"
for i in 1 2 3 4 5; do
  s=$(date +%s.%N); $AX suspend task $T > /dev/null 2>&1; a=$(el $s); sleep 1
  s=$(date +%s.%N); $AX resume task $T > /dev/null 2>&1; b=$(el $s)
  h=$($AX ssh $T -- git -C /workspace/itsdangerous log -1 --format=%H 2>&1 | tail -1)
  printf '%s\t%s\t%s\t%s\n' $i $a $b "$h" >> 10-cycles-after-clone.tsv
done
run 11-suspend-end "$AX suspend task $T"
cat steps.tsv; for f in 03-* 04-* 05-* 07-* 08-* 09-*; do echo "== $f"; grep -v "^Warning: no --token" $f | cut -c1-300 | head -20; done; cat 10-cycles-after-clone.tsv

echo DONE-W33A
