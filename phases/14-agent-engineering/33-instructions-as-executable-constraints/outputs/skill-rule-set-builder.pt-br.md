---
name: rule-set-builder
description: Entreviste o proprietário do projeto, classifique suas instruções de prosa existentes em cinco categorias operacionais e emita um agent-rules.md versionado mais um stub do verificador Python.
version: 1.0.0
phase: 14
lesson: 33
tags: [rules, instructions, constraints, checker, workbench]
---

Dado um repositório e quaisquer instruções de prosa existentes (`AGENTS.md`, `CONTRIBUTING.md`, documentos de integração), produza um conjunto de regras de cinco categorias que o ambiente de trabalho pode executar.

As cinco categorias:

1. `startup` — o que deve ser verdade antes do início do trabalho.
2. `forbidden` — o que nunca deve acontecer.
3. `definition_of_done` — o que prova que a tarefa foi concluída.
4. `uncertainty` — o que o agente faz quando não tem certeza.
5. `approval` — o que requer aprovação humana.

Produzir:

1. `docs/agent-rules.md` com um cabeçalho `##` por regra. Cada regra contém `category`, `check` e uma descrição de uma linha.
2. `tools/rule_checker.py` com uma classe `RuleChecker` expondo um método por `check`. Cada método usa uma classe de dados `TurnTrace` e retorna `bool`.
3. Executor `tools/rule_report.py` que carrega regras, executa o verificador em um rastreamento e emite um `rule_report.json`.
4. Um arquivo de notas de migração: quais linhas de prosa se tornaram quais regras, quais foram descartadas como aspiracionais, por quê.

Rejeições difíceis:

- Regras sem campo `check`. As regras apenas aspiracionais pertencem aos documentos de integração, não ao conjunto de regras do ambiente de trabalho.
- Uma única regra de “tenha cuidado”. Especifique uma categoria e marque ou remova-a.
- Cheques que exigem chamadas LLM. As verificações de regras devem ser determinísticas e baratas para que possam ser executadas em todos os turnos.
- Arquivos de regras com mais de 200 linhas. Dividir por categoria em `agent-rules.{startup,forbidden,done,uncertainty,approval}.md` e rotear a partir de um índice pai.

Regras de recusa:

- Se o produto do agente não puder fornecer um `TurnTrace` (sem instrumentação), recuse a ligação do verificador até que pelo menos `read_state_file`, `edited_files` e `tests_exit_code` sejam registrados.
- Se as instruções existentes forem em sua maioria aspiracionais (>50%), revele essa descoberta antes de emitir regras. O conjunto de regras parecerá limitado; isso está correto.
- Se uma regra for adicionada devido a um único incidente passado, anexe o ID do incidente para que uma revisão futura possa decidir se ainda é necessária.

Estrutura de saída:

```
<repo>/
├── docs/
│   └── agent-rules.md
├── tools/
│   ├── rule_checker.py
│   └── rule_report.py
└── docs/migration-notes.md
```

Termine com "o que ler a seguir" apontando para:

- Lição 36 para contratos de escopo por tarefa que estendem a categoria proibida.
- Lição 38 para portas de verificação que consomem o relatório de regras.
- Lição 39 para o agente revisor que pontua o cumprimento das regras.