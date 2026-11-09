# A paisagem do agente de codificação autónoma (2026)

> O banco SWE Verified passou de 4% para 80,9% em menos de três anos. O mesmo Claude Sonnet 4.5 marcou 43,2% no SWE-agent v1 e 59,8% no Cline autónomo  o andaime em torno do modelo agora importa tanto quanto o próprio modelo. OpenHands (anteriormente OpenDevin) é a plataforma mais ativa licenciada pelo MIT e seu loop CodeAct executa ações Python diretamente em uma caixa de areia em vez de chamadas de ferramentas JSON. Os números de cabeçalhos ocultam um problema metodológico: 161 das 500 tarefas verificadas de banco SWE exigem apenas uma alteração de linha de 12, e o banco SWE Pro (10 tarefas de linha superior) fica em 2359% para os mesmos modelos de fronteira.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## O problema

A pergunta certa é: em uma distribuição de tarefas que corresponda ao meu trabalho, com o andaime que vou executar na produção, que confiabilidade de ponta a ponta eu obtiver?

Entre 2022 e 2026, o campo aprendeu que o andaime  a camada de recuperação, o planejador, a caixa de areia, o loop de edição-verificação, o formato de feedback  é carregável. Claude Sonnet 4.5 no SWE-agent v1 marcou 43,2% no banco SWE Verified; o mesmo modelo dentro do andaime autônomo de Cline marcou 59,8%. 16.6 pontos absolutos de diferença, o mesmo peso. O modelo base é um componente; o ciclo é o produto.

O problema é que a saturação de benchmark oculta regressões. SWE-bench Verified está perto de saturado, e a cauda de tarefa fácil (161 das 500 tarefas que exigem ≤ 2 linhas) aumenta os pontuações. A qualidade do mundo real é melhor medida em distribuições como SWE-bench Pro (10+ mudanças de linhas), onde os mesmos líderes ainda sentam em 2359%.

## O conceito

### SWE-bench, um parágrafo

SWE-bench (Jimenez et al.) toma problemas reais do GitHub com patches de verdade no solo e pede a um agente para produzir um patch que faz com que o conjunto de testes passe. SWE-bench Verified (OpenAI, 2024) é um subconjunto de 500 tarefas curado pelo homem com as tarefas ambíguas e quebradas removidas. SWE-bench Pro é o sucessor mais difícil de tarefas que exigem 10+ linhas de mudança, onde os agentes fronteiriços atuais estão em 2359%.

### O que a curva 2022 → 2026 realmente mostra

- **2022**A partir de 1 de Janeiro de 1993, a Comissão apresentou um relatório sobre a aplicação do princípio da igualdade de oportunidades entre os Estados-Membros.
- **2024**: GPT-4 + andamios de estilo Devin em ~ 14%; agente SWE em ~ 12%.
- **2025**Claude 3.5/3.7 Sonnet dentro de Aider e agente SWE empurrar para a faixa de 4055%.
- **2026**A lista de classificação da Epoch AI acompanha esta ação ao vivo.

A inclinação provém de três fontes de composição: melhores modelos base, melhor andamento (CodeAct, reflexão, circuitos de verificação) e melhores referências (Removimento de ruído verificado).

### CodeAct vs JSON ferramenta chamadas

OpenHands (All-Hands-AI, arXiv:2407.16741, anteriormente OpenDevin) fez uma aposta arquitetônica específica: em vez do modelo emitindo chamadas de ferramenta JSON que um host decodifica e executa, o modelo emite código Python e um kernel de estilo Jupyter executa-o em uma caixa de areia.

O compromisso:

- **JSON tool calls**: cada ação é de uma vez; fácil de auditoria; composicionalidade limitada; segura por padrão porque cada chamada passa por um validador explícito.
- **CodeAct**: uma ação pode ser um programa inteiro; composição; requer uma caixa de areia endurecida (OpenHands usa isolamento Docker); modos de falha incluem qualquer coisa que o tempo de execução da caixa de areia permite.

As duas arquiteturas estão em produção. CodeAct é dominante em plataformas abertas (OpenHands, smolagents). As chamadas de ferramentas JSON continuam a ser dominantes em serviços gerenciados (Agentes Administrados Antropicos, Assistentes OpenAI) onde o provedor controla o executor.

### Escafados na paisagem de 2026

