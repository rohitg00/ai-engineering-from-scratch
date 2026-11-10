# Autor de MCP em Produção: Inscrição e Tokens vinculados ao emissor

> A lição 16 construiu a máquina de estado OAuth 2.1. Esta lição endurece seus limites de produção para MCP 2026-07-28: Documentos de Metadados de ID do Cliente em primeiro lugar, registro dinâmico desatualizado apenas para compatibilidade, validação do emissor de autorização-resposta, credenciais do cliente de chave do emissor, atualização JWKS e tokens pinados pelo público em cada solicitação sem estado.
>
> **Spec note (2026-07-28):**O registro dinâmico do cliente é desaproveitado em favor dos documentos de metadados de ID do cliente.`application_type`Um cliente valida a presente RFC 9207 `iss`Valorizar e nunca reutilizar credenciais em emissores de servidores de autorização.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 16 (OAuth 2.1 state machine), Phase 13 · 17 (gateways)
**Time:** ~90 minutes

## Objetivos de aprendizagem

- Descubra um servidor de autorização através dos metadados RFC 8414 e verifique o contrato.
- Registre um documento de metadados de identificação do cliente e isola o DCR desatualizado como um retrocesso.
- Validação da RFC 9207 `iss`, registros de chave por emissor de servidor de autorização e tokens de chave vinculados a recursos por emissor mais recurso.
- Cache e atualize as chaves JWKS em um cronograma para que a verificação da assinatura sobreviva ao rolover da chave.
- Aplicar tokens a um único recurso MCP usando indicadores de recursos RFC 8707 e recusar a reutilização de substituição confusa.
- Escolha a validação JWT ou a introspecção de token, defina a frescura da revogação e falhe com segurança quando as dependências de identidade não estão disponíveis.
- Separar o servidor de autorização, servidor de recursos e cliente para que cada um aplique apenas os seus próprios controles.
- Auditar um servidor de autorização contra uma lista de verificação de implantação e recusar inscrição insegura ou reutilização de tokens.

## O problema

O simulador Lição 16 executa OAuth 2.1 na memória. A produção tem três lacunas operacionais que um simulador de memória só não vê.

A primeira lacuna é a inscrição e o isolamento de credenciais. Uma organização real pode executar centenas de servidores MCP e milhares de clientes MCP.**Client ID Metadata Document**O cliente usa um URL HTTPS com um caminho que controla como seu identificador, e o servidor de autorização tira os metadados. RFC 7591 registro dinâmico permanece apenas como um caminho de compatibilidade depreciado. Quando DCR é inevitável, o pedido declara o correto `application_type`O cliente armazena registos no servidor de autorização do emissor e tokens de acesso no `(issuer, resource)`Um emissor alterado significa uma nova inscrição, e um recurso diferente significa um token separadamente vinculado ao público.

A segunda diferença é a rotação da chave. A validação JWT depende das chaves de assinatura do servidor de autorização, publicadas como um conjunto de chaves Web JSON (JWKS). O servidor de autorização rota estes em um cronograma (muitas vezes por hora, às vezes mais rápido sob resposta a incidentes). Um servidor MCP que pega JWKS uma vez no arranque valida bem até a janela de rotação , então cada solicitação falha até reiniciar. O cabo de produção JWKS como um valor em cache com um trabalho de atualização que sobreescreve o cache antes de as chaves anteriores expirarem, além de um retorno de caché para o caso em que um token assinado por uma chave mais nova do que o cache chegue.

A terceira lacuna é a vinculação do público. A lição 16 introduziu indicadores de recursos RFC 8707. Na produção, esse indicador se torna um teste de reivindicação difícil em cada solicitação.`token.aud`contra seu próprio URL de recurso canônico e rejeita desajustes com HTTP 401. Esta é a única defesa contra um servidor MCP upstream (ou um cliente malicioso que detém um token destinado a um servidor) reproduzindo esse token contra outro servidor na mesma malha de confiança.

Esta lição mapeia cada espaço em um pedaço de concreto da superfície. O documento de metadados é um endpoint HTTP. A atualização do cache JWKS é um trabalho programado mais um cache de valor chave. A validação JWT é uma rotina que o servidor de recursos executa antes de enviar qualquer ferramenta. Mantenha os três papéis separados e cada um impõe apenas os controles que possui: o servidor de autorização emite e roteia chaves, o servidor de recursos cache e valida, o cliente descobre e se inscreve.

