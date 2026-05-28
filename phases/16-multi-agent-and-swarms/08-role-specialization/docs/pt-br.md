# Eespecificaçãoialização de Papéis — Planejador, Crítico, Executor, Verificador

> A decomposição multi-agent mais comum em 2026: um agente planeja, um executa, um critica ou verifica. MetaGPT (arXiv:2308.00352) formaliza isso como SOPs codificados em prompts de papel — Gerente de Produto, Arquiteto, Gerente de Projeto, Engenheiro, Engenheiro QA — seguindo `Code = SOP(Team)`. ChatDev (arXiv:2307.07924) encadeia designer, programador, reviewer, tester através de uma "chat chain" com "comunicative dehallucination" (agents explicitamente pedem detalhes faltantes). O verificador é estrutural: Cemri et al. (MAST, arXiv:2503.13657) mostram que toda falha multi-agent pode ser rastreada até verificação faltante ou quebrada. PwC reportou ganho de 7× em acurácia (10% → 70%) de loops de validação estruturados no CrewAI.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 04 (Modelo Primitivo), Fase 16 · 05 (Supervisor)
**Tempo:** ~60 minutos

## Problema

Sistemas multi-agent genéricos produzem saída genérica. Três programadores num chat de grupo escrevem três variações do mesmo código medíocre. Você pode adicionar mais agents, mais rodadas, e ainda assim não cruzar o limiar de qualidade.

A correção não é mais agentes — são agentes *diferentes*. Atribua papéis distintos. Dê ao crítico ferramentas que o planejador não tem. Dê ao verificador um suite de testes objetivo. Agora o sistema tem discordância interna com correção fundamentada, não só chutes paralelos.

## Conceito

### Os quatro papéis canônicos

**Planejador.** Lê o objetivo, produz uma lista de passos ou uma especificação. Tools: recuperação de conhecimento, docs. Saída: plano estruturado.

**Executor.** Lê um passo do plano por vez, produz o artefato. Tools: as ferramentas de trabalho reais (compilador de código, shell, cliente API). Saída: o artefato.

**Crítico.** Lê a saída do executor contra a intenção do planejador. Tools: acesso somente-leitura ao artefato, análise estática. Saída: aceitar/rejeitar com motivos.

**Verificador.** Lê o artefato e roda uma verificação determinística. Tools: runner de testes, verificador de tipos, validador de schema. Saída: pass/fal com evidência.

Crítico é subjetivo, opinativo, geralmente baseado em LLM. Verificador é objetivo, determinístico, geralmente baseado em código. Não são o mesmo papel.

### O padrão SOP do MetaGPT

MetaGPT (arXiv:2308.00352) codifica SOPs de engenharia de software como prompts de papel:

- **Gerente de Produto** escreve o PRD.
- **Arquiteto** produz o design do sistema.
- **Gerente de Projeto** divide tarefas.
- **Engenheiro** implementa.
- **Engenheiro QA** roda testes.

Cada papel tem um schema de entrada/saída rigoroso. O prompt de papel diz o que o papel *é* e o que *deve produzir*. A formulação `Code = SOP(Team)` — SOPs determinísticos transformam um time de LLMs num pipeline previsível.

### A comunicative dehallucination do ChatDev

ChatDev adiciona um movimento-chave: quando um executor precisa de um detalhe eespecificaçãoífico que não estava no plano, ele pede explicitamente pro designer antes de continuar. Isso previne a falha clássica de LLM de inventar o detalhe de forma plausível.

Implementação: o prompt de papel inclui "quando você precisa de informação eespecificaçãoífica que não foi dada, pergunte pro papel relevante por nome antes de produzir saída."

### Por que o verificador é o mais importante

Cemri et al. (MAST) rastrearam 1642 falhas de execução multi-agent. 21.3% foram lacunas de verificação — o sistema entregou uma resposta que ninguém tinha checado. Os 79% restantes frequentemente se rastreiam até "houve uma verificação que falhou silenciosamente ou nunca foi rodada." Verificação é o papel estrutural.

PwC reportou (deployments CrewAI, 2025) que adicionar um loop de validação estruturado moveu acurácia de 10% pra 70%. Ganho de 7× de um papel.

### Crítico vs verificador

- Um crítico é um LLM revisando um artefato por qualidade. Subjetivo. Pode ser enganado por prosa plausível.
- Um verificador é um programa determinístico rodando no artefato. Objetivo. Dá pass/fal com evidência.

Use os dois. Crítico pega problemas de gosto que o verificador não consegue articular. Verificador pega bugs que o crítico não vê porque aparecem só em runtime.

### O anti-padrão

