---
name: skill-cost-patterns
description: Decision framework for LLM cost optimization -- caching strategies, rate limiting, model routing, and budget controls
version: 1.0.0
phase: 11
lesson: 11
tags: [caching, cost-optimization, rate-limiting, model-routing, budget, llm-ops]
---
---
name: skill-cost-patterns
description: Decision framework for LLM cost optimization -- caching strategies, rate limiting, model routing, and budget controls
version: 1.0.0
phase: 11
lesson: 11
tags: [caching, cost-optimization, rate-limiting, model-routing, budget, llm-ops]
---

# Padrões de otimização de custos LLM

Ao construir uma aplicação LLM que precisa controlar custos, aplique esta estrutura de decisão.

## Quando otimizar

**Otimize imediatamente quando:**
- O gasto mensal do LLM excede US$ 500 ou 10% do orçamento de infraestrutura
- O custo por consulta é superior a US$ 0,01 para um produto de consumo
- O prompt do seu sistema tem mais de 1.000 tokens e é enviado com cada solicitação
- Mais de 30% das consultas são duplicadas ou quase duplicadas
- Você está aumentando de 100 para mais de 10.000 usuários diários

**Não otimize ainda quando:**
- Você tem menos de 100 DAU e ainda está validando a adequação do produto ao mercado
- O gasto mensal é inferior a US$ 100 e cresce lentamente
- Você ainda está iterando no design do prompt (o armazenamento em cache bloqueia você em um prompt)

## Seleção de estratégia de cache

### Cache exato

**Use quando:** temperatura=0, prompts idênticos são repetidos, saídas determinísticas são necessárias.

```python
key = sha256(json.dumps({"model": m, "messages": msgs, "temp": 0}))
```

- Implementação: 30 minutos
- Taxa de acerto: 10-25% para a maioria dos aplicativos, 40-60% para bots de perguntas frequentes
- Latência: <1ms (pesquisa de ditado)
- Risco: respostas obsoletas se os dados subjacentes mudarem

**Ignorar quando:** temperatura > 0, cada consulta é única, são necessários dados em tempo real.

### Cache semântico

**Use quando:** usuários fazem a mesma pergunta com palavras diferentes, produtos com muitas perguntas frequentes, suporte ao cliente.

- Implementação: 2-4 horas (incorporação + similaridade + armazenamento)
- Taxa de acerto: 15-35% além do cache exato
- Latência: 10-50ms (incorporação + pesquisa de RNA)
- Risco: falsos positivos (retornando resposta errada em cache para uma pergunta semelhante, mas diferente)

**Diretrizes de limite:**
- 0,98+: muito conservador, quase nenhum falso positivo, menor taxa de acerto
- 0,95: bom equilíbrio para perguntas e respostas factuais
- 0,90: agressivo, maior taxa de acerto, mas risco de respostas erradas
- 0,85: apenas para aplicações de baixo risco (sugestões, preenchimento automático)

**Ignorar quando:** cada consulta tem um contexto único (geração de código), as respostas devem refletir os dados mais recentes, o espaço de consulta é ilimitado.

### Cache de prompt do provedor

**Use quando:** prompt do sistema > 1.024 tokens (OpenAI) ou mínimo específico do modelo, mesmo prefixo enviado repetidamente.

| Provedor | Ação | Poupança |
|----------|--------|--------|
| Antrópico | Adicionar `cache_control: {"type": "ephemeral"}` à mensagem do sistema | 90% no prefixo em cache (após 25% de prêmio de gravação) |
| OpenAI | Nada (automático) | 50% no prefixo em cache |
| Google | Use API de cache de contexto com TTL explícito | ~75% no contexto em cache |

**Pular quando:** o prompt do sistema muda por solicitação, o prompt tem comprimento mínimo.

## Regras de roteamento de modelo

### Baseado em palavras-chave (simples, rápido)

```
simple:  <= 5 words OR matches FAQ keywords -> gpt-4o-mini ($0.15/$0.60)
medium:  general queries, summaries        -> claude-sonnet ($3/$15)
complex: "analyze", "compare", "debug"     -> gpt-4o ($2.50/$10)
```

- Implementação: 1 hora
- Precisão: 70-80%
- Economia: 40-60% dos custos do modelo

### Baseado em incorporação (mais preciso)

Incorpore de 50 a 100 consultas rotuladas por categoria. Classifique novas consultas pelo vizinho mais próximo.

- Implementação: 4-8 horas
- Precisão: 85 92%
- Economia: 50-70% dos custos do modelo
- Custo adicional: ~$0,02/1 milhão de tokens para incorporações de classificação (insignificante)

### Baseado em ML (grau de produção)

Treine um classificador pequeno (regressão logística ou BERT pequeno) em pares históricos de consulta/modelo.

- Implementação: 1-2 semanas
- Precisão: 90-95%
- Economia: 60-75% dos custos do modelo
- Requer: dados de treinamento rotulados do tráfego de produção

## Configuração de limitação de taxa

### Parâmetros de bucket de token por nível

| Nível | Tamanho do balde | Taxa de recarga | Rotações máximas | Limite diário |
|------|------------|-------------|---------|-----------|
| Grátis | 50 mil tokens | 500/seg | 10 | 50K |
| Pró | 500 mil tokens | 5K/seg | 60 | 500 mil |
| Empresa | 5 milhões de tokens | 50K/seg | 300 | 5 milhões |

