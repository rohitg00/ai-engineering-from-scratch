# Especialização de funções  Planeador, crítico, executor, verificador

> A decomposição mais comum de multi-agentes em 2026: um agente planeja, um executa, um critica ou verifica. MetaGPT (arXiv:2308.00352) formaliza isso como SOPs codificados em instruções de papel  Product Manager, Architect, Project Manager, Engineer, QA Engineer  seguintes `Code = SOP(Team)`- Não . ChatDev (arXiv:2307.07924) cadeia designer, programador, revisor, testador através de uma "cadeia de bate-papo" com "desalucinação comunicativa" (agentes explicitamente solicitar detalhes faltantes). O verificador é resistente à carga: Cemri et al. (MAST, arXiv:2503.13657) mostram que cada falha multi-agente pode ser rastreada para a verificação faltante ou falhada. A PwC relatou um ganho de precisão de 7x (10% → 70%) a partir de ciclos de validação estruturados na CrewAI.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 05 (Supervisor)
**Time:** ~60 minutes

## Problemas

Os sistemas multi-agentes genéricos produzem saída genérica. Três programadores em um chat de grupo escrevem três sabores do mesmo código mediocre. Você pode adicionar mais agentes, adicionar mais rodadas e ainda não cruzar o limiar de qualidade.

A solução não é mais agentes  é * diferentes * agentes. atribuir papéis distintos. Dar as ferramentas críticas que o planejador não tem. Dar ao verificador um conjunto de testes objetivos. Agora o sistema tem desacordo interno com a correção fundamentada, não apenas adivinhação paralela.

## Conceptos

### Os quatro papéis canônicos

**Planner.**Leia o objetivo, produz uma lista de passos ou uma especificação Ferramentas: recuperação de conhecimentos, documentos.

**Executor.**Leia um plano passo a passo, produz o artefato. Ferramentas: as ferramentas de trabalho reais (compilador de código, shell, cliente API).

**Critic.**Leia a saída do executor contra a intenção do planejador. Ferramentas: acesso apenas para leitura do artefato, análise estática.

**Verifier.**Leia o artefato e executa uma verificação determinista. Ferramentas: test runner, verificador de tipo, validador de esquema.

O crítico é subjetivo, opinado, muitas vezes baseado em LLM. O verificador é objetivo, determinista, muitas vezes baseado em código.

### Padrão de SOP do MetaGPT

MetaGPT (arXiv:2308.00352) codifica os SOPs de engenharia de software como instruções de papel:

- **Product Manager**- O PRD escreve.
- **Architect**produz o projeto do sistema.
- **Project Manager**Divide as tarefas.
- **Engineer**- os instrumentos.
- **QA Engineer**- Faz testes.

Cada função tem um esquema de entrada/saída rigoroso.`Code = SOP(Team)`A formulação  SOPs deterministas transformam uma equipa de LLM num pipeline previsível.

### A desalucinação comunicativa do ChatDev.

ChatDev adiciona um movimento chave: quando um executor precisa de um detalhe específico que não estava no plano, ele pergunta explicitamente ao designer antes de continuar.

Implementação: o prompt de função inclui "quando você precisa de informações específicas que não lhe foram dadas, pergunte pelo nome do papel relevante antes de produzir a saída".

### Por que o verificador é mais importante

Cemri et al. (MAST) rastreou 1642 falhas de execução de vários agentes. 21,3% foram falhas de verificação  o sistema enviou uma resposta que ninguém tinha verificado. Os restantes 79% muitas vezes remontam a "havia um cheque que falhou silenciosamente ou nunca foi executado". Verificação é o papel de carga.

A PwC relatou (CrewAI deployments, 2025) que a adição de um ciclo de validação estruturada mudou a precisão de 10% para 70%.

### Critico vs verificador

- Um crítico é um Mestrado em Direito que avalia um artefato por qualidade.
- Um verificador é um programa determinista que funciona no artefato. Objetivo. Dá pass/falha com evidências.

Use ambos. O crítico detecta problemas de sabor que o verificador não pode articular. O verificador detecta bugs que o crítico não pode ver porque eles aparecem apenas no tempo de execução.

### O anti-patrão

