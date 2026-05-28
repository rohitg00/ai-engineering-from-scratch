# Capstone 09 — Agent de Migração de Código (Upgrade de Linguagem/Runtime em Nível de Repo)

> MigrationBench da Amazon (Java 8 para 17) e o migrador Py2-to-Py3 do App Engine da Google definiram a barra de 2026. OpenRewrite da Moderne faz rewrites AST determinísticos em escala. Grit ataca o mesmo problema com uma DSL estilo codemod. O padrão de produção combina ambos: um substrato determinístico para rewrites seguros mais uma camada de agente para os casos ambíguos, um sandbox para builds por branch e um teste de suporte que fica verde antes do PR abrir. O capstone é migrar 50 repos reais e publicar uma taxa de pass com uma taxonomia de falhas.

**Tipo:** Capstone
**Linguagens:** Python (agent), Java / Python (alvos), TypeScript (painel)
**Pré-requisitos:** Fase 5 (NLP), Fase 7 (transformers), Fase 11 (engenharia de LLM), Fase 13 (ferramentas), Fase 14 (agents), Fase 15 (autônomo), Fase 17 (infraestrutura)
**Fases exercitadas:** P5 · P7 · P11 · P13 · P14 · P15 · P17
**Tempo:** 30 horas

## Problema

Migração de código em larga escala é uma das aplicações mais limpas de agentes de programação em 2026. O ground truth é óbvio (a suíte de testes passa após a migração?), as recompensas são reais (migração de uma frota Java-8 é um projeto de escala de quadro de pessoal) e os benchmarks são públicos (subconjunto de 50 repos do MigrationBench). OpenRewrite da Moderne lida com o lado determinístico. A camada de agente lida com tudo que as receitas do OpenRewrite não conseguem: rewrites ambíguos, deriva de sistema de build, sintaxe de cauda longa, quebra de dependências transitivas.

Você vai construir um agente que pega um repo Java 8 (ou Python 2) e produz uma branch migrada com CI verde. Você vai medir taxa de pass, preservação de cobertura de testes, custo por repo e construir uma taxonomia de falhas. A comparação lado a lado com uma baseline somente-determinística te diz onde o valor do agente realmente está.

## Conceito

A pipeline tem duas camadas. O **substrato determinístico** (OpenRewrite para Java, libcst para Python) roda a maior parte dos rewrites mecânicos de forma segura: imports, assinaturas de métodos, edições de null-safety, try-with-resources, substituições de APIs descontinuadas. É rápido e produz diffs auditáveis. A **camada de agent** (SDK OpenAI Agents ou LangGraph sobre Claude Opus 4.7 e GPT-5.4-Codex) lida com casos que as receitas não conseguem: atualizações de arquivo de build (Maven/Gradle/pyproject), conflitos de dependências transitivas, testes flaky, anotações customizadas.

Cada repo recebe um sandbox Daytona com o runtime alvo pré-instalado. O agente itera: roda build, classifica falhas, aplica correção, re-roda. Limites rígidos: 30 minutos por repo, $8 por repo, 20 turnos do agent. Se todos os testes passarem e o delta de cobertura não for negativo, a branch abre um PR. Se não, o repo fica arquivado sob uma classe de falha com evidência.

A taxonomia de falhas é a entrega. Ao longo de 50 repos, o que quebrou? Dependências transitivas? Anotações customizadas? Versão de ferramenta de build? Testes flaky não relacionados à migração? Cada classe recebe uma contagem e um diff exemplar. Autores de receitas futuras podem mirar nos três primeiros.

## Arquitetura

```
repo alvo
      |
      v
receitas determinísticas OpenRewrite / libcst
   (seguras, rápidas, auditáveis, ~70-80% das correções)
      |
      v
sandbox Daytona por branch
      |
      v
loop do agente (Claude Opus 4.7 / GPT-5.4-Codex):
   - rodar build -> capturar falhas
   - classificar falhas (build, teste, lint)
   - aplicar correção (patch ou retry de receita)
   - re-rodar
   - orçamento: 30 min, $8, 20 turnos
      |
      v
gate de teste + delta de cobertura
      |
      v (passou)
abrir PR
      |
      v (falhou)
arquivar sob classe de falha + anexar reprodução
```

## Stack

- Substrato determinístico: OpenRewrite (Java) ou libcst (Python)
- Agent: SDK OpenAI Agents ou LangGraph sobre Claude Opus 4.7 + GPT-5.4-Codex
- Sandbox: devcontainers Daytona por branch, runtime alvo pré-instalado (Java 17 / Python 3.12)
- Sistemas de build: Maven, Gradle, uv (Python)
- Benchmarks: subconjunto de 50 repos do MigrationBench da Amazon (Java 8 para 17), repos Py2-to-Py3 do App Engine da Google
- Teste de suporte: runner paralelo, cobertura via Jacoco (Java) ou coverage.py (Python)
- Observabilidade: Langfuse + pacote de trace por repo com cada chunk de diff
- Painel: painel de taxonomia de falhas com contagens por classe e diffs exemplares

## Construa

1. **Passada de receitas.** Rode OpenRewrite (Java) ou libcst (Python) primeiro. Pegue os 70-80% das migrações que são mecânicas. Commite como commit "receita".

