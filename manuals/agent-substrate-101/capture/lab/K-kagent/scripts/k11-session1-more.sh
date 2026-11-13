E=~/evidence/K-kagent/session1; cd "$E"; . ~/scripts/lib.sh
SID=01a1cf43-d760-747a-b907-5e0640126e4e
mv actor-trace.log actor-trace-broken.log 2>/dev/null
start_tracer
cat > turn2.txt <<'EOF'
RUN: echo "note=$(cat /data/workspace/note.txt 2>&1)"; echo "scratch=$(cat /tmp/scratch.txt 2>&1)"; echo "bg=$(pgrep -x sleep | tr '\n' ' ')"; echo "uptime=$(cut -d' ' -f1 /proc/uptime)"; ps -o pid,etime,args | head -12; echo ---env; env | grep -i -E 'key|token|openai|proxy|ssl|ca_|kagent' | cut -c1-110; echo ---mounts; ls -la /data /run/kagent 2>&1 | head -24; df -h /data /tmp / 2>&1
EOF
turn turn2 $SID turn2.txt
cat > turn3.txt <<'EOF'
RUN: echo "uptime=$(cut -d' ' -f1 /proc/uptime)"; echo "bg=$(pgrep -x sleep | tr '\n' ' ')"; (nohup sleep 100000 >/dev/null 2>&1 &); sleep 0.2; echo "bg-now=$(pgrep -x sleep | tr '\n' ' ')"
EOF
turn turn3-back-to-back $SID turn3.txt
cat > turn4.txt <<'EOF'
RUN: echo "uptime=$(cut -d' ' -f1 /proc/uptime)"; echo "bg=$(pgrep -x sleep | tr '\n' ' ')"
EOF
turn turn4-back-to-back $SID turn4.txt
sleep 6
cat > turn5.txt <<'EOF'
RUN: echo "A http-outside:"; wget -S -O- -T 8 http://example.com 2>&1 | head -6; echo "B https-outside:"; wget -S -O- -T 8 https://example.com 2>&1 | head -6; echo "C dns-outside:"; nslookup example.com 2>&1 | tail -5; echo "D dns-allowed:"; nslookup mock-llm.kagent.svc.cluster.local 2>&1 | tail -4; echo "E allowed-host:"; wget -q -O- -T 8 http://mock-llm.kagent.svc.cluster.local:8080/v1/models 2>&1 | head -3; echo; echo "F raw-ip:"; wget -O- -T 5 http://1.1.1.1 2>&1 | head -3; echo "G kube-api:"; wget -O- -T 5 --no-check-certificate https://kubernetes.default.svc.cluster.local 2>&1 | head -3; echo "H short-name:"; wget -q -O- -T 5 http://mock-llm.kagent:8080/v1/models 2>&1 | head -3; echo; echo "I resolv:"; cat /etc/resolv.conf; ip addr 2>&1 | grep -E 'inet |^[0-9]' | head -8; ip route 2>&1 | head
EOF
turn turn5-egress $SID turn5.txt
sleep 5
stop_tracer
sg docker -c "kubectl ate get egress-policy session-$SID -a kagent -o yaml" > egress-policy-actor.yaml 2>&1
sg docker -c "kubectl ate get actor-template lab-agent-7f643ac37f02 -a kagent -o yaml" > actor-template.yaml 2>&1
sg docker -c "kubectl -n ate-system logs deploy/atenet-egress --since=3m" > atenet-egress.log 2>&1
sg docker -c "kubectl -n ate-system logs deploy/atenet-router --since=10m" > atenet-router.log 2>&1
sg docker -c "kubectl -n kagent logs deploy/kagent-controller --since=10m" > kagent-controller.log 2>&1
sg docker -c "kubectl -n kagent logs deploy/mock-llm" > mock.log 2>&1
sg docker -c "kubectl -n kagent get egresspolicy -o yaml" > k8s-egresspolicies.yaml 2>&1
for t in turn2 turn3-back-to-back turn4-back-to-back turn5-egress; do echo "=== $t"; cat $t.out | awk 'NR==1 || !/^TOOL_OUTPUT_BEGIN/' | head -60 | cut -c1-200; done
echo === timings; cat timings.tsv
echo === trace; cut -c1-330 actor-trace.log
echo === egress policy; cat egress-policy-actor.yaml | head -80
wc -l atenet-egress.log atenet-router.log kagent-controller.log
