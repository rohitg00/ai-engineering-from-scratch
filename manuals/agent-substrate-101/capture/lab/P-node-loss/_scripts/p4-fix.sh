export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin
C=kind-multi; S=lab-n
E=~/evidence/P-node-loss; cd "$E"
K() { kubectl ate --context $C "$@" 2>&1 | grep -v '^Warning: no --token-file'; }
{
echo "### after every tag in the atespace was deleted with 'kubectl ate delete tag' (golden tags of the templates included)"
echo "## get actor-templates"; K get actor-templates -a $S
echo "## get tags"; K get tags -a $S
echo "## create actor from template ballast-50"; K create actor diag2 -a $S --template ballast-50
} > 96-golden-tag-deleted.txt 2>&1
F=$(find ~/evidence ~/ballast -name '32-tmpl-50.yaml' 2>/dev/null | head -1)
[ -z "$F" ] && { echo NO-TEMPLATE-FILE; exit 1; }
for mb in 0 50; do
  sed "s/name: ballast-$mb\$/name: nb-$mb/" "$(dirname $F)/32-tmpl-$mb.yaml" > 97-tmpl-nb-$mb.yaml
  K create actor-template -f 97-tmpl-nb-$mb.yaml >> 96-golden-tag-deleted.txt
done
for i in $(seq 1 60); do [ "$(K get actor-templates -a $S | grep -c -E 'nb-[0-9]+ +[0-9a-f-]{36}')" = 2 ] && break; sleep 4; done
{ echo "## new templates"; K get actor-templates -a $S; } >> 96-golden-tag-deleted.txt
K create actor diag3 -a $S --template nb-50 | tail -1 | cut -c1-160
K delete actor diag3 -a $S > /dev/null
[ "$(K get actor-templates -a $S | grep -c -E 'nb-[0-9]+ +[0-9a-f-]{36}')" = 2 ] || { echo TEMPLATES-NOT-READY; exit 1; }
sed -e 's/ballast-50/nb-50/g' -e 's/ballast-0/nb-0/g' -e 's/E2-DONE/E2B-DONE/' -e 's/start-e2/start-e2b/g' ~/scripts/p3-e2.sh > ~/scripts/p3b-e2.sh
mv 74-second-revert.tsv 74-second-revert.FAILED-no-golden-tag.tsv; mv 72-e2-survivor-full-then-scale.tsv 72-e2.FAILED-no-golden-tag.tsv
bash ~/scripts/p3b-e2.sh > ~/logs/p3b-e2.sh.log 2>&1
echo "P4-DONE $(date -u +%T)"
