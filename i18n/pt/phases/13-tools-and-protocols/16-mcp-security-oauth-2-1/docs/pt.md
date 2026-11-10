# Autorização do MCP: CIMD, vinculação do emissor, PKCE e Step-Up

> Um pedido remoto de MCP é estatal, mas sua autorização não é anônima.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 15 (security)
**Time:** ~90 minutes

## Objetivos de aprendizagem

- Descubra os servidores de autorização através de metadados de recursos protegidos.
- Preferir Documentos de Metadados de ID de Cliente ao Registro Dinâmico de Cliente desatualizado.
- Declare o correcto .`application_type`Quando um caminho de compatibilidade com o DCR é inevitável.
- Validar a resposta de autorização `iss`e isolar as credenciais por emissor.
- Use PKCE, indicadores de recursos, validação de público e escopo incremental.
- Enviar solicitações autorizadas do MCP 2026-07-28 sem sessões de protocolo.

## O problema

Um servidor MCP remoto pode ler registros privados, escrever sistemas externos ou desencadear trabalhos caros. A autenticação diz quem apresentou uma credencial.

- Que servidor de autorização emitiu a credencial?
- Para que recurso MCP é o token?
- Qual cliente e redirecionador URI completaram o fluxo?
- Que operações o utilizador aprovou?
- Este exato pedido ainda corresponde à aprovação?

O perfil de autorização 2026-07-28 endurece a inscrição de clientes e o tratamento de emissores.`application_type`No caso de DCR, valida as respostas dos emitentes da RFC 9207 e proíbe a reutilização das credenciais entre os emitentes.

Estas regras complementam o núcleo sem Estado, não restabelecem um aperto de mão ou um`Mcp-Session-Id`- Não .

## O conceito

### Conheça os três papéis

- **MCP client:**Envia pedidos em nome de um proprietário de recursos.
- **MCP resource server:**Aceita o token de acesso e serve o ponto final do MCP.
- **Authorization server:**autentica o proprietário do recurso, recolhe o consentimento e emite tokens.

O servidor de recursos e o servidor de autorização podem ser operados juntos, mas mantêm os seus identificadores e responsabilidades de validação separados.

### Autorização aplica-se ao HTTP

A especificação de autorização MCP se aplica a transportes baseados em HTTP. Um servidor de estúdio local é executado sob o limite de confiança do processo e do sistema operacional. Não adicione um fluxo OAuth falso do navegador ao estúdio apenas para simetria.

Para o HTTP Streamable remoto, envie o token portador no `Authorization`Não coloque isso na URL.

### Comece com os metadados de recursos protegidos

O servidor de recursos publica os metadados RFC 9728:

```json
{
  "resource": "https://notes.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:delete", "notes:read", "notes:write"]
}
```

O cliente começa a partir do URL do recurso MCP, pega este documento, seleciona um servidor de autorização anunciado e, em seguida, pega os metadados OAuth ou OpenID Connect desse servidor.

Preservar o caminho de recurso ao construir o RFC 9728 URL bem conhecido. Para o recurso `https://notes.example.com/mcp`Esta lição usa`https://notes.example.com/.well-known/oauth-protected-resource/mcp`- Deixando cair o .`/mcp`O sufixo pode selecionar metadados para um recurso protegido diferente da mesma origem.

Não adivinhe o servidor de autorização a partir de um nome de hospedagem. Não siga um emissor descoberto de um corpo de erro não validado. Mantenha uma política para a qual os emissores o cliente está disposto a confiar.

### Verificar os metadados do servidor de autorização