## Ámbito de aplicação: Execução da produção após a lição 16

[Lesson 16: MCP Security with OAuth 2.1](../../16-mcp-security-oauth-2-1/docs/en.md)A lição não define um segundo fluxo de OAuth. Começa depois que esses contratos existem e pergunta como um servidor de recursos implantado mantém a sua aplicação durante a rotação de chaves, validação de tokens opacos, revogação, falha de dependência, implantação e resposta a incidentes.

O limite de produção é mais estreito e mais operacional:

- Um caminho JWT verifica um emissor fichado, algoritmo, chave de assinatura, público, reivindicações de tempo e escopo em cada solicitação enquanto refresca JWKS com segurança.
- Um caminho de tokens opacos chama o endpoint de introspecção autenticado do emissor e valida o estado ativo, público ou recurso, expiração, assunto e escopo devolvidos.
- A política de revogação define a rapidez com que uma credencial deve parar de funcionar e qual cache pode atrasar esse facto.
- A política de falha decide o que acontece quando a infraestrutura de descoberta, JWKS, introspecção ou revogação não está disponível.
- Registros de evidências que mostram que os metadados do emissor, o conjunto de chaves ou a resposta de introspecção, as reivindicações de tokens, a versão da política e a razão de recusa conduziram o resultado sem armazenar o token.

A lição 16 prova o fluxo. a lição 18 prova que um token permanece confiável, ou é recusado, depois de atingir um verdadeiro caminho de solicitação de MCP.

## O conceito

### RFC 8414  Metadados do servidor de autorização OAuth

Um documento em `/.well-known/oauth-authorization-server`descreve tudo o que um cliente precisa:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "client_id_metadata_document_supported": true,
  "registration_endpoint": "https://auth.example.com/register",
  "authorization_response_iss_parameter_supported": true,
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

Um cliente que recebeu uma MCP recurso URL cadeias de descoberta: `oauth-protected-resource`A partir da RFC 9728 (documento do servidor de recursos) nomeia o emissor, então `oauth-authorization-server`O cliente nunca codifica um URL de autorização.

Para um identificador de recurso com um caminho, insira o segmento conhecido antes desse caminho.`https://mcp.example.com/team/server`Resolve os metadados de recursos protegidos em `https://mcp.example.com/.well-known/oauth-protected-resource/team/server`- Aplicando .`/.well-known/...`após o caminho de recursos ser incorreto.

O contrato que verifica antes de confiar num IDP para o MCP:

- `code_challenge_methods_supported`inclui`S256`(PKCE por RFC 7636).**absent**, o servidor de autorização não suporta PKCE e o cliente **MUST**recusar a proceder.
- `grant_types_supported`inclui`authorization_code`e rejeita .`password`E ...`implicit`- Não .
- Há pelo menos um caminho de inscrição disponível: `client_id_metadata_document_supported: true`(CIMD, preferencial), um cliente pré-registrado, ou `registration_endpoint`(compatibilidade com a RFC 7591 degradada).
- Se`authorization_response_iss_parameter_supported`É verdade, o cliente requer o RFC 9207 devolvido.`iss`e compara-o exatamente com o emitente registado antes da redirecção.
- `response_types_supported`É exactamente`["code"]`para OAuth 2.1.

Se`S256`Se o servidor MCP não estiver disponível, o servidor MCP não se recusa a implementar contra este IdP  não há modo degradado para o PKCE.`client_id`O manifesto de implantação está errado, não o código.

### RFC 9728 (recapitulação)  Metadados de recursos protegidos

A lição 16 cobriu RFC 9728. O delta na produção: este documento é o único lugar que um cliente procura para encontrar os servidores de autorização confiáveis por * este * servidor MCP. Um único servidor MCP pode aceitar tokens de vários IdPs (um para funcionários, um para parceiros).

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### Documentos de metadados de ID do cliente (a definição padrão recomendada)

