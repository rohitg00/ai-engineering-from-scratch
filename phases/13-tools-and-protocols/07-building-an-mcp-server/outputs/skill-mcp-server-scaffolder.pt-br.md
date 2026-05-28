---
name: mcp-server-scaffolder
description: Crie um servidor MCP específico de domínio com a divisão correta de ferramentas/recursos/prompts e o caminho de graduação do SDK.
version: 1.0.0
phase: 13
lesson: 07
tags: [mcp, server, fastmcp, scaffold]
---

Dado um domínio (notas, tickets, arquivos, banco de dados, o que for), produza um plano de servidor MCP: quais recursos expor como ferramentas, quais como recursos, quais como prompts, além de um caminho de graduação para o Python ou TypeScript SDK.

Produzir:

1. Lista de ferramentas. Operações atômicas que o usuário pede explicitamente para realizar. Inclui nome, descrição (padrão Use-when), esquema de entrada e dicas de anotação.
2. Lista de recursos. Dados que o usuário deseja ler. Esquema de URI, tipo MIME e se `resources/subscribe` deve ser ativado.
3. Lista de solicitações. Modelos reutilizáveis ​​que o host deve expor como comandos de barra. Lista de argumentos.
4. Declaração de capacidade. O objeto `capabilities` exato que o servidor retorna em `initialize`.
5. Notas de formatura. Equivalentes FastMCP (Python) ou TypeScript SDK para cada peça. Cite um recurso do SDK (por exemplo, `lifespan`, `context`) que substitui um padrão stdlib rolado manualmente do andaime.

Rejeições difíceis:
- Qualquer “consulta de banco de dados” exposta apenas como ferramenta e não como recurso. A divisão correta é recurso para `/list` e `/read`, ferramenta para `/query` com parâmetros.
- Qualquer servidor que misture ferramentas de entrada do usuário com ferramentas privilegiadas no mesmo namespace sem anotações.
- Qualquer estrutura de servidor que reivindique capacidade `resources/subscribe` sem um mecanismo de notificação durável.

Regras de recusa:
- Se o domínio não tiver superfície somente leitura, recuse o scaffold de recursos; recomende um servidor somente para ferramentas.
- Se o domínio não tiver modelos de comando de barra natural, recuse os prompts de scaffold.
- Se o usuário solicitar um esquema de autenticação, recuse e encaminhe para a Fase 13 · 16 (OAuth 2.1).

Saída: um plano de servidor de uma página com as três listas primitivas, o objeto de capacidade e um snippet de graduação em estilo decorador de amostra de 10 linhas `@app.tool()`. Termine com o sinalizador de anotação mais importante que o servidor deve definir.