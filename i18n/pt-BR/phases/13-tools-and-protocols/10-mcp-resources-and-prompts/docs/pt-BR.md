# Recursos e instruções do MCP: Contexto endereçável para servidores sem Estado

> Ferramentas executam operações. Recursos expõem conteúdo endereçável. Instrui pacotes de mensagens selecionados pelo usuário. Um bom servidor MCP mantém esses contratos separados e previsíveis.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 07 (Building an MCP Server), Phase 13, Lesson 09 (MCP Transports)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Escolha entre ferramentas, recursos e instruções da intenção do consumidor.
- Anunciar o recurso e a superfície imediata através de obrigatoriedade `server/discover`- Não .
- Construir determinismo `resources/list`E ...`prompts/list`Os resultados.
- Aplicar`ttlMs`E ...`cacheScope`sem vazamento de dados específicos do utilizador.
- Retorna o erro JSON-RPC `-32602`para um URI de recurso inválido ou desconhecido.
- Abre um .`subscriptions/listen`POST-resposta de fluxo e correlacionar cada evento por ID de assinatura.
- Trate o conteúdo do recurso e os modelos de solicitação como saída de servidor não confiável.

## Comece com o consumidor

A maneira mais fácil de usar mal o MCP é começar com o código de implementação. Uma consulta de banco de dados se torna uma ferramenta porque as funções são familiares. Um fluxo de trabalho reutilizável se torna um recurso porque é armazenado em um arquivo. Um prompt se torna política oculta porque o host pode injetá-lo.

Comece com quem escolhe e o que eles esperam.

| Primitive | Primary intent | Selection owner | Typical result |
|---|---|---|---|
| Tool | Perform an operation | Model or application | Structured action result |
| Resource | Read content at a URI | Host, application, or user | Text or binary content |
| Prompt | Start a reusable message workflow | User through host UI | One or more prompt messages |

Uma nota em `notes://note-1`é um recurso porque é um conteúdo endereçável. `delete_note`É uma ferramenta porque muda o estado.`review_note`é um prompt porque um usuário escolhe um fluxo de trabalho de revisão preparado.

Não expõe uma operação como todas as três apenas para parecer completa. Cada superfície extra precisa de descoberta, autorização, armazenamento em cache, manejo de erros, testes e documentação.

## O Envelope dos Estadados 2026-07-28

Esta lição visa a revisão do protocolo do MCP `2026-07-28`Não há nenhuma inicialização de aperto de mão ou sessão de protocolo neste perfil.`_meta`- As chaves.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

Um servidor deve implementar `server/discover`O seu resultado é apoiado por anúncios
versões, recursos e recursos de execução, identidade de implementação, e
Um cliente pode chamar outro método diretamente, mas a descoberta dá-lhe
uma instantânea estável antes de construir uma interface.

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "resources": {"listChanged": true, "subscribe": true},
    "prompts": {"listChanged": true}
  },
  "ttlMs": 3600000,
  "cacheScope": "public"
}
```

Um resultado normal declara .`"resultType": "complete"`A resposta .`_meta`identifica a implementação de serviço com `io.modelcontextprotocol/serverInfo`. Esta informação é útil para diagnóstico. Não é uma identidade de autenticação.`-32022`com a revisão solicitada e as revisões suportadas do servidor.

O contrato sem estado muda os seus instintos de design. Uma lista não pode depender de uma chamada anterior em uma conexão. A autorização pode mudar o conjunto visível porque as credenciais são de entrada de solicitação, mas o histórico de conexão não deve.

## Recursos são contratos URI estáveis

Um recurso é o conteúdo identificado por um URI.

Boas propriedades URI:

- Estabilidade suficiente para marcar ou passar entre pedidos.
- Espaçados para o domínio do servidor.
- Independente de uma identificação de processo ou de uma conexão.
- Validado antes do acesso ao armazenamento.
- Autorizado em todas as leituras.

`notes://note-1`É melhor do que`note-1`Um servidor de arquivos pode usar `file://`URI, mas ainda deve verificar os limites do diretório configurado após resolver os links simulgados e segmentos relativos.

`resources/list`Retorna os recursos atualmente visíveis para o chamador. Ordenar por uma chave estável, como URI. Ordem determinista impede que falhem cache barulhentos, mudanças de instantâneos e UI hospedeiros que saltam entre atualizações.

```json
{
  "resultType": "complete",
  "resources": [
    {
      "uri": "notes://note-1",
      "name": "Architecture decision",
      "description": "Why the service uses a stateless boundary",
      "mimeType": "text/markdown"
    }
  ],
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "notes-server",
      "version": "2.0.0"
    }
  }
}
```