O CIMD inverte o registro de *push* para *pull*. Em vez de pedir ao servidor de autorização para coletar um `client_id`, o cliente usa um URL HTTPS que controla **as**- O seu`client_id`. A URL resolve-se a um documento de metadados JSON; o servidor de autorização o retira à demanda durante o fluxo OAuth.`app.example.com`, confia no cliente atendido por`https://app.example.com/client.json`Não há registo de ida e volta, não.`client_id`Espaço de nomes para descarga, nenhum estado por servidor para manter sincronizado.

O documento de metadados hospedado pelo cliente:

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback", "http://localhost:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

O `client_id`valor no documento **MUST**igual ao URL que é servido a partir (o servidor de autorização verifica isso; as desatividade são rejeitadas). O servidor de autorização anuncia suporte com `client_id_metadata_document_supported: true`Os dados de referência devem ser incluídos nos dados de referência RFC 8414

Para o contrato atual da CIMD, `client_id`- Não .`client_name`, e um não vazio .`redirect_uris`O identificador do cliente é um URL HTTPS absoluto com um caminho. `application_type`O requisito de DCR para o CIMD não é obrigatório.`application_type`na via CIMD preferida.

Dois fatos de segurança que a especificação é clara sobre:

- **SSRF.**O servidor de autorização retira uma URL fornecida pelo atacante. Ele deve se defender contra falsificação de solicitações do lado do servidor (sem retiros para endpoints internos / administradores).
- **localhost impersonation.**A CIMD sozinha não pode impedir um atacante local de reivindicar o URL de metadados de um cliente legítimo e vincular qualquer `localhost`Redirecionar. O servidor de autorização **MUST**exibe claramente o nome de hospedeiro de redirecção URI durante o consentimento e **SHOULD**Avisa-me .`localhost`- só redirecionam.

Como o CIMD não precisa de estado do lado do servidor, não há registrador para se manter na forma que o DCR requer. O lado do cliente é somente de leitura: entregue seu documento de metadados a partir de um endpoint HTTPS estático e deixe o servidor de autorização puxá-lo.

Se o operador do servidor de autorização já forneceu um identificador de cliente, use esse registro de escala do emissor antes de tentar a inscrição automática. Caso contrário, prefere o CIMD. Use o DCR desatualizado apenas quando o emissor não puder usar o pré-registro ou o CIMD.

### RFC 7591: inscrição de compatibilidade ultrapassada

O DCR é obsoleto na revisão 2026-07-28. Mantenha-o apenas para servidores de autorização que não podem consumir CIMD e onde o pré-registro é impraticável.

```json
POST /register
Content-Type: application/json

{
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

O servidor responde com `client_id`e um `registration_access_token`para atualizações posteriores:

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`application_type`Um cliente de desktop loopback declara que`native`; um cliente hospedado no servidor declara `web`e utiliza HTTPS redirecionar URI. `token_endpoint_auth_method: none`É o padrão certo para um cliente nativo público.`client_id`somente, com a PKCE a fornecer a prova de posse.

Três armadilhas de produção:

- O ponto final de registo deve ser limitado por IP da fonte.`client_id`Faça uma verificação de limite de taxa antes que o registrador trate o pedido.
- `software_statement`A simulação da lição o salta; a produção transmite uma etapa de verificação que rejeita registros não assinados de qualquer coisa que não seja o localhost redirecionar URI.
- O `registration_access_token`O roubo deste token significa que o atacante pode reescrever os URIs redirecionados do cliente.

### RFC 8707 (recapitulação)  Indicadores de recursos

A lição 16 estabeleceu a forma.`resource=<canonical-mcp-url>`, e o servidor do MCP verifica `token.aud`O URI canônico é o identificador mais específico para o servidor: usa esquema minúscula e host, não há fragmento e convencionalmente não há trailing slash.**not**O modelo de MCP é o único servidor de MCP que é utilizado para identificar um servidor MCP individual.`https://mcp.example.com`- Não .`https://mcp.example.com/mcp`- Não .`https://mcp.example.com:8443`, e `https://mcp.example.com/server/mcp`São todos URIs canônicos válidos.`aud`(A simulação desta aula usa públicos de hospedeiros nu como`https://notes.example.com`Para brevidade, uma implantação que co-hoste vários servidores MCP sob uma única origem os distingue por caminho.)

