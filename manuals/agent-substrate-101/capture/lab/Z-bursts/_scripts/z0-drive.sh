cd ~/scripts
bash z1-setup.sh > ~/logs/z1.log 2>&1
grep -q '^DONE$' ~/evidence/Z-bursts/00-setup/steps.tsv && bash z2-run.sh > ~/logs/z2.log 2>&1
echo ALL-DONE >> ~/logs/z1.log
