# Teste A/B para Funcionalidades LLM — GrowthBook, Statsig e o Problema das Vibes

> Teste A/B tradicional não foi feito para LLMs não-determinísticos. A distinção crítica: evals respondem "o modelo consegue fazer o trabalho?" Testes A/B respondem "os usuários se importam?" Ambos são necessários; lançar por checagem de vibe acabou. O que testar em 2026: engenharia de prompts (redação), seleção de modelo (GPT-4 vs GPT-3.5 vs OSS; acurácia vs custo vs latência), parâmetros de geração (temperature, top-p). Casos reais: uma variante de reward model de chatbot entregou +70% de duração de conversa e +30% de retenção; experimentos de assunto do Nextdoor AI entregaram +1% de CTR após refinamento da reward function; Khan Academy Khanmigo iterou num eixo latência-vs-acurácia-matemática. Divisão de plataformas: **Statsig** (adquirida por OpenAI por $1.1B em setembro de 2025) — testes sequenciais, CUPED, tudo-em-um. **GrowthBook** — open-source, warehouse-native, motores Bayesiano + Frequentista + Sequencial, CUPED, checagens SRM, correções Benjamini-Hochberg + Bonferroni. Você escolhe com base na preferência de warehouse-SQL e se "adquirida por OpenAI" importa pra sua organização.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador brincadeira de teste sequencial)
**Pré-requisitos:** Fase 17 · 13 (Observabilidade), Fase 17 · 20 (Deploy Progressivo)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Distinguir evals ("o modelo consegue fazer o trabalho") de testes A/B ("os usuários se importam").
- Listar três eixos testáveis (prompt, modelo, parâmetros) e escolher a métrica pra cada um.
- Explicar CUPED, testes sequenciais e correções de múltiplas comparações Benjamini-Hochberg.
- Escolher Statsig ou GrowthBook com base na postura warehouse-SQL e no posicionamento sobre aquisição corporativa.

## O Problema

Você ajustou um system prompt na mão. Parece melhor. Você lança. Conversão muda pelo ruído. Você culpa a métrica. Ou você lançou um modelo novo e conversão não mudou — o modelo piorou ou a mudança foi pequena demais pra detectar? Você não sabe, porque lançou sem um A/B.

Evals respondem se o modelo consegue fazer uma tarefa num conjunto rotulado. Não respondem se os usuários preferem o output. Só um experimento online controlado responde isso, e só se o experimento tem poder estatístico suficiente, controla não-determinismo e corrige múltiplas comparações.

## O Conceito

### Evals vs testes A/B

**Evals** — offline, conjunto rotulado, juiz (rubrica ou LLM-as-judge ou humano). Resposta: "O output é correto/útil/seguro nessa distribuição fixa?"

**Teste A/B** — online, usuários ao vivo, randomizado. Resposta: "A variante nova move a métrica que importa no nível do usuário?"

Ambos necessários. Evals pegam regressões antes da exposição; A/B confirma impacto do produto depois.

### O que testar

1. **Engenharia de prompts** — redação, estrutura do system prompt, exemplos. Métrica: sucesso da tarefa, retenção do usuário, custo/request.
2. **Seleção de modelo** — GPT-4 vs GPT-3.5-Turbo vs Llama-OSS. Métrica: acurácia (tarefa) + custo/request + latência P99. Multi-objetivo.
3. **Parâmetros de geração** — temperature, top-p, max_tokens. Métrica: específica da tarefa (diversidade do output vs determinismo).

### CUPED — redução de variância

Controlled-experiments Using Pre-Experiment Data. Regresse a variância do período anterior antes de comparar o período posterior. Redução típica de variância: 30-70%. Tamanho amostral efetivo sobe de graça.

Implementação: tanto Statsig quanto GrowthBook implementam.

### Testes sequenciais

Teste A/B clássico assume tamanho amostral fixo. Testes sequenciais ("peek-e-decida") controlam a taxa de falso positivo sob olhar repetido. Procedimentos sequenciais sempre válidos (mSPRT, sequências de confiança de Howard) permitem parar cedo em vencedores claros.

### Correções de múltiplas comparações

Rodar 20 testes A/B a 95% de confiança produz um falso positivo por acaso. Correção de Bonferroni aperta α por teste; Benjamini-Hochberg controla a taxa de descoberta falsa. GrowthBook implementa ambos.