Todo papel no seu sistema é um LLM e toda saída de papel é "parece bom pra mim." Modo de falha clássico MAST. Adicione pelo menos um verificador cujo pass/fal é decidido por código, não por um LLM.

### Mapeamentos de framework

- **CrewAI** — `Agent(role, goal, backstory)` é a superfície de eespecificaçãoialização de livro didático.
- **LangGraph** — nós podem ter prompts eespecificaçãoializados; arestas forçam o pipeline.
- **AutoGen** — ConversableAgents com nomes de uma palavra em papéis eespecificaçãoíficos num GroupChat.
- **OpenAI Agents SDK** — ferramentas de handoff entre Agents eespecificaçãoializados por papel.

## Construa

`code/main.py` implementa um pipeline de 4 papéis construindo uma função Python simples:

- **Planejador** produz uma especificação.
- **Executor** gera uma string de código.
- **Crítico** (simulado por LLM) sinaliza problemas óbvios.
- **Verificador** roda o código gerado num sandbox (`exec`) contra um caso de teste.

Demo roda duas vezes: uma onde o executor produz código correto (crítico + verificador passam os dois), uma onde o executor produz código fora da eespecificaçãoificação (crítico perde o bug porque parece plausível, verificador pega porque o teste falha).

Execute:

```
python3 code/main.py
```

## Use

`outputs/skill-role-designer.md` pega uma tarefa e produz o elenco de papéis (3-5 papéis), o schema de entrada/saída por papel e a verificação do verificador. Use isso antes de conectar agentes num framework.

## Entregue

Checklist:

- **Pelo menos um verificador determinístico.** Nunca full-LLM.
- **Schema de E/S explícito por papel.** O planejador retorna uma especificação, não prosa; o executor lê esse schema.
- **Comunicative dehallucination.** Executor deve pedir ao planejador quando info falta; nunca inventar.
- **Ordem crítico/verificador.** Rode crítico primeiro (barato, pega problemas de design), verificador depois (lento, pega bugs).
- **Orçamento de loop.** Máx 2 rodadas de revisão crítico-executor antes de escalar pra humano.

## Exercícios

1. Execute `code/main.py` e observe como o verificador pega o bug que o crítico perdeu. Adicione uma verificação de análise estática (contar ocorrências de `return`) como verificador adicional. O que ele pega que o teste de runtime perde?
2. Adicione um 5º papel: "analista de requisitos" que traduz desejo do usuário em especificação pronta pro planejador. Quais pedidos de comunicative dehallucination devem subir pra ele?
3. Leia a Seção 3 do MetaGPT ("Agents"). Liste o schema de entrada/saída dos 5 papéis do MetaGPT.
4. Leia o diagrama de chat-chain do ChatDev (arXiv:2307.07924 Figura 3). Identifique onde a comunicative dehallucination quebra um loop que seria infinito.
5. O ganho de 7× em acurácia do PwC veio de loops de verificação. Hipotetize três tarefas onde adicionar um verificador não ajudaria — onde verificação determinística de correção é impossível ou proibitivamente cara.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Eespecificaçãoialização de papéis | "Agents diferentes, trabalhos diferentes" | System prompts distintos calibrados pros papéis planejador/executor/crítico/verificador. |
| Padrão SOP | "Procedimento operacional padrão codificado" | Enquadramento do MetaGPT: schemas de E/S rigorosos por papel transformam um time num pipeline. |
| Comunicative dehallucination | "Pergunte antes de inventar" | Padrão ChatDev: executor pede ao planejador quando um detalhe falta ao invés de inventar um. |
| Crítico | "Reviewer LLM" | Revisor subjetivo e opinativo. Pega problemas de gosto. Pode ser enganado por prosa plausível. |
| Verificador | "Verificação determinística" | Pass/fal baseado em código. Runner de testes, verificador de tipos, validador de schema. Não pode ser enganado. |
| Lacuna de verificação | "Ninguém checou" | 21.3% das falhas MAST. Resposta entregue sem verificação que teria pego o bug. |
| Loop de revisão | "Crítico devolve" | Rejeição do crítico dispara re-execução do executor com feedback. Precisa de orçamento. |
| Anti-padrão full-LLM | "Parece bom pra mim" | Todo papel é LLM, sem verificação determinística. Falha clássica MAST. |

## Leitura Complementar

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) — o paper de referência de SOP-como-prompt-de-papel
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) — chat chain + comunicative dehallucination
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — taxonomia MAST; lacunas de verificação são 21.3% das falhas
- [Docs do CrewAI — Agent roles](https://docs.crewai.com/en/introduction) — superfície de eespecificaçãoificação de papéis em produção
