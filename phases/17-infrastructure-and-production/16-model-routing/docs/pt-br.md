# Roteamento de Modelo como Primitiva de Redução de Custos

> Um broker dinâmico avalia cada request (tipo de tarefa, comprimento em tokens, similaridade de embedding, confiança) e envia queries simples para um modelo barato, escalando as complexas para um modelo frontier. Também chamado de model cascading. Estudos de caso de produção mostram 20-60% de redução de custo em iso-quality em deployements EUA/UK/EU; uma melhoria de 30% na eficiência de roteamento em SaaS de alto volume vira seis dígitos de economia anual. O contexto de 2026 é que preços de inferência LLM caíram ~10x por ano — um token de nível GPT-4 foi de $20/M para ~$0.40/M de late 2022 a 2026. A maior parte da queda vem de stacks de serving melhores (Fase 17 · 04-09), não de hardware. Roteamento é como você converte essa queda de preço em margem sem regressão de produto. O modo de falha é deriva do modelo barato: o roteador empurra 40% para um modelo mais fraco, qualidade cai 3-5% em tarefas de raciocínio, ninguém percebe por um trimestre. Gate por métricas de qualidade online, não apenas por evals offline.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de cascading router)
**Pré-requisitos:** Fase 17 · 01 (Plataformas LLM Gerenciadas), Fase 17 · 19 (AI Gateways)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Explicar model cascading: barato primeiro com verificação de confiança, escalar em caso de baixa confiança.
- Enumerar os quatro sinais de roteamento (classificação de tarefa, comprimento do prompt, similaridade de embedding com conjunto de dificuldade conhecida, auto-confiança do primeiro passo).
- Calcular o custo blendado esperado na divisão de roteamento alvo com tolerância de perda de qualidade.
- Nomear a métrica de monitoramento de deriva (gate de qualidade online) que detecta o crescimento do modelo barato.

## O Problema

Seu serviço custa $80k/mês no GPT-5. Suas análises mostram 70% das queries são simples: "que horas são em Paris?" "reescreva essa frase." Um modelo de nível Haiku resolve essas perfeitamente a 3% do custo. 30% precisam do raciocínio do GPT-5 — código, matemática, planejamento multi-step.

Se você roteia os 70% para barato e os 30% para caro, sua conta cai ~65% na mesma qualidade de produto. Isso é roteamento. O truque é construir o broker sem regredir qualidade.

## O Conceito

### Quatro sinais de roteamento

1. **Classificação de tarefa**: simples/complexo/codegen/math/chat. Pode ser um classificador baseado em regras, um LLM pequeno (nível Haiku a $0.25/M), ou similaridade de embedding com buckets rotulados. Saída: rota = barato / balanceado / frontier.

2. **Comprimento do prompt**: prompts >4K tokens geralmente precisam de frontier para coerência. Prompts <500 tokens geralmente não.

3. **Similaridade de embedding com conjunto de dificuldade conhecida**: se a consulta está perto (cosseno > 0.88) de um bucket de dificuldade conhecida, escale diretamente para frontier.

4. **Auto-confiança do primeiro passo**: envie para barato; se log-probs do modelo mostram baixa confiança OU ele recusa OU produz linguagem evasiva, tente no frontier. Adiciona latência P95 em ~10% do tráfego mas economiza 50%+ nos outros 90%.

### Três padrões

**Pre-route** (classificador na frente): ~5-10ms de latência adicionada; mais rápido no geral.

**Cascade** (barato primeiro, escalar em baixa confiança): ~1.2x latência mediana (execução barata mais verificação), ~2x nos escalados. Melhor piso de qualidade.

**Ensemble route** (rode barato e frontier em paralelo para uma amostra, escolha por reward-model): maior qualidade, maior custo; use apenas para A/B crítico.

### Implementação

AI gateways (Fase 17 · 19) expõem roteamento. LiteLLM tem config `router` com reserva e cost-routing. Portkey tem guards + roteamento. Kong AI Gateway tem roteamento baseado em plugins. O marketplace de modelos do OpenRouter expõe uma API de recomendação.

