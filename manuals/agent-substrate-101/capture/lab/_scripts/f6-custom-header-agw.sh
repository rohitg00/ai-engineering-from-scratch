DP=agentgateway
E=~/evidence/F-egress/$DP; cd "$E"
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
K() { kubectl ate "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
S=lab-f; WH=whoami.egress-target.svc.cluster.local
cat > P5.yaml <<EOF
rules:
- http:
    hostnames: ["$WH"]
    effects:
      replaceHeaders:
      - header: X-Api-Key
        credentialUri: ate-secret://k8s.io/default/cred-ns/api-token/token
EOF
K get egress-policy f-main -a $S -o json > live5.tmp
{ echo "metadata:"; echo "  uid: $(jq -r .metadata.uid live5.tmp)"; echo "  version: \"$(jq -r .metadata.version live5.tmp)\""; cat P5.yaml; } > applied-P5.yaml
K update egress-policy f-main -a $S -f applied-P5.yaml | tail -1
(kubectl ate proxy actor f-main -a $S 8202:80 > proxy-f-main-3.log 2>&1 &)
sleep 14
jq -n --arg c "curl -sS -m 8 -i -H 'X-Api-Key: placeholder-custom-header' http://$WH/ | grep -i -E 'HTTP/|x-api-key'" '{command:["sh","-c",$c],timeout:"20s"}' > req5.tmp
curl -s -m 30 -X POST -d @req5.tmp http://127.0.0.1:8202/process > s-custom-header.json
M1=$(cat 03-marker-granted.txt)
{
echo "## custom header injection (X-Api-Key), dataplane $DP"
jq -r .stdout s-custom-header.json | sed "s/$M1/<GRANTED-MARKER>/"
sleep 3
for c in $(kubectl -n ate-system get deploy atenet-egress -o jsonpath='{.spec.template.spec.containers[*].name}'); do
  kubectl -n ate-system logs deploy/atenet-egress -c $c --since=40s > "51-log-custom-$c.log" 2>&1
  echo "log $c: lines=$(wc -l < 51-log-custom-$c.log) real_credential=$(grep -c -F "$M1" 51-log-custom-$c.log) actor_placeholder=$(grep -c -F 'placeholder-custom-header' 51-log-custom-$c.log) header_name=$(grep -i -c 'x-api-key' 51-log-custom-$c.log)"
  grep -i -m3 'x-api-key' "51-log-custom-$c.log" | sed "s/$M1/<GRANTED-MARKER-LEAKED>/g" | cut -c1-420
  sed -i "s/$M1/<GRANTED-MARKER-LEAKED>/g" "51-log-custom-$c.log"
done
} | tee 50-custom-header.txt
pkill -f "proxy actor f-main"; rm -f live5.tmp req5.tmp