2. **Tentativa de build.** Sandbox Daytona: instale runtime alvo, rode o build. Se verde, pule para testes. Se vermelho, entregue ao agent.

3. **Loop do agent.** LangGraph com ferramentas: `run_build`, `read_file`, `edit_file`, `run_test`, `git_diff`. O agente classifica a falha (dep, sintaxe, teste, ferramenta de build) e aplica uma correção direcionada. Re-rote.

4. **Limites de orçamento.** 30 minutos de relógio por repo, $8 de custo, 20 turnos do agent. Qualquer violação pausa e arquiva sob "budget_exhausted" com o diff atual.

5. **Gate de teste + cobertura.** Após o build ficar verde, rode a suíte de testes. Compare cobertura com o repo base. Se cobertura caiu mais de 2%, arquive sob "coverage_regression".

6. **Abrir PR.** Em sucesso, faça push da branch, abra o PR com o diff e um resumo de quais receitas se aplicaram e quais commits o agente escreveu.

7. **Taxonomia de falhas.** Para cada repo falhado, rotule com uma classe: `dep_upgrade_required`, `build_tool_deriva`, `custom_annotation`, `test_flake`, `syntax_edge_case`, `budget_exhausted`. Construa um painel.

8. **Execução de 50 repos.** Execute no subconjunto do MigrationBench. Relate taxa de pass por classe, custo-por-repo, preservação-de-cobertura e comparação-vs-baseline-somente-determinística.

## Use

```
$ migrate legacy-java-service --target java17
[receita]   27 rewrites aplicados (JUnit 4->5, inicializador HashMap, try-with-resources)
[build]     FALHA: símbolo não encontrado sun.misc.BASE64Encoder
[agent]     turno 1 classificar: removed_jdk_api
[agent]     turno 2 aplicar: sun.misc.BASE64Encoder -> java.util.Base64
[build]     OK
[testes]    412/412 passando; cobertura 84.1% -> 84.3%
[pr]        aberto #1841  custo=$3.20  turnos=4
```

## Entregue

`outputs/skill-migration-agent.md` é a entrega. Dado um repo, ela executa receitas determinísticas depois um loop de agente para produzir uma branch migrada verde, ou arquiva o repo sob uma classe de taxonomia.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Taxa de pass MigrationBench | Subconjunto de 50 repos pass@1 |
| 20 | Preservação de cobertura de testes | Delta médio de cobertura vs base |
| 20 | Custo por repo migrado | $/repo em execuções que passaram |
| 20 | Integração agente / ferramenta determinística | Fração de correções que o OpenRewrite tratou vs o agente escreveu |
| 15 | Análise de falhas | Taxonomia completa com exemplares |
| **100** | | |

## Exercícios

1. Rode a pipeline de migração com OpenRewrite apenas (sem agent). Compare a taxa de pass com a pipeline completa. Identifique os casos onde só o agente faz a diferença.

2. Implemente uma verificação "lint-clean": após a migração, rode um linter de estilo (spotless para Java, ruff para Python). Faça o PR falhar se novos erros de lint aparecerem. Meça a taxa de cobertura-preservada-mas-estilo-degradado.

3. Adicione um otimizador "diff-mínimo": após a branch do agente passar nos testes, corte mudanças desnecessárias com uma segunda passada. Relate a redução no tamanho do diff.

4. Estenda para uma terceira migração: Node 18 para Node 22. Reutilize a envoltória de sandbox; troque a camada de receitas por um codemod customizado.

5. Meça o tempo-até-primeiro-build-verde (TTFGB) como métrica de UX. Meta: p50 abaixo de 10 minutos.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Substrato determinístico | "Motor de receitas" | OpenRewrite / libcst: rewrites AST declarativos com garantias de segurança |
| Codemod | "Programa de modificação de código" | Uma regra de rewrite que altera código fonte mecanicamente |
| Build deriva | "Inconsistência de versão de ferramentas" | Mudanças sutis de comportamento Maven / Gradle / uv entre versões principais |
| Classe de falha | "Balde de taxonomia" | Uma razão rotulada por que o repo não migrou: dep, sintaxe, teste, ferramenta de build, orçamento |
| Delta de cobertura | "Preservação de cobertura" | Mudança na % de cobertura de testes do base para a branch migrada |
| Turno do agente | "Rodada de chamada de ferramenta" | Um ciclo plano -> executar -> observar no loop do agente |
| Esgotamento de orçamento | "Batendo no teto" | O repo consumiu seu limite de 30 min / $8 / 20 turnos sem passar |

## Leitura Complementar

- [MigrationBench da Amazon](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) — benchmark canônico de 2026
- [Plataforma OpenRewrite da Moderne.io](https://www.moderne.io) — referência do substrato determinístico
- [Documentação OpenRewrite](https://docs.openrewrite.org) — criação de receitas
- [Grit.io](https://www.grit.io) — DSL de codemod alternativa
- [Cookbook de migração em sandbox da OpenAI](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) — referência do Agents SDK
- [Migrador Py2 para Py3 do App Engine da Google](https://cloud.google.com/appengine) — benchmark de migração alternativo
- [libcst](https://github.com/Instagram/LibCST) — substrato determinístico Python
- [Sandboxes Daytona](https://daytona.io) — sandbox de referência por branch
