# Capstone 09  Agente de migração de código (Linguagem de nível re-re-exercício / atualização do tempo de execução)

> O MigrationBench da Amazon (Java 8 a 17) e o migrante Py2-to-Py3 do App Engine do Google definem a barra de 2026. O OpenRewrite de Moderne faz reescrituras deterministas de AST em escala. O Grit tem como alvo o mesmo problema com o DSL de estilo codemod. O padrão de produção combina ambas as coisas: um substrato determinista para reescrituras seguras, mais uma camada de agente para os casos ambíguos, uma caixa de areia para construções por ramo e um arame de ensaio que se torna verde antes da abertura do PR. A pedra final é migrar 50 repos reais e publicar uma taxa de passagem com uma taxonomia de falhas.

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard, agent scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## Problemas

A migração de código em larga escala é uma das aplicações de produção mais limpas de agentes de codificação de 2026. A verdade do terreno é óbvia (a série de testes passa após a migração?), os benefícios são reais (uma migração de frota Java-8 é um projeto em escala de pessoal) e os índices de referência são públicos (subconjunto de MigrationBench 50 repo). O OpenRewrite da Moderne lida com o lado determinista. A camada de agente lida com tudo o que as receitas OpenRewrite não podem: reescrituras ambíguas, deriva do sistema de construção, sintaxe de cauda longa, quebra de dependência transitória.

Você vai construir um agente que toma um repo Java 8 (ou Python 2 repo) e produz um ramo migrado de CI verde. Você vai medir a taxa de passagem, preservação da cobertura de teste, custo por repo e construir uma taxonomia de falha. O lado a lado contra uma linha de base apenas determinista diz-lhe onde o valor do agente realmente vive.

## Conceptos

O oleoduto tem duas camadas.**deterministic substrate**(OpenRewrite para Java, libcst para Python) executa a maior parte das reescrituras mecânicas de forma segura: importações, assinaturas de método, edições de segurança nula, tentativa de recursos, substituição de API desatualizada. É rápido e produz diferenças auditaveis.**agent layer**(OpenAI Agents SDK ou LangGraph sobre Claude Opus 4.7 e GPT-5.4-Codex) trata casos que as receitas não podem: atualizações de arquivos de construção (Maven/Gradle/pyproject), conflitos de dependência transitivos, flocos de teste, anotações personalizadas.

Cada repo recebe uma caixa de areia Daytona com o tempo de execução alvo pré-instalado. O agente itera: execução de construção, classificação de falhas, aplicação de correção, re-exécution. Limites duros: 30 minutos por repo, $ 8 por repo, 20 turnos de agente. Se todos os testes passarem e a cobertura cair em não mais de 2 pontos percentuais, o ramo abre um PR. Se não, o repo é arquivado sob uma classe de falha com evidências.

A taxonomia de falhas é o entregue. Em 50 repos, o que foi quebrado? deps transitivos? anotações personalizadas? construir versão de ferramenta? testar flocos não relacionados à migração? Cada classe recebe uma contagem e um exemplar diferença.

## Arquitetura

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## Estaca

- Substrato determinista: OpenRewrite (Java) ou libcst (Python)
- Agente: OpenAI Agents SDK ou LangGraph sobre Claude Opus 4.7 + GPT-5.4-Codex
- Sandbox: Daytona devcontainers por ramo, pré-instalado tempo de execução de destino (Java 17 / Python 3.12)
- Sistemas de construção: Maven, Gradle, uv (Python)
- Referências: Amazon MigrationBench 50 repo subconjunto (Java 8 a 17), Google App Engine Py2-to-Py3 repos
- Arnes de teste: corredor paralelo, cobertura via Jacoco (Java) ou coverage.py (Python)
- Observabilidade: Langfuse + trace bundle por repo com cada peça diferente
- Painel de controlo: painel de controlo de falhas de taxonomia com contagens por classe e diferenças exemplares

```figure
ce-migration-funnel
```

## Construí-lo

