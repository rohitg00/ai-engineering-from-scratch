# Serviço Multi-Region e Localidade de KV Cache

> Round-robin load balancing é ativamente prejudicial para inferência LLM com cache. Um request que não cai no node com o prefixo correspondente paga o custo total de prefill — cerca de 800 ms no P50 para um prompt longo vs ~80 ms com cache hit. Em 2026 o padrão de produção é um cache-aware router (vLLM Router em Rust, llm-d router) que consome eventos KV-cache e roteia por prefix-hash match. Pesquisa recente (GORGO) torna a latência de rede cross-region um termo explícito no objetivo de roteamento. As ofertas comerciais de "cross-region inference" (Bedrock cross-region inference, GKE multi-cluster gateways) tratam inferência como opaca — cuidam da disponibilidade, não do TTFT. JPMorgan e Mayo Clinic fizeram failover em us-east-1 em Nov 2024 em ~22 minutos. A realidade do DR: 32% das falhas de DR em LLMs são porque times fizeram backup dos pesos mas esqueceram os arquivos do tokenizer ou configs de quantização.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de prefix-cache-aware router)
**Pré-requisitos:** Fase 17 · 04 (vLLM Serving), Fase 17 · 06 (SGLang RadixAttention)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Explicar por que round-robin load balancing quebra inferência com cache e quantificar a penalidade de TTFT.
- Diagramar um cache-aware router: inputs (eventos KV-cache), algoritmo (prefix-hash match), desempate (utilização GPU).
- Nomear o motivo de 32% das falhas de DR em LLMs (tokenizer ausente / configs de quantização) e declarar um checklist de DR com três arquivos.
- Distinguir ofertas comerciais cross-region (Bedrock CRI, GKE Multi-Cluster Gateway) do KV-aware routing.

## O Problema

Seu serviço roda em us-east-1, us-west-2 e eu-west-1. Você colocou um ALB na frente com round-robin. A taxa de prefix cache hit em produção cai para 8%. TTFT P50 triplica. Seus logs do vLLM mostram que todo request está pagando o custo total de prefill.

Round-robin é ideal para serviços stateless. Inferência LLM é stateful por natureza — o KV cache codifica tudo que o modelo já viu. Roteamento cego é roteamento para o cache errado.

Separadamente, seu time tem um plano de DR. Você faz backup dos pesos do modelo no S3 cross-region. Uma outage regional atinge; você tenta failover; a réplica se recusa a iniciar. Você esqueceu que o tokenizer.json, a config de quantização e a config de escala RoPE estavam num bucket separado que você não sincronizou.

Serviço multi-region de LLM é um problema de cache, um problema de roteamento e um problema de higiene de DR — não um problema de load balancer.

## O Conceito

### Cache-aware routing

O request chega com um prompt. O router hash o prefixo (por exemplo, os primeiros 512 tokens); ele pergunta a cada réplica "você tem esse prefixo no cache?". Réplicas publicam eventos KV-cache num canal pub/sub conforme alocam e removem blocos. O router escolhe a réplica com o match, cai no desempate baseado em GPU se ninguém tem.

**vLLM Router** (Rust, production-stack 2026): se inscreve em eventos `kv.cache.block_added`, mantém um prefix-hash → índice de réplica, roteia com lookup O(1). Cai no least-queue-depth quando não há match.

**llm-d router**: mesmo padrão, Kubernetes-native. Publica eventos via ControlPlane API.

**SGLang RadixAttention** (Fase 17 · 06) é o equivalente intra-réplica. Roteamento cross-réplica é estritamente upstream.

### Números

TTFT P50 num prompt de 2K tokens, Llama 3.3 70B FP8, H100:
- Cache hit (mesma réplica, prefixo residente): ~80 ms.
- Cache miss (prefill frio): ~800 ms.

Gap de 10x. Se seu router acerta 60-80% do prefix cache entre réplicas, você se aproxima do performance de réplica única com capacidade de N réplicas. Se acerta 10%, você se aproxima de escalação ingênua.

### Cross-region tem uma nova restrição — latência de rede

RTT entre regiões:
- us-east-1 ↔ us-west-2: ~65 ms.
- us-east-1 ↔ eu-west-1: ~75 ms.
- us-east-1 ↔ ap-southeast-1: ~220 ms.

Se o roteamento leva um request de us-east-1 para um prefixo quente em ap-southeast-1, o prefill economizado (800 → 80 ms) é engolido pelo round-trip de 440 ms. GORGO (pesquisa 2026) torna isso explícito — minimizar `prefill_time + network_latency` conjuntamente, não só prefill. Geralmente a resposta é manter o roteamento regional exceto em prefixos multi-MB massivos onde prefill domina.

