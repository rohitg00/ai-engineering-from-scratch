# Memória Compartilhada e Padrões Blackboard

> Duas abordagens coexistem em sistemas multi-agent em 2026: o **pool de mensagens** (todo mundo vê as mensagens de todo mundo, como no AutoGen GroupChat ou MetaGPT) e o **blackboard com subscription** (agents se inscrevem em eventos relevantes, como no Context-Aware MCP ou framework Matrix). Ambas são a única parte stateful de um sistema multi-agent — o que significa que ambas são onde os bugs interessantes vivem. O modo de falha de referência é **envenenamento de memória**: um agente alucina um "fato", outros agentes tratam como verificado, e a acurácia degrada gradualmente de um jeito muito mais difícil de debugar que um crash imediato. Esta lição constrói ambas as estruturas em stdlib, injeta um ataque de envenenamento, e mostra as três mitigações que realmente funcionam em produção.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib, `threading`)
**Pré-requisitos:** Fase 16 · 04 (Primitive Model), Fase 16 · 09 (Parallel Swarm Networks)
**Tempo:** ~75 minutos

## Problema

Sistemas multi-agent precisam de um lugar pra agentes compartilharem fatos. Uma opção literal é "passar tudo em mensagens" — mas isso reinventa estado compartilhado com cópia extra. Outra é "dar a todo mundo um log global" — mas logs globais crescem sem limite e se envenenam fácil. Uma terceira é "projetar uma visão por agent" — escalável mas pesado em schema.

Quando um dos agentes alucina e escreve a alucinação no estado compartilhado, todo agente downstream que lê aquele estado adota a alucinação como fato. Quando o humano percebe, a cadeia de raciocínio já tem cinco passos e a causa raiz é a terceira mensagem já escrita. Debugar degradação de acurácia em multi-agent é mais difícil que debugar um crash.

Isso é envenenamento de memória. É a segunda família de falhas mais documentada na taxonomia MAST (Cemri et al., arXiv:2503.13657) e é estrutural: qualquer design de memória compartilhada sem proveniência e um verificador não-escritável vai apresentá-lo eventualmente.

## Conceito

### As duas topologias principais

**Pool de mensagens completo.** Cada agente lê cada mensagem. AutoGen GroupChat e MetaGPT usam isso. Simples, transparente, inespecificaçãoionável, mas não escala além de ~10 agentes porque o contexto de cada agente se enche do trabalho dos outros.

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**Blackboard com subscription.** Agents declaram interesse em tópicos; o substrato roteia apenas mensagens relevantes. CA-MCP (arXiv:2601.11595) e o framework descentralizado Matrix (arXiv:2511.21686) usam isso. Escala mais, mas requer design prévio de schema pra tornar as subscriptions significativas.

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### Quando cada um vence

- **Pool completo** vence quando são poucos agentes (< 10), heterogêneos, e a conversa é de curto prazo. Raciocinar sobre quem disse o que é trivial quando todo mundo vê tudo.
- **Blackboard** vence quando são muitos agents, homogêneos em papel mas numerosos em instância (swarms), e a conversa é de longa duração. O roteamento economiza custo de token e poluição de contexto.

Sistemas em produção frequentemente misturam: um pool completo pequeno no topo (camada de planejamento), blackboards abaixo (camada de workers).

### Envenenamento de memória, num cenário

Três agentes trabalham numa tarefa de pesquisa. Agent A é um agente de retrieval. Agent B é um sumarizador. Agent C é um analista.

1. A busca uma página e escreve uma mensagem no estado compartilhado: "O estudo relata uma melhoria de 42% na acurácia."
2. A página buscada dizia na verdade "4.2% de melhoria." A alucinou uma casa decimal.
3. B, lendo o estado compartilhado, escreve: "Grande ganho de 42% na acurácia relatado (fonte: A)."
4. C, lendo o estado compartilhado, escreve: "Recomendo adoção — 42% de ganho é transformador."
5. O relatório final cita um número de 42% que nunca existiu.

