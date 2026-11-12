set -u
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin:$HOME/bin:/usr/local/bin
echo "== host"; nproc; free -g | sed -n 2p; df -h / | tail -1
echo "== tools"; for t in docker kind kubectl kubectl-ate ax kagent ollama go helm; do printf "%s: " $t; command -v $t || echo none; done
echo "== clusters"; kind get clusters; kubectl config get-contexts -o name
echo "== docker"; docker ps --format '{{.Names}} {{.Status}}' | head -20
for c in kind-demo kind-kagent; do
  echo "== $c"; kubectl --context $c get nodes -o wide 2>&1 | cut -c1-140
  kubectl --context $c get pods -A --no-headers 2>&1 | awk '{print $1,$2,$3,$4}' | head -60
  kubectl --context $c get workerpools -A 2>&1 | head -20
done
echo "== ax dir"; ls ~ | head -40; ls ~/ax 2>/dev/null | head -30
echo "== net"; curl -s -m 10 -o /dev/null -w "ollama.com %{http_code} %{time_total}\n" https://ollama.com; curl -s -m 10 -o /dev/null -w "github %{http_code}\n" https://github.com; curl -s -m 10 -o /dev/null -w "hf %{http_code}\n" https://huggingface.co
