# Mitigação do início no frio para LLM sem servidor

> Um modelo grande leva minutos para passar do frio para a servida: um modelo 70B em um nó fresco precisa de aproximadamente 3-8 minutos antes do primeiro token. Num mundo sem servidores, isso não é um aquecimento, é uma interrupção. As mitigações operam em cinco camadas: imagens pré-seed nodes (Bottlerocket na AWS, arco de duplo volume), streaming de modelo (NVIDIA Run:ai Model Streamer, nativo no vLLM), instantâneos de memória da GPU (punto de verificação Modal, até 10 vezes mais rápido reinicialização), pools quentes (`min_workers=1`O Modal publica 2-4s de início frio como um piso; Baseten 5-10s padrão, subsegundo com pré-aquecimento. Esta lição ensina a medir, orçar e empilhar as cinco camadas.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Enumere as cinco camadas de mitigação do arranque a frio e nomeie uma ferramenta ou padrão em cada camada.
- Calcule o tempo total de arranque a frio como a soma de (provimento de nó) + (pesos de descarga) + (pesos de carga no HBM) + (motor init) para um modelo 70B.
- Explique por que a migração ao vivo transfere tokens de entrada (KB) e não cache KV (GB) e qual é a penalidade (recomputamento).
- Nomear a compensação de polas de aquecimento (pagar por GPU em inatividade ou aceitar coda de arranque a frio) e o limiar de SLA em que `min_workers > 0`torna-se obrigatório.

## O problema

O seu endpoint do LLM sem servidor sobe para zero durante a noite, às 8 da manhã, o tráfego aumenta.

1. Karpenter fornece um nó GPU: 45-60s.
2. O recipiente tira uma imagem de 30 GB com pesos: 120-300s.
3. O motor carrega pesos em HBM: 45-120s dependendo do tamanho do modelo e da velocidade de armazenamento.
4. VLLM ou TRT-LLM inicializa gráficos CUDA, pool de cache KV, tokenizer: 10-30s.

Total: 220-510s (cerca de 3-8 minutos) antes de um token voltar.`min_workers=1`Se o seu serviço tem 5 produtos cada com uma réplica quente, isso é 5 × 24 × 30 = 3.600 horas de GPU / mês, quer um único usuário tenha ou não chamado.

A mitigação do início frio é como manter a economia sem servidor enquanto se aproxima a latência do sempre-on.

## O conceito

### Layer 1  imagens de nós pré-sementados (Bottlerocket)

Na AWS, a arquitetura de dois volumes do Bottlerocket separa o sistema operacional dos dados.`EC2NodeClass`. Novos nós de arranque com pesos já em local NVMe  passos 2 e parte de 3 desaparecem. Funciona com Karpenter nativo. Economia típica: 2-4 minutos por arranque a frio para modelos grandes.

Equivalente no GCP: imagens personalizadas de VM com camadas de contêiner pré-cozadas. No Azure: instantâneos de disco gerenciados com o mesmo padrão.

### Layer 2  streaming modelo (Run:ai Model Streamer)

Em vez de carregar o arquivo completo antes de responder ao primeiro pedido, transmita pesos para a memória GPU camada por camada e comece o processamento assim que o primeiro bloco de transformador estiver residente. O NVIDIA Run:ai Model Streamer é originário em vLLM 2026. Funciona com S3, GCS e NVMe local. Cortar o tempo de carga de peso em cerca de metade para modelos grandes por sobreposição de I / O com configuração de computação.

### Layer 3  Snapshots de memória GPU (Modal)

O Modal toma um ponto de verificação do estado da GPU (pesos, gráficos CUDA, região cache KV) após a primeira carga. Reinicializações subsequentes deserializam diretamente em HBM  10 vezes mais rápido do que reinicializando. Esta é a coisa mais próxima de "iniciar uma GPU quente em 2 segundos".

### Layer 4  Piscinas quentes (min_workers=1)

A redução mais simples: manter sempre uma réplica pronta. O custo é a taxa horária de uma GPU 24x7.$0.85-$1,50/hora para evitar um início frio de 30s) e gentil para os grandes (pagar $ 4 / hora para evitar um início frio de 5 minutos). O limiar SLA onde piscinas quentes se tornam obrigatórias: tipicamente TTFT P99 < 60s em um modelo 70B +.

### Layer 5  Carregamento em camadas (ServerlessLLM)

O ServerlessLLM trata o armazenamento como uma hierarquia: NVMe (rápido, mas grande), DRAM (médio, mas com camadas), HBM (minúsculo, mas instantâneo). Pesos são pré-carregados para DRAM; carga a pedido para HBM. O papel relata redução de latência de 10-200x em cargas frias em comparação com o navio disco para HBM. A adoção da produção é precoce, mas integrações com vLLM existem.

### Layer 6  Migração ao vivo (patrão de bônus)

