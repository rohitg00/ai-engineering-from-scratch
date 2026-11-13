. ~/scripts/y-lib.sh
O=$EV/20-upgrade/00-install-rc3; mkdir -p $O; : > $O/steps.tsv
install_release rc3 v1.0.0-rc.3 yupg
cat $O/steps.tsv; df -h / | tail -1
