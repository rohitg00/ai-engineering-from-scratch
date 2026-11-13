set -u
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/S-ax-model/50-ax-v031; mkdir -p $E
C=kind-demo; KC="kubectl --context $C"; NS=ax031-system
cd ~/ax-v031
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
echo "step	rc	seconds" > $E/steps.tsv
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$E/$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> $E/steps.tsv; }
mkdir -p /tmp/ax031-img
for b in ax-server ax-controller; do
  cp bin/$b /tmp/ax031-img/$b
  printf 'FROM scratch\nCOPY %s /%s\nENTRYPOINT ["/%s"]\n' $b $b $b > /tmp/ax031-img/Dockerfile.$b
  run 20-image-$b "docker build -q -t localhost:5002/ax031-$b:v0.3.1 -f /tmp/ax031-img/Dockerfile.$b /tmp/ax031-img && docker push -q localhost:5002/ax031-$b:v0.3.1"
done
run 21-task-runner-image "docker build -q -t localhost:5002/ax031-task-runner:v0.3.1 -f Dockerfile.task-runner . && docker push localhost:5002/ax031-task-runner:v0.3.1 | tail -1"
DIG=$(grep -o 'sha256:[0-9a-f]*' $E/21-task-runner-image.log | tail -1); echo "task runner digest: $DIG" > $E/22-digests.txt
for f in redis ax-controller ax-server; do
  sed -e "s|ax-system|$NS|g" -e "s|ko://github.com/google/ax/cmd/ax-server|localhost:5002/ax031-ax-server:v0.3.1|" -e "s|ko://github.com/google/ax/cmd/ax-controller|localhost:5002/ax031-ax-controller:v0.3.1|" -e "s|name: ax-controller$|name: ax031-controller|" deploy/$f.yaml > $E/30-$f.rendered.yaml
done
grep -n -E "image:|ax031|token|trust|audience|signerName" $E/30-ax-controller.rendered.yaml | cut -c1-160 > $E/31-controller-rendered-grep.txt
run 40-apply-redis "$KC apply -f $E/30-redis.rendered.yaml"
run 41-apply-controller "$KC apply -f $E/30-ax-controller.rendered.yaml"
run 42-apply-server "$KC apply -f $E/30-ax-server.rendered.yaml"
run 43-rollout "$KC -n $NS rollout status deploy/ax-redis --timeout=120s; $KC -n $NS rollout status deploy/ax-server --timeout=120s; $KC -n $NS rollout status deploy/ax-controller --timeout=120s"
$KC -n $NS get pods -o wide > $E/44-pods.txt 2>&1
$KC -n $NS logs deploy/ax-controller --tail=40 > $E/45-controller-start.log 2>&1
$KC -n $NS logs deploy/ax-server --tail=40 > $E/46-server-start.log 2>&1
cat > $E/50-task.yaml <<EOF
apiVersion: ax.io/v1alpha1
kind: Task
metadata:
  name: ax031-install-check
  atespace: default
spec:
  image: "localhost:5002/ax031-task-runner@$DIG"
  command: ["sleep", "infinity"]
EOF
AX="$PWD/bin/ax --context $C -n $NS"
run 51-ax-version "$AX version; $AX ctx"
run 52-apply-task "$AX apply -f $E/50-task.yaml"
sleep 8
run 53-describe "$AX describe task ax031-install-check; $AX get tasks"
$KC -n $NS logs deploy/ax-controller --since=2m > $E/54-controller-after-apply.log 2>&1
$KC -n $NS logs deploy/ax-server --since=2m > $E/55-server-after-apply.log 2>&1
$KC -n ate-system logs deploy/ate-api-server -c ate-api-server --since=2m 2>/dev/null | grep -i -E "ateapi.Control|unimplemented|unknown service|ax031" | tail -5 | cut -c1-400 > $E/56-ateapi-side.log
cat $E/steps.tsv $E/22-digests.txt $E/31-controller-rendered-grep.txt $E/44-pods.txt
for f in 41-apply-controller 43-rollout 45-controller-start 51-ax-version 52-apply-task 53-describe 54-controller-after-apply 55-server-after-apply 56-ateapi-side; do echo "== $f"; cut -c1-420 $E/$f.log | tail -14; done
