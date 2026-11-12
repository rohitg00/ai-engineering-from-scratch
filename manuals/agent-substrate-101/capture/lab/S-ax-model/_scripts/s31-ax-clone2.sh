set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
E=~/evidence/S-ax-model/30-ax-clone; cd $E
T=s-clone
TM=$(kubectl ate --context $C get actor $T -a default -o json 2>/dev/null | jq -r '.actorTemplate.name')
kubectl ate --context $C get actor-template $TM -a default -o yaml 2>/dev/null > 20-actor-template.yaml
grep -n -i -E "systemInfo|trust|SSL_CERT|volumes|env" 20-actor-template.yaml > 21-template-trust-grep.txt
cat > 22-egress-passthrough.yaml <<'EOF'
rules:
- tlsPassthrough:
    hostnames: ["github.com"]
EOF
kubectl ate update egress-policy --help > 23-update-help.txt 2>&1
run 24-update-egress "kubectl ate --context $C update egress-policy $T -a default -f 22-egress-passthrough.yaml"
run 25-egress-now "kubectl ate --context $C get egress-policy $T -a default -o yaml"
run 26-suspend "$AX suspend task $T"
sleep 2
run 27-resume-with-passthrough "$AX resume task $T"
run 28-ssh-clone-state "$AX ssh $T -- sh -c 'ls -la /workspace /workspace/itsdangerous | head -40; git -C /workspace/itsdangerous log -1 --format=%H%n%cd%n%s 2>&1; git -C /workspace/itsdangerous branch -a 2>&1 | head; du -sh /workspace; ls -la /ax 2>&1; cat /ax/git-error.log 2>&1 | tail -5; find /workspace -maxdepth 1 -name \".*\" | head'"
run 29-actor-logs "kubectl ate --context $C logs actor $T -a default | grep -E 'git|workspace|maiden' | cut -c1-420 | tail -12"
run 30-describe "$AX describe task $T"
run 31-probe "$AX ssh $T -- sh -c 'curl -s -m 8 -o /dev/null -w \"github %{http_code}\n\" https://github.com/; curl -s -m 8 -o /dev/null -w \"example %{http_code} %{errormsg}\n\" https://example.com/'"
for i in 1 2 3 4 5; do
  s=$(date +%s.%N); $AX suspend task $T > /dev/null 2>&1; a=$(el $s); sleep 1
  s=$(date +%s.%N); $AX resume task $T > /dev/null 2>&1; b=$(el $s)
  h=$($AX ssh $T -- git -C /workspace/itsdangerous log -1 --format=%H 2>&1 | tail -1)
  printf '%s\t%s\t%s\t%s\n' $i $a $b "$h" >> 32-cycles-after-clone.tsv
done
run 33-actor-logs-last "kubectl ate --context $C logs actor $T -a default | grep -E 'git|workspace|maiden' | cut -c1-300 | tail -6"
cat steps.tsv | tail -9; cat 21-template-trust-grep.txt; for f in 24* 25* 28* 29* 30* 31* 32* 33*; do echo "== $f"; cut -c1-420 $f | grep -v "^Warning: no --token" | head -40; done
