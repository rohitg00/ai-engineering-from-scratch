# Agents Generativos e Simulação Emergente

> Park et al. 2023 (UIST '23, arXiv:2304.03442) populou **Smallville**, um sandbox de 25 agents, com uma arquitetura de três partes: **stream de memória** (log em linguagem natural), **reflexão** (sínteses de ordem superior que o agente gera sobre seu próprio stream) e **plano** (comportamento em nível de dia, depois sub-planos). O resultado marcante foi a emergência da festa de Dia dos Namorados: um agente com a semente "quer dar uma festa de Dia dos Namorados", sem roteirização adicional, produziu convites que se espalharam pela população, coordenaram datas, e a festa aconteceu — a partir de 24 agentes que começaram sem saber nada disso. Ablações mostram que todas as três componentes são necessárias pra verossimilhança. As falhas documentadas são erros de normas espaciais (entrar em lojas fechadas, compartilhar banheiros individuais). Essa é a arquitetura de referência pra simulações de agentes e avaliação social multi-agent em 2026.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 04 (Primitive Model), Fase 16 · 13 (Shared Memory)
**Tempo:** ~75 minutos

## Problema

A maioria dos sistemas multi-agent são times roteirizados: planejador planeja, coder codifica, reviewer revisa. Isso funciona pra tarefas bem definidas. Não captura o comportamento emergente, não-roteirizado, que surge quando agentes têm memória, prioridades e um mundo aberto. Pesquisa, simulação de sociedade e cada vez mais game AI precisam desse segundo tipo.

A arquitetura Smallville é o benchmark pra isso. Até Park 2023, as melhores simulações de agentes eram seguidores de scripts rasos; depois disso, o padrão virou o default pra agentes generativos em mundos abertos. Se você constrói uma simulação de agentes em 2026, está usando as três componentes do Smallville ou justificando explicitamente por que não.

## Conceito

### As três componentes

**Stream de memória.** Um log append-only de observações, ações, reflexões e planos. Cada entrada tem timestamp, tipo, descrição (linguagem natural) e metadados derivados: **recência**, **importância** (auto-avaliada 1-10 pelo agent) e **relevância** (similaridade cosseno à consulta atual).

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

A recuperação de memória combina os três scores: `score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`. As top-k entradas entram no prompt atual.

**Reflexão.** Periodicamente (a cada N memórias ou em eventos importantes), o agente gera sínteses de ordem superior a partir de memórias recentes. Entradas de reflexão voltam ao stream e são recuperáveis como qualquer outra memória. É assim que agentes constroem "entendimentos" — o equivalente da arquitetura pra crenças de longo prazo.

**Plano.** Decomição top-down. Primeiro, um plano em nível de dia em traços amplos ("ir trabalhar, jantar com Klaus"). Depois planos em nível de hora. Depois planos em nível de ação. Planos são revisáveis: quando uma observação contradiz um plano, o agente replaneja o segmento afetado.

### Por que as três importam (ablação)

Park et al. rodaram ablações removendo cada uma de observação, reflexão e plano. Cada ablação prejudica verossimilhança:

- Sem **observação** o agente perde contexto e age em crenças desatualizadas.
- Sem **reflexão** o agente não consegue formar crenças de ordem superior; interações ficam rasas.
- Sem **plano** comportamento vira ruído reativo; objetivos se dissipam.

Scores de verossimilhança de avaliadores humanos são mais altos com as três; remover qualquer uma produz uma regressão mensurável.

### A emergência do Dia dos Namorados

Um agent, Isabella Rodriguez, recebe a semente do objetivo "quer dar uma festa de Dia dos Namorados no Hobbs Cafe em 14 de fev às 5pm." Os 24 outros agentes não recebem essa semente. Ao longo de dias simulados:

1. O plano de Isabella inclui convidar pessoas.
2. Cada convite vira uma observação no stream de memória de um vizinho.
3. A reflexão do vizinho gera crenças: "Isabella está dando uma festa."
4. O plano do vizinho incorpora "ir na festa em 14 de fev."
5. Vizinhos contam pra outros vizinhos. O convite se espalha sem coordenação central.
6. Às 5pm em 14 de fev, vários agentes convergem no Hobbs Cafe.

Isso é emergência no sentido técnico: comportamento em nível de sistema (uma festa) surgiu de interações locais (convites bilaterais + planejamento individual) sem um orquestrador central.

### Os modos de falha documentados

Park et al. documentam explicitamente:

- **Erros de norma espacial.** Agents entram em lojas fechadas. Agents tentam usar o mesmo banheiro individual. Agents comem em salas não destinadas pra alimentação. O modelo não infere normas sócio-físicas do ambiente sozinho.
- **Transbordamento de memória.** Runs de simulação longas fazem o custo de recuperação de memória crescer. Remédio prático: compactação periódica de memória (resumir-e-podar) e decay em entradas de baixa importância.
- **Alucinação de reflexão.** Reflexões podem inventar relações que não existem no stream de memória. Mitigação: inclua IDs de memórias fonte nos prompts de reflexão e verifique no momento da recuperação.

Esses são modos de falha relevantes pra produção: qualquer simulação de agentes de 2026 os herda.

### Regras de implementação das três componentes

1. **Memória é append-only.** Nunca mutate uma entrada de memória. Correções são novas entradas.
2. **Scores de importância são baratos.** Chame o LLM pra avaliar importância 1-10 na hora da escrita. Cache o score.
3. **Recuperação é ranqueada, não filtrada.** Top-k por score combinado; não use filtros rígidos (que perdem contexto).
4. **Reflexão roda periodicamente.** Dispare quando a soma de importâncias de memórias não processadas exceder um limite (por exemplo, 150).
5. **Planos são revisáveis.** Quando uma nova observação contradiz um plano, regenere só o segmento afetado, não o plano inteiro.

### Agents generativos além do Smallville

A literatura de acompanhamento de 2024-2026 estende a arquitetura:

- **Simulação social multi-agent pra pesquisa de mercado/política.** Populações tipo Smallville simulam comportamento de usuários em resposta a features. Mais rápido que testes A/B; acurácia é contestada.
- **NPC AI pra games.** RPGs com agentes Smallville produzem enredos emergentes em vez de quests roteirizadas.
- **Benchmarks de avaliação de agentes generativos.** Em vez de acurácia de tarefa, a métrica vira verossimilhança + coerência de comportamento em runs longas.

A arquitetura é a referência. Extensões trocam componentes (vector store pra memória, reflexão aumentada por retrieval, plano neuro-simbólico) mas mantêm a estrutura de três partes.

### Por que isso importa pra engenharia multi-agent

Smallville é a prova de conceito de que emergência multi-agent é barata quando as componentes estão certas. A arquitetura já foi replicada em modelos open-source (LLMs menores perdem verossimilhança graciosamente, não abruptamente). Qualquer sistema em produção que precisa de **comportamento social emergente** usa essa forma. Qualquer sistema que precisa de **execução apertada de tarefas** usa os padrões de supervisor / papéis / primitives das lições anteriores desta fase.

## Construa

`code/main.py` implementa as três componentes em Python stdlib com políticas de agente roteirizadas (sem LLM real). A demo reproduz a emergência da festa em miniatura:

- `MemoryStream` — log append-only com recuperação por recência/importância/relevância.
- `reflect(stream)` — reflexão roteirizada sobre memórias recentes de alta importância.
- `plan(agent_state)` — planos em nível de dia e hora baseados nas crenças atuais.
- Cenário: 5 agents. Agent 1 começa com "dar festa às 5pm." Ao longo de ticks simulados, o convite se espalha e agentes convergem.

Execute:

```
python3 code/main.py
```

Saída esperada: trace tick-a-tick. No tick final, pelo menos 3 dos 5 agentes mostram a festa em seu plano, e convergem no local da festa. A única semente produziu a chegada coordenada sem nenhum orquestrador.

## Use

`outputs/skill-simulation-designer.md` desenha uma simulação de agentes generativos: número de agents, schema de memória, cadência de reflexão, horizonte de plano e métrica de avaliação.

## Deploy

Regras pra simulações em produção:

- **Memória é o banco de dados.** Escolha um store real (vector DB, Postgres) em escala. Stdlib in-memory é pra protótipos.
- **Registre o trace de recuperação.** Pra cada ação, registre as top-k memórias que a motivaram. Essa é sua capacidade de debug.
- **Orçamento de tokens por agent.** Cada retrieve + reflect + plan por tick de cada agente é O(k) chamadas de LLM. N agentes × T ticks × chamadas-por-tick pode engolir seu orçamento.
- **Compacte memória periodicamente.** Resuma-e-pode entradas de baixa importância. Política de retenção é decisão de design, não detalhe.
- **Detecte violações de normas espaciais/sociais** explicitamente. A arquitetura não aprende elas.

## Exercícios

1. Execute `code/main.py`. Confirme que 3+ agentes convergem na festa. Aumente pra 10 agentes — a emergência ainda acontece?
2. Remova o passo de reflexão. Como fica o comportamento? Mapeie pra o achado de ablação do Park 2023.
3. Introduza um objetivo semente competidor ("Klaus quer dar uma palestra de pesquisa às 5pm"). Os agentes se dividem ou um objetivo domina? O que determina?
4. Adicione restrições espaciais: o Hobbs Cafe comporta no máximo 4 agents. A simulação lida com transbordamento graciosamente ou atinge o padrão de falha do "banheiro individual"?
5. Leia Park et al. (arXiv:2304.03442) Seção 6 (experimentos de comportamento emergente). Identifique um comportamento não reproduzível na sua miniatura. Qual componente da arquitetura você precisaria melhorar?

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Stream de memória | "O diário do agent" | Log append-only de observações, ações, reflexões, planos. |
| Recência | "Quão nova é a memória" | Score de decay exponencial pela idade. |
| Importância | "Quanto o agente se importa" | Auto-avaliada 1-10 na hora da escrita. Cached. |
| Relevância | "Quão relacionada à consulta atual" | Similaridade cosseno (baseada em embedding). |
| Reflexão | "Crença de ordem superior" | Síntese gerada a partir de memórias recentes, re-ingerida como nova memória. |
| Plano | "Decomição dia/hora/ação" | Árvore de planos top-down. Revisável quando observações contradizem. |
| Smallville | "O sandbox do Park 2023" | Simulação de 25 agentes que produziu a emergência do Dia dos Namorados. |
| Verossimilhança | "A métrica de qualidade" | Score de avaliadores humanos sobre se o comportamento parece de um agente plausível. |

## Leitura Complementar

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) — a arquitetura de referência
- [Página do paper UIST '23](https://dl.acm.org/doi/10.1145/3586183.3606763) — venue de publicação
- [Release do código Smallville](https://github.com/joonspk-research/generative_agents) — implementação Python de referência
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) — arte anterior pra agentes com memória estruturada
