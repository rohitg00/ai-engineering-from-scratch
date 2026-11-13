set -u
export PATH=$HOME/ax/bin:$PATH:/usr/local/go/bin:$HOME/go/bin
export GOWORK=off
E=~/evidence/S-ax-model/70-agent-image; mkdir -p $E; cd ~/ax
el() { echo "$(date +%s.%N) - $1" | bc -l | xargs printf '%.3f'; }
echo "step	rc	seconds" > $E/steps.tsv
run() { n="$1"; shift; s=$(date +%s.%N); bash -c "$*" > "$E/$n.log" 2>&1; rc=$?; printf '%s\t%s\t%s\n' "$n" "$rc" "$(el $s)" >> $E/steps.tsv; }
BASE=localhost:5002/ax-task-runner@$(cat bin/ax-task-runner.digest)
run 01-build "make build-claude-code-image CONTAINER_CLI=docker CLAUDE_CODE_REPO=localhost:5002/ax-claude-code CLAUDE_CODE_BASE_IMAGE=$BASE"
run 02-push "docker push localhost:5002/ax-claude-code:latest"
docker image inspect localhost:5002/ax-claude-code:latest --format '{{index .RepoDigests 0}} {{.Size}}' > $E/03-image.txt 2>&1
docker run --rm --entrypoint claude localhost:5002/ax-claude-code:latest --version > $E/04-claude-version.txt 2>&1
docker rm -f ollama > /dev/null 2>&1
docker run -d --name ollama --network kind --ip 172.18.0.5 --cpus 12 -e OLLAMA_KEEP_ALIVE=24h -e OLLAMA_NUM_PARALLEL=1 -e OLLAMA_CONTEXT_LENGTH=32768 -v ollama:/root/.ollama ollama/ollama > $E/05-ollama-recreate.log 2>&1
for i in $(seq 60); do docker exec ollama ollama list >/dev/null 2>&1 && break; sleep 1; done
docker inspect ollama --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' >> $E/05-ollama-recreate.log
s=$(date +%s.%N)
curl -s -m 300 http://172.18.0.5:11434/v1/messages -H 'content-type: application/json' -H 'x-api-key: ollama' -H 'anthropic-version: 2023-06-01' -d '{"model":"qwen2.5:3b","max_tokens":40,"messages":[{"role":"user","content":"Say hello in five words."}]}' > $E/06-anthropic-format-check.json 2>&1
echo "anthropic format check seconds=$(el $s)" > $E/07-anthropic-format-check.txt
cat $E/steps.tsv; tail -4 $E/01-build.log | cut -c1-200; cat $E/03-image.txt $E/04-claude-version.txt $E/05-ollama-recreate.log $E/07-anthropic-format-check.txt; head -c 500 $E/06-anthropic-format-check.json; echo; docker exec ollama ollama ps
