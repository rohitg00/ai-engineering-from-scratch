---
name: workbench-benchmark
description: Execute a mesma tarefa por meio de pipelines somente de prompt e guiados pelo ambiente de trabalho no aplicativo de amostra do próprio projeto e emita um relatório de cinco resultados antes/depois.
version: 1.0.0
phase: 14
lesson: 41
tags: [benchmark, before-after, evaluation, workbench, sample-app]
---

Dado um repositório, um produto de agente e um pequeno aplicativo de amostra, produza um equipamento de avaliação portátil que compare somente prompt com pipelines guiados pelo ambiente de trabalho.

Produzir:

1. `eval/sample_app/` — um aplicativo de amostra com viabilidade mínima extraído do domínio do projeto.
2. `eval/run_prompt_only.py` e `eval/run_workbench.py`, cada um com uma descrição de tarefa e retornando um `TaskOutcome`.
3. `eval/report.py` que executa ambos os pipelines e grava `before-after-report.md` mais `comparison.json`.
4. Fluxo de trabalho de CI que falha quando os resultados do ambiente de trabalho regridem em um conjunto de tarefas fixo.
5. `docs/benchmark.md` explicando os cinco resultados e o que conta como regressão.

Rejeições difíceis:

- Um benchmark com apenas um pipeline. A comparação é o ponto principal.
- Resultados expressos em percentagens sem denominador. Sempre informe `n / m`.
- Um aplicativo de amostra no qual o produto do agente foi treinado. Use um acessório ajustado ao domínio.
- Relatórios que escondem falsos negativos. As tarefas onde somente prompt foi mais rápido devem ser enumeradas.

Regras de recusa:

- Caso o projeto não possua comando de aceitação, recuse o envio do benchmark. Não há nada para medir.
- Se o pipeline do ambiente de trabalho ocupar mais de 3x o pipeline somente de prompt na tarefa mediana, revele essa descoberta; a bancada precisa de simplificação, não o modelo.
- Se o chicote não puder funcionar off-line, recuse-se a conectá-lo ao CI. A instabilidade da rede corromperá a comparação.

Estrutura de saída:

```
<repo>/
├── eval/
│   ├── sample_app/
│   ├── run_prompt_only.py
│   ├── run_workbench.py
│   └── report.py
├── outputs/eval/
│   ├── before-after-report.md
│   └── comparison.json
├── docs/benchmark.md
└── .github/workflows/benchmark.yml
```

Termine com "o que ler a seguir" apontando para:

- Lição 42 para o pacote final que agrupa todas as superfícies usadas pelo pipeline da bancada.
- Lição 19 (SWE-bench, GAIA, AgentBench) para os benchmarks macro que complementa.
- Lição 30 (Desenvolvimento de agente baseado em avaliação) para loops de avaliação contínuos quando o benchmark estiver conectado.