# CrewAI: Crews Baseadas em Papel e Flows

> CrewAI é o framework multi-agent baseado em papel de 2026. Quatro primitivos: Agent, Task, Crew, Process. Duas formas de nível superior: Crews (autônomas, colaboração baseada em papel) e Flows (orientados a eventos, determinísticos). A documentação é direta: "pra qualquer aplicação pronta pra produção, comece com um Flow."

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 12 (Workflow Patterns), Fase 14 · 14 (Actor Model)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Nomear as quatro primitivas do CrewAI (Agent, Task, Crew, Process) e o que cada uma detém.
- Distinguir Sequential, Hierarchical e o Consensus planejado; escolha uma por carga de trabalho.
- Distinguir Crews (autônomas baseadas em papel) de Flows (orientados a eventos determinísticos) e explicar a recomendação de produção da documentação.
- Conectar ferramentas com o decorator `@tool` e subclasse `BaseTool`; raciocine sobre saídas estruturadas vs texto livre.
- Nomear os quatro tipos de memória do CrewAI e quando cada um compensa.
- Implementar uma crew de três agents com stdlib (pesquisador, escritor, editor) que produz um brief.
- Identificar os três modos de falha do CrewAI: inchaço de prompt, imposto do manager-LLM, handoffs frágeis.

## O Problema

Times adotando frameworks multi-agent batem no mesmo muro. "Colaboração autônoma" soa ótimo num demo. Aí um cliente abre bug e você precisa de replay determinístico. Ou finanças pergunta quanto custa por execução uma crew roteada por LLM. Ou o on-call precisa saber que agent travou às 3 da manhã.

Crews de forma livre roteadas por LLM não respondem nenhuma dessas direitinho. DAGs puras respondem todas mas perdem a forma exploratória que um agent de brainstorming precisa.

A divisão do CrewAI é honesta sobre o trade. Crews pra trabalho colaborativo, baseado em papel, exploratório. Flows pra produção orientada a eventos, detida por código, auditável. Mesmo framework, duas formas, escolha por superfície.

## O Conceito

### Quatro primitivas

A superfície do CrewAI é pequena. Memorize isso e o resto é configuração.

- **Agent.** `role + goal + backstory + tools + (opcional) llm`. O backstory aguenta o peso. Ele molda tom, julgamento, quando o agent para. Tools são funções que o agent pode chamar (mais abaixo).
- **Task.** `description + expected_output + agent + (opcional) context + (opcional) output_pydantic`. Uma unidade de trabalho reutilizável. `expected_output` é o contrato. `context` lista tasks upstream cujas saídas são passadas. `output_pydantic` força uma forma estruturada.
- **Crew.** Contêiner. Detém a lista de `agents`, a lista de `tasks`, o `process` e configurações opcionais `memory` + `verbose` + `manager_llm`.
- **Process.** Estratégia de execução. Sequential, Hierarchical, Consensus (planejado). Escolhe a forma da execução.

Agents não se veem diretamente. Tasks referenciam agents. A Crew sequencia tasks. O Process decide quem escolhe a próxima task. Esse é o modelo mental inteiro.

