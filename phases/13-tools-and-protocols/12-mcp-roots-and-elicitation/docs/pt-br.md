# Roots e Elicitation — Delimitação e Entrada do Usuário no Meio do Fluxo

> Paths codificados quebram no momento em que o usuário abre um projeto diferente. Argumentos de ferramenta pré-preenchidos quebram quando o usuário subeespecificaçãoifica. Roots delimitam o servidor a um conjunto de URIs controlado pelo usuário; elicitation pausa no meio de uma chamada de ferramenta pra perguntar ao usuário por entrada estruturada via formulário ou URL. Duas primitivas do cliente, duas correções pra modos comuns de falha do MCP. SEP-1036 (elicitação em modo URL, 2025-11-25) é experimental até H1 2026 — verifique versões de SDK antes de depender disso.

**Tipo:** Construir
**Linguagens:** Python (stdlib, demonstração de roots + elicitation)
**Pré-requisitos:** Fase 13 · 07 (servidor MCP)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Declarar `roots` e responder a `notifications/roots/list_changed`.
- Restringir operações de arquivo do servidor a URIs dentro do conjunto de roots declarado.
- Usar `elicitation/create` pra pedir ao usuário uma confirmação ou entrada estruturada no meio de uma chamada de ferramenta.
- Escolher entre elicitação em modo formulário e modo URL (esta é experimental; risco de deriva notado).

## O Problema

Duas falhas concretas que um servidor MCP de notas atinge em produção.

**Premissa de path quebrada.** O servidor foi escrito contra `~/notes`. Um usuário numa máquina diferente com notas em `~/Documents/Notes` recebe uma chamada de ferramenta que falha silenciosamente (nenhum arquivo encontrado) ou pior, escreve no lugar errado.

**Argumento faltando que o usuário saberia.** O usuário pede "delete a nota antiga do relatório TPS". O modelo chama `notes_delete(title: "TPS report")` mas existem três notas correspondentes de 2023, 2024 e 2025. A ferramenta não pode adivinhar. Falhar com "ambíguo" é chato; rodar nas três é catastrófico.

Roots corrigem o primeiro: o cliente declara no `initialize` o conjunto de URIs que o servidor pode tocar. Elicitation corrige o segundo: o servidor pausa a chamada de ferramenta e envia `elicitation/create` pra pedir ao usuário que escolha qual.

## O Conceito

### Roots

O cliente declara uma lista de roots no `initialize`:

```json
{
  "capabilities": {"roots": {"listChanged": true}}
}
```

Servidor pode então chamar `roots/list`:

```json
{"roots": [{"uri": "file:///Users/alice/Documents/Notes", "name": "Notes"}]}
```

Servidores DEVEM tratar roots como o limite: qualquer leitura ou escrita de arquivo fora do conjunto de roots é rejeitada. Isso não é aplicado pelo cliente (o servidor ainda é código que o usuário confiou), mas servidores compatíveis com a eespecificaçãoificação honram.

Quando o usuário adiciona ou remove uma root, o cliente envia `notifications/roots/list_changed`. O servidor rechama `roots/list` e atualiza seu limite.

### Por que roots são uma primitiva do cliente

Roots são declaradas pelo cliente porque representam o modelo de consentimento do usuário. O usuário disse ao Claude Desktop "dê a este servidor de notas acesso a esses dois diretórios". O servidor não pode ampliar esse escopo.

### Elicitation: o padrão em modo formulário

