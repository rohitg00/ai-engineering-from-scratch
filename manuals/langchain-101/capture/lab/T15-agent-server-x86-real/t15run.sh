cd "$(dirname "$0")/t15rapp"
label=$1; nj=$2; shift 2
export T15_LOG=$(pwd)/../t15r-events.jsonl LANGSMITH_TRACING=false LANGGRAPH_CLI_NO_ANALYTICS=1
args="--no-browser --no-reload --host 127.0.0.1 --port 2024"
[ -n "$nj" ] && args="$args --n-jobs-per-worker $nj"
${VENV:-.venv}/bin/langgraph dev $args > ../server-$label.log 2>&1 &
SP=$!
for i in $(seq 1 120); do curl -s 127.0.0.1:2024/ok >/dev/null 2>&1 && break; sleep 1; done
echo "server up after $i s"
${VENV:-.venv}/bin/python -c "import importlib.metadata as m; print({p: m.version(p) for p in ['langgraph-cli','langgraph-api','langgraph-runtime-inmem','langgraph','langchain','langchain-ollama']})" > ../versions-$label.txt
cd ..
for part in "$@"; do
  case $part in
    floor) ${VENV:-.venv}/bin/python -W ignore t15r_drive.py floor --out 03-floor.jsonl --label $label --n 10 ;;
    load) ${VENV:-.venv}/bin/python -W ignore t15r_drive.py load --out 02-load.jsonl --label $label --levels 1,4,16 --min-runs 10 ;;
    workers) ${VENV:-.venv}/bin/python -W ignore t15r_drive.py workers --out 04-workers.jsonl --label $label --n 10 ;;
    recursion) ${VENV:-.venv}/bin/python -W ignore t15r_drive.py recursion --out 01-recursion.jsonl --label $label --reps 3 --cap 120 ;;
    smoke) ${VENV:-.venv}/bin/python -W ignore t15r_drive.py floor --out 00-smoke.jsonl --label $label --n 2 ;;
  esac
done
kill $SP; sleep 2; pkill -f "langgraph dev"; sleep 1
pgrep -fa "langgraph dev" || echo "server stopped"
