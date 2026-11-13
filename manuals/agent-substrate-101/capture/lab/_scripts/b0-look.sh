export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
E=~/evidence/A-quickstart
sed -n '/NAMESPACE/,$p' "$E/60-state.log" | cut -c1-150 | head -60
echo "--- help"
kubectl ate --help 2>&1 | sed -n 1,30p
kubectl ate suspend actor --help 2>&1 | tail -12
kubectl ate proxy actor --help 2>&1 | tail -14
echo "--- actor yaml"
kubectl ate get actor my-counter-1 -a ate-demo-counter -o yaml
