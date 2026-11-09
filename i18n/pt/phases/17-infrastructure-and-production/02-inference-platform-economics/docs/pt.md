# Economia da plataforma de inferência  Futebol, Juntos, Basetão, Modal, Replicação, Qualquer escala

> O mercado de inferência de 2026 não é mais aluguel de tempo de GPU. Ele se divide em silício personalizado (Groq, Cerebras, SambaNova), plataformas de GPU (Baseten, Together, Fireworks, Modal) e mercados de primeira API (Replicate, DeepInfra).$1/hr per GPU on May 1, 2026, and $A avaliação 4B em tokens 10T+/dia indica o modelo de trabalho orientado pelo volume.$300M Series E at $A regra de posicionamento competitivo é simples: Fireworks otimiza a latência, Together otimiza a largura do catálogo, Baseten otimiza o polish empresarial, Modal otimiza o Python-native DX, Replicate otimiza o alcance multimodal, Anyscale otimiza o Python distribuído. Esta lição dá-lhe uma matriz que você pode entregar a um fundador.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy per-call economics comparator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nomear os três segmentos de mercado (sílico personalizado, plataformas GPU, API-first) e mapear cada fornecedor para um segmento.
- Explique por que o modelo de preços da API "por token" se comprime para a curva de custo do motor de serviço, não do hardware.
- Calcule o custo efetivo por pedido em pelo menos três fornecedores e explique quando o valor por minuto (Baseten, Modal) supera o valor por token.
- Identificar qual é a plataforma padrão adequada para uma determinada carga de trabalho (desbordamento sem servidor, alta produção constante, variantes ajustadas, multimodal).

## O problema

Você avaliou as plataformas de hiperescalagem gerenciadas. Você decidiu que precisava de um fornecedor mais estreito e mais rápido. Fireworks para latência, Together para largura, Baseten para um modelo personalizado afinado. Agora você tem seis opções reais e as páginas de preços não se alinham. Fireworks mostra.$/M tokens; Baseten shows $/minute; Modal shows $/second; Replicate shows $Não se pode compará-los cara a cara sem modelar a carga de trabalho.

Pior ainda, o modelo de negócios por trás de cada página de preços é diferente. Fireworks executa seu próprio motor personalizado (FireAttention) em GPUs compartilhadas; a taxa por token reflete sua curva de utilização. Baseten dá-lhe GPUs dedicadas Truss +; por minuto reflete exclusividade. Modal é verdadeiro Python servidorless  por segundo de faturamento com subsegundo começo frio. A mesma saída (resposta de MLL), três funções de custo diferentes.

Esta lição modela os seis e diz-lhe quando cada um ganha.

## O conceito

### Os três segmentos

**Custom silicon**Groq (LPU), Cerebras (WSE), SambaNova (RDU). Tipicamente 5-10 vezes mais rápido que um cluster baseado em GPU no mesmo modelo. Preço por token mais alto (Groq foi ~ $ 0,99 / M em Llama-70B no final de 2025) mas imbatível para casos de uso sensíveis à latência. Groq é a escolha de produção para agentes de voz e tradução em tempo real.

**GPU platforms** Baseten, Together, Fireworks, Modal, Anyscale. Execução em NVIDIA (H100, H200, B200 em 2026) ou às vezes AMD. A camada econômica entre "arrendamento de GPU bruto" (RunPod, Lambda) e "serviço gerenciado hipercaler" (Bedrock).

**API-first marketplaces** Replicar, DeepInfra, OpenRouter, Fal. Catálogo amplo, pagamento por previsão ou pagamento por segundo, enfatizar o tempo para a primeira chamada.

### Fireworks  Plataforma de GPU optimizada para latência

- Motor FireAttention (custom); comercializado como 4 vezes menor latência do que o vLLM em configurações equivalentes.
- Nível de lote em ~50% de taxa sem servidor para cargas de trabalho não interativas.
- O modelo de sintonia perfeita serviu à mesma taxa que o modelo base  um diferencial real contra os provedores que cobram um prêmio pelo seu LoRA.
- Meados de 2026: aumento da renda de GPU sob demanda de US $ 1 / hora a partir de 1 de maio de 2026.
- Sinais financeiros: Valorização de 4 mil milhões de dólares, 10T+ tokens/dia manuseados.

### Juntos  Otimizado em largura

- 200+ modelos, incluindo lançamentos de código aberto, dentro de dias após a publicação inicial.
- 50-70% mais barato do que Replicar em modelos equivalentes de LLM  o posicionamento "AI Native Cloud" é volume e catálogo.
- Inferência + ajuste fino + formação numa API.

### Baseten  empresa-polonês-otimizado

- Estrutura de truss: embalagens de modelo com dependências, segredos, servidor config em um manifesto.
- A GPU varia de T4 a B200, cobrança por minuto com uma redução razoável de arranque a frio.
- SOC 2 Tipo II, pronto para HIPAA.
- $5B valuation, January 2026 Series E ($300 milhões de dólares da CapitalG, IVP, NVIDIA).

### Modal  Python nativo-otimizado

