cd ~/evidence/K-kagent/latency
tail -3 events.log
wc -l timings.tsv
awk -F'\t' '$2!="session-create"{split($2,a,"-"); k=a[1]"-"a[2]; n[k]++; s[k]+=$4; v[k]=v[k]" "$4} END{for(k in n) printf "%s n=%d mean=%.3f :%s\n",k,n[k],s[k]/n[k],v[k]}' timings.tsv | sort
awk -F'\t' '$2=="session-create"{n++; s+=$4; v=v" "$4} END{printf "session-create n=%d mean=%.3f :%s\n",n,s/n,v}' timings.tsv