Os metadados devem expor pontos finais e controles suportados:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "code_challenge_methods_supported": ["S256"],
  "authorization_response_iss_parameter_supported": true,
  "client_id_metadata_document_supported": true
}
```

Requer S256 para PKCE. Regista a cadeia exata de emissor. Esse valor exato torna-se a chave para registro e armazenamento de tokens.

### Seguir a prioridade de registo

Use informações pré-registradas do cliente quando o cliente já tem uma relação explícita com a emissora selecionada. De outra forma, prefira Documentos de Metadados de ID do cliente quando o servidor de autorização anuncia suporte. Use DCR apenas como a falha de compatibilidade obsoleta, em seguida, solicite informações do cliente se nenhum desses mecanismos estiver disponível.

### Preferir documentos de metadados de ID do cliente

Um documento de metadados de ID do cliente dá ao servidor de autorização um URL HTTPS que é tanto o identificador do cliente quanto a localização de seus metadados:

```json
{
  "client_id": "https://client.example.com/oauth/metadata.json",
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

O servidor de autorização recolhe e valida o documento.`client_id`deve ser um URL HTTPS com um caminho, e o valor dentro do documento deve ser igual a esse URL exatamente. Os campos de documento necessários são `client_id`- Não .`client_name`, e `redirect_uris`- Não .`application_type`O novo uso obrigatório é especificamente o caminho DCR.

Tratar a obtenção do documento como uma operação sensível ao SSRF. Resolver e validar o destino, rejeitar endereços loopback, privados, link-local e de outra forma não permitidos, verificar novamente após redirecionamentos e alterações de DNS, limitar redirecionamentos, bytes e tempo, exigir JSON, e apenas de acordo com controles de cache HTTP validados. Tratar `client_name`e outros campos de exibição como texto não confiável.

O CIMD elimina a necessidade de imprimir um novo identificador dinâmico para cada primeiro contato.

### DCR é um caminho de compatibilidade

O Registro Dinâmico de Clientes continua disponível para servidores de autorização antigos, mas é desatualizado para novas implementações de MCP.

Ao utilizar DCR, declarar `application_type`- Não .

```json
{
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

- Utilização de clientes de desktop, móvel, linha de comando e loopback `native`- Não .
- Utilização de aplicativos de navegador hospedados remotamente `web`e redireções remotas HTTPS.

Exclusão do campo pode ser por defeito `web`em uma implementação de registro OpenID Connect e fazer um redirecionamento loopback legítimo falhar.

Mantenha o código DCR por trás de uma decisão explícita de retrocesso. Não recue silenciosamente após uma falha de validação arbitrária do CIMD. Isso pode transformar uma falha de segurança em um caminho de inscrição mais fraco.

### A obrigação de atribuir credenciais ao emitente

Armazenar material de inscrição emitido pelo emitente sob a denominação exacta do emitente:

```text
issuer_credentials[issuer] = pre_registered_or_dcr_client
tokens[(issuer, resource)] = access_token
```

Se a descoberta de recursos protegidos mudar de `https://auth-one.example`- Não .`https://auth-two.example`, reevaluar a confiança. Nunca envie o segredo do cliente da primeira emissora, o ID do cliente DCR, o token de acesso de registro, o token de atualização ou o token de acesso para o segundo. Os clientes pré-registrados e DCR devem usar as credenciais emitidas para a nova emissora.

Um ID do cliente CIMD é diferente porque é um URL HTTPS auto-hostado, não uma credencial criada por um servidor de autorização. O mesmo URL CIMD é portátil: um novo emissor confiável pega e valida o documento sem re-registro DCR. Respuestas de autorização e tokens ainda são validados e armazenados sob o novo emissor.

### Código de autorização com PKCE

O fluxo interativo é:

1. Gerenciar uma alta entropia `code_verifier`- Não .
2. Derivar o S256 `code_challenge`- Não .
3. Enviar a solicitação de autorização com exato `client_id`- Não .`redirect_uri`- Não .`scope`- Não .`code_challenge`, e `resource`- Não .
4. Receber uma resposta de autorização contendo `code`e, quando fornecido, `iss`- Não .
5. Validação`iss`contra o emitente registrado exato antes de utilizar qualquer campo de resposta.
6. Troca o código com `code_verifier`, o mesmo redirecionamento URI, e o mesmo `resource`- Não .
7. Guarde o token resultante em `(issuer, resource)`- Não .

O `resource`Parâmetro de RFC 8707 aparece tanto em solicitações de autorização e token.

### Validação`iss`- Exactamente.

A RFC 9207 impede que uma resposta de autorização de um emitente seja confundida com uma resposta de outro.

Quando ?`iss`Se o código estiver presente, compare-o com o emissor registrado sem dobrar o caso, alterar o trail-slash, remover a porta padrão ou normalizar a codificação por cento.

Um servidor de autorização que inclui `iss`publicidade `authorization_response_iss_parameter_supported: true`Os clientes atuais ainda validam um presente .`iss`Mesmo quando esse anúncio está faltando.

### Validação de audiência no servidor MCP

O servidor de recursos só aceita tokens emitidos para si:

```text
token.issuer == configured_authorization_server
token.audience == canonical_mcp_resource
```

Os tokens inválidos, expirados, errados emitentes ou de audiência errada recebem 401. O servidor MCP não deve aceitar ou transitar um token destinado a outro serviço.

### Solicitar o menor alcance de corrente

Comece com o escopo necessário agora. Se uma ferramenta posterior exigir mais, o servidor retorna 403 com um desafio de escopo autorizado:

```text
WWW-Authenticate: Bearer error="insufficient_scope",
  scope="notes:delete",
  resource_metadata="https://notes.example.com/.well-known/oauth-protected-resource/mcp"
```

O cliente explica a nova permissão, obtém o consentimento, executa um novo fluxo de autorização com o conjunto de escopo combinado e retenta a solicitação MCP com um novo ID JSON-RPC.

Não se suponha que o âmbito de aplicação em causa seja um subconjunto de `scopes_supported`O desafio é autoritário para a operação actual.

### Autorização e o fio MCP sem Estado

Uma chamada de ferramenta autorizada ainda contém o envelope completo de solicitações atuais:

```text
POST /mcp
Authorization: Bearer <access-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.delete
```

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "notes.delete",
    "arguments": {"id": "note-7"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "oauth-lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

O token autoriza o principal, os metadados da solicitação negociam o comportamento do protocolo, nenhum substitui o outro.

Validar o fio em uma ordem fixa: JSON-RPC e tipos de metadados, igualdade de cabeçalho e corpo, em seguida, suporte de protocolo. Uma desatividade de roteamento ou versão-título retorna HTTP 400 com `-32020`. Se o cabeçalho e o corpo concordarem em uma versão não suportada, retorne HTTP 400 com `-32022`E ...`data`- Exactamente .`{"supported":["2026-07-28"],"requested":"<actual>"}`Um método desconhecido retorna HTTP 404 com `-32601`- Não .

Cada erro de solicitação, incluindo 401 tokens inválidos e 403 escopo insuficiente, é um envelope de erro JSON-RPC com a solicitação original `id`. Informações de recuperação estruturada pertencem a um erro opcional `data`- O que é ?`WWW-Authenticate`O texto de um notificação não tem um código de código.`id`Uma notificação HTTP aceita retorna 202 com um corpo vazio.

O servidor implementa `server/discover`O Conselho de Ministros da Agricultura e do Meio Ambiente, da Agricultura e do Meio Ambiente, da Agricultura e do Meio Ambiente, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura, da Alimentação e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Saúde, da Agricultura e da Alimentação, da Agricultura e da Alimentação, da Agricultura e da Saúde, da Agricultura e da Agricultura, da Agricultura e da Saúde, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Saúde, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura, da Agricultura, da Agricultura, da Agricultura e da Agricultura, da Agricultura e da Agricultura.`tools/list`Os seus descriptores de ferramentas têm nomes estáveis, descrições e raiz de objeto.`inputSchema`Os valores são deterministas e retornam.`resultType`, metadados de identidade do servidor, um limite `ttlMs`, e `cacheScope`- A descoberta e uma lista de ferramentas independentes do utilizador podem estar disponíveis antes da autorização.

### Não há passaportes simbólicos

Um servidor MCP não deve encaminhar o token de acesso MCP do cliente para uma API de downstream. Obter um token de downstream separado com o público certo ou usar um design explícito de troca de token. A validação do público só funciona quando os serviços recusam tokens cunhados para outra pessoa.

### Tokens de atualização

Os tokens de atualização são opcionais. Quando emitidos, armazená-los confidencialmente e segmenta-los por emissor e recurso. Não suponha que existam. Rotá-los quando o servidor de autorização suporta a rotação e detectar a reutilização de valores inválidos.

```figure
t3-scope-stepup
```

## Construí-lo

`code/main.py`é um protocolo em processo e simulador de autorização. Implementa descoberta de recursos protegidos, metadados do servidor de autorização, inscrição no CIMD, retrocesso de DCR com versão, verificações de tipos de aplicativos, PKCE, validação de emissor, tokens vinculados a recursos, intensificação do escopo,`server/discover`- Não .`tools/list`, e um pedido de ferramenta sem estado.

O modelo recebe corpos de solicitações analisados e cabeçalhos de roteamento.`Content-Type`ou `Accept`. Conecte-o ao adaptador HTTP Streamable da Lição 09 , que requer `Content-Type: application/json`e um `Accept`valor que contém ambos `application/json`E ...`text/event-stream`- Não .

- É o que é ?

```bash
cd phases/13-tools-and-protocols/16-mcp-security-oauth-2-1
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

A saída mostra a descoberta primeiro, inscrição no CIMD, uma leitura comum, dois passos separados no escopo e armazenamento de credenciais de chave de emissor.

## Usá-lo

Mapear os objetos do simulador para os componentes de produção:

- `ResourceServer.protected_resource_metadata`torna-se o ponto final da RFC 9728.
- `AuthorizationServer.metadata`torna-se RFC 8414 ou OpenID Connect descoberta.
- `Client.enroll`torna-se resolução CIMD mais um ramo de compatibilidade explícita com o DCR.
- Credenciais de cliente emitidas pelo emitente e `tokens_by_issuer_resource`Uma URL CIMD pode permanecer portátil enquanto os resultados da sua autorização permanecerem vinculados ao emissor.
- `ResourceServer.handle`torna-se middleware que valida os cabeçalhos atuais do MCP, token e alcance das ferramentas antes de ser enviado, mantendo cada erro de solicitação em um envelope JSON-RPC correspondente.

## Envia-o

Esta lição vai avançar .`outputs/skill-oauth-scope-planner.md`. Agora, ela desenha a prioridade de inscrição, o armazenamento de credenciais vinculado ao emissor, o tipo de aplicação, o PKCE, os indicadores de recursos, os desafios de âmbito e o limite atual de solicitações de apatridia.

## Exercícios

1. Adicione rotação de token de atualização e rejeite a reutilização do token de atualização anterior.
2. Adicionar uma lista de autorizações de emissor. Ao mudar de emissor, reutilizar apenas uma URL CIMD portátil; recusar todas as credenciais e tokens emitidas anteriormente pelo emissor.
3. Adicionar um prazo de validade aos códigos de autorização e confirmar falha de uma troca tardia.
4. Construir uma variante do cliente web com um redirecionamento remoto HTTPS e comparar seus metadados DCR com o cliente nativo.
5. Adicionar um segundo recurso sob a mesma emissora. Confirmar que o token de acesso não pode ser usado no primeiro recurso.

## Termos-chave

| Term | Meaning |
|------|---------|
| Protected-resource metadata | RFC 9728 document that identifies the resource and authorization servers |
| CIMD | HTTPS metadata document whose URL is the OAuth client identifier |
| DCR | Deprecated dynamic client enrollment retained for compatibility |
| `application_type` | `native` or `web`, used to validate redirect URI rules |
| PKCE | Verifier and S256 challenge that protect an intercepted authorization code |
| `iss` | RFC 9207 authorization response issuer identifier |
| Resource indicator | RFC 8707 parameter that binds a token request to an MCP resource |
| Audience | Resource for which a token is valid |
| Step-up | New consent and token issuance for an additional current-operation scope |
| Issuer-bound credentials | Registration and token records isolated by exact authorization server issuer |

## Mais leitura

- [MCP 2026-07-28 authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 9207: OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207)
- [OAuth Client ID Metadata Document draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/)
