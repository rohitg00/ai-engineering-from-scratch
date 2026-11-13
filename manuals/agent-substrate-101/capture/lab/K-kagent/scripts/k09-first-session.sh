E=~/evidence/K-kagent/session1; mkdir -p "$E"; cd "$E"
now() { date +%s.%N; }
iso() { date -u +%FT%T.%3NZ; }
rm -f stop
sg docker -c "bash ~/scripts/tracer.sh $E/actor-trace.log $E/stop" &
sleep 1
echo "$(iso) session-create-start" | tee -a events.log
s=$(now); sg docker -c "kagent agent session create --agent lab-agent -o json" > session-create.json 2> session-create.err; e=$(now)
echo "$(iso) session-create-end dur=$(echo "$e - $s" | bc)" | tee -a events.log
cat session-create.json | head -40; cat session-create.err | head
SID=$(jq -r '.. | objects | (.id // .sessionId // .session_id // empty)' session-create.json | head -1)
echo "SID=$SID" | tee -a events.log
sg docker -c "kubectl ate get actor -a kagent -o json" > actors-after-create.json 2>/dev/null
head -c 1500 actors-after-create.json; echo
sleep 5
cat > turn1.txt <<'EOF'
RUN: mkdir -p /data/workspace && echo hello-from-turn1 > /data/workspace/note.txt; echo scratch-turn1 > /tmp/scratch.txt; echo rootfs-turn1 > /root-marker.txt 2>/dev/null; (nohup sleep 100000 >/dev/null 2>&1 &) ; sleep 0.2; echo "bg=$(pgrep -f 'sleep 100000' | tr '\n' ' ')"; echo "host=$(hostname)"; echo "uptime=$(cut -d' ' -f1 /proc/uptime)"; echo "pid1=$(ps -o etimes= -p 1 | tr -d ' ')"; echo "whoami=$(id -un) pwd=$(pwd)"
EOF
echo "$(iso) turn1-start" | tee -a events.log
s=$(now); sg docker -c "kagent agent invoke --session $SID -f turn1.txt -o json" > turn1.json 2> turn1.err; rc=$?; e=$(now)
echo "$(iso) turn1-end rc=$rc dur=$(echo "$e - $s" | bc)" | tee -a events.log
head -c 3000 turn1.json; echo; head -5 turn1.err
sleep 20
echo "$(iso) after-20s" | tee -a events.log
touch stop; sleep 0.5
echo ---trace; cat actor-trace.log | cut -c1-400
sg docker -c "kubectl -n kagent logs deploy/mock-llm --tail=50" > mock.log 2>&1; echo ---mock; cut -c1-700 mock.log