Nenhum agente crashou. Nenhum teste falhou. O sistema "funcionou." A alucinação cruzou do contexto de um agente pra cada raciocínio downstream via estado compartilhado.

### Por que isso é estrutural

Sem estado compartilhado, a alucinação do agente A ficaria no contexto do A. Agents downstream refariam o retrieval ou o raciocínio e poderiam pegar o erro. Com estado compartilhado ingênuo, o contexto do A vira o contexto de todo mundo, e a alucinação é lavada em fato.

O problema não é o estado compartilhado em si — é estado compartilhado **sem proveniência e sem um verificador independente**. Três mitigações resolvem isso:

1. **Atribua proveniência em cada escrita.** Cada entrada no estado compartilhado registra quem escreveu, quando, sob qual prompt, e (se aplicável) qual fonte o agente citou. Agents downstream leem com ceticismo calibrado pela proveniência.
2. **Versione escritas; trate-as como append-only.** Uma correção é uma nova entrada que substitui a antiga, não uma atualização in-place. A trilha de auditoria é preservada.
3. **Mantenha pelo menos um agente que não pode escrever no estado compartilhado.** Um agente verificador read-only amostra entradas, refaz buscas de fontes e sinaliza inconsistências. Porque não pode escrever no pool, não pode ser envenenado pelo pool.

### Precedente de blackboard (Hayes-Roth, 1985)

O padrão blackboard precede agentes LLM em quatro décadas. Hayes-Roth (1985, "A Blackboard Architecture for Control") descreveu Knowledge Sources eespecificaçãoializadas que observam um blackboard global, contribuem soluções parciais, e disparam outras sources. O blackboard de 2026 (CA-MCP, Matrix) é o mesmo padrão com agentes LLM como Knowledge Sources e blobs JSON como soluções parciais. A literatura antiga tem soluções documentadas pra contenção de escritas, controle oportunístico e consistência que sistemas modernos redescobrem.

### Projeção vs visão completa

Um blackboard puro dá a cada subscriber a mesma projeção (limitada por tópico). Um design mais agressivo é **projeção por agent**: cada agente recebe uma visão customizada pro seu papel. Os state reducers do LangGraph são a implementação canônica de 2026 — a função reducer dobra o estado global num slice eespecificaçãoífico pro papel.

A projeção por agente escala mais, mas precisa de schema. Sem um, você reconstrói projeção ad-hoc no prompt de cada agent.

### Padrões de contenção de escrita

Múltiplos agentes escrevendo simultaneamente é um problema de concorrência, não só de LLM. Três padrões funcionam:

- **Escritor sequencial (produtor único).** Todas as escritas passam por um agente coordenador que serializa. Simples, mas gargalo.
- **Concorrência otimista com versionamento.** Cada entrada tem uma versão; escritores falham em mismatch de versão e retry. Técnica clássica de banco de dados.
- **Particionamento por tópico.** Agents diferentes são donos de tópicos diferentes. Sem contenção entre tópicos. Requer limites de partição projetados.

A maioria dos frameworks de 2026 usa escritor sequencial como padrão porque chamadas de LLM são lentas o suficiente pra contenção ser rara e o gargalo não doer.

### O verificador não-escritável

A mitigação mais importante é o verificador read-only. Regras de implementação:

- Verificador compartilha estado com o time (lê o blackboard ou pool).
- Verificador não tem handle de escrita no estado compartilhado — só num canal de verificação separado.
- Verificador busca independentemente fontes citadas nas escritas. Sinaliza discordância.
- As saídas do verificador são roteadas pra um humano ou pra um agente de decisão separado, nunca voltam pro pool.

Sem essa separação, as saídas do verificador viram novas entradas no pool, o que significa que um pool envenenado envenena o verificador, que envenena suas verificações.

## Construa

`code/main.py` implementa ambas as topologias em Python stdlib mais um ataque de envenenamento fictício e as três mitigações.

