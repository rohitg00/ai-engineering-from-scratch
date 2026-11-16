#!/bin/zsh
E=$HOME/.cache/aiefs-manuals-wip/langchain-research/additions/bench2/evals
L=$HOME/.cache/aiefs-manuals-wip/langchain-research/additions/bench2/logs
cd $HOME/.cache/aiefs-manuals-wip/langchain-research/repos/deepagents/libs/evals
step() { echo "### $(date +%H:%M:%S) $* :: $(uptime)" | tee -a $L/queue.log; }
for M in ${=MODELS:-qwen3:4b-instruct-2507-q4_K_M qwen3:8b qwen3:14b gpt-oss:20b}; do
  S=${M//:/_}
  step "e: deepagents evals $M"
  env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY OLLAMA_HOST=127.0.0.1:11435 LANGSMITH_TRACING=true LANGSMITH_API_KEY=offline \
    LANGSMITH_ENDPOINT=http://127.0.0.1:9 LANGSMITH_TEST_TRACKING=false PYTHONPATH=$E PYTHONDONTWRITEBYTECODE=1 \
    $E/venv/bin/python -m pytest tests/evals -p localplug -p no:cacheprovider --model ollama:$M -v --tb=line \
    --ignore=tests/evals/tau2_airline --ignore=tests/evals/memory_agent_bench \
    --eval-category file_operations --eval-category retrieval --eval-category tool_use --eval-category memory \
    --eval-category conversation --eval-category summarization \
    --evals-report-file $E/report-$S.json -o junit_family=xunit2 --junitxml=$E/junit-$S.xml > $L/evals-$S.log 2>&1
  step "e: done $M exit=$?"
done