Cada papel no seu sistema é um LLM e cada papel é "parece-me bem". Modo de falha MAST clássico. Adicione pelo menos um verificador cujo pass/falha é decidido por código, não por um LLM.

### Mapas de quadro

- **CrewAI**- Não .`Agent(role, goal, backstory)`é a superfície de especialização dos livros didáticos.
- **LangGraph**Os nós podem ter indicações especializadas; as bordas reforçam o pipeline.
- **AutoGen** Agentes conversáveis específicos de função com nomes de uma palavra em um Chat de Grupo.
- **OpenAI Agents SDK** Transferência de ferramentas entre agentes especializados em funções.

```figure
swarm-roles
```

## Construí-lo

`code/main.py`Implementa um pipeline de 4 funções construindo uma função Python simples:

- **Planner**produz uma especificação.
- **Executor**gera uma cadeia de código.
- **Critic**(SIMULADO DE MULTIMENTO) sinaliza problemas óbvios.
- **Verifier**executa o código gerado em uma caixa de areia (`exec`) contra um caso de ensaio.

Demo é executado duas vezes: uma vez quando o executor produz código correto (crítica + verificador ambos passam), uma vez quando o executor produz código off-spec (crítica perde o bug porque parece plausível, verificador pegou porque o teste falha).

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

## Usá-lo

`outputs/skill-role-designer.md`O sistema de verificação de dados é um sistema de verificação de dados que permite a verificação de dados.

## Envia-o

Lista de verificação:

- **At least one deterministic verifier.**Nunca tudo-LLM.
- **Explicit I/O schema per role.**O planejador retorna uma especificação, não prosa; o executor lê esse esquema.
- **Communicative dehallucination.**O executor deve perguntar ao planejador quando falta informação; nunca a invente.
- **Critic/verifier ordering.**Execute primeiro o crítico (barato, detecta problemas de design), segundo o verificador (lento, detecta bugs).
- **Loop budget.**Max 2 revisão de crítico-executivo rodadas antes de escalar para humano.

## Exercícios

1. Corra .`code/main.py`E observe como o verificador detecta o bug que o crítico perdeu. Adicione uma verificação de análise estática (contar ocorrências de `return`O que é que ele pega quando o teste de tempo de execução falha?
2. Adicione um quinto papel: "analista de requisitos" que traduz o desejo do usuário em especificação pronta para planejamento.
3. Leia a secção 3 do MetaGPT ("Agentes"). Enumere o esquema de entrada/saída de cada uma das 5 funções do MetaGPT.
4. Leia o diagrama da cadeia de bate-papo do ChatDev (arXiv:2307.07924 Figura 3). Identifique onde a desalucinação comunicativa quebra um ciclo que de outra forma seria infinito.
5. O ganho de precisão 7x da PwC veio de loops de verificação.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Role specialization | "Different agents, different jobs" | Distinct system prompts tuned for planner/executor/critic/verifier roles. |
| SOP pattern | "Encoded standard operating procedure" | MetaGPT's framing: strict I/O schemas per role turn a team into a pipeline. |
| Communicative dehallucination | "Ask before inventing" | ChatDev pattern: executor asks planner when a detail is missing rather than making one up. |
| Critic | "LLM reviewer" | Subjective, opinionated reviewer. Catches taste issues. Can be fooled by plausible prose. |
| Verifier | "Deterministic check" | Code-based pass/fail. Test runner, type checker, schema validator. Cannot be fooled. |
| Verification gap | "No one checked" | 21.3% of MAST failures. Answer shipped without a check that would have caught the bug. |
| Revision loop | "Critic sends it back" | Critic rejection triggers executor re-run with feedback. Needs a budget. |
| All-LLM anti-pattern | "Looks good to me" | Every role is an LLM, no deterministic check. Classic MAST failure. |

## Mais leitura

- [Hong et al. — MetaGPT: Meta Programming for Multi-Agent Collaboration](https://arxiv.org/abs/2308.00352) O documento de referência de PEC-as-roles
- [Qian et al. — Communicative Agents for Software Development (ChatDev)](https://arxiv.org/abs/2307.07924) Cadeia de bate-papo + desalucinação comunicativa
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomia MAST; as lacunas de verificação representam 21,3% das falhas
- [CrewAI docs — Agent roles](https://docs.crewai.com/en/introduction) superfície de especificação de papel de produção
