cd ~/evidence/K-kagent/parallel
date -u +%T; tail -4 events.log; wc -l timings.tsv; ls | head -30 | tr '\n' ' '; echo
cat port-forward.log | tail -3
ps -eo etimes,cmd | grep -E "kagent agent|port-forward|k17|kubectl" | grep -v grep | cut -c1-150 | head -12
