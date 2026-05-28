---
name: mcp-client-harness
description: Given a declarative list of MCP servers (name, command, args), scaffold a multi-server client with handshake, namespace merge, and routing.
version: 1.0.0
phase: 13
lesson: 08
tags: [mcp, client, multi-server, routing, namespace]
---
---
name: mcp-client-harness
description: Given a declarative list of MCP servers (name, command, args), scaffold a multi-server client with handshake, namespace merge, and routing.
version: 1.0.0
phase: 13
lesson: 08
tags: [mcp, client, multi-server, routing, namespace]
---

Dada uma configuração de servidores MCP para execução, produza um chicote de cliente que gera cada um, faz o handshake de cada um, mescla suas listas de ferramentas em um namespace e roteia cada chamada para o servidor proprietário.

Produzir:

1. Analisador de configuração do servidor. Mapa `name -> {command, args, env}`. Valide se existem comandos no caminho.
2. Plano de geração. Use subprocess.Popen com tubos stdin/stdout/stderr, `bufsize=1`, modo de texto. Um thread de leitura em segundo plano por servidor.
3. Pipeline de aperto de mão. Para cada sessão: envie `initialize`, aguarde resposta, persista capacidades, envie `notifications/initialized`.
4. Mesclagem de namespace. Escolha uma política de colisão: `prefix-on-collision` (padrão), `reject-on-collision` ou `silent-overwrite` (proibido). Imprima uma lista de ferramentas mescladas na inicialização.
5. Função de roteamento. `client.call(canonical_name, arguments)` procura a sessão proprietária e escreve uma mensagem `tools/call`. Aguarde a resposta do ID correspondente por meio de um futuro na tabela de solicitações pendentes.

Rejeições difíceis:
- Qualquer equipamento que não gere cada servidor em seu próprio processo. A multiplexação em processo anula o modelo de isolamento.
- Qualquer chicote com `silent-overwrite` como política de colisão padrão. Risco de segurança.
- Qualquer chicote que bloqueie o thread principal nas leituras de stdout. As notificações irão parar.

Regras de recusa:
- Se o comando de um servidor não for confiável (não estiver em uma lista de permissões fixada), recuse-se a gerar e encaminhe para a Fase 13 · 15 para a verificação de segurança.
- Caso o usuário configure mais de 10 servidores sem motivo, avise e sugira um gateway (Fase 13 · 17).
- Se for solicitado a lidar com o OAuth aqui, recuse e encaminhe para a Fase 13 · 16.

Saída: um arquivo Python completo do cliente (cerca de 150 linhas) com sessão, lógica de mesclagem, roteamento e um loop principal que exercita cada servidor configurado. Termine com um resumo de uma linha nomeando a política de colisão e o número de ferramentas mescladas.