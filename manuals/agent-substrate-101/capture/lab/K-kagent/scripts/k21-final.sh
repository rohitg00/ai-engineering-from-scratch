E=~/evidence/K-kagent; cd "$E"; . ~/scripts/lib.sh
mkdir -p delete; cd delete; : > events.log; : > timings.tsv
ls ../latency | grep -i delete; cat ../latency/delete.out 2>/dev/null | head -3
SID=$(new_session lab-agent del)
echo hello > hello.txt; turn del-turn1 $SID hello.txt >/dev/null
sleep 2
sg docker -c "kubectl ate get actor session-$SID -a kagent" 2>/dev/null | tail -1 | cut -c1-150 | tee before-delete.txt
ev "delete-start"; sg docker -c "kagent agent session delete $SID" > delete.out 2>&1; ev "delete-end rc=$?"; head -3 delete.out
for i in 1 2 3 4 5 6; do echo "$(iso) $(sg docker -c "kubectl ate get actor session-$SID -a kagent" 2>&1 | grep -v Warning | tail -1 | cut -c1-170)" | tee -a delete-watch.txt; sleep 1; done
sg docker -c "kagent agent session get $SID -o json" 2>&1 | head -c 400; echo
cd "$E"
echo "--- resume outliers (>1s)"
python3 - logs/actor-state-changes.tsv <<'EOF'
import sys, csv, datetime
def p(s):
    s = s.rstrip('Z'); a, _, b = s.partition('.'); return datetime.datetime.strptime(a + '.' + (b + '000000')[:6], '%Y-%m-%dT%H:%M:%S.%f')
start = {}
for t, name, op, state in csv.reader(open(sys.argv[1]), delimiter='\t'):
    k = (name, op)
    if state in ('resuming', 'suspending'): start[k] = (p(t), t)
    elif state in ('running', 'suspended') and k in start:
        d = (p(t) - start[k][0]).total_seconds(); t0 = start.pop(k)[1]
        if d > 1: print(op, name, t0, '->', t, f'{d:.3f}s')
EOF
echo "--- router park/503 lines"; grep -h -i -E "park|503" logs/atenet-router-*.log | cut -c1-400 | head -4
echo "--- controller log around the slow turn3 (10:19:35-10:19:41)"; grep -h -E '10:19:3[5-9]|10:19:4[01]' session1/kagent-controller.log | cut -c1-360 | head -14
echo "--- golden build"; cat agent/agent-conditions.trace | head -3; cat agent/agent-conditions.trace | tail -2; cat agent/apply-agent.log | head -2
grep -h '"Actor state changed"' logs/ate-api-server-*.log | jq -r 'select(.["ate.actor.name"]|startswith("session-")|not) | [.time, .["ate.actor.name"], .["ate.actor.operation.name"], .["ate.actor.state"]] | @tsv' | sort | head -12
echo "--- worker pod security + resources"
sg docker -c "kubectl -n kagent get pod -l ate.dev/worker-pool=kagent-default -o json" | jq '.items[0].spec | {hostNetwork, hostPID, serviceAccountName, containers: [.containers[] | {name, image, securityContext, resources}], volumes: [.volumes[] | {name, hostPath: (.hostPath.path // null)}]}' > inventory/worker-pod-spec.json; jq -c . inventory/worker-pod-spec.json | cut -c1-900
sg docker -c "kubectl ate get actor -a kagent" 2>/dev/null > inventory/actors-end.txt; awk 'NR>1{print $4}' inventory/actors-end.txt | sort | uniq -c
sg docker -c "kubectl ate get worker" 2>/dev/null > inventory/workers-end.txt; cut -c1-200 inventory/workers-end.txt
sg docker -c "kubectl -n kagent get secret,cm" > inventory/kagent-secrets-configmaps-names.txt 2>&1
sg docker -c "kubectl get clustertrustbundle" > inventory/clustertrustbundles.txt 2>&1; cat inventory/clustertrustbundles.txt | cut -c1-120
sg docker -c "kubectl get pods -A -o wide" > inventory/pods-end.txt 2>&1; grep -v Running inventory/pods-end.txt | cut -c1-120
cp ~/scripts/*.sh ~/scripts/*.py ~/scripts/*.yaml "$E/scripts/" 2>/dev/null || { mkdir -p "$E/scripts"; cp ~/scripts/* "$E/scripts/"; }
cp ~/logs/*.log "$E/logs/" 2>/dev/null
cd ~/evidence && tar czf ~/K-kagent.tgz K-kagent && ls -la ~/K-kagent.tgz && sha256sum ~/K-kagent.tgz && du -sh K-kagent && find K-kagent -type f | wc -l
