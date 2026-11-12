set -u
E=~/evidence/S-ax-model/10-model; mkdir -p $E
t0=$(date +%s.%N)
docker rm -f ollama >/dev/null 2>&1
docker run -d --name ollama --network kind --cpus 12 -e OLLAMA_KEEP_ALIVE=24h -e OLLAMA_NUM_PARALLEL=1 -v ollama:/root/.ollama ollama/ollama > $E/01-docker-run.log 2>&1
for i in $(seq 60); do docker exec ollama ollama list >/dev/null 2>&1 && break; sleep 1; done
docker image inspect ollama/ollama --format '{{index .RepoDigests 0}} {{.Size}}' > $E/02-image.txt
docker exec ollama ollama --version >> $E/02-image.txt 2>&1
docker inspect ollama --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' > $E/03-ip.txt
for m in qwen2.5:1.5b qwen2.5:3b; do
  s=$(date +%s.%N); docker exec ollama ollama pull $m > $E/04-pull-$(echo $m | tr ':' '-').log 2>&1; e=$(date +%s.%N)
  echo "$m pull_seconds $(echo "$e - $s" | bc)" >> $E/05-pull-times.txt
done
docker exec ollama ollama list > $E/06-list.txt
for m in qwen2.5:1.5b qwen2.5:3b; do docker exec ollama ollama show $m > $E/07-show-$(echo $m | tr ':' '-').txt 2>&1; done
free -m | sed -n 2p > $E/08-guest-mem-after-pull.txt
cat $E/02-image.txt $E/03-ip.txt $E/05-pull-times.txt $E/06-list.txt
echo total $(echo "$(date +%s.%N) - $t0" | bc)
