cd ~/scripts
mv ~/evidence/Z-bursts/00-setup/20-growth.tsv ~/evidence/Z-bursts/00-setup/20-growth-first-pass-invalid.tsv
bash z1b-grow.sh > ~/logs/z1b.log 2>&1
bash z2-run.sh > ~/logs/z2.log 2>&1
echo ALL-DONE >> ~/logs/z1b.log
