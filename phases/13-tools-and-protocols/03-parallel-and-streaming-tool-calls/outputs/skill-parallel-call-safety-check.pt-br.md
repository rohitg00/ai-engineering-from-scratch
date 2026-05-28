---
name: parallel-call-safety-check
description: Audit a tool registry for safe parallelization. Mark each tool parallel_safe, note ordering dependencies, and flag downstream rate-limit risk.
version: 1.0.0
phase: 13
lesson: 03
tags: [parallel-tool-calls, streaming, correlation, rate-limits]
---
---
name: parallel-call-safety-check
description: Audit a tool registry for safe parallelization. Mark each tool parallel_safe, note ordering dependencies, and flag downstream rate-limit risk.
version: 1.0.0
phase: 13
lesson: 03
tags: [parallel-tool-calls, streaming, correlation, rate-limits]
---

Dado um registro de ferramentas (lista de ferramentas com nomes, descrições e executores), retorne uma cópia anotada com os campos `parallel_safe: bool`, `ordering_deps: [tool_name]` e `rate_limit_group: name` adicionados.

Produzir:

1. Classificação por ferramenta. Para cada ferramenta, decida: é seguro executar em paralelo no mesmo turno (leituras puras, recursos diferentes); inseguros (mutações, recursos compartilhados, limites de taxas externas).
2. Gráfico de dependência. Identifique pares onde a saída de uma ferramenta deve alimentar a entrada de outra. Não é possível paralelizar dentro de uma curva. Marque com `ordering_deps`.
3. Agrupamento de limite de taxa. Ferramentas que atingem a mesma API downstream compartilham um grupo. O host deve limitar a simultaneidade por grupo, não por ferramenta.
4. Recomendações de segurança. Para cada ferramenta insegura, indique se deseja desabilitar o paralelo para esse turno, fila ou fragmento por recurso.
5. Sinalizadores específicos do provedor. Recomende `parallel_tool_calls=false` no OpenAI ou `disable_parallel_tool_use=true` no Anthropic quando qualquer ferramenta insegura estiver no conjunto.

Rejeições difíceis:
- Qualquer registro sem classificação após auditoria. Negar padrão; desconhecido significa inseguro.
- Qualquer ferramenta de caminho de gravação em um recurso compartilhado marcado como `parallel_safe: true`. Condições de corrida.
- Qualquer ferramenta que atinja uma API externa com taxa limitada sem `rate_limit_group`.

Regras de recusa:
- Se solicitado a marcar todas as ferramentas como seguras em paralelo sem inspeção, recuse.
- Se o registro incluir ferramentas consequentes no mesmo recurso (`delete_file` e `write_file` no mesmo caminho), recuse a paralelização e direcione para a Fase 14 · 09 para serialização em nível de sandbox.
- Se o usuário argumentar que suas ferramentas nunca correm, recuse e peça a prova (testes, logs ou argumento formal). As corridas acontecem silenciosamente na produção.

Saída: um registro revisado como um blob JSON com os três novos campos por ferramenta, seguido de um breve resumo nomeando a opção de paralelização de maior risco e a mitigação recomendada. Termine com uma substituição sugerida de `tool_choice` para a curva atual.