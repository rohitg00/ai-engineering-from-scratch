cd ~/evidence/K-kagent/session1
sg docker -c "kubectl ate get actor -a kagent" 2>/dev/null
sg docker -c "kubectl ate get actor -a kagent -o json" 2>/dev/null > actors-after-turn1.json
jq -c '.actors[0] | del(.status.snapshots)' actors-after-turn1.json
jq -c '.actors[0].status.snapshots[] | {fidelity, generation, owner, localSnapshot, durableSnapshot}' actors-after-turn1.json | cut -c1-500
jq -r '[paths(scalars) | map(tostring) | join(".")] | .[]' actors-after-turn1.json | sed 's/\.[0-9]*\./.N./g' | sort -u | head -60
sg docker -c "kubectl ate get egress-policy --help" 2>&1 | sed -n 1,14p