Open-source: RouteLLM (LMSYS), Not Diamond (comercial), Prompt Mule.

### A curva de preços de 2026

| Classe de modelo | Late 2022 | 2026 | Mudança |
|-----------------|-----------|------|---------|
| Qualidade nível GPT-4 | ~$20/M | ~$0.40/M | 50x mais barato |
| Frontier (GPT-5, Claude 4) | — | ~$3-10/M | nova faixa |

A maior parte da melhoria é eficiência de serving — as lições centrais da Fase 17 · 04-09 viraram quedas de custo no lado do provider. Roteamento te permite capturar esses ganhos na camada da aplicação ao invés de esperar todos os seus usuários migrarem para a faixa barata.

### Drift é o risco real

Seu roteador empurra 40% para o modelo barato. Em seis meses, a distribuição de tarefas muda (usuários ficam mais sofisticados, fazem perguntas mais longas). O roteador não percebe porque o classificador foi treinado com dados do Q1. Qualidade cai silenciosamente. Ninguém reclama alto o suficiente. Você descobre num benchmark de concorrente que perdeu.

Gate por métricas de qualidade online:

- Like / dislike por rota.
- LLM-judge automático em amostra retida (5%) por rota.
- Taxa de escalação: se o cascade está escalando >30%, o modelo barato está sendo super-rooteado.
- Taxa de recusa por rota.

### Números que você deve lembrar

- Economia de roteamento em 2026 em iso-quality: 20-60% em estudos de caso.
- Queda de preço LLM 2022-2026: ~10x por ano agregado.
- Nível GPT-4 2022 vs 2026: ~$20/M → ~$0.40/M.
- Impacto de latência do cascade: ~1.2x mediana, ~2x escalado (~10% do tráfego).

## Use

`code/main.py` simula pre-route, cascade e ensemble num workload misto. Reporta custo blendado, perda de qualidade e taxa de escalação.

## Entregue

Esta aula produz `outputs/skill-router-plan.md`. Dados workload e orçamento de qualidade, escolhe um padrão de roteamento e sinais.

## Exercícios

1. Execute `code/main.py`. Em que piso de acurácia o cascade vence o pre-route?
2. Sua base de usuários é 30% enterprise (queries complexas), 70% tier gratuito (simples). Projete a divisão de roteamento. Qual métrica online controla?
3. Uma rota perde 2% de qualidade mas economiza 40%. Isso é ship? Depende do produto — argumente os dois lados.
4. Implemente uma verificação de confiança usando logprobs das APIs OpenAI / Anthropic. Qual threshold você começa?
5. Em seis meses, a taxa de escalação sobe de 8% para 22%. Diagnostique três causas e a correção para cada uma.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Model routing | "broker de custo" | Escolha dinâmica de modelo por request |
| Model cascade | "barato primeiro, escalar" | Rodar barato, cair no frontier em baixa confiança |
| Pre-route | "classificar primeiro" | Classificador na frente; sem re-execução |
| Ensemble route | "escolha paralela" | Rodar múltiplos, reward-model escolhe o melhor |
| Taxa de escalação | "% escalado" | Fração de requests do cascade que foram escalados |
| RouteLLM | "router LMSYS" | Biblioteca OSS de router |
| Not Diamond | "router comercial" | Produto SaaS de model routing |
| Drift | "crescimento do barato" | Desvio de distribuição sem o router perceber |
| Gate de qualidade online | "verificação ao vivo" | LLM-judge automático amostrando tráfego ao vivo |

## Leituras Adicionais

- [AbhyashSuchi — Model Routing LLM 2026 Best Practices](https://abhyashsuchi.in/model-routing-llm-2026-best-practices/)
- [Lukas Brunner — Rise of Inference Optimization 2026](https://dev.to/lukas_brunner/the-rise-of-inference-optimization-the-real-llm-infra-trend-shaping-2026-4e4o)
- [Paper / código do RouteLLM](https://github.com/lm-sys/RouteLLM)
- [Not Diamond — model routing](https://www.notdiamond.ai/)
- [OpenRouter](https://openrouter.ai/) — gateway multi-model com primitivas de roteamento.
