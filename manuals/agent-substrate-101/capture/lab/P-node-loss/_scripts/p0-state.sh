export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-multi
K() { kubectl ate --context $C "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
free -g | sed -n 2p; df -h / | tail -1
sg docker -c "docker ps -a --format '{{.Names}} {{.Status}}'"
kubectl --context $C get nodes -o wide --no-headers | awk '{print $1,$2,$3,$6}'
kubectl --context $C get pods -A -o wide --no-headers | grep -v -E "kube-system|local-path" | awk '{print $1,$2,$4,$8}'
kubectl --context $C get workerpool -A -o yaml | grep -E "^    name:|replicas:|cpu:|memory:|namespace:" | paste -sd' ' -
K get workers
K get actor-templates -a lab-n
K get actors -a lab-n
kubectl --context $C -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | select(.name=="atelet") | (.args|join(" "))' | cut -c1-300
echo == kind-kind
kubectl --context kind-kind get pods -A --no-headers | grep -v -E "Running|Completed" | head
kubectl --context kind-kind get pods -n ate-system --no-headers | awk '{print $1,$2,$3}'
kubectl ate --context kind-kind get actors -A 2>&1 | grep -v Warning | head -12
kubectl --context kind-kind get ns --no-headers | awk '{print $1}' | paste -sd' ' -
ls ~/evidence ~/scripts | head -80 | paste -sd' ' -
pgrep -af "\.sh" | grep -v pgrep | cut -c1-100 | head
