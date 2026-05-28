# Economia de Plataformas de Inferência — Fireworks, Together, Baseten, Modal, Replicate, Anyscale

> O mercado de inferência em 2026 não é mais aluguel de tempo de GPU. Ele se bifurca em silício custom (Groq, Cerebras, SambaNova), plataformas de GPU (Baseten, Together, Fireworks, Modal) e marketplaces API-first (Replicate, DeepInfra). Fireworks subiu o preço em $1/hr por GPU em 1º de maio de 2026, e uma valuation de $4B em 10T+ tokens/dia te diz que o modelo baseado em volume funciona. Baseten fechou $300M Series E a $5B em janeiro de 2026. A regra de posicionamento competitivo é simples: Fireworks otimiza latência, Together otimiza amplitude de catálogo, Baseten otimiza polish empresarial, Modal otimiza DX Python-native, Replicate otimiza alcance multimodal, Anyscale otimiza Python distribuído. Esta aula te dá uma matriz que você pode entregar a um fundador.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, comparador de economia por chamada toy)
**Pré-requisitos:** Fase 17 · 01 (Plataformas Gerenciadas de LLM), Fase 17 · 04 (Internals de Serving vLLM)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear os três segmentos de mercado (silício custom, plataformas de GPU, API-first) e mapear cada vendor para um segmento.
- Explicar por que o modelo de preço "por-token" da API se comprime para a curva de custo da engine de serving, não para a do hardware.
- Computar o custo efetivo por request em pelo menos três vendors e explicar quando por-minuto (Baseten, Modal) ganha de por-token.
- Identificar qual plataforma é o padrão certo para um dado workload (serverless bursty, alta taxa estável, variantes fine-tuned, multimodal).

## O Problema

Você avaliou plataformas hiperscaler gerenciadas. Decidiu que precisa de um provedor mais focado e mais rápido — Fireworks para latência, Together para amplitude, Baseten para um modelo custom fine-tuned. Agora você tem seis escolhas reais e as páginas de preços não se alinham. Fireworks mostra $/M tokens; Baseten mostra $/minuto; Modal mostra $/segundo; Replicate mostra $/prediction. Você não consegue compará-los lado a lado sem modelar o workload.

Pior: o modelo de negócio por trás de cada página de preço é diferente. Fireworks roda sua engine custom (FireAttention) em GPUs compartilhadas; a taxa por-token reflete a curva de utilização deles. Baseten te dá Truss + GPUs dedicadas; por-minuto reflete exclusividade. Modal é Python serverless de verdade — cobrança por segundo com cold starts sub-segundo. Mesma saída (uma resposta de LLM), três funções de custo diferentes.

Esta aula modela os seis e te diz quando cada um vence.

## O Conceito

### Os três segmentos

**Silício custom** — Groq (LPU), Cerebras (WSE), SambaNova (RDU). Tipicamente 5-10x mais rápido em decode que um cluster baseado em GPU no mesmo modelo. Preço por-token mais alto (Groq era ~$0.99/M no Llama-70B no fim de 2025) mas imbatível para casos de uso sensíveis a latência. Grogo é a escolha de produção para voice agentes e tradução em tempo real.

**Plataformas de GPU** — Baseten, Together, Fireworks, Modal, Anyscale. Rodam em NVIDIA (H100, H200, B200 em 2026) ou às vezes AMD. A camada econômica entre "aluguel bruto de GPU" (RunPod, Lambda) e "serviço gerenciado de hiperscaler" (Bedrock).

**Marketplaces API-first** — Replicate, DeepInfra, OpenRouter, Fal. Catálogo amplo, pagamento por predição ou por segundo, foco em tempo até a primeira chamada.

### Fireworks — plataforma de GPU otimizada para latência

- Engine FireAttention (custom); comercializada com 4x menos latência que vLLM em configs equivalentes.
- Tier batch a ~50% da tarifa serverless para workloads não interativos.
- Modelo fine-tuned servido na mesma tarifa que o modelo base — um diferencial real vs provedores que cobram premium pelo seu LoRA.
- Meados de 2026: subiu aluguel de GPU sob demanda em $1/hora efetivo em 1º de maio de 2026. Preço em volume negociável em escala.
- Sinal financeiro: valuation de $4B, 10T+ tokens/dia processados.

### Together — otimizada para amplitude

- 200+ modelos incluindo releases open-source em dias da publicação upstream.
- 50-70% mais barato que Replicate em modelos LLM equivalentes — o posicionamento "AI Native Cloud" é volume e catálogo.
- Inferência + fine-tuning + treinamento em uma API.

### Baseten — otimizada para polish empresarial

- Framework Truss: empacotamento de modelo com dependências, secrets, config de serving em um manifesto.
- Faixa de GPU de T4 até B200. Cobrança por minuto com mitigação razoável de cold start.
- SOC 2 Type II, pronto para HIPAA. Escolha comum em fintech e saúde.
- Valuation de $5B, Series E de janeiro de 2026 ($300M de CapitalG, IVP, NVIDIA).

### Modal — otimizada para DX Python-native

- Infraestrutura-as-código em Python puro. Decorre uma função com `@modal.function(gpu="A100")` e implanta com um comando.
- Cobrança por segundo. Cold starts de 2-4s com pre-warming; <1s para modelos pequenos.
- Series B de $87M a $1.1B de valuation (2025). Melhor pontuação de experiência do desenvolvedor em pesquisas independentes.