Quando um nó fica indisponível (deslocamento de pontos, drenagem de nós), o padrão tradicional é iniciar a replica em frio e fazer uma fila de solicitações de drenagem. A migração ao vivo move os tokens de entrada (kilobytes) para um destino que tem o modelo carregado e recompõe o cache KV no destino. A recomputada é mais barata do que transferir GB de cache KV pela rede. Aplicável para implementações desagregadas.

### A matemática da piscina quente

Para um serviço com P99 TTFT SLA de 2s, a questão não é "poalha quente sim/não" mas "quantas réplicas quentes, e quais caminhos obtê-los".

- Caminhos interativos de alto valor (chat ao vivo, agente de voz): `min_workers=1-2`- Não .
- Caminhos de batch de fundo (classificação noturna): escala a zero aceita, início a frio de 5 a 10 minutos tolerável.
- Nível de prémio: `min_workers`por inquilino com capacidade específica.

### Messa antes de otimizar

Anatomia de arranque a frio para um modelo 70B num nó fresco (ilustre):

| Phase | Time | Mitigation |
|-------|------|-----------|
| Node provision | 50s | Bottlerocket + pre-seeded image, warm pool |
| Image pull | 180s | Pre-seeded data volume (eliminate) |
| Weights to HBM | 75s | Model streamer (halve); GPU snapshot (eliminate) |
| Engine init | 20s | Persistent CUDA graph cache |
| First forward | 3s | Min inherent latency |
| **Total cold** | **328s** | |
| **Total with mitigations** | **~15s** | 22x reduction |

### Números que você deve lembrar

- Começo a frio modal: 2-4 segundos (com instantâneos de GPU).
- Base de base de início a frio por defeito: 5 a 10 segundos; subsegundo com pré-aquecimento.
- Começo a frio de 70B: 3-8 minutos.
- Run:ai Modelo Streamer: ~ 2x aceleração de carga de peso.
- Carregamento em camadas de ServerlessLLM: redução de 10-200x de latência (números de papel).

```figure
cold-start-pipeline
```

## Usá-lo

`code/main.py`O relatório da Comissão sobre a aplicação do princípio da igualdade de oportunidades de trabalho e de emprego, que foi elaborado em 2002 e que foi publicado em 2002 e que foi publicado em 2002 e que foi publicado em 2002 e que foi publicado em 2002 e que foi publicado em 2002 e que foi publicado em 2002 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2006 e que foi publicado em 2007.

## Envia-o

Esta lição produz`outputs/skill-cold-start-planner.md`- Tendo em conta o SLA, o tamanho do modelo e a forma do tráfego, escolhe quais as medidas de mitigação a empilhar.

## Exercícios

1. Corra .`code/main.py`- Calcular a taxa de pedido de equilíbrio, acima da qual uma réplica quente é mais barata do que o pagamento do imposto de arranque a frio através de descontos adicionais de pedido no SLO.
2. Você implanta um modelo 13B com P99 TTFT SLA de 3s. Escolha a pilha de mitigação mínima (menos camadas) que o atinja.
3. A pré-sementação de botelhas elimina a atração da imagem, mas os pesos ainda carregam da imagem para o HBM.
4. O seu provedor sem servidor oferece instantâneos de GPU (Modal) e sua equipe recusa porque "snapshots vazam PII".
5. Desenhe uma política de piscina quente em camadas: quantas réplicas quentes para usuários pagos, usuários de teste e cargas de trabalho em lote? Mostre a matemática.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cold start | "the big pause" | Time from request to first token on a fresh replica |
| Warm pool | "always-on minimum" | `min_workers >= 1` to keep at least one replica ready |
| Pre-seeded image | "baked AMI" | Node image with container weights pre-resident |
| Bottlerocket | "AWS node OS" | AWS container-optimized OS with dual-volume snapshot support |
| Model streamer | "streaming load" | Overlap weights I/O with compute setup |
| GPU snapshot | "checkpoint to HBM" | Serialize post-load GPU state; deserialize on restart |
| Tiered loading | "NVMe + DRAM + HBM" | Hierarchy of storage tiers; load on demand |
| Live migration | "move tokens" | Transfer input (KB), recompute KV on destination |
| `min_workers` | "warm replicas" | Serverless minimum keep-alive count |
| Scale-to-zero | "full serverless" | No cost when idle; accept full cold-start tax |

## Mais leitura

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) Os valores de referência e a arquitetura dos pontos de controlo publicados pela Modal.
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) padrão de imagem de volume de dados pré-seeded.
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) Pesos de sobreposição de carga com configuração de cálculo.
- [Baseten — Cold starts](https://docs.baseten.co/deployment/autoscaling/cold-starts) Manual de jogo de pré- aquecimento.
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) Projeto de carga em camadas.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) migração ao vivo para as instalações desagregadas.
