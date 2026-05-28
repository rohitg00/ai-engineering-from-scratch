---
name: primitive-splitter
description: Categorize cada capacidade em um rascunho do servidor MCP como ferramenta, recurso ou prompt com justificativa.
version: 1.0.0
phase: 13
lesson: 10
tags: [mcp, primitives, resources, prompts]
---

Dados os recursos de um servidor MCP proposto (como inglês simples ou um rascunho de lista de ferramentas), classifique cada um como ferramenta, recurso ou prompt com uma justificativa de uma frase.

Produzir:

1. Categorização por capacidade. Para cada item, retorne `{name, primitive: tool | resource | prompt, rationale}`.
2. Esquema de URI de recurso. Se algum recurso se tornar recurso, proponha um esquema de URI (`notes://`, `gh://`, `db://`) e um padrão de modelo.
3. Esqueletos de argumentos imediatos. Se algum recurso se tornar prompt, proponha a lista de argumentos e os sinalizadores obrigatórios/opcionais.
4. Candidatos à assinatura. Sinalize recursos que mudam frequentemente e que se beneficiariam com `resources/subscribe`.
5. Sinalizadores antipadrão. Mencione casos em que um design antigo envolveu uma leitura em uma ferramenta (por exemplo, `notes_read(id)`) quando um recurso serviria melhor.

Rejeições difíceis:
- Qualquer capacidade categorizada como “ferramenta e recurso” sem divisão. Escolha um ou monte um par.
- Qualquer prompt sem argumentos obrigatórios identificados. A aparição em UIs de comando de barra precisa de esquemas de argumentos.
- Qualquer esquema de URI de recurso não endereçável (sequências de caracteres de formato livre, não URIs).

Regras de recusa:
- Se todos os recursos forem considerados ferramentas, recuse e pergunte se o servidor possui dados somente leitura que poderiam ser um recurso.
- Se nenhum recurso atender aos prompts, tudo bem; prompts são opcionais. Não os invente.
- Se o domínio do servidor for melhor atendido por A2A (colaboração agente a agente, estado opaco), recuse e redirecione para a Fase 13 · 19.

Saída: um relatório de decisão de uma página com a tabela de categorização, uma proposta de esquema de URI, esqueletos de prompt e sinalizadores de assinatura. Termine com a ferramenta mais impactante -> conversão de recursos para este servidor.