| Scaffold | License | Execution model | Notable property |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct in Docker | Most active open platform; event-stream replayable |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | First end-to-end SWE-bench scaffold |
| Aider | Apache-2 | edit-via-diff in local repo | Minimal scaffold, strong regression stability |
| Cline | Apache-2 | VS Code agent with tool policy | Highest-scoring open scaffold on Sonnet 4.5 |
| Devin (Cognition) | Proprietary | Managed VM + planner | First "AI software engineer" product category |
| Claude Code | Proprietary | Permission modes + routines | Lesson 10 covers the agent loop in detail |

### Por que o andaime domina

Uma corrida de codificação é uma trajetória de longo horizonte (Lessão 1).

1. **Retrieval**O ACI do SWE-agent, o índice de arquivos do OpenHands e o repo-map do Aider atacam tudo isso.
2. **Verifier loop**A execução de testes, a leitura de pistas e a repetição são 10 pontos delta no banco SWE.
3. **Failure containment**O mesmo modelo com e sem um ciclo de verificação parece ser dois produtos diferentes.

### Saturação do índice de referência e distribuição real

Os autores da OpenHands e da Epoch AI ambos sinalizam que o SWE-bench Verified tem uma cauda fácil: 161 das 500 tarefas precisam apenas de 12 linhas de mudança. As pontuações altas são impulsionadas em parte por essa cauda. O SWE-bench Pro restringe-se a 10+ mudanças de linhas e retorna pontuações na faixa de 2359% mesmo para sistemas de fronteira. Sua distribuição de produção é quase certamente mais próxima do Pro do que do Verified.

Implicação para a escolha de um agente: executar um subconjunto Pro-like de seu próprio backlog de bugs. A pontuação que importa é a pontuação em tarefas representativas do que você envia.

```figure
a5-scaffold-delta
```

## Usá-lo

`code/main.py`Comparar dois andares de agentes de brinquedo numa distribuição fixa de mini-tarefas:

1. A.**JSON tool-call**Equipamento que faz uma ação por virada.
2. A.**CodeAct**Equipamento que pode emitir um pequeno fragmento Python por ação.

Ambos usam um "modelo" de estúdio (regras deterministas), de modo que a comparação isola o andaime da qualidade do modelo.

## Envia-o

`outputs/skill-scaffold-audit.md`ajuda a auditar um esquadrão de agentes de codificação proposto antes da adoção: qualidade de recuperação, presença de verificadores, isolamento de caixa de areia e adequação de referência à distribuição.

## Exercícios

1. Corra .`code/main.py`Quantas voltas cada andaime faz no mesmo conjunto de tarefas? Qual é o raio de explosão por ação de cada um?

2. Leia o artigo OpenHands (arXiv:2407.16741). O artigo argumenta que o CodeAct supera as chamadas de ferramenta JSON em tarefas complexas. Identifique um modo de falha que o artigo reconhece e escreva uma frase sobre quando esse modo dominaria na produção.

3. Escolha uma tarefa do seu backlog de bugs que exigiria mais de 10 linhas de mudança em dois arquivos. Estima a probabilidade de sucesso de ponta a ponta para um modelo de fronteira sob (a) chamadas de ferramentas JSON e (b) CodeAct. Justifique a lacuna.

4. O banco SWE Verified tem 161 tarefas de um único arquivo, 12 linhas. Construa uma pontuação que as exclui. Como a tabela de classificação mistura?

5. Leia "Introdução de SWE-bench Verified" (OpenAI). Explique a metodologia específica usada para remover tarefas ambíguas e nomeie uma categoria que a curadoria não veria.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| SWE-bench | "Coding benchmark" | Real GitHub issues with ground-truth patches and test suites |
| SWE-bench Verified | "Cleaned subset" | 500 human-curated tasks, easier-tail present |
| SWE-bench Pro | "Harder subset" | 10+ line changes; frontier sits at 23–59% |
| CodeAct | "Code-as-action" | Agent emits Python; Jupyter-style kernel executes in sandbox |
| JSON tool call | "Function calling" | Each action is a structured JSON payload validated before execution |
| Scaffold | "Agent framework" | Retrieval + planner + executor + verifier loop around the base model |
| ACI (Agent-Computer Interface) | "SWE-agent's format" | Command set designed for LLM ergonomics, not human shells |
| Verifier loop | "Test-and-retry" | Run tests, read output, revise patch; biggest non-model reliability gain |

## Mais leitura

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) o indicador de referência e a metodologia originais.
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) como foi construído o subconjunto curado.
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) Arquitetura CodeAct e design de fluxo de eventos.
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks)- As pontuações em directo.
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) enquadramento de confiabilidade do agente codificador de longo horizonte.
