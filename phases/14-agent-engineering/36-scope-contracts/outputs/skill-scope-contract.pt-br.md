---
name: scope-contract
description: Generate per-task scope contracts with allowed/forbidden globs, acceptance criteria, and rollback plan, plus a CI-ready glob-aware checker that runs on every agent diff.
version: 1.0.0
phase: 14
lesson: 36
tags: [scope, contract, globs, diff-check, ci]
---
---
name: scope-contract
description: Generate per-task scope contracts with allowed/forbidden globs, acceptance criteria, and rollback plan, plus a CI-ready glob-aware checker that runs on every agent diff.
version: 1.0.0
phase: 14
lesson: 36
tags: [scope, contract, globs, diff-check, ci]
---

Dada uma descrição da tarefa e um layout de repositório, produza um contrato de escopo e um verificador com reconhecimento de diferenças.

Produzir:

1. `scope_contract.json` para a tarefa com campos: `task_id`, `goal`, `allowed_files` (globs), `forbidden_files` (globs), `acceptance_criteria`, `rollback_plan`, `approvals_required`.
2. `tools/scope_check.py` que segue um caminho de contrato e uma lista de arquivos tocados e retorna um `ScopeReport` mais uma saída diferente de zero em qualquer violação.
3. Etapa CI (`.github/workflows/scope-check.yml` ou equivalente) que executa o verificador na comparação de mesclagem.
4. `outputs/scope/closed/<task_id>.json` convenção de arquivamento para que os contratos sejam enviados com o histórico de alterações.

Rejeições difíceis:

- Um contrato sem `forbidden_files`. O espaço negativo faz parte do contrato.
- Um contrato que lista caminhos brutos em vez de globs para diretórios de código. Os refatoradores invalidam os caminhos brutos durante a noite.
- Um campo `rollback_plan` vazio ou "ver runbook". Soletre.
- Aprovações listadas como “caso a caso”. Os limites de aprovação devem ser enumeráveis.

Regras de recusa:

- Se a descrição da tarefa não restringir uma região do repositório, recuse a criação de `allowed_files` apenas a partir da descrição. Peça o diretório em que a tarefa reside.
- Se o repo não tiver comando de teste, recuse adicionar `acceptance_criteria` até que um seja fornecido ou stub. Um contrato que não pode ser verificado é um desejo.
- Se o tempo de execução do agente não puder respeitar os limites de aprovação (sem intervenção humana), revele a lacuna antes do envio; o aumento do escopo em ações que exigem aprovação será a falha dominante.

Estrutura de saída:

```
<repo>/
├── scope_contract.json
├── outputs/scope/closed/
│   └── T-XXX.json
├── tools/
│   └── scope_check.py
└── .github/
    └── workflows/
        └── scope-check.yml
```

Termine com "o que ler a seguir" apontando para:

- Lição 37 para feedback de tempo de execução que vincula a execução de comandos ao contrato.
- Lição 38 para a porta de verificação que consome o relatório de escopo.
- Lição 39 para o agente revisor que audita o arquivo de contratos fechados.