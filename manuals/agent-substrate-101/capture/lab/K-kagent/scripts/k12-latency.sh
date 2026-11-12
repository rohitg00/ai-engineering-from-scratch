E=~/evidence/K-kagent/latency; mkdir -p "$E"; cd "$E"; . ~/scripts/lib.sh
: > timings.tsv; : > events.log; rm -f actor-trace.log
echo "hello" > hello.txt
start_tracer
# series A: one session, 20 turns spaced 4 s apart (actor is SUSPENDED before each turn)
SA=$(new_session lab-agent A)
for i in $(seq -w 1 20); do turn "A-spaced-$i" "$SA" hello.txt >/dev/null; sleep 4; done
# series B: one session, 20 turns sent back to back (next turn starts as soon as the CLI returns)
SB=$(new_session lab-agent B)
for i in $(seq -w 1 20); do turn "B-b2b-$i" "$SB" hello.txt >/dev/null; done
sleep 4
# series C: 10 new sessions, first turn of each (actor starts from the golden snapshot)
for i in $(seq -w 1 10); do S=$(new_session lab-agent "C$i"); turn "C-first-$i" "$S" hello.txt >/dev/null; sleep 2; done
sleep 4
# series D: 8 sessions created, then one turn sent to all 8 at the same time
for i in $(seq 1 8); do new_session lab-agent "D$i" > "d$i.sid"; done
sleep 2
ev "D-parallel-start"
for i in $(seq 1 8); do ( turn "D-par-$i" "$(cat d$i.sid)" hello.txt >/dev/null ) & done
sleep 1.2
sg docker -c "kubectl ate get actor -a kagent" > D-actors-during.txt 2>/dev/null
sg docker -c "kubectl ate get worker" > D-workers-during.txt 2>/dev/null
sg docker -c "kubectl get pods -n kagent -o wide" > D-pods-during.txt 2>/dev/null
wait
ev "D-parallel-end"
sleep 5
sg docker -c "kubectl ate get actor -a kagent" > actors-final.txt 2>/dev/null
sg docker -c "kubectl ate get worker" > workers-final.txt 2>/dev/null
# session delete -> actor?
ev "delete-session $SB"
sg docker -c "kagent agent session delete $SB" > delete.out 2>&1
for i in 1 2 3 4 5 6 7 8 9 10; do sleep 1; sg docker -c "kubectl ate get actor session-$SB -a kagent" >> delete-watch.txt 2>&1; echo "--- $(iso)" >> delete-watch.txt; done
stop_tracer
sg docker -c "kubectl -n kagent logs deploy/kagent-controller --since=15m" > kagent-controller.log 2>&1
sg docker -c "kubectl -n ate-system logs deploy/atenet-router --since=15m" > atenet-router.log 2>&1
echo DONE >> events.log
