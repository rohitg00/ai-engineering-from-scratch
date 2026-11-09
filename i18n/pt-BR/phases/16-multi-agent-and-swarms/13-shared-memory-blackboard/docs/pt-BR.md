# Memória compartilhada e padrões de quadro negro

> Em 2026 existem duas abordagens em conjunto: o**message pool**(todos vêem as mensagens de todos, como no AutoGen GroupChat ou MetaGPT) e o **blackboard with subscription**(agentes se inscreverem em eventos relevantes, como no MCP Context-Aware ou na estrutura Matrix). Ambos são a única parte com estado de um sistema multi-agente  o que significa que ambos são onde os bugs interessantes vivem.**memory poisoning**A lição da "Study of the Fire" é uma lição de que um agente alucina um "fatto", outros agentes o tratam como verificado, e a precisão declina gradualmente de uma forma que é muito mais difícil de depurar do que um acidente imediato.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problemas

Os sistemas multi-agentes precisam de um lugar para os agentes compartilharem fatos. Uma opção literal é "passá-lo tudo em mensagens"  mas que reinventa o estado compartilhado com cópia extra. Outra é "dar a todos um log global"  mas os logs globais crescem ilimitados e envenenam facilmente.

Quando um dos agentes alucina e escreve a alucinação para o estado compartilhado, cada agente a seguir que lê esse estado adota a alucinação como fato. Quando os humanos percebem, a cadeia de raciocínio está a cinco passos de profundidade e a causa raiz é a terceira mensagem já escrita.

É a segunda família de falhas mais documentada na taxonomia MAST (Cemri et al., arXiv:2503.13657) e é estrutural: qualquer projeto de memória compartilhada sem origem e um verificador não-escritível irá exibí-lo eventualmente.

## Conceptos

### As duas principais topologias

**Full message pool.**Cada agente lê cada mensagem. AutoGen GroupChat e MetaGPT usam isso. Simple, transparente, inspecionável, mas não escala além de ~ 10 agentes porque o contexto de cada agente preenche o trabalho de outros agentes.

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**Blackboard with subscription.**Os agentes declaram interesse em tópicos; os substratos apenas encaminham mensagens relevantes. CA-MCP (arXiv:2601.11595) e a estrutura descentralizada Matrix (arXiv:2511.21686) usam isso. Escala ainda mais, mas requer um projeto de esquema antecipado para tornar as assinaturas significativas.

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### Quando cada um vencer

- **Full pool**O que é trivial é o que é dito quando todos vêem tudo.
- **Blackboard**O roteamento economiza custos simbólicos e poluição do contexto.

Os sistemas de produção frequentemente misturam-se: uma pequena piscina completa no topo (camada de planejamento), placas negras abaixo (camada de trabalhadores).

### Envenenamento da memória, num cenário

Três agentes trabalham numa tarefa de investigação, o agente A é um agente de recuperação, o agente B é um resumidor, o agente C é um analista.

1. A traz uma página e escreve uma mensagem para o estado compartilhado: "O estudo relata uma melhoria de 42 por cento na precisão".
2. A página que recebi disse "melhora de 4,2%". Um alucinava um decimal.
3. B, lendo o estado compartilhado, escreve: "Grande ganho de precisão de 42% relatado (fonte: A). "
4. C, lendo o estado compartilhado, escreve: "Recomenda adoção  42% elevação é transformadora".
5. O relatório final cita um número de 42% que nunca existiu.

Nenhum agente caiu, nenhum teste falhou, o sistema "funcionou", a alucinação passou do contexto de um agente para o raciocínio de cada agente através de um estado compartilhado.

### Por que é estrutural

Sem estado compartilhado, a alucinação do agente A permanece no contexto de A. Agentes do fluxo inferior re-recolherão ou re-derivarão e podem pegar o erro. Com estado compartilhado ingênuo, o contexto de A se torna o contexto de todos, e a alucinação é lavada em fato.

O problema não é o estado compartilhado em si.**without provenance and without an independent verifier**Três medidas de mitigação abordam isto:

1. **Attribute provenance on every write.**Cada entrada em registros estaduais compartilhados quem a escreveu, quando, sob que prompt e (se aplicável) qual a fonte citada pelo agente.
2. **Version writes; treat them as append-only.**Uma correcção é uma nova entrada que substitui a antiga, não uma atualização no local.
3. **Keep at least one agent that cannot write to shared state.**Um agente de verificação de somente leitura mostra entradas, recorre fontes e sinaliza inconsistências. Ele ainda lê o pool, então pode ser enganado por uma entrada ruim, mas verifica cada entrada contra a fonte original e não pode escrever, então seus veredictos nunca alimentam um fato envenenado de volta ao estado compartilhado.

### Precedente de quadro negro (Hayes-Roth, 1985)

O padrão de quadro negro precede os agentes de LLM em quatro décadas. Hayes-Roth (1985, "A Blackboard Architecture for Control") descreveu fontes de conhecimento especializadas que observam uma tabela negra global, contribuem com soluções parciais e desencadeiam outras fontes. O quadro negro de 2026 (CA-MCP, Matrix) é o mesmo padrão com agentes LLM como fontes de conhecimento e manchas JSON como soluções parciais. A literatura antiga tem documentado soluções para escrever contenção, controle oportunista e consistência que os sistemas modernos redescobrem.

### Projeção vs visão completa

Uma placa negra pura dá a cada assinante a mesma projeção (tema-escalado).**per-agent projection**A função de redução dobra o estado global em uma fatia específica de papel.

