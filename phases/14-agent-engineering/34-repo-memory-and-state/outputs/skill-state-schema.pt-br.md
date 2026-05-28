---
name: state-schema
description: Generate project-specific JSON Schemas for agent state and task board, a Python StateManager with atomic writes, and a migration scaffold so schema bumps cannot corrupt the workbench.
version: 1.0.0
phase: 14
lesson: 34
tags: [state, schema, json-schema, atomic-writes, migrations]
---
---
name: state-schema
description: Generate project-specific JSON Schemas for agent state and task board, a Python StateManager with atomic writes, and a migration scaffold so schema bumps cannot corrupt the workbench.
version: 1.0.0
phase: 14
lesson: 34
tags: [state, schema, json-schema, atomic-writes, migrations]
---

Dado um repositório e o produto do agente em execução nele, produza arquivos de estado de esquema inicial para o ambiente de trabalho.

Produzir:

1. `schemas/agent_state.schema.json` cobrindo chaves obrigatórias, valores de status permitidos, disciplina array versus nulo e um número inteiro `schema_version`.
2. `schemas/task_board.schema.json` cobrindo padrão de identificação de tarefa, proprietários permitidos, status permitidos e matrizes de aceitação.
3. `tools/state_manager.py` expondo `load`, `commit` e `update` com gravações atômicas temporárias e renomeadas.
4. `tools/migrate_state.py` estrutura para o próximo salto de esquema, falha em voz alta se o arquivo for de uma versão desconhecida.
5. `agent_state.json` e `task_board.json` semeados em `schema_version: 1` e um novo backlog.

Rejeições difíceis:

- Um esquema sem campo `schema_version`. As migrações não são opcionais.
- Permitir `null` onde um array é esperado. `null` é um bug de gravação disfarçado de dados.
- Um escritor que usa `open(path, "w")` simples. Somente gravações atômicas; arquivos parciais corrompem a fonte da verdade.
- Armazenamento de tokens, transcrições brutas de bate-papo ou PII dentro do estado. Estado é para fatos relevantes para repo.

Regras de recusa:

- Se o repositório não tiver controle de versão, recuse o envio de arquivos de estado. Gravações atômicas mais git diff é a história da durabilidade.
- Caso o projeto não possua pelo menos um comando de aceitação para validar a transição `done`, recuse o valor do enum `status: done`. Adicionar `done` sem uma verificação de aceitação é teatro.
- Se o projeto pretende compartilhar o estado entre processos sem uma estratégia de bloqueio, revele essa descoberta antes do envio; a renomeação atômica é necessária, mas não suficiente.

Estrutura de saída:

```
<repo>/
├── agent_state.json
├── task_board.json
├── schemas/
│   ├── agent_state.schema.json
│   └── task_board.schema.json
└── tools/
    ├── state_manager.py
    └── migrate_state.py
```

Termine com "o que ler a seguir" apontando para:

- Lição 35 para o script de inicialização que chama o gerenciador na inicialização.
- Lição 38 para o portão de verificação que lê o estado para pontuar a conclusão.
- Lição 40 para o gerador de handoff que consome o mesmo esquema.