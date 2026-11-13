E=~/evidence/K-kagent/inventory; mkdir -p "$E"; cd "$E"
cat ~/evidence/K-kagent/install/steps.tsv
run() { sg docker -c "$1" > "$2" 2>&1; }
run "kubectl get ns -o wide --show-labels" ns.txt
run "kubectl get pods -A -o wide" pods.txt
run "helm list -A -o yaml" helm-list.yaml
run "kubectl get crd -o custom-columns=NAME:.metadata.name,VERSIONS:.spec.versions[*].name --no-headers | grep -E 'ate.dev|kagent'" crds.txt
run "kubectl get pods -A -o json | jq -r '.items[] | .metadata.namespace as \$n | .metadata.name as \$p | .status.containerStatuses[]? | [\$n,\$p,.name,.image,.imageID] | @tsv'" images.tsv
run "kubectl get pods -A -o json | jq -r '.items[] | .metadata.namespace as \$n | .metadata.name as \$p | (.spec.initContainers // [])[] | [\$n,\$p,.name,.image] | @tsv'" init-images.tsv
run "kubectl get workerpools,sandboxconfigs -A -o yaml" workerpools.yaml
run "kubectl get harness,agenttemplate,agent,modelconfig,modelproviderconfig,egresspolicy,remotemcpserver,sandboxtemplate -A -o yaml" kagent-objects.yaml
run "kubectl get harness,agenttemplate,agent,modelconfig,egresspolicy,remotemcpserver,sandboxtemplate -A" kagent-objects.txt
run "kubectl get deploy,ds,sts,svc,networkpolicy -A" workloads.txt
for d in atenet-router atenet-egress ate-api-server ate-controller; do
  run "kubectl -n ate-system get deploy $d -o yaml" "deploy-$d.yaml"
done
run "kubectl -n ate-system get ds atelet -o yaml" ds-atelet.yaml
run "kubectl -n kagent get deploy kagent-controller -o yaml" deploy-kagent-controller.yaml
run "kubectl -n kagent get cm -o yaml" kagent-configmaps.yaml
for r in substrate substrate-atelet; do run "helm get values $r -n ate-system -a -o yaml" "helm-values-$r.yaml"; done
run "helm get values kagent -n kagent -o yaml" helm-values-kagent-user.yaml
run "kagent version" kagent-version.txt
run "kagent --help; kagent agent --help; kagent agent session --help; kagent agent session create --help; kagent agent session invoke --help; kagent agent session get --help; kagent sandbox --help" kagent-cli-help.txt
run "docker exec kagent-control-plane crictl images" node-images.txt
run "kubectl version -o yaml" kubectl-version.yaml
run "kubectl top pods -A" top.txt
echo "--- summary"
cat ns.txt | cut -c1-150
cat crds.txt
cut -f3,4,5 images.tsv | sort -u | cut -c1-230
cat kagent-objects.txt
cat kagent-version.txt
grep -n -i -E "agentgateway|envoy" images.tsv init-images.tsv | cut -c1-200
tail -30 ~/evidence/K-kagent/install/40-kagent-install.log | cut -c1-250