`resources/read`Retorna um ou mais itens de conteúdo. Um URI desconhecido não é uma leitura vazia bem sucedida. A especificação atual de recursos atribui URIs de recursos invalidos ou desconhecidos a parâmetros invalidos JSON-RPC, código `-32602`- Não .

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32602,
    "message": "Unknown or invalid resource URI",
    "data": {
      "uri": "notes://missing"
    }
  }
}
```

Essa distinção permite que um cliente separe ausência de um documento vazio válido.

### Modelos de recursos

Um modelo de recurso descreve uma família de URI parametrizados. Use um quando listar cada item concreto seria caro ou ilimitado. Por exemplo, `notes://projects/{project}/decisions/{decision}`Diz ao cliente como formar um endereço válido sem devolver todas as decisões.

Um modelo não enfraquece a validação. Parsear variáveis, aplicar autorização, impor limites de comprimento e caracteres e construir consultas de armazenamento com parâmetros digitalizados. Nunca concatenar uma cauda arbitrária de URI em um caminho do sistema de arquivos ou declaração de banco de dados.

### O conteúdo não é instrução confiável

O texto do recurso pode conter injeção rápida, segredos, comandos enganosos ou marcas mal formadas. O host deve preservar a proveniência e tratar o conteúdo do recurso como dados. O servidor deve limitar o tamanho do conteúdo, retornar um tipo MIME preciso, editar campos que o chamador não pode acessar e evitar retornar registros não relacionados.

## Os comandos são modelos controlados pelo usuário

As instruções MCP são projetadas para seleção explícita do usuário. Um host pode renderizá-las como comandos de corte, itens de menu ou botões de fluxo de trabalho. O protocolo não requer uma interface de usuário.

`prompts/list`Cada prompt precisa de um nome estável, uma descrição útil e declarações de argumento que permitam que o host colete entrada antes `prompts/get`- Não .

```json
{
  "resultType": "complete",
  "prompts": [
    {
      "name": "review_note",
      "title": "Review a note",
      "description": "Review one note for a named concern",
      "arguments": [
        {
          "name": "uri",
          "description": "The note resource URI",
          "required": true
        }
      ]
    }
  ],
  "ttlMs": 600000,
  "cacheScope": "public"
}
```

`prompts/get`Resolve argumentos em mensagens. Não substitui as instruções do sistema do host. O host decide como as mensagens devolvidas entram no contexto do modelo e mantém sua própria política de confiança em maior prioridade.

Validar argumentos de prompt no limite do servidor. Um URI de prompt deve passar pela mesma verificação de autorização que uma leitura direta do recurso. Não faça de um prompt um canal lateral em torno do acesso ao recurso.

## As dicas de cache fazem parte da correção

`ttlMs`Indica ao cliente quanto tempo um resultado pode ser reutilizado. `cacheScope`descreve quem pode partilhar esse valor em cache.

| Scope | Meaning | Typical use |
|---|---|---|
| `public` | May be reused across users when authorization permits | Public prompt catalog |
| `private` | Bound to the requesting user or credential context | User-owned note content |

Escolha um TTL a partir da taxa de mudança dos dados e do dano da atraso. Cinco minutos podem servir para um catálogo público de solicitação.

O MCP define apenas `public`E ...`private`Como `cacheScope`Para um resultado secreto ou em rápida mudança, retornar `cacheScope: "private"`com`ttlMs: 0`, então aplicar qualquer regra mais rigorosa de não-locker na política de cache do host. `no-store`não é um MCP em si `cacheScope`- O valor.

As dicas de cache nunca substituem a autorização. Uma chave de cache deve incluir todas as dimensões de solicitação que alteram a visibilidade, incluindo inquilino, usuário, alcance, local e cursor de paginagem. Se um cache compartilhado não pode expressar essas dimensões com segurança, use `private`com um TTL zero e uma política de não venda de lojas no nível do host.

## Assinaturas Usar um fluxo de resposta aberto pelo cliente

O padrão de assinatura moderno substitui o antigo `resources/subscribe`RPC e o antigo ponto final do evento HTTP GET.

O cliente manda .`subscriptions/listen`Como uma solicitação normal JSON-RPC. Sobre Streamable HTTP este é um POST cuja resposta permanece aberta como um fluxo SSE.`notifications`O objeto é um permitido. Um servidor não deve entregar tipos de notificação que não foram solicitados.

```json
{
  "jsonrpc": "2.0",
  "id": 17,
  "method": "subscriptions/listen",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    },
    "notifications": {
      "resourcesListChanged": true,
      "promptsListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

O ID da solicitação é o ID da assinatura. Antes de qualquer evento solicitado, o servidor envia `notifications/subscriptions/acknowledged`O seu filtro contém apenas o subconjunto que o servidor aceitou.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "notifications": {
      "resourcesListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

Cada evento posterior nesse fluxo tem os mesmos metadados.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "uri": "notes://note-1"
  }
}
```