- Infraestrutura como código em Python puro. Decorar uma função com `@modal.function(gpu="A100")`e despedaçar com um comando.
- Falta de 2 a 4 segundos com pré-aquecimento; < 1s para modelos pequenos.
- $87M Series B at $1.1B Avaliação (2025).

### Replicação  largura multimodal

- A plataforma padrão para modelos de imagem, vídeo e áudio.
- Ecossistema de integração (Zapier, Vercel, plugins CMS).
- Menos competitivo em taxas de LLM por token, mas ganha na variedade multimodal.

### Qualquer escala  Ray-native

- Construído em Ray; RayTurbo é o motor de inferência proprietário da Anyscale (competindo com vLLM).
- Melhor para cargas de trabalho distribuídas do Python onde o passo de inferência é um nó em um gráfico maior.
- Gerenciado Ray clusters; estreita integração com Ray AIR e Ray Serve.

### Per-token versus per-minute  quando cada um ganha

Per-token faz sentido quando a carga de trabalho é insensible à latência e explodiu  você só paga pelo que usa. Por minuto faz sentido quando a utilização é alta e previsível  você bate por token uma vez que você está saturando a GPU.

Regra rígida: para cargas de trabalho acima de ~ 30% de utilização sustentada de uma GPU dedicada, por minuto (Baseten, Modal) começa a bater por token (Fireworks, Together). abaixo disso, por token ganha porque você evita pagar por ocioso.

### O motor personalizado é o verdadeiro fosso .

Cada plataforma acima do vLLM e SGLang reivindica um motor personalizado. FireAttention, RayTurbo, a pilha de inferência de Baseten. Custom-engine afirma que o marketing de sombras  o enquadramento honesto é que vLLM + SGLang representam cerca de 80% da inferência de código aberto de produção, e os diferenciadores na camada da plataforma são DX, atribuição e SLAs.

### Números que você deve lembrar

- Aluguer de GPU de fogos de artifício: Renda de $1/hora a partir de 1o de maio de 2026.
- A reclamação de fogos de artifício: 4 vezes menor latência do que a vLLM em configurações equivalentes.
- Juntos: 50-70% mais barato do que o Replicate em LLM.
- Valoração de base: $5B (Series E, Jan 2026, $300M rodada).
- Valoração do capital: US$ 1,1 bilhão (Série B, 2025).
- Batidas por minuto por token acima de ~ 30% de utilização sustentada.

```figure
cost-per-token
```

## Usá-lo

`code/main.py`Comparar os seis fornecedores numa carga de trabalho sintética entre modelos de preços.$/day and effective $- M tokens, para encontrar o equilíbrio entre token e minuto.

## Envia-o

Esta lição produz`outputs/skill-inference-platform-picker.md`. Tendo em conta o perfil de carga de trabalho, o SLA e o orçamento, escolhe a plataforma de inferência primária e nomeia o segundo.

## Exercícios

1. Corra .`code/main.py`Em que utilização sustentada o Baseten (por minuto) vence o Fireworks (por token) para um modelo 70B em um H100?
2. O seu produto serve para geração de imagens, chat e conversas, escolha plataformas para cada modalidade e nomeia o padrão de gateway que as unifica.
3. Os fogos de artifício aumentam os preços em 1 dólar por hora no seu modelo primário.
4. Um cliente regulamentado requer GPUs SOC 2 Tipo II + HIPAA + dedicados. Quais três plataformas são viáveis e qual ganha no FinOps?
5. Comparar custo por 1.000 previsões para Llama 3.1 70B em Fireworks serverless, Together on demand, Baseten dedicado e Replicate API. Qual é o mais barato em 10 previsões por dia?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Custom silicon | "non-GPU chips" | Groq LPU, Cerebras WSE, SambaNova RDU — optimized for decode |
| FireAttention | "Fireworks engine" | Custom attention kernel; marketed at 4x lower latency than vLLM |
| Truss | "Baseten's format" | Model packaging manifest; dependencies + secrets + serving config |
| Per-token | "API pricing" | Charge by tokens consumed; pay for no idle |
| Per-minute | "dedicated pricing" | Charge by wall-clock GPU time; wins at high utilization |
| Per-prediction | "Replicate pricing" | Charge per model invocation; common for image/video |
| RayTurbo | "Anyscale engine" | Proprietary inference on Ray; competes with vLLM on Ray clusters |
| Batch tier | "50% off" | Non-interactive queue at reduced rate; common on Fireworks, OpenAI |
| Fine-tuned at base rate | "Fireworks LoRA" | Charge LoRA-served requests at base model's rate (differentiator) |

## Mais leitura

- [Fireworks Pricing](https://fireworks.ai/pricing)Tarifas por token, nível de lote, aluguel de GPU.
- [Baseten Pricing](https://www.baseten.co/pricing/) taxas por minuto, capacidade comprometida, níveis de empresa.
- [Modal Pricing](https://modal.com/pricing) taxas de GPU por segundo e nível livre.
- [Together AI Pricing](https://www.together.ai/pricing) Catálogo de modelos e taxas por token.
- [Anyscale Pricing](https://www.anyscale.com/pricing) RayTurbo e gerenciou o preço do Ray.
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) avaliação comparativa.
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) Paisagem de fornecedores.
