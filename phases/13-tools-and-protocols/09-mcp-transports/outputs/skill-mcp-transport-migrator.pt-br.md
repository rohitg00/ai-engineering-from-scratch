---
name: mcp-transport-migrator
description: Produza um plano de migração de HTTP+SSE legado para HTTP Streamable com continuidade de ID de sessão e validação de origem.
version: 1.0.0
phase: 13
lesson: 09
tags: [mcp, streamable-http, sse-migration, session-id, origin]
---

Dado um servidor MCP HTTP+SSE (legado), produza um plano de migração para HTTP Streamable de ponto final único.

Produzir:

1. Reescrita do terminal. Mesclar `/messages` e `/sse` em um `/mcp`. Mapeie POST para tratamento de solicitação, GET para fluxo SSE, DELETE para encerramento de sessão.
2. Continuidade da sessão. Gere novo `Mcp-Session-Id` no primeiro POST. Rejeite IDs fornecidos pelo cliente. Retenha a lógica de ponte se o cliente enviar primeiro um cookie de sessão herdado.
3. Validação de origem. Lista de permissões origens de produção explícitas (`https://app.company.com`, `https://claude.ai`, variantes de host local). Rejeite todos os outros com 403.
4. Repetição do ID do último evento. Mantenha um buffer circular de eventos recentes por sessão para que as reconexões possam ser retomadas.
5. Janela de descontinuação. Documente a data de transição e um período de carência de 60 dias em que os endpoints legados 301 para o novo com um cabeçalho de aviso.

Rejeições difíceis:
- Qualquer plano que mantenha ambos os endpoints ativos indefinidamente. O SSE legado será removido em 2026.
- Qualquer plano em que os IDs de sessão sejam gerados pelo cliente. Quebra o requisito de aleatoriedade criptográfica.
- Qualquer plano sem validação Origin. Vulnerabilidade de religação de DNS.

Regras de recusa:
- Se o servidor for somente local (stdio), recuse migrar para HTTP; stdio está correto para local.
- Se o servidor ainda não envia o OAuth, conclua as Fases 13 · 16 antes de expô-lo publicamente.
- Se o destino de hospedagem não suportar HTTP de longa duração (por exemplo, nível gratuito Vercel), recuse e recomende Cloudflare Workers.

Saída: um runbook de migração com as alterações de endpoint, lista de permissões de origem, plano de ID de sessão, cronograma de descontinuação e uma lista de verificação de teste que abrange inicialização, ferramentas/lista, notificações de streaming, reconexão com ID do último evento e DELETE explícito.