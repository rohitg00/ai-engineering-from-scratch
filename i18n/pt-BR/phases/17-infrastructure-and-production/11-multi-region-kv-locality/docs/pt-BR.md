# Serviço de Mestrado em Direito Multiregional e localização de cache de KV

> O equilíbrio de carga de round-robin é ativamente prejudicial para a inferência LLM em cache. Uma solicitação que não aterrissa no nó que mantém seu prefixo paga preenchimento total  aproximadamente 800 ms em P50 em um prompt longo versus ~ 80 ms com um cache hit. Em 2026, o padrão de produção é um roteador consciente de cache (vLLM Router in Rust, llm-d router) que consome eventos de cache KV e rotas em prefixo-hash match. A pesquisa recente (GORGO) torna a latência de rede transregional um termo explícito no objetivo de roteamento. As ofertas comerciais de "infereção transregional" (infereção transregional Bedrock, gateways multi-cluster GKE) tratam a inferência como opaca  eles lidam com a disponibilidade, não com a TTFT. A JPMorgan e a Clínica Mayo fizeram um falha-over no leste em Novembro de 2024 em 22 minutos. A realidade do DR: 32% das falhas do LLM DR são porque as equipes fizeram backup de pesos, mas esqueceram arquivos de tokenizer ou configurações de quantização.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy prefix-cache-aware router simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Explique por que as rupturas de equilíbrio de carga em round-robin cacham a inferência e quantifique a penalidade TTFT.
- Diagrama de um roteador consciente de cache: entradas (eventos de cache KV), algoritmo (paralelas de prefixo-hash), tie-breaker (utilização de GPU).
- Nomear o driver de falha de 32% de DR para LLMs (arquivos de tokenizer / configurações de quantização faltantes) e indicar uma lista de verificação de DR de três arquivos.
- Distinguir as ofertas comerciais transnacionais (Bedrock CRI, GKE Multi-Cluster Gateway) das rotas de veículos de transporte informático.

## O problema

O seu serviço funciona em US-East-1, US-West-2, e EU-West-1. Você coloca um ALB na frente com round-robin. Prefixo cache taxa de hit na produção cai para 8%. TTFT P50 triplica.

O round-robin é o ideal para serviços sem estado. A inferência LLM é estadual por design. O cache KV codifica tudo o que o modelo viu. Routing blind é rotear para o cache errado.

Separadamente, sua equipe tem um plano DR. Você faz backup de pesos do modelo para S3 cross-região. Uma interrupção regional acontece; você tenta falhar; a réplica se recusa a iniciar. Você esqueceu tokenizer.json, a configuração de quantização e a configuração de escalação RoPE estavam em um balde separado que você não sincronizou.

O serviço de LLM multi-regional é um problema de cache, um problema de roteamento e um problema de higiene DR  não um problema de equilíbrio de carga.

## O conceito

### Roteamento consciente de cache

O roteador seleciona o replicador com a correspondência, fazendo com que o seu dispositivo seja usado para fazer a correção de dados.

**vLLM Router**(Rust, 2026 production stack): subscribe a `kv.cache.block_added`eventos, mantém um índice de prefixo-hash → réplica, rotas com $O(1)$Caem até à menor profundidade da fila quando não há correspondência.

**llm-d router**O mesmo padrão, Kubernetes nativo. Publica eventos através da API ControlPlane.

**SGLang RadixAttention**(Fase 17 · 06) é o equivalente intra-replica.

### Números

TTFT P50 em um sinal de 2K, Llama 3.3 70B FP8, H100:
- Cachegueiro (sima réplica, prefixo residente): ~80 ms.
- Falha de cache (preenchimento a frio): ~ 800 ms.

Se o seu roteador atingir 60-80% do cache de prefixos em réplicas, você aproxima o desempenho de uma única réplica na capacidade de N-replica. Se atingir 10%, você aproxima a escalação ingênua.

### Trans-região tem uma nova restrição  latência de rede

RTT interregional:
- US-East-1  US-West-2: ~65 ms.
- EUA-Leste-1  Eu-Oeste-1: ~75 ms.
- US-East-1  ap-southeast-1: ~ 220 ms.

Se o roteamento leva uma solicitação de us-east-1 para um prefixo quente em ap-southeast-1, o prefill salvado (800 → 80 ms, portanto 720 ms) reduz para cerca de 500 ms uma vez que o ~ 220 ms RTT é pago, e a margem desaparece se a região remota faz fila a solicitação ou já despejou o prefixo. GORGO (2026 pesquisa) faz isso explícito  minimizar `prefill_time + network_latency`A resposta é manter o roteamento regional, exceto em prefixos massivos de vários MB onde prefill domina.

