# Mitigação de Cold Start para LLMs Serverless

> Uma imagem de modelo de 20 GB leva 5-10 minutos (7B) a 20+ minutos (70B) para ir de cold para serving. Em um mundo verdadeiramente serverless, isso não é um warm-up — é uma indisponibilidade. As mitigações operam em cinco camadas: imagens de nós pré-semeadas (Bottlerocket na AWS, arquitetura de volume dual), streaming de modelo (NVIDIA Run:ai Model Streamer, nativo no vLLM), snapshots de memória GPU (checkpoints do Modal, até 10x mais rápido para reiniciar), pools quentes (`min_workers=1`), carregamento escalonado (pipeline NVMe→DRAM→HBM do ServerlessLLM, redução de latência de 10-200x) e migração ao vivo que move tokens de entrada (KB) em vez de KV cache (GB). Modal publica cold starts de 2-4s como piso; Baseten 5-10s padrão, sub-segundo com pre-warming. Esta aula te ensina a medir, orçar e empilhar as cinco camadas.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, simulador toy de caminho de cold start)
**Pré-requisitos:** Fase 17 · 02 (Economia de Plataformas de Inferência), Fase 17 · 03 (Auto-escalabilidade de GPU)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Enumerar as cinco camadas de mitigação de cold start e nomear uma ferramenta ou padrão em cada camada.
- Computar o tempo total de cold start como soma de (provisionamento do nó) + (download dos pesos) + (carregamento dos pesos no HBM) + (inicialização da engine) para um modelo 70B.
- Explicar por que migração ao vivo transfere tokens de entrada (KB) e não KV cache (GB) e qual é a penalidade (recomputação).
- Nomear o tradeoff do pool quente (pagar por GPU ociosa ou aceitar cauda de cold start) e o limiar de SLA no qual `min_workers > 0` se torna obrigatório.

## O Problema

Seu endpoint LLM serverless escala para zero durante a noite. Às 8h o tráfego dispara. O primeiro request espera enquanto:

1. Karpenter provisiona um nó GPU: 45-60s.
2. O container puxa uma imagem de 30 GB com os pesos: 120-300s.
3. A engine carrega os pesos no HBM: 45-120s dependendo do tamanho do modelo e velocidade do armazenamento.
4. vLLM ou TRT-LLM inicializa CUDA graphs, pool de KV cache, tokenizer: 10-30s.

Total: 220-510s (aproximadamente 3-8 minutos) antes de um token voltar. Seu SLA é 2s. Você implanta um pool quente (`min_workers=1`) e o problema parece desaparecer — mas agora você paga por uma GPU ociosa 24x7. Se seu serviço tem 5 produtos cada um com uma réplica quente, são 5 × 24 × 30 = 3.600 GPU-horas/mês independente de se um único usuário ligou.

Mitigação de cold start é como manter a economia serverless enquanto se aproxima a latência de sempre-ligado.

## O Conceito

### Camada 1 — imagens de nós pré-semeadas (Bottlerocket)

Na AWS, a arquitetura de volume dual do Bottlerocket separa SO de dados. Snapshot o volume de dados com sua imagem de container pré-baixada; referencie o ID do snapshot no seu `EC2NodeClass`. Nós novos bootam com os pesos já no NVMe local — passos 2 e parte do 3 desaparecem. Funciona com Karpenter nativamente. Economia típica: 2-4 minutos por cold start para modelos grandes.

Equivalente no GCP: imagens de VM custom com camadas de container pré-cozidas. Na Azure: snapshots de disco gerenciado com o mesmo padrão.

### Camada 2 — streaming de modelo (Run:ai Model Streamer)

Em vez de carregar o arquivo inteiro antes de responder ao primeiro request, faça streaming dos pesos para a memória GPU camada por camada e comece a processar assim que o primeiro bloco do transformer estiver resident. O NVIDIA Run:ai Model Streamer vem nativo no vLLM 2026. Funciona com S3, GCS e NVMe local. Corta o tempo de carregamento de pesos pela metade para modelos grandes ao sobrepor I/O com setup de compute.

### Camada 3 — snapshots de memória GPU (Modal)

Modal tira um checkpoint do estado da GPU (pesos, CUDA graphs, região de KV cache) após o primeiro carregamento. Reinícios subsequentes desserializam direto no HBM — 10x mais rápido que reinicializar. Isso é o mais perto de "bootar uma GPU quente em 2 segundos." Tradeoff: snapshots são por topologia de GPU, então se o Karpenter migrar você para um SKU diferente, você refaz o checkpoint.

### Camada 4 — pools quentes (min_workers=1)

Mitigação mais simples: manter uma réplica sempre pronta. Custo é a tarifa horária de uma GPU 24x7. A aritmética é brutal para modelos pequenos (você paga $0,85-$1,50/hr para evitar um cold start de 30s) e gentil para grandes (paga $4/hr para evitar um cold start de 5 minutos). O limiar de SLA onde pools quentes se tornam obrigatórios: tipicamente TTFT P99 < 60s em um modelo 70B+.

### Camada 5 — carregamento escalonado (ServerlessLLM)

