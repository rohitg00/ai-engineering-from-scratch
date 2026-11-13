# shared helpers; source after setting E (evidence dir) and cd into it
now() { date +%s.%N; }
iso() { date -u +%FT%T.%3NZ; }
ev() { echo "$(iso) $*" | tee -a events.log; }
start_tracer() { rm -f stop; sg docker -c "bash ~/scripts/tracer.sh $PWD/actor-trace.log $PWD/stop" & sleep 0.6; }
stop_tracer() { touch stop; sleep 0.4; }
new_session() {
  s=$(now); sg docker -c "kagent agent session create --agent ${1:-lab-agent} -o json" > "session-$2.json" 2> "session-$2.err"; e=$(now)
  SID=$(jq -r '.session.id' "session-$2.json")
  printf '%s\tsession-create\t%s\t%.3f\n' "$(iso)" "$SID" "$(echo "$e - $s" | bc)" >> timings.tsv
  echo "$SID"
}
# turn NAME SID TEXTFILE -> writes NAME.json NAME.out, appends timings.tsv
turn() {
  ev "$1-start"
  s=$(now); sg docker -c "kagent agent invoke --session $2 -f $3 -o json" > "$1.json" 2> "$1.err"; rc=$?; e=$(now)
  d=$(echo "$e - $s" | bc)
  ev "$1-end rc=$rc dur=$d"
  st=$(jq -r '.task.status.state // "none"' "$1.json" 2>/dev/null)
  printf '%s\t%s\t%s\t%.3f\t%s\t%s\n' "$(iso)" "$1" "$2" "$d" "$rc" "$st" >> timings.tsv
  jq -r '.task.artifacts[]?.parts[]? | (.data.response.result // .text // empty)' "$1.json" > "$1.out" 2>/dev/null
}
wait_state() { # wait_state SID STATE timeout_s
  for i in $(seq 1 $(( $3 * 5 ))); do
    st=$(sg docker -c "kubectl ate get actor session-$1 -a kagent -o json" 2>/dev/null | jq -r '.. | objects | .state? // empty' | head -1)
    [ "$st" = "$2" ] && return 0
    sleep 0.2
  done
  return 1
}
