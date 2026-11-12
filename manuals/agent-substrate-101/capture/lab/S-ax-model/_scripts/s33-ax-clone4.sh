set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-demo
AX="ax --context $C -n ax-system"
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> steps.tsv; }
E=~/evidence/S-ax-model/30-ax-clone; cd $E
T=s-clone
mv 49-cycles-after-clone.tsv 49-cycles-https-rule-no-trust-2.tsv
kubectl ate --context $C get egress-policy $T -a default -o json 2>/dev/null | jq '.rules = [{"tlsPassthrough": {"hostnames": ["github.com"], "ports": {"numbers": [443]}}}]' > 60-egress-passthrough.json
run 61-update-egress "kubectl ate --context $C update egress-policy $T -a default -f 60-egress-passthrough.json"
run 62-egress-now "kubectl ate --context $C get egress-policy $T -a default -o yaml"
grep -q tlsPassthrough 62-egress-now.log || { echo UPDATE-FAILED; cat 61-update-egress.log; exit 1; }
run 63-probe-running "$AX ssh $T -- sh -c 'curl -s -m 8 -o /dev/null -w \"github %{http_code} %{errormsg}\n\" https://github.com/; curl -s -m 8 -o /dev/null -w \"example %{http_code} %{errormsg}\n\" https://example.com/'"
run 64-suspend "$AX suspend task $T"
sleep 2
run 65-resume-with-passthrough "$AX resume task $T"
run 66-ssh-clone-state "$AX ssh $T -- sh -c 'ls -la /workspace /workspace/itsdangerous | head -40; git -C /workspace/itsdangerous log -1 --format=%H%n%cd%n%s 2>&1; git -C /workspace/itsdangerous branch -a 2>&1 | head; du -sh /workspace; ls -la /ax 2>&1; cat /ax/git-error.log 2>&1 | tail -5'"
run 67-actor-logs "kubectl ate --context $C logs actor $T -a default | grep -E 'git|workspace|maiden' | cut -c1-420 | tail -8"
run 68-describe "$AX describe task $T"
for i in 1 2 3 4 5; do
  s=$(date +%s.%N); $AX suspend task $T > /dev/null 2>&1; a=$(el $s); sleep 1
  s=$(date +%s.%N); $AX resume task $T > /dev/null 2>&1; b=$(el $s)
  h=$($AX ssh $T -- git -C /workspace/itsdangerous log -1 --format=%H 2>&1 | tail -1)
  printf '%s\t%s\t%s\t%s\n' $i $a $b "$h" >> 69-cycles-after-clone.tsv
done
run 70-actor-logs-last "kubectl ate --context $C logs actor $T -a default | grep -E 'git|workspace|maiden' | cut -c1-300 | tail -6"
tail -9 steps.tsv; for f in 61* 62* 63* 66* 67* 68* 69* 70*; do echo "== $f"; cut -c1-420 $f | grep -v "^Warning: no --token" | head -40; done
