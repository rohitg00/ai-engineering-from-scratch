---
name: terminal-coding-agent
description: Crie e avalie um agente de codificação nativo de terminal em relação ao SWE-bench Pro com custo limitado, ferramentas em área restrita e superfície de gancho 2026 completa.
version: 1.0.0
phase: 19
lesson: 01
tags: [capstone, coding-agent, claude-code, swe-bench, mcp, hooks, sandbox]
---

Dado um repositório de destino e uma tarefa de linguagem natural, crie um chicote que planeje, execute em uma sandbox e abra uma solicitação pull. Combine ou supere a linha de base do mini-agente Swe em um subconjunto SWE-bench Pro de 30 tarefas, mantendo um orçamento de US$ 5 por tarefa.

Plano de construção:

1. Monte um chicote Bun + Ink TUI com um painel de plano, um fluxo de chamada de ferramenta e um orçamento de token/dólar ao vivo.
2. Defina seis ferramentas (read_file, edit_file, ripgrep, tree_sitter_symbols, run_shell, git) sobre Model Context Protocol StreamableHTTP. Cada chamada retorna no máximo 4k tokens.
3. Execute cada chamada de ferramenta dentro de uma sandbox E2B ou Daytona em uma nova ramificação `git worktree add`. Nunca toque no sistema de arquivos host.
4. Conecte todos os oito eventos de gancho 2026: SessionStart, SessionEnd, PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop, PreCompact. Envie pelo menos quatro ganchos de autoria do usuário (guarda de comando destrutivo, contabilidade de token, emissor de span OTel, gravador de pacote de rastreamento).
5. Aplique três orçamentos: 50 turnos, 200 mil tokens, US$ 5 dólares. O PreCompact dispara a 150k e resume curvas mais antigas.
6. Emita extensões OpenTelemetry com convenções semânticas GenAI para um Langfuse auto-hospedado.
7. Em caso de sucesso, empurre o branch e abra um PR com o plano e o pacote de rastreamento no corpo.
8. Avalie o mini-swe-agent em um subconjunto SWE-bench Pro Python de 30 edições e registre pass@1, turnos, tokens e dólares por tarefa.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | SWE-banco Pro pass@1 | Subconjunto correspondente de 30 tarefas versus linha de base do mini-agente Swe |
| 20 | Clareza de arquitetura | Separação planejar/agir/observar, superfície do gancho, legibilidade do esquema da ferramenta |
| 20 | Segurança | Sandbox escape red-team + auditoria de guarda de comando destrutivo |
| 20 | Observabilidade | 100% das chamadas de ferramentas abrangidas, contabilização de tokens por turno |
| 15 | Experiência do usuário do desenvolvedor | Inicialização a frio abaixo de 2s, recuperação de falhas, semântica de cancelamento Ctrl-C |

Rejeições difíceis:

- Aproveite o uso do git no sistema de arquivos host em vez de dentro da sandbox.
- Qualquer agente que possa gravar fora da árvore de trabalho ou enrolar URLs externos sem um gancho explícito de lista de permissões.
- Números de avaliação relatados sem uma linha de base correspondente nas mesmas 30 questões.
- Alegações de "taxa de aprovação" que dependem de `git reset --hard` entre novas tentativas; SWE-bench Pro é pass@1.

Regras de recusa:

- Recuse-se a enviar diretamente para main em qualquer configuração. Apenas filiais de relações públicas.
- Recuse-se a desativar a guarda de comando destrutivo. É um requisito difícil da rubrica.
- Recuse-se a funcionar sem um limite orçamental. Execuções abertas contaminam a comparação de avaliação.

Saída: um repositório contendo o chicote, um chicote de avaliação SWE-bench Pro fixo de 30 tarefas com execução de linha de base do mini-agente Swe correspondente, um arquivo de rastreamento OpenTelemetry para pelo menos 5 execuções completas e um artigo que nomeia quais tarefas o chicote resolve que a linha de base não resolve e vice-versa. Termine com uma seção sobre os três principais modos de falha que você observou e a mudança de gancho que corrigiu cada um deles.