### RFC 7636 (recapitulação)  PKCE

O PKCE é obrigatório na OAuth 2.1.`code_challenge`E ...`code_verifier`O servidor rejeita qualquer solicitação de token sem um verificador ou com um verificador que não hash para o desafio armazenado.

### Profil de autorização MCP 2026-07-28

A atual revisão do MCP mantém o limite entre o recurso e o servidor OAuth, tornando o transporte do MCP estatal. Não há sessão de protocolo para armazenar em cache uma decisão de identidade.

- Implementar os metadados de recursos protegidos da RFC 9728, e fornecer a sua localização através do `WWW-Authenticate: Bearer resource_metadata="..."`cabeçalho em um 401 **or**O URI conhecido `/.well-known/oauth-protected-resource`(SEP-985 fez o cabeçalho opcional com um retorno bem conhecido).`authorization_servers`campo **MUST**Nomear pelo menos um servidor.
- Aceitar tokens apenas através de `Authorization: Bearer ...`- Não .**every**solicitação  nunca em uma cadeia de consulta, nunca validada apenas no início da sessão.
- Validação`aud`- Não .`iss`- Não .`exp`, e os escopo requeridos por pedido.**MUST**validar que o token foi emitido especificamente para ele (audiência); um erro ou falta de correspondência `aud`é rejeitado, nunca é tratado como um cartão livre.
- No 401/403, retorno `WWW-Authenticate: Bearer`transporte`error=...`, o `resource_metadata="<PRM-URL>"`Parâmetro (a URL do documento de metadados, *não* o recurso nu), e `scope="..."`- Não .`insufficient_scope`(403). Nota: o parâmetro é `resource_metadata`, um ponteiro de descoberta  não há `resource`Parâmetro no desafio.
- Autorizador-servidor de descoberta aceita **either**RFC 8414 Metadados de autenticação **or**OpenID Connect Discovery 1.0; os clientes devem tentar ambos os sufixos conhecidos em ordem de prioridade.
- O cliente (não o servidor) defende-se contra **mix-up attacks**: registra o esperado `issuer`antes de redirecionar e validar o `iss`O PKCE não deixa de confundir, porque o cliente entrega o seu código.`code_verifier`Para qualquer ponto simbólico que fosse dirigido.
- Uma credencial de cliente pertence a um emissor de servidor de autorização.`client_id`, token de registro, ou token de acesso.
- O CIMD é o mecanismo de inscrição preferido. O DCR é desacreditado; uma solicitação de compatibilidade com o DCR continua a declarar o correcto `application_type`- Não .

O projecto OAuth 2.1 é o substrato; a superfície é a RFC 8414/7591/8707/9728/9207 + RFC 7636 + CIMD; a especificação do MCP é o perfil.

### Lista de verificação de capacidade de implantação

As tabelas de características do fornecedor ficam obsoletas rapidamente. Inscreva os metadados devolvidos pelo servidor de autorização que você realmente vai implantar em vez disso. O gate é mecânico:

| Check | Required decision |
|---|---|
| Discovered issuer | Exact HTTPS issuer expected by policy |
| PKCE | `S256` advertised; otherwise stop |
| Enrollment | CIMD preferred, pre-registration accepted, DCR only as deprecated compatibility |
| Authorization response | Validate RFC 9207 `iss` when present or advertised |
| Resource binding | Token request carries `resource`; resource server requires the matching `aud` |
| Credential storage | Key client IDs and registration credentials by issuer; key access tokens by issuer plus resource |
| DCR compatibility | Declare `native` or `web`; reject redirect URIs that do not fit the declared application type |

Não deduzir suporte a partir de um nome de produto ou nível de preços. Captar o documento descoberto em evidências de implantação e não fechar quando um campo obrigatório está ausente.

### Padrão de atualização JWKS (rotar no AS, atualizar no servidor de recursos)

Mantenha dois verbos separados, porque misturá-los é um verdadeiro erro de produção:

- **Rotate**O servidor de recursos não tem parte nisso e não pode fazê-lo.
- **Refresh**É o que o servidor de recursos faz: re-`GET`É a única ação JWKS que um servidor de recursos realiza.