### Replicate — amplitude multimodal

- Pagamento por predição. Plataforma padrão para modelos de imagem, vídeo e áudio.
- Ecossistema de integração (Zapier, Vercel, plugins CMS).
- Menos competitivo em taxas por-token de LLM mas ganha na variedade multimodal.

### Anyscale — Ray-native

- Construído sobre Ray; RayTurbo é a engine proprietária de inferência do Anyscale (concorre com vLLM).
- Melhor para workloads Python distribuídos onde o passo de inferência é um nó em um grafo maior.
- Clusters Ray gerenciados; integração apertada com Ray AIR e Ray Serve.

### Por-token versus por-minuto — quando cada um ganha

Por-token faz sentido quando o workload é insensível a latência e bursty — você só paga pelo que usa. Por-minuto faz sentido quando a utilização é alta e previsível — você ganha de por-token quando está saturando a GPU.

Regra aproximada: para workloads acima de ~30% de utilização sustentada de uma GPU dedicada, por-minuto (Baseten, Modal) começa a ganhar de por-token (Fireworks, Together). Abaixo disso, por-token ganha porque você evita pagar por ociosidade.

### Engine custom é o verdadeiro moat

Toda plataforma acima do vLLM e SGLang tem uma engine custom. FireAttention, RayTurbo, stack de inferência do Baseten. Claims de engine custom são marketing — o enquadramento honesto é que vLLM + SGLang representam cerca de 80% da inferência open-source em produção, e os diferenciais na camada de plataforma são DX, atribuição e SLAs.

### Números que você deve memorizar

- Fireworks aluguel de GPU: subida de $1/hr efetivo em 1º de maio de 2026.
- Claim do Fireworks: 4x menos latência que vLLM em configs equivalentes.
- Together: 50-70% mais barato que Replicate em LLMs.
- Valuation do Baseten: $5B (Series E, Jan 2026, rodada de $300M).
- Valuation do Modal: $1.1B (Series B, 2025).
- Por-minuto ganha de por-token acima de ~30% de utilização sustentada.

## Use

`code/main.py` compara os seis vendors em um workload sintético através de modelos de preço. Reporta $/dia e $/M tokens efetivos. Execute para encontrar o break-even entre por-token e por-minuto.

## Entregue

Esta aula produz `outputs/skill-inference-platform-picker.md`. Dado perfil de workload, SLA e orçamento, escolhe a plataforma principal de inferência e nomeia a segunda colocada.

## Exercícios

1. Execute `code/main.py`. Em que utilização sustentada o Baseten (por-minuto) ganha do Fireworks (por-token) para um modelo 70B em uma H100? Derive o crossover você mesmo e compare com a regra aproximada.
2. Seu produto serve geração de imagem mais chat mais speech-to-text. Escolha plataformas para cada modalidade e nomeie o padrão de gateway que as unifica.
3. Fireworks sube os preços em $1/hr no seu modelo principal. Modele o impacto no custo misto se 40% do seu tráfego migra para o tier batch (50% off).
4. Um cliente regulamentado precisa de SOC 2 Type II + HIPAA + GPUs dedicadas. Quais três plataformas são viáveis e qual ganha em FinOps?
5. Compare custo por 1.000 predições para o Llama 3.1 70B no Fireworks serverless, Together sob demanda, Baseten dedicado e Replicate API. Qual é o mais barato a 10 predições/dia? A 10.000?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Silício custom | "chips não-GPU" | Groq LPU, Cerebras WSE, SambaNova RDU — otimizados para decode |
| FireAttention | "engine do Fireworks" | Kernel de attention custom; comercializado com 4x menos latência que vLLM |
| Truss | "formato do Baseten" | Manifesto de empacotamento de modelo; dependências + secrets + config de serving |
| Por-token | "preço de API" | Cobrança por tokens consumidos; não paga por ociosidade |
| Por-minuto | "preço dedicado" | Cobrança por tempo de GPU no relógio; ganha em alta utilização |
| Por-predição | "preço da Replicate" | Cobrança por invocação de modelo; comum para imagem/vídeo |
| RayTurbo | "engine do Anyscale" | Inferência proprietária no Ray; concorre com vLLM em clusters Ray |
| Tier batch | "50% off" | Fila não interativa com tarifa reduzida; comum no Fireworks, OpenAI |
| Fine-tuned na tarifa base | "LoRA do Fireworks" | Cobra requests LoRA servidos na tarifa do modelo base (diferencial) |

## Leitura Complementar

- [Fireworks Pricing](https://fireworks.ai/pricing) — taxas por-token, tier batch, aluguel de GPU.
- [Baseten Pricing](https://www.baseten.co/pricing/) — taxas por-minuto, capacidade comprometida, tiers enterprise.
- [Modal Pricing](https://modal.com/pricing) — taxas por segundo de GPU e tier gratuito.
- [Together AI Pricing](https://www.together.ai/pricing) — catálogo de modelos e taxas por-token.
- [Anyscale Pricing](https://www.anyscale.com/pricing) — preços do RayTurbo e Ray gerenciado.
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) — avaliação comparativa.
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) — panorama de vendors.
