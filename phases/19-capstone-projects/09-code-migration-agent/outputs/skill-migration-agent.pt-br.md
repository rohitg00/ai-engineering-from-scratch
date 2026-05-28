---
name: migration-agent
description: Crie um agente de migração de código em nível de repositório que combine receitas determinísticas com um loop de fallback do agente, passe no MigrationBench e publique uma taxonomia de falha.
version: 1.0.0
phase: 19
lesson: 09
tags: [capstone, code-migration, openrewrite, libcst, migrationbench, agent, sandbox]
---

Dado um repositório Java 8 ou Python 2, produza uma ramificação migrada (para Java 17 ou Python 3.12) com um conjunto de testes verde e regressão de cobertura mínima. Avalie o subconjunto MigrationBench de 50 repositórios.

Plano de construção:

1. Passo determinístico: OpenRewrite (Java) ou libcst (Python) executa reescritas mecânicas primeiro. Confirme como o commit da "receita" com uma diferença limpa.
2. Sandbox Daytona: tempo de execução de destino pré-instalado; construção por filial; montagem de origem somente leitura.
3. Loop de agente: LangGraph ou OpenAI Agents SDK sobre Claude Opus 4.7 + GPT-5.4-Codex. Ferramentas: `run_build`, `read_file`, `edit_file`, `run_test`, `git_diff`. Classifique a falha (dep, sintaxe, teste, ferramenta de construção), aplique a correção direcionada e execute novamente.
4. Limites de orçamento: 30 min, US$ 8, 20 turnos. Violando quaisquer paradas e arquivos em `budget_exhausted` com a comparação atual.
5. Teste + portão de cobertura: construa o verde e depois teste o verde; a cobertura não deve cair mais de 2%.
6. PR aberto com commit de receita + commits do agente + comentário resumido.
7. Taxonomia de falha: tag por repositório de `{dep_upgrade_required, build_tool_drift, custom_annotation, test_flake, syntax_edge_case, budget_exhausted, coverage_regression}`.
8. 50 repositórios executados no MigrationBench; publicar taxa de aprovação por classe, custo por recompra e preservação de cobertura; comparar versus linha de base apenas determinística.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Taxa de aprovação do MigrationBench | Subconjunto de 50 repositórios pass@1 |
| 20 | Preservação da cobertura dos testes | Delta médio de cobertura vs agência base |
| 20 | Custo por repositório migrado | Média de $/repo em corridas de aprovação |
| 20 | Integração agente/ferramenta determinística | Fração de correções tratadas por OpenRewrite vs agente |
| 15 | Redação de análise de falhas | Completude da taxonomia com exemplares |

Rejeições difíceis:

- Pipelines que ignoram a passagem determinística. OpenRewrite lida com a mecânica 70-80% mais barata e confiável do que qualquer agente.
- Regressões de cobertura acima de 2% tratadas como aprovação.
- PRs que agrupam alterações mecânicas e de autoria do agente em um único commit. Deve separar.
- Taxa de aprovação de relatórios sem uma linha de base apenas determinística correspondente nos mesmos 50 repositórios.

Regras de recusa:

- Recuse-se a empurrar à força um ramo migrado sobre a base. Sempre uma nova filial + PR.
- Recuse-se a abrir um PR cujo CI não tenha ficado verde na sandbox.
- Recuse-se a executar repositórios corporativos sem licença explícita para modificação.

Resultado: um repositório contendo o pipeline de migração de duas camadas, os logs de execução do MigrationBench de 50 repositórios, o painel de taxonomia de falhas, uma execução de linha de base apenas determinística correspondente e um resumo das três classes de falhas mais comuns e a mudança de receita que eliminaria cada uma.