A projeção por agente aumenta mais, mas precisa de um esquema, sem um, você reconstrui a projeção ad hoc em cada agente.

### Padrões de conteúdo de escrita

A escrita simultânea de vários agentes é um problema de simultâneo, não apenas um problema de LLM.

- **Sequential writer (single producer).**Todas as cartas passam por um agente coordenador que serializa.
- **Optimistic concurrency with versioning.**Cada entrada tem uma versão; os escritores falham em versão de desajuste e retestar.
- **Topic partitioning.**Diferentes agentes possuem tópicos diferentes, não há contenção entre tópicos, requer limites de partição projetados.

A maioria dos frameworks 2026 é padrão para o escritor sequencial porque as chamadas de LLM são lentas o suficiente para que a contenção seja rara e o gargalo de engarrafamento não dói.

### O verificador não escritível

A maior mitigação da carga é a verificação de somente leitura.

- O verificador compartilha o estado com a equipe (leia o quadro negro ou o pool).
- Verificador não tem manobra de escrita para condicionar estado  apenas para um canal de verificação separado.
- Verificador independentemente traz fontes citadas em escritos.
- As próprias saídas do verificador são encaminhadas para um ser humano ou um agente de decisão separado, nunca voltadas para a piscina.

Sem esta separação, as saídas do verificador tornam-se novas entradas na piscina, o que significa que uma piscina envenenada envenena o verificador, o que envenena as suas verificações.

```figure
swarm-blackboard
```

## Construí-lo

`code/main.py`Implementa as duas topologias no STDlib Python, mais um ataque de intoxicação de brinquedo e as três mitigações.

- `MessagePool` Registo de apêndice só com leitura completa.
- `Blackboard` Pub/sub com tema-chave com assinaturas por agente.
- `ProvenanceEntry` todos os registros de escrita (writer, timestamp, prompt_hash, source_uri).
- `PoisoningScenario` executa uma tarefa de investigação de três agentes, onde o agente A alucina um decimal.
- `Verifier` um agente de somente leitura que retoma fontes e sinaliza inconsistências.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

Produção esperada:
- Corrida 1 (sem verificador): o 42% alucinado se propaga para o relatório final.
- Corrida 2 (com verificador): o verificador sinaliza a inconsistência, o grupo é rotulado "bandoado", o relatório final inclui uma retração.

## Usá-lo

`outputs/skill-memory-auditor.md`É uma habilidade que verifica o projeto de memória compartilhada de qualquer sistema multi-agente para proveniência, versão e separação de verificador.

## Envia-o

Para qualquer projeto de memória compartilhada:

- Registo de proveniência em cada escrita: `(writer, timestamp, prompt_hash, tool_calls_cited, source_uri)`- Não .
- As correções são novas entradas que fazem referência à substituição.
- Deploia pelo menos um agente de verificação de somente leitura com acesso à fonte independente.
- A saída do verificador de rota para um canal separado, não de volta para o pool compartilhado.
- Registrar a proporção de escritos que são supersões  uma proporção crescente é uma evidência inicial de padrões de alucinação.

## Exercícios

1. Corra .`code/main.py`Confirme que a primeira fase propaga a alucinação e a segunda a apanha.
2. Adicione uma segunda alucinação: o agente B inventa um conjunto de dados de tamanho.
3. Transforma a piscina inteira para um quadro com partições de tópicos (`prices`- Não .`summaries`- Não .`analyses`Quais são os cenários de intoxicação que o tema de partição torna mais difícil de realizar, e com quais não ajuda?
4. Leia Hayes-Roth (1985, "A Blackboard Architecture for Control"). Identifique dois padrões de controle do artigo não discutidos nesta lição que os sistemas 2026 beneficiariam.
5. Leia CA-MCP (arXiv:2601.11595). Mapear seu Comércio de Contexto Compartilhado para a classe MessagePool ou Blackboard em `code/main.py`Que primitivas adiciona o CA-MCP?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Message pool | "Shared chat history" | Append-only log that every agent reads. Full transparency, poor scaling. |
| Blackboard | "Shared workspace" | Topic-keyed pub/sub. Agents subscribe to relevant topics. Scales farther. |
| Provenance | "Who wrote what" | Metadata on each write: writer, timestamp, prompt, sources. |
| Memory poisoning | "Hallucinations spreading" | One agent's error enters shared state, downstream agents adopt it as fact. |
| Append-only | "No in-place updates" | Corrections are new entries that supersede. Preserves audit trail. |
| Unwritable verifier | "Independent auditor" | Read-only agent that re-fetches sources and flags inconsistencies. |
| Projection | "Scoped view" | Per-agent view computed from global state. LangGraph reducers are the canonical case. |
| Knowledge Source | "Specialist agent" | Hayes-Roth's 1985 term for a blackboard participant. |

## Mais leitura

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomia MAST; intoxicação da memória é uma subfamília de falhas de coordenação
- [CA-MCP — Context-Aware Multi-Server MCP](https://arxiv.org/abs/2601.11595) Compartilhado conteúdo de armazenamento para servidores MCP coordenados
- [Matrix — decentralized multi-agent framework](https://arxiv.org/abs/2511.21686) quadro de texto baseado em fila de mensagens sem um orquestrador central
- [LangGraph state and reducers](https://docs.langchain.com/oss/python/langgraph/workflows-agents) o padrão de projecção por agente na produção
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Notas de proveniência e de verificação de uma implantação de produção