1. **Recipe pass.**Execute primeiro as receitas OpenRewrite (Java) ou libcst (Python). Capta 70-80% das migrações que são mecânicas. Compromete-se como "receita" compromete.

2. **Build trial.**Sandbox Daytona: instale o tempo de execução do alvo, execute a construção.

3. **Agent loop.**LangGraph com ferramentas: `run_build`- Não .`read_file`- Não .`edit_file`- Não .`run_test`- Não .`git_diff`O agente classifica a falha (profundidade, sintaxe, teste, ferramenta de construção) e aplica uma correcção direccionada.

4. **Budget caps.**30 minutos de tempo por repo, 8 dólares, 20 voltas de agente.

5. **Test + coverage gate.**Depois que a construção for verde, execute o conjunto de testes. Compare a cobertura com o repo base. Se a cobertura caiu mais de 2 pontos percentuais, arquivar sob "cobreza_regressão".

6. **PR open.**Em caso de sucesso, empurra o ramo, abra o PR com a diferença e um resumo das receitas aplicadas e que compromete o agente autor.

7. **Failure taxonomy.**Para cada repo falhado, etiquete com uma classe: `dep_upgrade_required`- Não .`build_tool_drift`- Não .`custom_annotation`- Não .`test_flake`- Não .`syntax_edge_case`- Não .`budget_exhausted`- Construir um painel.

8. **50-repo run.**Executa através do subconjunto MigrationBench. Relatório por taxa de passagem por classe, custo por repo, cobertura-preservação e uma linha de base comparada com determinista apenas.

## Usá-lo

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## Envia-o

`outputs/skill-migration-agent.md`Dado um repo, ele executa receitas deterministas, em seguida, um ciclo de agente para produzir um ramo migrado verde, ou arquivar o repo sob uma classe de taxonomia.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base |
| 20 | Cost per migrated repo | $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes that OpenRewrite handled vs agent authored |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |
| **100** | | |

## Exercícios

1. Execute o pipeline de migração com OpenRewrite apenas (sem agente). Compare a taxa de passagem com o pipeline completo. Identifique os casos em que o agente sozinho é a diferença.

2. Implementar uma verificação de "linto limpo": após a migração, executar um linter de estilo (incompleto para Java, ruff para Python). Falhar no PR se aparecerem novos erros de linto. Medir a taxa de cobertura preservada, mas estilo-regressado.

3. Adicionar um optimizador de "diferência mínima": após o ramo do agente passar nos testes, corrigir as alterações desnecessárias com um segundo passo.

4. Estender para uma terceira migração: Nodo 18 para Nodo 22. Reutilizar a embalagem da caixa de areia; trocar a camada de receita por um codemod personalizado.

5. Meter o tempo de construção verde-primeira (TTFGB) como uma métrica UX. Meta: p50 abaixo de 10 minutos.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | "Recipe engine" | OpenRewrite / libcst: declarative AST rewrites with safety guarantees |
| Codemod | "Code-modifying program" | A rewrite rule that changes source code mechanically |
| Build drift | "Tool version skew" | Subtle Maven / Gradle / uv behavior changes between major versions |
| Failure class | "Taxonomy bucket" | A labeled reason a repo did not migrate: dep, syntax, test, build-tool, budget |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to migrated branch |
| Agent turn | "Tool-call round" | One plan -> act -> observe cycle in the agent loop |
| Budget exhaustion | "Hit the ceiling" | The repo consumed its 30-min / $8 / 20-turn limit without passing |

## Mais leitura

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) o índice de referência canônico de 2026
- [Moderne.io OpenRewrite platform](https://www.moderne.io) a referência de substrato determinista
- [OpenRewrite documentation](https://docs.openrewrite.org) Atividade de composição
- [Grit.io](https://www.grit.io) Modulo de código DSL alternativo
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) a referência ao KSD Agents
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) índice de referência de migração alternativa
- [libcst](https://github.com/Instagram/LibCST) Substrato determinista Python
- [Daytona sandboxes](https://daytona.io) Referência por caixa de areia
