export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
cd ~/evidence/B-lifecycle
awk -F'\t' '$2=="state"{c[$3]++} END{for(k in c) print "idle-watch samples", k, c[k]}' 10-trace.tsv
grep -E "idle-watch|call-after|DONE" 10-trace.tsv
tail -2 10-trace.tsv
kubectl ate revert --help 2>&1 | grep -v Warning | head -20
kubectl ate revert actor --help 2>&1 | grep -v Warning | sed -n 1,14p
kubectl ate resume actor --help 2>&1 | grep -v Warning | sed -n 1,8p
kubectl ate get actor my-counter-1 -a ate-demo-counter 2>&1 | grep -v Warning
kubectl ate logs actor my-counter-1 -a ate-demo-counter --source=lifecycle 2>&1 | grep -v Warning | tail -4 | cut -c1-200
