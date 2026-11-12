DP=agentgateway
E=~/evidence/G-dataplane/$DP; mkdir -p "$E"; cd "$E"
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
N=ate-system
kubectl -n $N get pods -o wide > 01-pods.txt
for d in atenet-router atenet-egress; do
  kubectl -n $N get deploy $d -o yaml > 02-deploy-$d.yaml
  kubectl -n $N get deploy $d -o json | jq -r '.spec.template.spec | (.initContainers // [] | map(. + {init:true})) + .containers | .[] | [(.init // false | tostring), .name, .image, ((.args // []) | join(" ")), ((.env // []) | map(.name + "=" + (.value // "<ref>")) | join(" ")), ((.ports // []) | map((.name // "") + ":" + (.containerPort|tostring)) | join(",")), ((.volumeMounts // []) | map(.name + "->" + .mountPath) | join(","))] | @tsv' > 03-containers-$d.tsv
  kubectl -n $N get deploy $d -o json | jq '.spec.template.spec.volumes' > 04-volumes-$d.json
  kubectl -n $N get deploy $d -o json | jq '[.spec.template.spec.containers[] | {name, securityContext, resources}]' > 05-sec-res-$d.json
done
kubectl -n $N get svc -o wide > 06-services.txt
kubectl -n $N get svc atenet-router atenet-egress -o yaml > 06-services-atenet.yaml 2>&1
kubectl -n $N get networkpolicy -o yaml > 07-networkpolicies.yaml
kubectl -n $N get networkpolicy > 07-networkpolicies.txt
kubectl -n $N get cm -o name > 08-configmaps.txt
kubectl -n $N get secret -o custom-columns=NAME:.metadata.name,TYPE:.type,KEYS:.data --no-headers | sed -E 's/:[A-Za-z0-9+\/=]{20,}/:<redacted>/g' | cut -c1-200 > 09-secrets-names.txt
for cm in $(kubectl -n $N get cm -o name | grep -i -E 'atenet|agentgateway|envoy|egress|router'); do
  kubectl -n $N get $cm -o yaml > "10-$(basename $cm).yaml"
done
: > 11-listening.txt
for d in atenet-router atenet-egress; do
  for p in $(kubectl -n $N get pod -l app=$d -o name 2>/dev/null; kubectl -n $N get pod -o name | grep "$d" ); do
    pn=$(basename $p)
    for c in $(kubectl -n $N get pod $pn -o jsonpath='{.spec.containers[*].name}'); do
      cid=$(kubectl -n $N get pod $pn -o json | jq -r --arg c $c '.status.containerStatuses[] | select(.name==$c) | .containerID' | sed 's#containerd://##')
      pid=$(sg docker -c "docker exec kind-control-plane crictl inspect -o go-template --template '{{.info.pid}}' $cid" 2>/dev/null)
      echo "## $pn / $c pid=$pid" >> 11-listening.txt
      sg docker -c "docker exec kind-control-plane nsenter -t $pid -n ss -ltnpH" >> 11-listening.txt 2>&1
      echo "## env $pn / $c" >> 12-proc-env.txt
      sg docker -c "docker exec kind-control-plane sh -c 'tr \"\\0\" \"\\n\" < /proc/$pid/environ | grep -E \"LOG|RUST|LEVEL|DEBUG\"; tr \"\\0\" \" \" < /proc/$pid/cmdline'" >> 12-proc-env.txt 2>&1
      echo >> 12-proc-env.txt
    done
    break
  done
done
sort -u -o 11-listening.txt.tmp 11-listening.txt 2>/dev/null; rm -f 11-listening.txt.tmp
sg docker -c "docker exec kind-control-plane crictl stats" 2>/dev/null > 13-crictl-stats-all.txt
sg docker -c "docker exec kind-control-plane crictl ps" 2>/dev/null | grep -E 'CONTAINER|atenet|envoy|agentgateway|ext-proc|sdsmint' > 13-crictl-ps-atenet.txt
for id in $(awk 'NR>1{print $1}' 13-crictl-ps-atenet.txt); do sg docker -c "docker exec kind-control-plane crictl stats $id" 2>/dev/null | tail -1; done > 13-crictl-stats-atenet.txt
for d in atenet-router atenet-egress; do
  for c in $(kubectl -n $N get deploy $d -o jsonpath='{.spec.template.spec.containers[*].name}'); do
    kubectl -n $N logs deploy/$d -c $c --tail=300 > 14-logs-$d-$c.log 2>&1
  done
done
kubectl get pods -A -o json | jq -r '.items[] | .metadata.namespace as $n | .metadata.name as $p | .spec.containers[] | [$n,$p,.name,.image] | @tsv' > 15-all-images.tsv
sg docker -c "docker exec kind-control-plane crictl images --digests" > 16-node-images.txt 2>&1
echo "== containers"; for d in atenet-router atenet-egress; do echo "-- $d"; cut -f1-3,5-7 03-containers-$d.tsv | cut -c1-900; done
echo "== services"; cat 06-services.txt | cut -c1-170
echo "== netpol"; cat 07-networkpolicies.txt
echo "== listening"; awk "/^##/{h=\$0; next} {print h \" | \" \$4 \" \" \$6}" 11-listening.txt | sed -E "s/,fd=[0-9]+//" | sort -u | cut -c1-170
echo "== env"; grep -v -E "^RUSTFS|^$" 12-proc-env.txt | cut -c1-700
echo "== stats"; cat 13-crictl-ps-atenet.txt | cut -c1-150; cat 13-crictl-stats-atenet.txt