- `MessagePool` — log append-only thread-safe com leitura completa.
- `Blackboard` — pub/sub com chave de tópico e subscriptions por agent.
- `ProvenanceEntry` — cada escrita registra (escritor, timestamp, prompt_hash, source_uri).
- `PoisoningScenario` — roda uma tarefa de pesquisa de três agentes onde o agente A alucina uma casa decimal. Imprime o relatório final.
- `Verifier` — um agente read-only que refaz buscas de fontes e sinaliza inconsistências. Roda o mesmo cenário com o verificador presente.

Execute:

```
python3 code/main.py
```

Saída esperada:
- Run 1 (sem verificador): a alucinação de 42% se propaga pro relatório final.
- Run 2 (com verificador): o verificador sinaliza a inconsistência, o pool é marcado como "flagged", o relatório final inclui uma retratação.

## Use

`outputs/skill-memory-auditor.md` é uma skill que audita o design de memória compartilhada de qualquer sistema multi-agent quanto a proveniência, versionamento e separação de verificador. Rode antes da produção em novas arquiteturas multi-agent.

## Deploy

Para qualquer design de memória compartilhada:

- Registre proveniência em cada escrita: `(escritor, timestamp, prompt_hash, tool_calls_cited, source_uri)`.
- Torne o log append-only. Correções são novas entradas que referenciam a substituída.
- Deploy pelo menos um agente verificador read-only com acesso independente a fontes.
- Roteie a saída do verificador pra um canal separado, não de volta pro pool compartilhado.
- Registre a proporção de escritas que são substituições — uma proporção crescente é evidência precoce de padrões de alucinação.

## Exercícios

1. Execute `code/main.py`. Confirme que a run 1 propaga a alucinação e a run 2 pega ela.
2. Adicione uma segunda alucinação: o agente B inventa um tamanho de dataset. O verificador deveria pegar as duas sem ser ajustado manualmente pra nenhuma.
3. Troque o pool completo por um blackboard com partições de tópico (`prices`, `summaries`, `analyses`). Quais cenários de envenenamento o particionamento de tópico torna mais difíceis e quais não ajuda?
4. Leia Hayes-Roth (1985, "A Blackboard Architecture for Control"). Identifique dois padrões de controle do paper que não são discutidos nesta lição e que sistemas de 2026 se beneficiariam.
5. Leia CA-MCP (arXiv:2601.11595). Mapeie o Shared Context Store deles pra classe MessagePool ou Blackboard em `code/main.py`. Quais primitives o CA-MCP adiciona?

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Message pool | "Histórico de chat compartilhado" | Log append-only que cada agente lê. Transparência total, escalabilidade ruim. |
| Blackboard | "Workspace compartilhado" | Pub/sub com chave de tópico. Agents se inscrevem em tópicos relevantes. Escala mais. |
| Proveniência | "Quem escreveu o quê" | Metadados em cada escrita: escritor, timestamp, prompt, fontes. |
| Envenenamento de memória | "Alucinações se espalhando" | O erro de um agente entra no estado compartilhado, agentes downstream adotam como fato. |
| Append-only | "Sem atualizações in-place" | Correções são novas entradas que substituem. Preserva trilha de auditoria. |
| Verificador não-escritável | "Auditor independente" | Agent read-only que refaz buscas de fontes e sinaliza inconsistências. |
| Projeção | "Visão escopada" | Visão por agente computada do estado global. Os reducers do LangGraph são o caso canônico. |
| Knowledge Source | "Agent eespecificaçãoialista" | Termo de Hayes-Roth de 1985 pra um participante do blackboard. |

## Leitura Complementar

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — taxonomia MAST; envenenamento de memória é sub-família de falha de coordenação
- [CA-MCP — Context-Aware Multi-Server MCP](https://arxiv.org/abs/2601.11595) — Shared Context Store pra servers MCP coordenados
- [Matrix — decentralized multi-agent framework](https://arxiv.org/abs/2511.21686) — blackboard baseado em fila de mensagens sem orquestrador central
- [LangGraph state and reducers](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — o padrão de projeção por agente em produção
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — notas sobre proveniência e verificação de um implantação em produção