O modo de falha de produção é um cache obsoleto. Resolva-o com um trabalho de atualização programado mais um cache de valor de chave. O servidor de recursos executa um trabalho (cron, temporizador, o que quer que o seu tempo de execução ofereça) que, em um intervalo fixo, retira `<issuer>/.well-known/jwks.json`e sobreescreve.`cache[issuer] = {keys, fetched_at}`O validador lê do cache.`kid`Está faltando nos gatilhos do cache **one**A nova versão de um token é assinada por uma nova chave e chega antes da próxima versão.

O retorno .**must be a re-fetch, never a rotate**Se você ligar o caminho de cache-miss para um rotar-e-minte, duas coisas quebram: (1) minar uma chave nova produz um `kid`que * ainda * não corresponde ao token, então a pesquisa falha de qualquer maneira; e (2) um atacante que pulverizou tokens com aleatório `kid`Os valores forçam uma série ilimitada de criações-chave  um DoS auto-infligido.`kid`custa no máximo uma tração desperdiçada.

Forma do cache:

```json
{
  "https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

Os servidores de autorização giram introduzindo a seguinte chave (`k_2026_04`) antes de retirar o anterior (`k_2026_03`O cache mantém a união; o validador seleciona por `kid`- Não .

### A rotina de validação

O servidor MCP executa a validação antes de enviar qualquer ferramenta.`code/main.py`utilizações:

```python
result = server.validate(bearer_token, required_scope="mcp:tools.invoke")
if not result["valid"]:
    return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
```

`validate`decodifica o JWT, resolve a chave de assinatura do cache JWKS (refrena uma vez por falta), verifica a assinatura, depois verifica `iss`contra a lista de autorização, `aud`contra o recurso canônico deste servidor,`exp`, e o âmbito de aplicação necessário  devolvendo um `WWW-Authenticate`A manutenção de uma única rotina no servidor de recursos significa que cada ponto de entrada (cada chamada de ferramenta, cada transporte) passa pelas mesmas verificações; não há caminho que chegue a uma ferramenta sem validar primeiro.

### Tokens opacos usam introspecção, não conjectura

Nem todos os tokens de acesso são JWT. Se o emissor documenta um token opaco, o servidor de recursos não pode decodificá-lo em alegações confiáveis. Envia o token para o endpoint de introspecção RFC 7662 do emissor através de um backchannel autenticado e requer`active: true`, o contexto de emissor esperado, o público ou recurso exato dos MCP, as reivindicações de tempo não expirado e os escopo exigidos pela ferramenta concreta.

Introspecção de cache por emissor, digestão de tokens de sentido único e recurso MCP. Nunca use o token claro como um log ou um rótulo de cache. Aponta uma entrada de cache positiva pela mais cedo do token expirado, orientação do emitente no cache e o objetivo de recusa da implantação. Mantenha o cache negativo curto o suficiente para que um token recém-emitido não permaneça falsamente inativo. Um resultado para um recurso não pode autorizar outro recurso mesmo quando a cadeia de tokens opaca é idêntica.

Não escolha o modo de validação entre o conteúdo de tokens controlados pelo atacante. Pin JWT versus comportamento de introspecção para metadados de emissor validados e configuração de implantação. No caminho JWT, pin aceitou algoritmos e confiável `jwks_uri`; nunca siga uma URL ou algoritmo chave selecionados apenas pelo cabeçalho do token.

### A revogação é um contrato de frescura.

RFC 7009 permite que um cliente peça a um servidor de autorização para revogar um token. Essa solicitação não elimina cópias já armazenadas em cache por cada servidor de recursos. Defina o atraso máximo aceitável de revogação e faça com que cada cache o honre.

As implementações de tokens opacos podem alcançar uma revogação mais rigorosa, através da introspecção em cada chamada de alto risco ou usando um cache positivo curto. As implementações autônomas do JWT geralmente combinam curtas vidas de tokens de acesso com revogação de tokens de atualização, retirada de chaves para incidentes em todo o emissor e um tópico opcional, sessão ou denilista de token-id para recusa local de emergência. Um JWT assinado permanece criptográficamente válido até expiração, a menos que o servidor de recursos tenha provas externas de revogação atuais.

Logout, desativação da conta, retirada de consentimento e resposta a incidentes são diferentes gatilhos, mas devem convergir em uma declaração mensurável: após o máximo da janela de revogação declarada, cada réplica recusa a credencial. Teste essa declaração através do balanceador de carga, não apenas contra um processo quente.

### A falha da dependência requer uma decisão declarada

Nunca improvise a política de disponibilidade dentro de um manipulador de exceções.

| Failure | Safe production behavior |
|---|---|
| Scheduled JWKS refresh fails, known `kid` remains in a still-valid bounded cache | Continue only within the declared stale-on-error window and emit degraded health evidence |
| Token has an unknown `kid` and the one allowed refresh fails | Reject; never accept an unverifiable signature |
| Introspection is unavailable | Fail closed for protected calls; do not convert network failure into `active: true` |
| Protected-resource or issuer metadata changes unexpectedly | Stop new enrollment and token acquisition; keep only explicitly pinned, unexpired configuration under a bounded incident policy |
| Revocation endpoint is unavailable | Report logout or revocation as incomplete, retain the credential locally as unusable when possible, and do not claim global revocation succeeded |
| Clock source or claim type is invalid | Reject rather than widening skew until the token passes |

Classificar falhas separadamente das credenciais inválidas. Uma interrupção de dependência é um erro operacional com a política de saúde e retry. Uma assinatura ruim, emissor, público, expiração ou escopo é uma recusa de autorização. Nenhum chega ao gerenciador de ferramentas e nenhum deve vazar o conteúdo de token em evidências de auditoria.

### O acesso ao público-replay (restrição de privilégios de acesso a tokens)

Servidor A (`notes.example.com`) e o servidor B (`tasks.example.com`O servidor A é comprometido. O atacante pega no token de notas de um usuário e reproduz-o contra o servidor B.

Validador do servidor B:

1. Decodificar JWT, trazer JWKS por `kid`Verifique a assinatura.
2. Verifique .`iss`contra os seus metadados de recurso protegido `authorization_servers`(Passando o mesmo IDP.)
3. Verifique .`aud == "https://tasks.example.com"`(Falha de token                                                                                                                                                                                                                                                            `aud`É o que é`https://notes.example.com`.)
4. Retorno 401 com `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="https://tasks.example.com/.well-known/oauth-protected-resource"`- Não .