A notificação diz que o recurso mudou.`resources/read`Não se assume que o evento contenha o novo documento.

Várias assinaturas podem compartilhar um canal de estúdio. O ID de assinatura permite que o cliente demultiplexe.`resultType: "complete"`A resposta correlacionada com o pedido original.

Não use um fluxo de assinatura como sessão de protocolo. Uma leitura posterior ainda é uma solicitação completa que pode chegar a qualquer instância de servidor saudável.

```figure
t3-primitive-sort
```

## Laboratório Interativo

Use a figura para classificar cinco recursos de um rastreador de projeto: detalhes de questão, criar questão, modelo de revisão de sprint, política do projeto e questão de fechamento. Depois, decida quais listas podem ser armazenadas em cache publicamente, que leitura deve permanecer privada e quais recursos merecem notificações de atualização.

Para cada classificação, nome o escolhedor. Se o modelo executar uma ação, use uma ferramenta. Se um host ler conteúdo com endereço URI, use um recurso. Se o usuário iniciar um fluxo de trabalho de mensagem preparado, use um prompt.

## Laboratório de Prática

Execute o simulador a partir da raiz do repositório:

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Inscreva a transcrição na seguinte ordem:

1. Confirme .`server/discover`publicita a revisão atual e ambas as capacidades.
2. Confirmar que os resultados da lista estão classificados e usados `resultType: "complete"`- Não .
3. Confirmar a lista e ler resultados contêm dicas intencionais de cache.
4. Alterar a URI de leitura para `notes://missing`e observar .`-32602`- Não .
5. Confirmar o reconhecimento de assinatura antes do evento do recurso.
6. Confirmar o evento e fechar graciosamente ambos carregam o ID de assinatura `5`- Não .

O modelo Python não abre uma conexão HTTP real. Representa as mensagens que um SDK deve colocar no fluxo de resposta de escala de solicitação.

## Artigo enviado

`outputs/skill-primitive-splitter.md`É uma revisão de design reutilizável para seleção primitiva de MCP. Agora verifica a descoberta determinista, o escopo do cache, o comportamento inválido do URI e os filtros de assinatura modernos.

A lição também navega .`assets/primitive-split.svg`, uma versão estática do limite primitivo e assinatura para estudo offline.

## Verifique

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Resultado esperado: o programa principal imprime uma transcrição JSON e o comando de teste relata pelo menos doze testes de aprovação.

## Conexão Capstone

Use este contrato quando o seu servidor de capstone expõe conhecimentos endereçáveis além de ações. Inclua um catálogo determinista instantâneo, uma leitura de recurso autorizado, uma resolução rápida, um caso URI inválido e uma transcrição de assinatura.

As suas provas devem mostrar que nenhuma lista depende do histórico de conexão e que um evento de assinatura nunca concede acesso ao recurso subjacente.

## Exercícios

1. Adicionar um`notes://projects/{project}/notes/{id}`Modelo de recurso e valida ambas as variáveis.
2. Adicionar página para `resources/list`Mas, ao mesmo tempo, preservando a ordem determinista.
3. Crie um recurso para `cacheScope: "private"`com`ttlMs: 0`, adicionar uma política de não-locação de loja de nível host, e explicar a ameaça que justifica ambos os controles.
4. Adicionar uma assinatura de alteração da lista de solicitações e provar que nenhum evento é enviado quando o filtro for omitido `promptsListChanged`- Não .
5. Criar duas assinaturas simultâneas e provar que cada evento tem a ID de solicitação correta.
6. Adicione uma autorização sujeita ao processador de leitura e prove que uma entrada no cache não pode cruzar assuntos.

## Termos-chave

- **Resource:**Conteúdo com endereço URI exposto por um servidor MCP.
- **Prompt:**Um modelo de mensagem controlado pelo utilizador exposto por um servidor MCP.
- **Deterministic list:**Um resultado de descoberta com adesão estável e ordenação para as mesmas entradas de solicitação.
- **`ttlMs`:**Cachar a duração da fresquidade em milissegundos.
- **`cacheScope`:**O limite de compartilhamento para um resultado em cache.
- **`subscriptions/listen`:**Um pedido de longa duração cujo fluxo de resposta fornece notificações explicitamente filtradas.
- **Subscription ID:**Identificação original da solicitação de escuta, repetida nos metadados da notificação.
- **Invalid parameters:**Erro JSON-RPC `-32602`, utilizado para um URI de recurso inválido ou desconhecido.
- **Unsupported protocol version:**Erro JSON-RPC `-32022`, incluindo `supported`E ...`requested`Revisões.
- **`server/discover`:**Método servidor obrigatório que retorna revisões suportadas, recursos, identidade e sugestões opcionais de cache.

## Mais leitura

- [MCP 2026-07-28 Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP 2026-07-28 Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP 2026-07-28 Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
