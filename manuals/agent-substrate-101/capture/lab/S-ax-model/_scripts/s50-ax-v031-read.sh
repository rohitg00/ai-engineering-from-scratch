cd ~/ax
E=~/evidence/S-ax-model/50-ax-v031; mkdir -p $E
git log -1 --format='%H %cd %s' v0.3.1 > $E/01-tag.txt; git rev-list --count v0.3.1..HEAD >> $E/01-tag.txt
git show v0.3.1:go.mod | grep -n -E "substrate|^go " > $E/02-gomod-v031.txt; grep -n -E "substrate|^go " go.mod > $E/02-gomod-head.txt
git diff --stat v0.3.1 HEAD | tail -40 > $E/03-diffstat.txt
git log --oneline v0.3.1..HEAD | head -60 > $E/04-commits-since.txt
git show v0.3.1:docs/installation.md | grep -n -i -E "substrate|v0\.|version" | head -20 > $E/05-install-doc-v031.txt
git show v0.3.1:Makefile | grep -n -E "^[a-z-]+:|SUBSTRATE|VERSION|REGISTRY|KO_" | head -50 > $E/06-makefile-v031.txt
cat $E/01-tag.txt $E/02-gomod-v031.txt $E/02-gomod-head.txt; tail -3 $E/03-diffstat.txt; cat $E/04-commits-since.txt | head -40; cat $E/05-install-doc-v031.txt $E/06-makefile-v031.txt
echo == r3; cat ~/scripts/r3-build.sh | head -40; echo == r4; cat ~/scripts/r4-deploy.sh | head -70
date -u +%T; tail -1 ~/evidence/S-ax-model/20-kagent/loop/events.log
