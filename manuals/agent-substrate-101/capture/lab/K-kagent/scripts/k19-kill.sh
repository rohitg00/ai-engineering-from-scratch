pkill -f k17-parallel.sh; touch ~/evidence/K-kagent/parallel/stop; sleep 1; pkill -f tracer.sh; ps -eo etimes,cmd | grep -E "k17|tracer|port-forward" | grep -v grep | cut -c1-120