A alegação do público é a única defesa contra este ataque na camada de protocolo. Salto para desempenho é o erro de produção mais comum; o validador deve ser executado em cada solicitação, não apenas no início da sessão.**access-token privilege restriction**: um servidor MCP `MUST`rejeitar qualquer token que não o nomee na audiência.

> **Naming note.**A especificação reserva o termo "deputado confuso" para um problema relacionado, mas distinto: um servidor MCP que atua como um OAuth **proxy**para uma API de terceiros, usando um ID estático do cliente, que encaminha um token sem obter o consentimento do usuário por cliente. Audience binding corrige a repetição acima; a correção confusa-deputado é o consentimento por cliente **plus**nunca passar o token de entrada através de APIs upstream (o servidor MCP `MUST`Obter um token upstream separado).

### Ataques misturados (defesa do lado do cliente que o servidor não pode fornecer)

Um cliente fala com muitos servidores de autorização ao longo de sua vida. Um AS malicioso pode tentar fazer com que o cliente redimia um código de autorização de um AS honesto no token endpoint do atacante.

1. Antes de redirecionar, o cliente registra o esperado `issuer`dos metadados AS validados.
2. Na resposta de autorização, o cliente compara os devolvidos `iss`Parâmetro contra o emissor registrado (comparação simples de cadeia, sem normalização) antes de enviar o código para qualquer lugar.
3. Descoincidência (ou `iss`ausentes quando a AS anunciou `authorization_response_iss_parameter_supported`) → rejeitar, e nem mesmo exibir o `error`campos.

A PKCE não deixa de confusar, porque o cliente entrega o seu`code_verifier`Para o que quer que seja o ponto final do token para o qual foi direcionado.`state`- Não .

### Modos de falha