### "Cross-region inference" comercial não ajuda aqui

AWS Bedrock cross-region inference roteia automaticamente requests para outras regiões durante pressão de capacidade. Ele otimiza disponibilidade, não TTFT, e trata inferência como opaca. GKE Multi-Cluster Gateway é a mesma coisa — failover em nível de serviço, sem consciência de KV cache.

Você ainda precisa de um cache-aware router na camada da aplicação mesmo usando esses. Eles tratam o caso "us-east-1 pegou fogo". Cache-aware routing trata o caso de TTFT.

### Higiene de DR — o problema dos 32% de arquivos faltando

Estatística amplamente citada de 2026: 32% das falhas de DR em LLMs acontecem porque times fizeram backup dos pesos mas esqueceram:

- `tokenizer.json` ou `tokenizer.model`
- Configs de quantização (`quantize_config.json`, escalas AWQ, zero-points GPTQ)
- Configs eespecificaçãoíficas do modelo (escala RoPE, attention masks, chat templates)
- Config do engine (`vllm_config.yaml`, configurações-padrão de sampling, manifests de adaptador LoRA)

A solução é um manifesto de DR mínimo de três arquivos:

1. Todos os arquivos sob o repo HF do modelo (pesos + configs + tokenizer).
2. Config de serving eespecificaçãoífica do engine.
3. Manifest de implantação (YAML do K8s, Dockerfile, lock de dependências).

Além disso: execute um drill de DR trimestral. O drill da JPMorgan em us-east-1 atingiu 22 minutos de recuperação em Nov 2024 apenas porque o playbook foi ensaiado.

### Residência de dados é ortogonal

PHI de clientes da EU não pode sair da EU. Se seu cache-aware router envia um request originado em Paris para us-east-1 por um match de prefixo, você violou GDPR independente do ganho de TTFT. Particione os routers por fronteira de residência antes de otimizar para cache.

### Números que você deve lembrar

- Gap de TTFT entre cache hit e miss: ~10x (80 ms vs 800 ms em prompt de 2K).
- RTT inter-região US-EU: ~75 ms.
- Falha DR: 32% faltando configs de tokenizer/quantização.
- Failover da JPMorgan em us-east-1 Nov 2024: 22 minutos (SLA de 30 min).

## Use

`code/main.py` simula três estratégias de roteamento (round-robin, cache-aware regional, cache-aware global) num workload multi-region. Reporta taxa de cache hit, TTFT P50/P99 e custo cross-region.

## Entregue

Esta aula produz `outputs/skill-multi-region-router.md`. Dadas regiões, restrições de residência e SLA, projeta um plano de roteamento.

## Exercícios

1. Execute `code/main.py`. Em que comprimento de prompt o roteamento cross-region vence o roteamento local-only, dado RTT de 75 ms?
2. Sua taxa de cache hit cai de 70% para 12%. Diagnostique três causas possíveis e os observáveis que confirmariam cada uma.
3. Projete um manifesto de DR para um modelo 70B AWQ-quantized servido no vLLM com 5 adaptadores LoRA. Liste todos os arquivos e configs.
4. Argumente se Bedrock cross-region inference é "suficiente" para uma fintech com SLOs rígidos de TTFT. Cite comportamentos eespecificaçãoíficos.
5. Um request originado em Paris encontra um prefixo em us-east-1. Você roteia? Escreva a política.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Cache-aware routing | "LB inteligente" | Roteamento por prefix-hash match para réplica com KV-cache |
| Eventos KV-cache | "cache pub-sub" | Réplicas publicam add/evict de blocos; router indexa |
| Prefix hash | "cache key" | Hash dos primeiros N tokens usado como lookup no router |
| GORGO | "pesquisa de cross-region routing" | arXiv 2602.11688; latência de rede como termo explícito |
| Cross-region inference | "Bedrock CRI" | Produto AWS; failover de disponibilidade, não consciência de TTFT |
| Manifest de DR | "lista de backup" | Cada arquivo necessário para restaurar — não só pesos |
| Residência de dados | "fronteira GDPR" | Restrição legal de qual região vê dados do usuário |
| RTT | "round-trip time" | Latência de rede; 75 ms US-EU, 220 ms US-APAC |
| LLM-aware LB | "cache-hit LB" | Cache-aware router como categoria de produto |

## Leituras Adicionais

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) — reuso KV-cache cross-region com termo de latência de rede.
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) — documentação de failover de disponibilidade.
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) — código-fonte do cache-aware router.
