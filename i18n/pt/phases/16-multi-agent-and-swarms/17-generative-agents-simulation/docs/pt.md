# Agentes geradores e simulação emergente

> Park et al. 2023 (UIST '23, arXiv:2304.03442) povoado **Smallville**, uma caixa de areia de 25 agentes, com uma arquitetura de três partes: **memory stream**(registro de linguagem natural), **reflection**(sínteses de nível superior que o agente gera sobre o seu próprio fluxo), e **plan**(comportamento de nível diário, depois sub-plans). O resultado histórico foi o surgimento da festa do Dia dos Namorados: um agente sementeou com "quer organizar uma festa do Dia dos Namorados", sem mais roteiro, produziu convites espalhados pela população, datas coordenadas, e a festa aconteceu  de 24 agentes que começaram sem saber disso. As ablações mostram que os três componentes são necessários para a credibilidade. Os falhas documentadas são erros de norma espacial (entrada em lojas fechadas, partilha de banheiros para uma pessoa). Esta é a arquitetura de referência para simulações de agentes e avaliação social multi-agente em 2026.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problemas

A maioria dos sistemas multi-agentes são equipes estritamente escritas: planos de planejamento, códigos de codificação, revisões de revisores. Isso funciona para tarefas bem definidas. Não captura o comportamento emergente e não escrito que surge quando os agentes têm memória, prioridades e um mundo aberto. Pesquisa, simulação da sociedade e AI de jogos precisam deste segundo tipo.

A arquitetura de Smallville é o ponto de referência para isso. Até Park 2023, as melhores simulações de agentes eram seguidores de guiões superficiais; depois disso, o padrão é o padrão padrão para agentes geradores em mundos abertos. Se você construir uma simulação de agente em 2026, você está usando os três componentes de Smallville ou justificando explicitamente por que não está.

## Conceptos

### Os três componentes

**Memory stream.**Um registro de observações, ações, reflexões e planos apenas apêndice. Cada entrada tem um timestamp, um tipo, uma descrição (linguagem natural) e metadados derivados: **recency**- Não .**importance**(auto-rated 1-10 pelo agente), e **relevance**(similidade de cosina com a consulta corrente).

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

A recuperação da memória combina as três pontuações: `score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`As entradas de cima-k entram no prompt atual.

**Reflection.**Periodicamente (a cada N memórias ou em eventos importantes), o agente gera síntese de ordem mais alta a partir de memórias recentes. As entradas de reflexão voltam ao fluxo e são recuperáveis como qualquer outra memória. É assim que os agentes construem "entendimentos"  o equivalente da arquitetura de crenças de longo prazo.

**Plan.**A decomposição de cima para baixo. Primeiro, um plano de nível diário em grandes traços ("vai trabalhar, jantar com Klaus"). Depois planos a nível horário.

### Por que as três coisas importam (abertura)

Park et al. executaram ablações que deixam cair cada uma das observações, reflexão e plano.

- Sem .**observation**O agente perde o contexto e age com crenças obsoletas.
- Sem .**reflection**O agente não pode formar crenças de ordem superior; as interações permanecem superficiais.
- Sem .**plan**O comportamento torna-se ruído reativo; os objetivos se dissiparem.

Os resultados de credibilidade dos avaliadores humanos são mais altos com os três; a queda de qualquer um produz uma regressão mensurável.

### A emergência do Dia dos Namorados

Uma agente, Isabella Rodriguez, é semeada com o objetivo de "quer organizar uma festa de São Valentim no Hobbs Café em 14 de fevereiro às 17h".

1. O plano da Isabella inclui convidar pessoas.
2. Cada convite se torna uma observação no fluxo de memória do vizinho.
3. A reflexão daquele vizinho gera crenças: "Isabella está fazendo uma festa".
4. O plano do vizinho inclui "assistir à festa no dia 14 de fevereiro".
5. Os vizinhos dizem aos outros vizinhos, o convite se espalha sem coordenação central.
6. Às 17h, 14 de fevereiro, vários agentes convergem no Hobbs Cafe.

Este é o surgimento no sentido técnico: o comportamento a nível do sistema (um partido) surgiu de interações locais (invitações bilaterais + planejamento individual) sem um orquestador central.

### Os modos de falha documentados

Park et al. documentam explícitamente:

- **Spatial norm errors.**Os agentes entram em lojas fechadas. Os agentes tentam usar a mesma casa de banho individual. Os agentes comem em salas não destinadas a comer. O modelo não deduz as normas sociais-físicas apenas do ambiente.
- **Memory overflow.**A simulação profunda faz com que o custo de recuperação da memória aumente. Remédio prático: compactação periódica da memória (resumo e poda) e decadência em entradas de baixa importância.
- **Reflection hallucination.**Reflexões podem inventar relações que não existem no fluxo de memória. Mitigation: incluir ids de memória fonte em instruções de reflexão e verificar no momento da recuperação.

Estes são modos de falha relevantes para a produção: qualquer simulação de agente 2026 herda-os.

### Regras de execução de três componentes

1. **Memory is append-only.**Nunca mude uma entrada de memória.
2. **Importance scores are cheap.**Liga para o Mestrado para avaliar a importância entre 1 e 10 no momento da escrita.
3. **Retrieval is ranked, not filtered.**Top-k por pontuação combinada; não use filtros duros (que perdem contexto).
4. **Reflection runs periodically.**Trigger quando a soma da importância das memórias não processadas exceda um limiar (por exemplo, 150).
5. **Plans are revisable.**Quando uma nova observação contradiz um plano, regenerar apenas o segmento afetado, não o plano inteiro.

### Agentes geradores para além de Smallville

A literatura de acompanhamento 2024-2026 estende a arquitetura:

- **Multi-agent social simulation for policy / market research.**Populações semelhantes a Smallville simulam o comportamento do usuário em resposta a características.
- **NPC AI for games.**Jogos de papel com agentes de Smallville produzem histórias emergentes em vez de missões guiadas.
- **Generative-agent evaluation benchmarks.**Em vez de precisão da tarefa, a métrica se torna credibilidade + coerência do comportamento em longas corridas.

A arquitetura é a referência. As extensões trocam componentes (localização vetorial para memória, reflexão aumentada por recuperação, plano neurosimbólico), mas mantêm a estrutura de três partes.

### Por que isso importa para a engenharia multi-agente

Smallville é a prova do conceito de que a emergência de multi-agentes é barata quando os componentes são corretos. A arquitetura foi agora replicada em modelos de código aberto (LLCs menores perdem credibilidade graciosamente, não fortemente). Qualquer sistema de produção que precisa **emergent social behavior**Qualquer sistema que precise.**tight task execution**utiliza os padrões de supervisor / papéis / primitivos de início nesta fase.

```figure
a5-memory-reflection
```

## Construí-lo

`code/main.py`Implementa os três componentes em stdlib Python com políticas de agente scripted (sem LLM real).

- `MemoryStream` Registro de apêndice apenas com recuperação de recência/importância/relevância.
- `reflect(stream)` reflexão escrita sobre memórias recentes de grande importância.
- `plan(agent_state)` planos de nível diário e horário baseados nas crenças atuais.
- O cenário: 5 agentes, o agente 1 começa com "a festa de lançamento às 17h".

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

A produção esperada: rastreamento de tique por tique. No tique final, pelo menos 3 dos 5 agentes mostram o partido em seu plano, e convergem no local do partido. A única semente produziu a chegada coordenada sem nenhum orquestrador.

## Usá-lo

`outputs/skill-simulation-designer.md`concebe uma simulação de agente gerador: número de agentes, esquema de memória, cadência de reflexão, horizonte de plano e métrica de avaliação.

## Envia-o

Regras para simulações de produção:

- **Memory is the database.**Escolha uma loja real (vector DB, Postgres) em escala.
- **Log the retrieval trace.**Para cada ação, registra as memórias que o levaram.
- **Budget per-agent tokens.**O plano de cada agente de recuperação + reflexo + por tick é $O(k)$N agentes × T ticks × chamadas por tick pode envenenar o seu orçamento.
- **Compact memory periodically.**Resumir e cortar as entradas de baixa importância.
- **Detect spatial / social norm violations**A arquitetura não os aprende.

## Exercícios

1. Corra .`code/main.py`Aumentar os agentes para 10 .
2. Remova o passo de reflexão. Como é que o comportamento parece? Mapa para a descoberta de ablação no Park 2023.
3. Introduza um objetivo sementeado em competição ("Klaus quer dar uma palestra de pesquisa às 17h").
4. Adicione restrições espaciais: Hobbs Cafe pode conter no máximo 4 agentes. O maná de simulação transbordar graciosamente, ou atinge o padrão de falha de "banheiro de uma pessoa única"?
5. Leia Park et al. (arXiv:2304.03442) Seção 6 (experimentos de comportamento emergente). Identifique um comportamento não reprodutivel em sua miniatura. Que componente da arquitetura você precisaria melhorar?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory stream | "The agent's diary" | Append-only log of observations, actions, reflections, plans. |
| Recency | "How new is the memory" | Exponential-decay score by age. |
| Importance | "How much does the agent care" | Self-rated 1-10 at write time. Cached. |
| Relevance | "How related to the current query" | Cosine similarity (embedding-based). |
| Reflection | "Higher-order belief" | Synthesis generated from recent memories, re-ingested as a new memory. |
| Plan | "Day/hour/action decomposition" | Top-down plan tree. Revisable when observations contradict. |
| Smallville | "Park 2023's sandbox" | 25-agent simulation that produced the Valentine's Day emergence. |
| Believability | "The quality metric" | Human-rater score for whether behavior seems like a plausible agent. |

## Mais leitura

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) a arquitetura de referência
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763) local de publicação
- [Smallville code release](https://github.com/joonspk-research/generative_agents) implementação de Python de referência
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) arte anterior para agentes de memória estruturada
