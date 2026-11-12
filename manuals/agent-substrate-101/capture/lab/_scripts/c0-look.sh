export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
cd ~/substrate
echo "--- counter.yaml.tmpl"; grep -v -E '^\s*#|^\s*$' demos/counter/counter.yaml.tmpl
echo "--- counter-template.yaml.tmpl"; grep -v -E '^\s*#|^\s*$' demos/counter/counter-template.yaml.tmpl
echo "--- live workerpool"; kubectl get workerpool counter -n ate-demo-counter -o yaml | sed -n '/^spec:/,$p'
echo "--- live template"; kubectl ate get actor-template counter -a ate-demo-counter -o yaml 2>/dev/null
echo "--- counter.go head"; sed -n '/^func main/,/^}/p' demos/counter/counter.go | head -60
echo "--- flags"; kubectl -n ate-system get deploy ate-api-server -o json | jq -r '.spec.template.spec.containers[] | .name + " " + (.args // [] | join(" "))' | cut -c1-900
kubectl -n ate-system get ds atelet -o json | jq -r '.spec.template.spec.containers[] | .name + " " + (.args // [] | join(" "))' | cut -c1-700
