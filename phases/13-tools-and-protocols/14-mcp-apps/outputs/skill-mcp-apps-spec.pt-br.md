---
name: mcp-apps-spec
description: Produza o contrato completo de aplicativos MCP para uma ferramenta que precisa de um recurso de UI interativo.
version: 1.0.0
phase: 13
lesson: 14
tags: [mcp, apps, ui-resources, csp, iframe-sandbox]
---

Dada uma ferramenta que se beneficiaria de uma UI interativa (linha do tempo, formulário, painel, mapa, gráfico), produza o contrato de aplicativos MCP.

Produzir:

1. URI `ui://`. Um nome canônico para o recurso de IU (por exemplo, `ui://notes/timeline`).
2. Forma do resultado da ferramenta. `content[]` com preâmbulo `text` e bloco `ui_resource`; `_meta.ui` preenchido.
3. CSP. Lista de permissões mínima para `default-src`, `script-src`, `connect-src`, `img-src`, `style-src`. Evite `'unsafe-inline'`, a menos que seja necessário.
4. Lista de permissões. Câmera/microfone/geolocalização/rede se necessário; vazio se não.
5. Pontos de entrada pós-mensagem. Quais chamadas `host.*` a IU fará e o que elas retornarão.
6. Lista de verificação de segurança. Distinguir do host, sem clickjacking, conexão estrita, sanitização de HTML se algum conteúdo do usuário for renderizado.

Rejeições difíceis:
-CSP com `default-src *`. Risco de segurança aberto.
- Qualquer solicitação `permissions` além do que a IU realmente usa. Privilégio mínimo.
- Qualquer recurso ui:// que carregue scripts externos. Empacote ou recuse.
- Qualquer UI que renderize HTML controlado pelo usuário sem higienização. Vetor XSS.

Regras de recusa:
- Se a UI for apenas um resultado estático, recuse o scaffold de um aplicativo; retornar conteúdo de texto.
- Se a ferramenta se beneficiar de widgets de host nativos (barras de progresso, caixas de diálogo de confirmação), recomende-os.
- Se o host ainda não oferecer suporte a aplicativos MCP (VS Code estável, Zed, Windsurf em 2026-04), sinalize o caminho de retorno para texto.

Saída: um contrato de uma página com o URI `ui://`, JSON de resultado da ferramenta, CSP, permissões, pontos de entrada postMessage e uma lista de verificação de segurança. Termine com uma frase sobre o host mínimo que renderizará esta UI.