### SRM — mismatch de razão amostral

Hash de aleatorização distribui usuários nas variantes. Se split 50/50 entrega 47/53, algo está errado — checagem SRM sinaliza. Ambas as plataformas implementam.

### Statsig vs GrowthBook

**Statsig**:
- Adquirida por OpenAI por $1.1B (setembro 2025). Hosted, SaaS.
- Testes sequenciais, CUPED, populações held-out.
- Tudo-em-um: feature flags + experimentação + observabilidade.
- Melhor para: time que já quer um produto bundle, não se importa com propriedade da OpenAI.

**GrowthBook**:
- Open-source (MIT); warehouse-native (lê de Snowflake/BigQuery/Redshift direto).
- Múltiplos motores: Bayesiano, Frequentista, Sequencial.
- CUPED, SRM, Bonferroni, BH.
- Self-host ou cloud gerenciada.
- Melhor para: time que usa warehouse-SQL, equipe de dados controla a camada de métricas, quer OSS.

### Não-determinismo complica o poder

Mesmo prompt gera outputs variáveis. Cálculos de poder tradicionais assumem observações IID. Com não-determinismo de LLM, o tamanho amostral efetivo é menor que o nominal. Multiplique o tamanho amostral necessário por ~1.3-1.5x como margem de segurança.

### Resultados de casos reais

- Variante de reward model de chatbot: +70% de duração de conversa, +30% de retenção.
- Assuntos do Nextdoor: +1% de CTR após refinamento da reward function.
- Khan Academy Khanmigo: iteração iterativa no trade-off latência-vs-acurácia-matemática.

### Anti-padrão: lançar por vibes

Todo engenheiro sênior consegue nomear uma funcionalidade que foi lançada porque "parece melhor" sem nenhum A/B. A maioria degradou métricas de produto que o time não percebeu por meses. A/B é a função de força.

### Números pra lembrar

- Statsig adquirida por OpenAI: $1.1B, setembro 2025.
- GrowthBook: open-source MIT; Bayesiano + Frequentista + Sequencial.
- CUPED redução de variância: 30-70%.
- Não-determinismo de LLM → +30-50% de buffer no tamanho amostral.

## Use

`code/main.py` simula um teste A/B sequencial com limites fixos e sequenciais. Mostra como o sequencial permite parar cedo.

## Entregue

Esta aula produz `outputs/skill-ab-plan.md`. Dada mudança de funcionalidade, workload, baseline, escolhe plataforma, gates, tamanho amostral.

## Exercícios

1. Execute `code/main.py`. Para um lift esperado de 5% com baseline de 3% de conversão, qual tamanho amostral para 80% de poder?
2. Escolha Statsig ou GrowthBook para um cliente on-prem regulado por healthcare.
3. Projet um A/B que testa GPT-4 vs GPT-3.5 em custo por ticket resolvido. Qual é a métrica primária, métrica de guarda, secundária?
4. Seu canary passa mas A/B mostra -1.2% de conversão. Lança? Escreva os critérios de escalação.
5. Aplique CUPED num período anterior com 60% da variância do posterior. Calcule o boost no tamanho amostral efetivo.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|---------------------------|
| Eval | "teste offline" | Avaliação de capacidade do modelo em conjunto rotulado |
| Teste A/B | "experimento" | Comparação randomizada ao vivo com usuários |
| CUPED | "redução de variância" | Regressão de período anterior para reduzir variância |
| Teste sequencial | "teste peek-ok" | Procedimento sempre válido com parada antecipada |
| Múltipla comparação | "erro familiar" | Rodar muitos testes infla falsos positivos |
| Bonferroni | "correção apertada" | Divida α pelo número de testes |
| Benjamini-Hochberg | "BH FDR" | Controle de taxa de descoberta falsa, menos conservador |
| SRM | "split errado" | Mismatch de razão amostral; bug de alocação |
| Statsig | "propriedade da OpenAI" | Comercial tudo-em-um, adquirida em 2025 |
| GrowthBook | "o OSS" | Plataforma warehouse-native MIT |
| mSPRT | "teste de razão de probabilidade sequencial" | Procedimento sequencial clássico |

## Leitura Complementar

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