### Lista de verificação de implementação

1. Armazene buckets no Redis (não na memória) para aplicativos de várias instâncias
2. Use operações atômicas (MULTI/EXEC) para evitar condições de corrida
3. Retornar cabeçalho `Retry-After` com respostas de rejeição
4. Rastreie solicitações rejeitadas como uma métrica (>5% de rejeição = limites de nível muito apertados)
5. Implemente a degradação graciosa: rejeite primeiro solicitações de modelo caras e mantenha o acesso de modelo barato

## Controles de orçamento

### Disjuntor de três limiares

| Limite | Ação | Reversível |
|-----------|--------|-----------|
| 70% do orçamento mensal | Aviso de registro, equipe de alerta via Slack/PagerDuty | Sim (automático) |
| 85% do orçamento mensal | Direcione todo o tráfego para o modelo mais barato | Sim (automático, próximo ciclo de faturamento) |
| 95% do orçamento mensal | Servir apenas respostas em cache, rejeitar novas chamadas LLM | Sim (reset manual ou próximo ciclo) |

### Acompanhamento de custos por usuário

Acompanhe o custo cumulativo por usuário. Sinalize usuários que excedem 10x a mediana. Causas comuns:
- Usuário avançado legítimo (atualize seu nível)
- Loop de injeção imediata (bot enviando solicitações automatizadas)
- Integração ineficiente (cliente tentando novamente a cada erro)

## Campos de rastreamento de custos

Registre todas as chamadas de API com estes campos:

```json
{
  "timestamp": "2026-04-02T10:30:00Z",
  "model": "gpt-4o",
  "input_tokens": 1523,
  "output_tokens": 487,
  "cached_input_tokens": 1024,
  "latency_ms": 1847,
  "cost_usd": 0.006142,
  "user_id": "user_abc123",
  "cache_status": "partial_hit",
  "request_category": "customer_support",
  "complexity_class": "medium",
  "routed_from": "gpt-4o"
}
```

### Principais métricas do painel

- **Custo por consulta** (P50, P95, P99) – por modelo, por recurso, por nível de usuário
- **Taxa de acertos do cache** – exata versus semântica, tendência ao longo do tempo
- **Distribuição de modelo** -- % de tráfego por modelo, custo por modelo
- **Taxa de consumo do orçamento** -- gasto atual versus projeção mensal na taxa atual
- **Taxa de rejeição** -- % de solicitações com taxa limitada, por nível

## Erros comuns

| Erro | Por que dói | Correção |
|--------|-------------|-----|
| Cache com temperatura > 0 | Saídas não determinísticas, cache obsoleto fornece variedade errada | Armazene em cache apenas chamadas temp=0 ou aceite que as respostas armazenadas em cache percam a aleatoriedade |
| Limite de cache semântico muito baixo | Retorna respostas erradas para consultas superficialmente semelhantes | Comece em 0,95, diminua somente após medir a taxa de falsos positivos |
| Sem invalidação de cache | As respostas ficam obsoletas quando os dados subjacentes mudam | Definir TTL (1 hora para dados dinâmicos, 24 horas para estáticos), invalidar em atualizações de dados |
| Roteamento de todo o tráfego para o modelo mais barato | Qualidade cai, usuários notam | Encaminhar por complexidade, medir a qualidade por nível, definir limites mínimos de qualidade |
| Sem limites por usuário | Um usuário abusivo queima todo o orçamento | Sempre implemente cotas por usuário, mesmo que generosas |
| Ignorando tokens de saída | A produção custa 2 a 5 vezes mais do que a entrada por token | Defina max_tokens apropriadamente, use sequências de parada, comprima saídas |
| O cache antes do prompt é estável | O cache é preenchido com respostas de prompts antigos | Habilite o cache somente após a finalização do prompt, libere o cache nas alterações do prompt |

## Referência de preços (em abril de 2026)

| Modelo | Entrada ($/1 milhão) | Produção ($/1 milhão) | Entrada em cache ($/1 milhão) | Melhor para |
|---|---------|----------|---------|---------| 
| gpt-4.1-nano | US$ 0,10 | US$ 0,40 | US$ 0,025 | Tarefas simples de alto volume |
| gpt-4o-mini | US$ 0,15 | US$ 0,60 | US$ 0,075 | Roteamento simples, classificação |
| gemini-2.5-flash | US$ 0,15 | US$ 0,60 | US$ 0,0375 | Orçamento multimodal |
| claude-haiku-3.5 | US$ 0,80 | US$ 4,00 | US$ 0,08 | Tarefas rápidas de nível intermediário |
| o4-mini | US$ 1,10 | US$ 4,40 | US$ 0,275 | Raciocínio sobre um orçamento |
| gemini-2.5-pro | US$ 1,25 | US$ 10,00 | US$ 0,3125 | Contexto longo, multimodal |
| gpt-4o | US$ 2,50 | US$ 10,00 | US$ 1,25 | Uso geral, chamada de função |
| claude-soneto-4 | US$ 3,00 | US$ 15,00 | US$ 0,30 | Qualidade/custo equilibrado |
| claude-opus-4 | US$ 15,00 | US$ 75,00 | US$ 1,50 | Máxima qualidade, raciocínio complexo |