ServerlessLLM trata armazenamento como uma hierarquia: NVMe (rápido mas grande), DRAM (médio mas escalonado), HBM (pequeno mas instantâneo). Pesos são pré-carregados no DRAM; carregamento sob demanda no HBM. O paper relata redução de latência de 10-200x em cold loads versus disco-para-HBM ingênuo. Adoção em produção é precoce mas integrações com o vLLM existem.

### Camada 6 — migração ao vivo (padrão bônus)

Quando um nó se torna indisponível (eviction em spot, drain de nó), o padrão tradicional é cold start de outra réplica e drain da fila de requests. Migração ao vivo move os tokens de entrada (kilobytes) para um destino que tem o modelo carregado e recomputa o KV cache no destino. Recomputação é mais barata que transferir GB de KV cache pela rede. Aplicável a implantações disagregadas.

### A matemática do pool quente

Para um serviço com SLA de P99 TTFT de 2s, a pergunta não é "pool quente sim/não" mas "quantas réplicas quentes, e quais camadas as recebem."

- Camadas interativas de alto valor (chat ao vivo, voice agent): `min_workers=1-2`.
- Camadas de batch em background (classificação noturna): aceitar scale-to-zero, cold start de 5-10 minutos tolerável.
- Tier premium: `min_workers` por tenant com capacidade dedicada.

### Meça antes de otimizar

Anatomia de cold start para um modelo 70B em um nó novo (ilustrativo):

| Fase | Tempo | Mitigação |
|------|-------|-----------|
| Provisionamento do nó | 50s | Bottlerocket + imagem pré-semeada, pool quente |
| Pull da imagem | 180s | Volume de dados pré-semeeado (eliminar) |
| Pesos para HBM | 75s | Model streamer (reduzir pela metade); snapshot GPU (eliminar) |
| Init da engine | 20s | Cache de CUDA graph persistente |
| Primeiro forward | 3s | Latência inerente mínima |
| **Total cold** | **328s** | |
| **Total com mitigações** | **~15s** | Redução de 22x |

### Números que você deve memorizar

- Cold start do Modal: 2-4s (com snapshots GPU).
- Cold start padrão do Baseten: 5-10s; sub-segundo com pre-warming.
- Cold start cru de 70B: 3-8 minutos.
- Model Streamer da Run:ai: ~2x de speedup no carregamento de pesos.
- Carregamento escalonado do ServerlessLLM: redução de latência de 10-200x (números do paper).

## Use

`code/main.py` modela um caminho de cold start com e sem cada mitigação. Reporta tempo total de cold start, custo do pool quente e a taxa de break-even de requests acima da qual o pool quente paga por si.

## Entregue

Esta aula produz `outputs/skill-cold-start-planner.md`. Dado SLA, tamanho de modelo e forma do tráfego, escolhe quais mitigations empilhar.

## Exercícios

1. Execute `code/main.py`. Compute a taxa de break-even de requests acima da qual uma réplica quente é mais barata que pagar o imposto de cold start via requests extras perdidos no SLO.
2. Você implanta um modelo 13B com SLA de P99 TTFT de 3s. Escolha a stack mínima de mitigação (menos camadas) que atinge isso.
3. Pré-semeio do Bottlerocket elimina o pull da imagem mas os pesos ainda carregam do snapshot para o HBM. Compute o wall-clock para um modelo 70B se o NVMe com snapshot lê a 7 GB/s.
4. Seu provedor serverless oferece snapshots GPU (Modal) e sua equipe recusa porque "snapshots vazam PII." Argumente os dois lados — qual é o risco real, e qual é a mitigação (snapshots efêmeros, criptografia, isolamento de namespace)?
5. Projete uma política de pool quente escalonada: quantas réplicas quentes para usuários pagos, usuários de trial e workloads de batch? Mostre a matemática.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Cold start | "a grande pausa" | Tempo do request ao primeiro token em uma réplica nova |
| Pool quente | "mínimo sempre-ligado" | `min_workers >= 1` para manter pelo menos uma réplica pronta |
| Imagem pré-semeada | "AMI cozida" | Imagem de nó com pesos de container pré-residentes |
| Bottlerocket | "SO de nó da AWS" | SO da AWS otimizado para container com suporte a snapshots de volume dual |
| Model streamer | "carregamento em streaming" | Sobrepor I/O de pesos com setup de compute |
| Snapshot GPU | "checkpoint para HBM" | Serializar estado da GPU pós-carregamento; desserializar no reinício |
| Carregamento escalonado | "NVMe + DRAM + HBM" | Hierarquia de camadas de armazenamento; carregar sob demanda |
| Migração ao vivo | "mover tokens" | Transferir entrada (KB), recomputar KV no destino |
| `min_workers` | "réplicas quentes" | Contagem mínima de keep-alive serverless |
| Scale-to-zero | "serverless completo" | Sem custo quando ocioso; aceitar o imposto total de cold start |

## Leitura Complementar

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) — benchmarks publicados e arquitetura de checkpoint do Modal.
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) — padrão de snapshot de volume de dados pré-semeeado.
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) — sobrepor carregamento de pesos com setup de compute.
- [Baseten — Cold-start mitigation](https://www.baseten.co/blog/cold-start-mitigation/) — playbook de pre-warming.
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) — design de carregamento escalonado.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — migração ao vivo para implantações disagregadas.