> **Validado contra** CrewAI 0.86 (2026-05). Versões mais recentes podem renomear ou mesclar tipos de processos; cheque a [documentação de CrewAI Processes](https://docs.crewai.com/concepts/processes) antes de depender de uma forma específica.

### Sequential vs Hierarchical vs Consensus

- **Sequential.** Tasks rodam na ordem de declaração. Saída da task N está disponível como `context` pra task N+1. Menor custo. Mais previsível. Use quando a ordem é fixa.
- **Hierarchical.** Um Agent manager (chamada de LLM separada) roteia entre especialistas. CrewAI cria o manager da sua config `manager_llm` ou um padrão. O manager escolhe a próxima task a cada rodada e pode recusar ou re-rotear. Use quando você tem quatro ou mais especialistas e a ordem genuinamente depende da saída anterior.
- **Consensus.** Planejado, não implementado na API pública. A documentação reserva o nome pra um processo futuro baseado em voto. Não dependa disso hoje.

Hierarchical adiciona uma chamada de LLM por rodada (o manager) em cima de cada chamada de especialista. Custo em tokens pode triplicar numa execução de cinco etapas. Pague só quando precisar do roteamento.

### Crews vs Flows

Esse é o framing que a documentação lidera em 2026.

- **Crew.** Autonomia dirigida por LLM. O framework escolhe a forma em runtime. Bom pra: pesquisa, brainstorming, primeiros rascunhos, qualquer lugar onde o caminho faz parte da resposta. Difícil de replayar. Difícil de testar. Barato de prototipar.
- **Flow.** Grafo orientado a eventos que você detém. `@start` marca a entrada. `@listen(topic)` marca uma etapa que dispara quando outra emite esse topic. Cada etapa é Python puro (pode chamar uma Crew internamente). Bom pra: produção. Observável. Testável. Determinístico.

A recomendação de produção da documentação em 2026: comece com um Flow. Enrole Crews como chamadas `Crew.kickoff()` de dentro de etapas de Flow quando autonomia ganha seu custo. O Flow dá a trilha de auditoria, a Crew dá a exploração. Componha, não escolha.

### Integração de ferramentas

Três formas de dar uma ferramenta a um Agent. Escolha a mais simples que se encaixa.

1. **Decorator `@tool`.** Funções puras viram ferramentas. Assinatura é o schema; docstring é a descrição que o LLM vê. Melhor pra helpers avulsos.

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **Subclasse `BaseTool`.** Ferramenta baseada em classe com schema de args explícito, suporte async, retries. Use quando a ferramenta tem estado (um cliente, um cache) ou precisa de args estruturados.

   ```python
   from crewai.tools import BaseTool
   from pydantic import BaseModel

   class SearchArgs(BaseModel):
       query: str
       limit: int = 10

   class SearchTool(BaseTool):
       name = "web_search"
       description = "Search the web and return top results."
       args_schema = SearchArgs

       def _run(self, query: str, limit: int = 10) -> str:
           return self.client.search(query, limit=limit)
   ```

3. **Toolkits embutidos.** CrewAI entrega adaptadores de primeira mão: `SerperDevTool`, `FileReadTool`, `DirectoryReadTool`, `CodeInterpreterTool`, `RagTool`, `WebsiteSearchTool`. Conecta com um import.

Saídas estruturadas usam Pydantic. Passe `output_pydantic=MyModel` na Task. CrewAI valida a resposta do LLM contra o modelo e coerce ou retries. Combine isso com uma string `expected_output` apertada. Saídas de texto livre servem pra rascunhos; saídas estruturadas são o que Flows downstream conseguem consumir.

### Hooks de memória

CrewAI entrega quatro tipos de memória de prontidão. Eles compõem: uma Crew pode habilitar os quatro ao mesmo tempo.

> **Validado contra** CrewAI 0.86 (2026-05). Releases recentes roteiam tudo por um sistema unificado `Memory` que envolve esses quatro armazenamentos. O modelo conceitual abaixo ainda vale, mas a superfície de classe pública pode colapsar pra um único ponto de entrada `Memory` em versões mais recentes; cheque a [documentação de memória do CrewAI](https://docs.crewai.com/concepts/memory) pela API atual.

- **Short-term.** Buffer de conversa dentro de uma única execução. Limpo no final.
- **Long-term.** Persistido entre execuções. Armazenado em vector DB (Chroma por padrão, trocável). Recuperado por similaridade à task atual.
- **Entity.** Fatos por entidade. "Cliente X está no plano enterprise." Chaveado por entidade, não por similaridade. Sobrevive entre execuções.
- **Contextual.** Recuperação na montagem. Puxa memória relevante no momento em que o Agent precisa, não pré-carregada.

Habilite na Crew com `memory=True` ou config por tipo. Suportado por um provider de embeddings que você configura (padrão OpenAI, trocável pra local). Memória é um dos lugares onde CrewAI ganha contra frameworks mais enxutos; LangGraph puro requer que você conecte cada uma dessas.

### Quando CrewAI se encaixa

- Três a seis agents com papéis nomeados e workflow colaborativo. Redação, revisão, planejamento, brainstorming.
- Roteamento onde o julgamento do LLM sobre a próxima etapa faz parte do valor (Hierarchical).
- Qualquer lugar onde o time lê `role + goal + backstory` mais feliz que uma definição de grafo.

### Quando CrewAI não se encaixa

- DAGs determinísticas com ordenação rígida. Use LangGraph (Aula 13). A forma de grafo é a abstração certa; o framing de papel do CrewAI é atrito.
- Orçamentos de latência sub-segundo. Hierarchical adiciona idas e vindas. Mesmo Sequential serializa prompts que incluem backstories e saídas anteriores.
- Loops de agent único. Pule o framework; um agent loop (Aula 1) mais um registro de ferramentas é menor.

Aula 17 (Tradeoffs de Frameworks de Agent) detalha isso numa matrix. Versão curta: CrewAI fica no canto "colaborativo baseado em papel."

### Forma de dependência

Independente de LangChain. Python 3.10 a 3.13. Usa `uv`. Contagem de stars: veja [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) (snapshot de 2026-05). Integração AWS Bedrock documentada; benchmarks de vendor reportam ganho substancial de velocidade vs LangGraph em cargas de QA, mas a metodologia (dataset, hardware, métrica de avaliação) não é publicada, então trate números de vendor como apenas indicativos.

### Onde esse padrão dá errado

- **Inchaço de prompt de backstories.** Um backstory de 2000 palavras por agent e uma crew de cinco agents queima o orçamento de contexto antes da primeira chamada de ferramenta. Mantenha backstories abaixo de 200 palavras. Reuse frases entre agents; não repita o estilo cinco vezes.
- **Imposto de tokens do manager-LLM.** Processo Hierarchical adiciona uma chamada de LLM do manager antes de cada chamada de especialista. Numa crew de cinco tasks são seis chamadas de LLM em vez de cinco, e a chamada do manager carrega a lista completa de tasks mais saídas anteriores. Mude pra Sequential a menos que roteamento dependa da saída.
- **Handoffs frágeis.** `expected_output` da task N é "um esboço." Task N+1 lê como `context` e tenta parsear três seções. O LLM produziu quatro. O agent downstream improvisa. Conserte com `output_pydantic` na task N pra que N+1 leia um objeto tipado, não texto livre.
- **Crew como produção.** Crew de forma livre entregue em produção sem wrapper de Flow. Variabilidade de saída é alta; replay é impossível; on-call não consegue diff de uma execução ruim contra uma boa. Enrole com um Flow.

## Construa

`code/main.py` implementa versões stdlib de ambas as formas mais uma crew de três agents.

Forma:

- `Agent`, `Task` dataclasses combinando com a superfície do CrewAI.
- `SequentialCrew.kickoff(inputs)` roda tasks na ordem de declaração, passando saídas como `context`.
- `HierarchicalCrew.kickoff(topic)` adiciona um Agent manager escolhendo o próximo especialista a cada rodada, para em "done."
- `Flow` com decorators `@start` e `@listen(topic)`, um mini loop de eventos e um trace.
- Decorator `tool(name)` espelhando a forma `@tool` do CrewAI.
- `Memory` com armazenamentos `short_term`, `long_term`, `entity`; similaridade mock usa numpy.
- Respostas mock de LLM são strings hardcoded com chave em role mais prefixo de input. Sem rede. Determinístico.

Demo concreta: crew de pesquisador, escritor e editor produzindo um brief sobre "agent engineering 2026." Pesquisador puxa (mocked) fontes. Escritor rascunha. Editor aperta. Mesma crew roda através de um Flow pra mostrar a forma determinística.

Rode:

```bash
python3 code/main.py
```

Trace cobre: crew sequencial passando saídas por `context`, crew hierárquica com escolhas do manager (pesquisador, escritor, editor e depois "done"), flow rodando as mesmas três etapas com topics explícitos (`researched`, `drafted`, `edited`), chamadas de ferramenta roteadas por `@tool` e memória de longo prazo persistindo entre dois kickoffs.

O trace da Crew é fluido; o manager poderia em princípio reordenar. O trace do Flow é fixo. Essa escolha é a aula.

## Use

- **CrewAI Flow** pra produção. Mesmo quando o Flow é uma etapa que chama `Crew.kickoff()`. O Flow dá o limite de auditoria.
- **CrewAI Crew (Sequential)** pra trabalho colaborativo de ordem clara, especialmente primeiros rascunhos e loops de revisão.
- **CrewAI Crew (Hierarchical)** quando roteamento depende da saída e você tem quatro ou mais especialistas.
- **LangGraph** (Aula 13) pra máquinas de estados explícitas, resume durável, ordenação rígida.
- **AutoGen v0.4** (Aula 14) pra concorrência de modelo ator e isolamento de falhas.
- **OpenAI Agents SDK** (Aula 16) pra produtos OpenAI-first com handoffs e guardrails.
- **Claude Agent SDK** (Aula 17) pra produtos Claude-first com subagents e session store.

## Entregue

`outputs/skill-crew-or-flow.md` escolhe Crew vs Flow pra uma tarefa e scaffolds a implementação mínima. Rejeições rígidas em Crew-sem-backstory, Flow-sem-topics-explícitos, Hierarchical com menos de três especialistas.

## Armadilhas

- **Backstory como tempero.** Ele molda saídas. Teste três variantes por agent; variância é real. Escolha uma, congele.
- **Pular `expected_output`.** Sem contrato por task, tasks downstream pegam o que o LLM produziu. Crew roda; auditoria falha.
- **Memória sempre ligada.** Escritas long-term a cada execução. Vector DB cresce. Recuperação fica barulhenta. Escopo as escritas pra tasks onde o fato é persistente.
- **Deriva de prompt do manager.** Prompt do manager no Hierarchical é implícito. Se roteamento fica estranho, despeje em modo verbose e leia.
- **Efeitos colaterais de ferramenta em Crews.** Uma Crew pode chamar uma ferramenta mais vezes que o esperado. POST, DELETE, pagamento ficam em etapa de Flow, nunca em ferramenta de Crew.

## Exercícios

1. Converta a crew Sequential pra Flow. Conte os pontos onde variabilidade cai. Note onde legibilidade cai.
2. Adicione memória de entidade à crew: fatos sobre um cliente persistem entre kickoffs. Verifique que recuperação puxa a entidade certa.
3. Implemente um processo Hierarchical onde o manager recusa roteiar pro editor até que a saída do escritor tenha pelo menos três parágrafos. Trace o retry.
4. Conecte uma subclasse `BaseTool` pra uma busca web (mocked). Compare a forma do trace vs a versão com decorator `@tool`.
5. Adicione `output_pydantic=Brief` à task do editor, onde `Brief` tem `title`, `summary`, `sections`. Faça a task do escritor produzir JSON malformado uma vez; verifique o comportamento de retry do CrewAI no trace.
6. Leia a introdução da documentação do CrewAI. Porte o exemplo pra API real `crewai`. Quais garantias a versão stdlib pulou?
7. Conecte AgentOps ou Langfuse (Aula 24) a uma execução real. Quais traces você perdeu na versão stdlib?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Agent | "Pessoa" | Papel + objetivo + backstory + ferramentas |
| Task | "Unidade de trabalho" | Descrição + output esperado + responsável + saída estruturada opcional |
| Crew | "Equipe de agents" | Contêiner pra Agents + Tasks + Process |
| Process | "Estratégia de execução" | Sequential / Hierarchical / Consensus (planejado) |
| Flow | "Workflow determinístico" | Orientado a eventos, detido por código, testável |
| Backstory | "Prompt de persona" | Modelador de tom e julgamento pro Agent |
| `@tool` | "Ferramenta function" | Decorator que transforma função em ferramenta que Agent pode chamar |
| `BaseTool` | "Ferramenta classe" | Ferramenta baseada em classe com schema de args, retries, suporte async |
| Entity memory | "Fatos por entidade" | Memória escopada a cliente / conta / issue |
| Long-term memory | "Memória cross-run" | Memória suportada por vector que sobrevive entre kickoffs |
| Contextual memory | "Recuperação just-in-time" | Memória puxada no momento em que Agent precisa |
| Manager LLM | "Agent roteador" | LLM extra no processo Hierarchical que escolhe a próxima task |
| `expected_output` | "Contrato de task" | String que diz ao Agent (e auditor) qual forma retornar |

## Leitura Complementar

- [CrewAI docs introduction](https://docs.crewai.com/en/introduction): conceitos e caminho de produção recomendado
- [CrewAI Flows guide](https://docs.crewai.com/en/concepts/flows): forma orientada a eventos, `@start`, `@listen`
- [CrewAI tools reference](https://docs.crewai.com/en/concepts/tools): `@tool`, `BaseTool`, toolkits embutidos
- [CrewAI memory](https://docs.crewai.com/en/concepts/memory): short-term, long-term, entity, contextual
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents): quando multi-agent ajuda e quando não
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview): a alternativa de máquina de estados