- **Stale JWKS.**O validador rejeita tokens válidos depois que o AS roteia uma chave. A correção é o padrão cron-refresh + cache-miss-refetch acima. Nunca cache JWKS sem um trabalho de atualização.
- **Rotate-as-fall-back.**Cablear o caminho de cache-miss para um rotar-e-minte em vez de uma re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-re-`kid`, e torna-se controlado pelo atacante .`kid`O retorno deve ser o idempotente `refresh-jwks`- Não .
- **Missing `aud` claim.**Alguns IPs deixam de fazer o default `aud`A menos que`resource`O validador deve rejeitar os tokens com falta `aud`Não tratem a ausência como um cartão livre.
- **Mix-up via missing `iss` check.**Um cliente que não valida a RFC 9207 `iss`O parâmetro de autorização-resposta contra o emissor que ele gravou antes de redirecionar pode ser direcionado para resgatar um código de AS honesto no token endpoint de um atacante.
- **Scope upgrade race.**Dois fluxos de aumento simultâneos para o mesmo usuário podem ser bem sucedidos e produzir dois tokens de acesso com escopo diferente. O validador deve usar o token apresentado no pedido, não procurar "escopo atual do usuário" que cria uma janela TOCTOU.
- **Registration token theft.**Um vazamento .`registration_access_token`O atacante pode reescrever e redirecionar os URI.
- **`iss` not pinned.**Um validador que aceita qualquer`iss`permite que um atacante construa seu próprio servidor de autorização, registre um cliente para o público-alvo e emita tokens.`authorization_servers`A lista é a lista de permitidos; aplique-a.
- **Credential or token cache collision.**Um cliente que abre registros apenas por recurso pode apresentar a identidade de um servidor de autorização para outro. Um cliente que abre tokens de acesso apenas por emissor pode reproduzir um token no público errado. Registros de chave por emissor validado, tokens de acesso de chave por `(issuer, resource)`, e reinscriver-se sempre que o emissor mudar.

```figure
t3-jwks-rotate
```

## Usá-lo

`code/main.py`anda o fluxo de produção completo com stdlib Python e três papéis: `AuthorizationServer`- Não .`ResourceServer`, e `Client`O fluxo:

A partir da raiz do repositório, executar:

