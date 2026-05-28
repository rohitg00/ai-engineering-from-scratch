---
name: multi-agent-team
description: Construa uma equipe de software multiagente com arquiteto, codificadores paralelos, revisores e testadores; medir contra o SWE-bench Pro e produzir uma transferência post-mortem.
version: 1.0.0
phase: 19
lesson: 10
tags: [capstone, multi-agent, swe-bench, langgraph, a2a, worktree, roles]
---

Dado um URL de problema do GitHub e um nível de paralelismo, implante uma equipe de software multiagente que produza um PR pronto para mesclagem. Avalie 50 problemas do SWE-bench Pro e publique um histograma de falha de transferência.

Plano de construção:

1. Quadro de tarefas: armazenamento JSONL de mensagens digitadas com suporte de arquivo (ou Redis). Tipos de mensagens: plan_request, subtask, diff_ready, review_needed, review_feedback, aprovado, test_needed, test_passed, test_failed, replan_needed.
2. Arquiteto (Opus 4.7): lê o problema, escreve um plano, emite um DAG de subtarefas com interfaces explícitas (arquivos tocados, funções públicas, impacto de teste).
3. N codificadores (Soneto 4.7): cada um reivindica uma subtarefa, gera uma nova sandbox `git worktree add` + Daytona, implementa de forma independente.
4. Coordenador de mesclagem: mesclagem de três vias; Resolução de conflitos mediada por LLM apenas na sobreposição de nível de arquivo.
5. Revisor (GPT-5.4): lê a comparação mesclada; não pode aprovar diferenças de sua autoria; emite aprovado ou review_feedback roteado para o codificador relevante.
6. Testador (Gemini 2.5 Pro): executa o conjunto de testes em uma sandbox limpa; emite test_passed ou test_failed com artefatos.
7. Contabilidade de transferência: cada mensagem de função cruzada torna-se um intervalo Langfuse com tamanho e modelo de carga útil. Amplificação de token de cálculo = total_tokens / single_agent_baseline_tokens.
8. Injete uma análise de bug óbvia (10% das execuções) para medir a taxa de aprovação falsa do revisor.
9. Execute 50 edições do SWE-bench Pro; publicar pass@1, relógio de parede versus linha de base de agente único, detalhamento de token por função, histograma de falha de transferência.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | SWE-banco Pro pass@1 | Subconjunto de 50 edições pass@1 |
| 20 | Aceleração paralela | Linha de base de relógio versus agente único |
| 20 | Qualidade da revisão | Taxa de falsa aprovação na investigação de bug injetado |
| 20 | Eficiência simbólica | Total de tokens por problema resolvido versus agente único |
| 15 | Engenharia de coordenação | Resolução de conflitos de mesclagem, histograma de falha de transferência |

Rejeições difíceis:

- Revisor que pode aprovar diferenças de sua autoria ou propostas. Restrição difícil.
- Relatórios sem execução de linha de base de agente único correspondente. O multiagente precisa ganhar *por dólar*, não apenas passar@1.
- Quadros de tarefas onde as mensagens são strings de formato livre em vez de mensagens A2A digitadas.
- Mesclar coordenadores que eliminam silenciosamente diferenças conflitantes em vez de encaminhar de volta para replanejar.

Regras de recusa:

- Recuse-se a funcionar sem limites orçamentários por função (token + dólar).
- Recuse-se a abrir um PR cujo testador não tenha verificado em uma sandbox limpa.
- Recuse-se a dimensionar codificadores além de 8 em uma única execução. A sobrecarga de coordenação domina acima disso.

Saída: um repositório contendo o quadro de tarefas + trabalhadores de função, o log de execução do SWE-bench Pro de 50 edições, uma execução de linha de base de agente único correspondente, um painel Langfuse com intervalos marcados por função e detalhamentos de token por função, um relatório de investigação de bug injetado e uma autópsia nomeando as três transferências que quebraram com mais frequência e o esquema de mensagem ou alteração de prompt que reduziu cada uma.