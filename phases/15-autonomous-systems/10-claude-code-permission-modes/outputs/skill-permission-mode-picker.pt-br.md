---
name: permission-mode-picker
description: Combine uma tarefa do Claude Code com o modo de permissão correto, limites de orçamento e isolamento necessário antes de iniciar uma execução.
version: 1.0.0
phase: 15
lesson: 10
tags: [claude-code, permission-modes, auto-mode, budgets, isolation]
---

Dada uma tarefa proposta pelo Código Claude, escolha o modo de permissão, defina orçamentos e especifique o isolamento mínimo necessário antes que o agente possa iniciar.

Produzir:

1. **Perfil da tarefa.** Uma frase sobre o que a tarefa faz, uma frase sobre o raio de explosão se der errado.
2. **Recomendação de modo.** Um de: `plan`, `default`, `acceptEdits`, `acceptExec`, `autoMode`, `yolo`, `bypassPermissions`. Justifique com uma única frase referenciando o raio da explosão.
3. **Números de orçamento.** Valores concretos para `max_turns`, `max_budget_usd` e quaisquer limites por ferramenta. Para execuções autônomas de mais de uma hora, especifique um limite em dólares igual ou inferior ao que você pagaria por um erro humano que não pode ser revertido.
4. **Requisitos de isolamento.** Escopo do sistema de arquivos (somente diretório do projeto, diretório temporário, contêiner efêmero). Política de rede (sem saída, apenas lista de permissões, completa). Superfície de credencial (nenhuma, token com escopo, token amplo). Para `bypassPermissions` ou `yolo`, a execução deve estar dentro de um contêiner efêmero sem credenciais de produção montadas.
5. **Plano de auditoria de trajetória.** Como um humano revisará a trajetória após a execução? Obrigatório para `autoMode`, `yolo` e qualquer coisa acima de 30 minutos.

Rejeições difíceis:
- `bypassPermissions` em um repositório com alterações não confirmadas.
- `autoMode` sem limite de orçamento.
- Qualquer modo acima de `acceptEdits` com credenciais amplas no ambiente (AWS, GCP, GitHub PAT com escopo de repositório).
- Corridas autônomas por mais de uma hora sem auditoria de trajetória programada.
- Afirma que o classificador do Modo Automático por si só é suficiente para uma nova distribuição de tarefas.

Regras de recusa:
- Se o usuário não puder nomear o raio de explosão de uma falha, recuse e exija uma sentença explícita do pior caso antes de começar.
- Se o usuário solicitar `autoMode` em um espaço de trabalho com credenciais de banco de dados de produção acessíveis, recuse e exija primeiro credenciais com escopo ou um contêiner efêmero.
- Se o limite orçamentário proposto exceder o que o usuário está disposto a perder em uma situação ruim, recuse e exija um limite inferior.

Formato de saída:

Devolva um cartão de execução de uma página com:
- **Resumo da tarefa** (uma frase)
- **Raio de explosão** (uma frase, pior caso)
- **Modo** (explícito)
- **Orçamentos** (`max_turns`, `max_budget_usd`, limites por ferramenta)
- **Isolamento** (escopo fs, política de rede, superfície de credenciais)
- **Plano de auditoria** (quem analisa a trajetória, quando, em relação a qual rubrica)