### A "infereção transregional" comercial não ajuda aqui

A inferência transregional AWS Bedrock encaminha automaticamente as solicitações para outras regiões durante a pressão de capacidade. Optimiza a disponibilidade, não o TTFT, e trata a inferência como opaca.

Ainda precisa de um roteador de cache de camada de aplicativo mesmo quando usas estes. Eles lidam com o caso "us-east-1 está em chamas". Roteamento de cache-consciente lidam com o caso TTFT.

### DR higiene  o problema dos arquivos faltantes de 32%

Estatisticas de 2026 citadas amplamente: 32% das falhas de LLM DR acontecem porque as equipes fizeram backup de pesos, mas esqueceram:

- `tokenizer.json`ou `tokenizer.model`
- Configurações de quantização (`quantize_config.json`, escalas AWQ, pontos zero GPTQ)
- Configurações específicas do modelo (escalagem RoPE, máscaras de atenção, modelos de bate-papo)
- Configuração do motor (`vllm_config.yaml`, padrões de amostragem, manifesto de adaptador LoRA)

A correcção é um manifesto mínimo de DR de três arquivos:

1. Todos os arquivos sob o modelo HF repo (pesos + configurações + tokenizer).
2. Configuração de serviço específica do motor.
3. Manifesto de implantação (K8s YAML, Dockerfile, bloqueio de dependência).

O exercício do JPMorgan US-East-1 recuperou 22 minutos em novembro de 2024 só porque o livro de jogo foi ensaiado.

### Residência de dados é ortogonal

O cliente PHI da UE não pode sair da UE. Se o seu roteador consciente do cache enviar uma solicitação de Paris para us-east-1 para uma correspondência de prefixo, você violou o GDPR independentemente do ganho TTFT. Partir roteadores por fronteira de residência antes de otimizar o cache.

### Números que você deve lembrar

- Cache hit vs miss TTFT gap: ~ 10x (80 ms vs 800 ms em 2K prompt).
- RTT interregional EUA-UE: ~75 ms.
- Falha de DR: 32% falha em configurações de tokenizer/quantico.
- JPMorgan us-east-1 falha de nov. 2024: 22 minutos (30 minutos SLA).

```figure
cache-aware-router
```

## Usá-lo

`code/main.py`Simula três estratégias de roteamento (round-robin, cache-consciente regional, cache-consciente global) em uma carga de trabalho multi-região.

## Envia-o

Esta lição produz`outputs/skill-multi-region-router.md`- Tendo em conta as regiões, as restrições de residência e a SLA, elabora um plano de rotação.

## Exercícios

1. Corra .`code/main.py`A que comprimento de rotação interregional supera a rotação local, dada a RTT de 75 ms?
2. A taxa de acessos no cache cai de 70% para 12%. Diagnóstico de três possíveis causas e os observaveis que confirmam cada uma.
3. Desenhar um manifesto DR para um modelo 70B AWQ-quantizado servido em vLLM com 5 adaptadores LoRA. Lista todos os arquivos e configuração.
4. Argumentar se a inferência transregional de Bedrock é "suficiente" para uma fintech com SLOs TTFT rigorosos. Citar comportamentos específicos.
5. Uma solicitação de origem de Paris corresponde a um prefixo no EUA-Leste-1.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cache-aware routing | "smart LB" | Route on prefix-hash match to KV-cache-holding replica |
| KV-cache events | "cache pub-sub" | Replicas publish block add/evict; router indexes |
| Prefix hash | "cache key" | Hash of first N tokens used as router lookup |
| GORGO | "cross-region routing research" | arXiv 2602.11688; network latency as explicit term |
| Cross-region inference | "Bedrock CRI" | AWS product; availability failover, not TTFT awareness |
| DR manifest | "the backup list" | Every file needed to restore — not just weights |
| Data residency | "GDPR boundary" | Legal constraint on which region sees user data |
| RTT | "round-trip time" | Network latency; 75 ms US-EU, 220 ms US-APAC |
| LLM-aware LB | "cache-hit LB" | Cache-aware router as a product category |

## Mais leitura

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) Reutilização de caché KV transnacional com prazo de latência da rede.
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) Documentação de falha de disponibilidade.
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) Fonte de roteador consciente de cache.
