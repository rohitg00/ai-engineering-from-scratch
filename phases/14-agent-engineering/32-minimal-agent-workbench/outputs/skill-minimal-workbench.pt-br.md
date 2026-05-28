---
name: minimal-workbench
description: Estabeleça o ambiente de trabalho de agente mínimo viável de três arquivos para qualquer repositório - roteador AGENTS.md curto, agente_state.json durável e um JSON task_board.json vinculado ao backlog atual do projeto.
version: 1.0.0
phase: 14
lesson: 32
tags: [workbench, agents-md, state, task-board, scaffold]
---

Dado um caminho de recompra e um backlog curto, crie o ambiente de trabalho do agente mínimo viável.

Produzir:

1. `AGENTS.md` não tem mais de 80 linhas. Ele deve rotear para: o arquivo de estado, o quadro de tarefas, o documento de regras mais profundo (mesmo que vazio) e o comando de verificação. Não há tutoriais em prosa neste arquivo.
2. `agent_state.json` com estas teclas: `active_task_id`, `touched_files`, `assumptions`, `blockers`, `next_action`. Todos os campos opcionais são padronizados como array vazio ou string vazia, nunca `null` para arrays.
3. `task_board.json` como uma matriz JSON de tarefas. Cada tarefa tem `id`, `goal`, `owner` (`builder` | `reviewer` | `human`), `acceptance` (lista de strings) e `status` (`todo` | `in_progress` | `done` | `blocked`).
4. Espaço reservado `docs/agent-rules.md` com um único H2 por superfície para que lições posteriores possam preenchê-lo.

Rejeições difíceis:

- `AGENTS.md` acima de 80 linhas ou menos de 10 linhas. Muito tempo e o agente pula; muito curto e não carrega roteamento.
- Um arquivo de estado que faz referência ao histórico do chat em vez do repositório. O repo é o sistema de registro.
- Um quadro de tarefas sem `acceptance`. Tarefas sem critérios de aceitação tornam-se carimbos de “boa aparência”.
- Tarefas cujo `owner` é `agent` ou `model`. Proprietários são funções, não entidades.

Regras de recusa:

- Se o repo não tiver comando de verificação, recuse-se a escrever `AGENTS.md` até que um seja fornecido ou stub. Um roteador apontando para uma porta perdida é pior do que nenhum roteador.
- Se o backlog tiver mais de 12 tarefas abertas, recuse e peça ao usuário para dividi-lo. Placas sobre uma tela chegam ao teatro de planejamento.
- Se o projeto for enviado com segredos em arquivos rastreados, recuse-se a gravar o arquivo de estado e revele primeiro o vazamento secreto como uma descoberta de bloqueio.

Estrutura de saída:

```
<repo>/
├── AGENTS.md
├── agent_state.json
├── task_board.json
└── docs/
    └── agent-rules.md
```

Termine com "o que ler a seguir" apontando para:

- Lição 33 para transformar o espaço reservado de regras em restrições executáveis.
- Lição 34 para o esquema de estado durável.
- Lição 36 para o contrato de escopo por tarefa.