`elicitation/create` recebe um schema de formulário mais uma mensagem em linguagem natural:

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Deletar 'TPS report'? Múltiplas notas correspondem; escolha uma.",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "note_id": {
          "type": "string",
          "enum": ["note-3", "note-7", "note-14"]
        },
        "confirm": {"type": "boolean"}
      },
      "required": ["note_id", "confirm"]
    }
  }
}
```

Cliente renderiza um formulário, coleta a resposta do usuário, retorna:

```json
{
  "action": "accept",
  "content": {"note_id": "note-14", "confirm": true}
}
```

Três ações possíveis: `accept` (usuário preencheu), `decline` (usuário fechou), `cancel` (usuário abortou toda a chamada de ferramenta).

Schemas de formulário são flat — objetos aninhados não são suportados na v1. SDKs normalmente rejeitam qualquer coisa mais complexa que uma camada.

### Elicitation: modo URL (SEP-1036, experimental)

Novo em 2025-11-25. Em vez de um schema, o servidor envia uma URL:

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Faça login no GitHub",
    "url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

Cliente abre a URL num navegador, espera conclusão, retorna quando o usuário volta. Útil pra fluxos OAuth, autorização de pagamento e assinatura de documentos onde um formulário não basta.

Nota de risco de deriva: a forma de resposta do SEP-1036 ainda se estabilizando; alguns SDKs retornam a URL de callback, outros retornam um token de conclusão. Leia as release notes do seu SDK antes de usar modo URL em produção.

### Quando elicitation é a ferramenta certa

- Confirmação do usuário antes de ações destrutivas (dica destrutiva + elicitation).
- Desambiguação (escolher um de N correspondências).
- Configuração de primeira execução (chaves de API, diretórios, preferências).
- Fluxos estilo OAuth (modo URL).

### Quando elicitation é errada

- Preencher argumentos obrigatórios que o modelo poderia ter pedido em texto. Use um re-prompt normal, não um diálogo de elicitation.
- Chamadas de alta frequência. Elicitation interrompe a conversa; não dispare dentro de um loop.
- Qualquer coisa que o servidor poderia validar depois. Valide, retorne um erro, deixe o modelo perguntar ao usuário em texto.

### Ponte de humano no loop

Elicitation mais sampling juntos habilitam o modelo de "humano no loop" do MCP. Um loop de agente do servidor pode pausar pra entrada do usuário (elicitation) ou raciocínio do modelo (sampling). Fase 13 · 11 cobriu sampling; esta aula cobre elicitation. Junte pra controle completo no meio do loop.

## Use

`code/main.py` estende o servidor de notas com:

- Resposta `roots/list` que o servidor reconsulta após notificações de mudança de root.
- Uma ferramenta `notes_delete` que usa `elicitation/create` pra desambiguar quando múltiplas notas correspondem.
- Uma ferramenta `notes_setup` que usa elicitação em modo URL pra abrir uma página de configuração de primeira execução (simulada).
- Uma verificação de limite que recusa operações em URIs fora das roots declaradas.

A demonstração roda três cenários: caminho feliz (uma correspondência), desambiguação (três correspondências, elicitation dispara), escrita-fora-da-root (rejeitada).

## Entregue

Esta aula produz `outputs/skill-elicitation-form-designer.md`. Dada uma ferramenta que pode precisar de confirmação ou desambiguação do usuário, a skill projeta o schema do formulário de elicitation e o template da mensagem.

## Exercícios

1. Rode `code/main.py`. Dispare o caminho de desambiguação; confirme que a resposta simulada do usuário é roteada de volta pra ferramenta.

2. Adicione uma nova ferramenta `notes_archive` que requer confirmação de elicitation toda vez (dica destrutiva). Verifique o UX: como se compara ao modelo pedindo de novo em texto?

3. Implemente elicitação em modo URL pra um fluxo OAuth de primeira execução. Note o risco de deriva e adicione um guard de versão de SDK.

4. Estenda o tratamento de `roots/list`: quando uma notificação chegar, o servidor deve reler atomicamente e re-verificar handles de arquivo abertos que podem agora estar fora do escopo.

5. Leia a thread de discussão do SEP-1036 no GitHub. Identifique uma questão aberta que afeta como servidores devem lidar com callbacks de modo URL.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Root | "Limite de consentimento" | URI que o cliente permitiu ao servidor tocar |
| `roots/list` | "Servidor pede escopo" | Cliente retorna o conjunto atual de roots |
| `notifications/roots/list_changed` | "Usuário mudou escopo" | Cliente sinaliza que o conjunto de roots mutou |
| Elicitation | "Perguntar ao usuário no meio da chamada" | Request do servidor pra entrada estruturada do usuário |
| `elicitation/create` | "O método" | Método JSON-RPC pra requests de elicitation |
| Modo formulário | "Formulário guiado por schema" | JSON Schema flat renderizado como formulário na interface do cliente |
| Modo URL | "Redirecionamento de navegador" | SEP-1036 experimental; abre uma URL e espera |
| `accept` / `decline` / `cancel` | "Resultados da resposta do usuário" | Três ramos que o servidor trata |
| Desambiguação | "Escolher um" | Caso de uso comum de elicitation quando uma ferramenta tem N candidatos |
| Formulário flat | "Só propriedades de nível superior" | Schemas de elicitation não podem aninhar |

## Leituras Complementares

- [MCP — Client roots especificação](https://modelcontextprotocol.io/especificaçãoification/draft/client/roots) — referência canônica de roots
- [MCP — Client elicitation especificação](https://modelcontextprotocol.io/especificaçãoification/draft/client/elicitation) — referência canônica de elicitation
- [Cisco — What's new in MCP elicitation, structured content, OAuth enhancements](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements) — walkthrough das adições 2025-11-25
- [MCP — GitHub SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol) — proposta de elicitação em modo URL (experimental, risco de deriva)
- [The New Stack — How elicitation brings human-in-the-loop to AI tools](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/) — walkthrough de UX