```bash
cd phases/13-tools-and-protocols/18-mcp-auth-production
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

O primeiro comando imprime a inscrição e a validação de tokens vinculados ao emissor
O segundo relata 18 verificações de passagem.
ouve ou escreve credenciais de rede.

1. O servidor de autorização publica os metadados RFC 8414 em `/.well-known/oauth-authorization-server`- Não .
2. O cliente MCP liga ao endpoint de metadados e verifica as suas opções de inscrição (`client_id_metadata_document_supported`para a CIMD, `registration_endpoint`para DCR) e `S256`Apoio da PKCE.
3. O cliente verifica se há um pré-registro de escala de emissor, caso contrário, registra com seu documento de metadados de ID do cliente HTTPS.
4. O cliente registra o emitente validado, cria um desafio S256, recebe um código de autorização única mais `iss`, valida o emitente devolvido e resgata o código com o verificador original e a RFC 8707 `resource`Indicador.
5. Cliente MCP chama uma ferramenta no servidor MCP com `Authorization: Bearer ...`- Não .
6. Servidor MCP executa `validate`, resolvendo a chave de assinatura do cache JWKS.
7. O IdP gira uma chave; a atualização programada retira o JWKS para o cache.
8. A próxima chamada valida contra as chaves atualizadas sem reiniciar, e o token anterior ainda valida durante a janela de sobreposição.
9. Uma tentativa de repetição de público contra um recurso diferente da MCP recebe 401 com`audience mismatch`e um `resource_metadata`O punhal.

O JWT aqui usa HS256 com um segredo compartilhado (assim a lição é executada apenas no stdlib). A produção usa RS256 ou EdDSA com o padrão JWKS acima; a lógica de validação é idêntica.`refresh_jwks`lê diretamente a lista de chaves do servidor de autorização; através do fio é um HTTP `GET`- Não .`jwks_uri`- Não .

## Envia-o

Esta lição produz`outputs/skill-mcp-auth.md`. Dada uma configuração de servidor MCP e um conjunto de capacidades de IdP, a habilidade emite a superfície de auth para se manter em pé  os metadados de recurso protegido, o caminho de inscrição a usar (CIMD, pré-registro ou retrocesso DCR), o cronograma de atualização JWKS, o mapeamento de alcance e as regras de recusa a aplicar quando o IdP não suporta o perfil RFC completo.

## Exercícios

1. Corra .`code/main.py`. Rastrear o fluxo. Observe como o IdP gira uma chave no passo 6 da saída do script (passo 7 do fluxo acima), o programado `refresh_jwks`Retira o conjunto publicado e tanto o token antigo (janela de sobreposição) como um token novo validam sem reiniciar.

2. Adicionar um novo IDP aos metadados de recursos protegidos `authorization_servers`Lista. Emite um token assinado pelo novo IDP e confirme que o validador o aceita. Emite um token assinado por um IDP não listado e confirme que o validador rejeita com `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`- Não .

3. Adicionar um check de limite de taxa para `register_client`Utilize um token-bucket por IP de fonte mantido em um pequeno ditado teclado por IP.

4. Leia RFC 7591 e identifique dois campos que a lição tem `/register`O operador não valida. Adicione a validação.`software_statement`E ...`redirect_uris`Sistema de URI.)

5. Adicionar um segundo servidor de autorização. Confirmar que o cliente armazena uma inscrição separada em chave de emissor e se recusa a reutilizar o token do primeiro emissor ou `client_id`- Não .

6. Prova a correcção do DoS. Envia ao validador um token com um aleatório.`kid`e confirmar .`refresh_jwks`O número de chaves do servidor de autorização não cresce, então deliberadamente re-cabe o fall-back para um rotar-e-minte e assistir o número de chaves subir por token falso.

7. Exercício de DCR deprecado com ambos `native`E ...`web`Clientes. Confirmar um cliente web com um redirecionamento HTTP URI e um cliente nativo sem um redirecionamento loopback exato são rejeitados.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ASM | "OAuth metadata document" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| CIMD | "Client metadata URL" | Client ID Metadata Document: an HTTPS URL used as the `client_id`; the AS pulls the JSON. Preferred enrollment in MCP 2026-07-28 |
| DCR | "Self-service client registration" | RFC 7591 `POST /register`; deprecated for current MCP and retained only for compatibility |
| JWKS | "Public keys for JWT validation" | JSON Web Key Set, fetched from `jwks_uri`, indexed by `kid` |
| Rotate vs refresh | "Updating the keys" | *Rotate* = AS mints/retires signing keys; *refresh* = resource server re-fetches the published set. Resource servers only ever refresh |
| Resource indicator | "Audience parameter" | RFC 8707 `resource` parameter pinning the token to one server |
| `aud` claim | "Audience" | JWT claim the validator compares against the canonical resource URL |
| Audience replay | "Token replay" | Token issued for Server A presented to Server B; defended by audience validation (spec: access-token privilege restriction) |
| Confused deputy | "Proxy token misuse" | An MCP proxy with a static client ID forwarding a token without per-client consent; distinct from audience replay |
| Mix-up attack | "Wrong token endpoint" | Client steered to redeem an honest AS's code at an attacker's endpoint; defended client-side via RFC 9207 `iss` |
| `iss` allow-list | "Trusted authorization servers" | The set named in protected-resource metadata's `authorization_servers` |
| `resource_metadata` | "Where to find the PRM doc" | `WWW-Authenticate` parameter naming the RFC 9728 metadata URL on a 401/403 |
| Public client | "Native or browser client" | OAuth client with no `client_secret`; PKCE compensates |
| `WWW-Authenticate` | "401/403 response header" | Carries `Bearer error=...` directives that drive client recovery |

## Mais leitura

- [MCP authorization specification (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)- o perfil de autorização do MCP em vigor
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)- CIMD, validação do emitente, depreciação do DCR e alterações de credenciais de chave do emitente
- [OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) CIMD
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) Contrato de descoberta
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) DCR (caminho de retorno)
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) Prova de posse do cliente público
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) Pinning público
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) Descoberta de servidor de recursos
- [RFC 9207 — OAuth 2.0 Authorization Server Issuer Identification](https://datatracker.ietf.org/doc/html/rfc9207) o `iss`Parâmetro que defenda contra ataques confusos
- [RFC 7662: OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [RFC 7009: OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)
