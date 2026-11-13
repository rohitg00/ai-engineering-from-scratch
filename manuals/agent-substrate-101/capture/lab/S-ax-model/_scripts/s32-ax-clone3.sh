set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
E=~/evidence/S-ax-model/30-ax-clone; cd $E
T=s-clone
mv 32-cycles-after-clone.tsv 32-cycles-https-rule-no-trust.tsv
kubectl ate --context $C get egress-policy $T -a default -o json 2>/dev/null | jq '.rules = [{"tlsPassthrough": {"hostnames": ["github.com"]}}]' > 40-egress-passthrough.json
cat 40-egress-passthrough.json
run 41-update-egress "kubectl ate --context $C update egress-policy $T -a default -f 40-egress-passthrough.json"
run 42-egress-now "kubectl ate --context $C get egress-policy $T -a default -o yaml"
run 43-probe-running "$AX ssh $T -- sh -c 'curl -s -m 8 -o /dev/null -w \"github %{http_code} %{errormsg}\n\" https://github.com/; curl -s -m 8 -o /dev/null -w \"example %{http_code} %{errormsg}\n\" https://example.com/'"
run 44-suspend "$AX suspend task $T"
sleep 2
run 45-resume-with-passthrough "$AX resume task $T"
run 46-ssh-clone-state "$AX ssh $T -- sh -c 'ls -la /workspace /workspace/itsdangerous | head -40; git -C /workspace/itsdangerous log -1 --format=%H%n%cd%n%s 2>&1; git -C /workspace/itsdangerous branch -a 2>&1 | head; du -sh /workspace; ls -la /ax 2>&1; cat /ax/git-error.log 2>&1 | tail -5; ls -la /workspace/.ax* 2>&1 | head'"
run 47-actor-logs "kubectl ate --context $C logs actor $T -a default | grep -E 'git|workspace|maiden' | cut -c1-420 | tail -8"
run 48-describe "$AX describe task $T"
for i in 1 2 3 4 5; do
  s=$(date +%s.%N); $AX suspend task $T > /dev/null 2>&1; a=$(el $s); sleep 1
  s=$(date +%s.%N); $AX resume task $T > /dev/null 2>&1; b=$(el $s)
  h=$($AX ssh $T -- git -C /workspace/itsdangerous log -1 --format=%H 2>&1 | tail -1)
  printf '%s\t%s\t%s\t%s\n' $i $a $b "$h" >> 49-cycles-after-clone.tsv
done
run 50-actor-logs-last "kubectl ate --context $C logs actor $T -a default | grep -E 'git|workspace|maiden' | cut -c1-300 | tail -6"
tail -9 steps.tsv; for f in 41* 42* 43* 46* 47* 48* 49* 50*; do echo "== $f"; cut -c1-420 $f | grep -v "^Warning: no --token" | head -40; done
date -u +%T; tail -1 ~/evidence/S-ax-model/20-kagent/loop/events.log
