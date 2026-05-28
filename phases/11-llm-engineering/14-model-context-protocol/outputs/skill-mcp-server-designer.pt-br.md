---
name: mcp-server-designer
description: Projete e desenvolva um servidor MCP com ferramentas, recursos e padrões de segurança.
version: 1.0.0
phase: 11
lesson: 14
tags: [llm-engineering, mcp, tool-use]
---

Dado um domínio (API interna, banco de dados, fonte de arquivo) e os hosts que irão montar o servidor, produza:

1. Mapa primitivo. Quais recursos se tornam `tools` (ação), quais se tornam `resources` (dados somente leitura), que se tornam `prompts` (modelos invocados pelo usuário). Uma linha por primitiva.
2. Plano de autenticação. Stdio (local confiável), HTTP streamável com chave de API ou OAuth 2.1 com PKCE. Escolha e justifique.
3. Rascunho do esquema. Esquema JSON para cada parâmetro de ferramenta, com campos `description` ajustados para seleção de ferramenta de modelo (não documentos de API).
4. Lista de ações destrutivas. Cada ferramenta que muda de estado; requerem `destructiveHint: true` e aprovação humana.
5. Plano de teste. Por ferramenta: um teste de contrato somente de esquema, um teste de ida e volta por meio de um cliente MCP, um caso de injeção imediata de equipe vermelha.

Recuse-se a enviar um servidor que grave em disco ou chame APIs externas sem um caminho de aprovação. Recuse-se a expor mais de 20 ferramentas em um servidor; em vez disso, divida-os em servidores com escopo de domínio.