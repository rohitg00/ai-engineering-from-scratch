# Espetáculo explícito e solicitação de desapatados

> As raízes são desaproveitadas no MCP 2026-07-28 e nunca foram uma caixa de segurança. Coloque alcance em argumentos visíveis de ferramentas ou recursos URIs, autorize-o no servidor e use MRTR quando uma ferramenta realmente precisa de entrada do usuário. O usuário vê a decisão, o modelo vê o maná, e qualquer instância do servidor pode processar a retry.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 11 (stateless MRTR)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Substitua as raízes desatualizadas por parâmetros explícitos do espaço de trabalho, URIs de recursos ou configuração do servidor.
- Indicações de alcance separadas da autorização, contenção de caminho e sandboxing do sistema operacional.
- Modo de entrega`elicitation/create`através de um MRTR `input_required`resultado.
- Anunciar o suporte de elicitação nas capacidades do cliente por pedido e rejeitar os modos não suportados.
- Validação`accept`- Não .`decline`, e `cancel`como resultados distintos.
- Ligue a confirmação destrutiva a um principal autenticado, argumentos originais, conjunto de candidatos e expiração.

## Dois problemas semelhantes

Uma ferramenta de notas recebe o seguinte pedido: "Termine o antigo relatório TPS".

O servidor tem de responder a duas perguntas diferentes.

1. Que espaço de trabalho pode esta operação tocar?
2. Qual das três notas correspondentes o usuário quis dizer?

O primeiro é o escopo e a autorização. O segundo é a desambiguação interativa.

## As raízes são uma superfície de migração

As revisões anteriores do MCP permitiram que um cliente anunciasse Roots e notificasse um servidor quando a lista mudasse.

O MCP 2026-07-28 deprecia `roots/list`E ...`notifications/roots/list_changed`Prefere uma destas substituições explícitas:

- A.`workspaceUri`ou `directory`Argumento de ferramenta quando o alcance varia por chamada.
- Uma URI de recurso quando a operação já visa um recurso.
- Configuração do servidor quando uma implementação possui um espaço de trabalho fixo.
- Uma caixa de arroz de processo ou um sistema de arquivos preso quando o código deve ser tecnicamente incapaz de escapar.

Se ainda for necessária uma integração existente em 2026-07-28 `roots/list`durante a janela de deprecação, o servidor o inserir no MRTR `inputRequests`- não deve enviar um pedido de reversão ao vivo. É um adaptador de migração; os novos operadores devem aceitar um alcance explícito.

O modelo pode ver e repetir um manilho explícito.

### A regra de três camadas

Uma URI explícita ainda não se autoriza.

1. **Authorization:**Este principal autenticado pode usar este espaço de trabalho?
2. **Containment:**O URI-alvo normalizado permanece dentro do limite do espaço de trabalho autorizado?
3. **Sandbox:**O sistema operacional pode impedir um servidor comprometido de escapar de qualquer maneira?

O servidor executável mantém uma lista de permisso de espaços de trabalho autorizados, normaliza percentualmente encodados caminhos, verifica um verdadeiro caminho-componente de fronteira, e re-verifica contenção imediatamente antes da eliminação.

As verificações ingênuas de prefixos de cadeia estão erradas:

```text
allowed:   file:///work/notes
attacker:  file:///work/notes-evil/secret.md
traversal: file:///work/notes/%2e%2e/private.md
```

Ambos os caminhos hostis começam com uma cadeia enganosa. Normalize primeiro, então compare os componentes do caminho. Um servidor de arquivos de produção também deve se defender contra corridas de links simbólicos e semântica de caminho específica para plataforma.

## A solicitação ainda existe, mas a entrega mudou

Elicitation é a função do cliente atual para coletar informações do usuário durante `tools/call`- Não .`prompts/get`, ou `resources/read`O nome do método permanece .`elicitation/create`O que mudou foi a direcção do fluxo do fio.

Um servidor 2026-07-28 não envia uma solicitação JSON-RPC inversa.`InputRequiredResult`- Não .

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "delete_choice": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "Choose one matching note and confirm deletion.",
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
    },
    "requestState": "integrity-protected-delete-state"
  }
}
```

O host retransmite o formulário. O usuário pode aceitar, rejeitar ou rejeitá-lo explicitamente. O cliente então retrata o original `tools/call`com um documento de identificação fresco:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes_delete",
    "arguments": {
      "workspaceUri": "file:///Users/alice/Documents/Notes",
      "title": "TPS report"
    },
    "inputResponses": {
      "delete_choice": {
        "action": "accept",
        "content": {"note_id": "note-14", "confirm": true}
      }
    },
    "requestState": "integrity-protected-delete-state",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

Não há sessão de protocolo entre as duas chamadas. O servidor verifica o estado ecoado, valida a resposta contra o esquema esperado, verifica que a nota selecionada estava no conjunto de candidatos assinados, reabilita o espaço de trabalho, verifica novamente a contenção e, em seguida, elimina.

## Negociação de Capacidade é por Solicitação

Um cliente que suporta a solicitação de modo de formulário declara:

```json
{
  "io.modelcontextprotocol/clientCapabilities": {
    "elicitation": {"form": {}}
  }
}
```

Uma capacidade de elicitação vazia.`"elicitation": {}`, continua a ser equivalente a um apoio à compatibilidade apenas em forma.`"elicitation": {"form": {}}`Também suporta o modo de formulário. Uma declaração apenas para URL, `"elicitation": {"url": {}}`O servidor não deve incorporar um modo ausente das capacidades da solicitação corrente, mesmo que uma solicitação anterior o anunciasse.

Cada pedido também contém `io.modelcontextprotocol/protocolVersion`. Uma versão faltante ou não-string retorna `-32602`Uma cadeia não suportada retorna .`-32022`com exato`supported`E ...`requested`dados. Retorno de suporte de solicitação faltante ou apenas URL `-32021`com`data.requiredCapabilities`definido para `{"elicitation":{"form":{}}}`- Não .

Um envelope sem um JSON-RPC `id`é uma notificação. processá-la sem emitir um sucesso JSON-RPC ou resposta de erro. Em Streamable HTTP, uma notificação aceita recebe `202 Accepted`Sem corpo.

`clientInfo`O documento deve ser incluído para efeitos de diagnóstico, mas é auto-relatado e não pode identificar o utilizador para autorização.

O servidor implementa `server/discover`e retornos `supportedVersions`, capacidades,`ttlMs`, e `cacheScope`com`resultType: "complete"`Não publicita Roots para este design moderno.`tools/list`Esse resultado retorna a determinística.`notes_delete`Descrição, objeto válido `inputSchema`, metadados de identidade do servidor e dicas de cache público.

## Modo de formulário

O modo de formulário usa um esquema JSON restrito projetado para diálogos utilizáveis. A raiz é um objeto e suas propriedades são campos primitivos planos ou matrizes enum suportadas. Objetos profundamente aninhados e esquemas de documento de propósito geral não pertencem a um diálogo de confirmação.

Utilize o modo de formulário para:

- escolha de um dos vários candidatos;
- A confirmação de uma operação destrutiva;
- recolha de preferências não sensíveis;
- A recolha de um pequeno número de valores deve ser decidida pelo utilizador, e não pelo modelo.

Não use o modo de formulário para senhas, chaves de API, tokens de acesso ou credenciais de pagamento. Esses segredos passariam pelo cliente MCP e poderiam chegar aos registos ou ao contexto do modelo.

O servidor valida o conteúdo devolvido novamente. A validação do formulário do lado do cliente melhora a experiência de uso, mas não cria confiança.

## Modo de URL

O modo URL envia um URL web seguro para uma interação fora da banda:

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "message": "Connect the report service to continue.",
    "url": "https://mcp.example.com/connect/report-service"
  }
}
```

Use-o quando informações confidenciais devem ir diretamente para um fluxo web controlado por servidores, como autorização de terceiros. O cliente mostra o destino completo e obtém o consentimento antes de abri-lo. Não deve pre-pegar o URL.

Um `accept`resposta significa o usuário concordou em abrir a URL. Não prova que o fluxo externo foi concluído. Ao retomar, o servidor verifica seu próprio estado e completa ou retorna outro `input_required`resultado.

A elicitação de URL não é um substituto para a autorização entre o cliente MCP e o servidor MCP. É para uma interação externa que o servidor MCP precisa realizar em nome do usuário. O servidor deve vincular o usuário do navegador ao mesmo principal autenticado que iniciou a operação MCP.

## Ramos de resposta

Tratar as ações como decisões de produto, não como alias:

| Action | Meaning | Safe server behavior |
|--------|---------|----------------------|
| `accept` | User submitted the interaction | Validate content and continue |
| `decline` | User explicitly refused | Return a complete, non-error refusal outcome |
| `cancel` | User dismissed or could not finish | Stop safely and allow a later retry |

Nunca interpretar o conteúdo faltante como consentimento. Nunca converter o declínio em um ciclo repetido.

## Proteção do Estado MRTR destrutivo

A lista de candidatos não pode viver apenas em um valor Base64 de pedido ou sem assinatura. Um cliente controla tudo o que envia de volta.

A lição assina uma carga útil do Estado contendo:

- principal autenticado;
- Método de origem;
- Digestão de `workspaceUri`E ...`title`O artigo 2.o
- Identificadores de notas permitidos indicados no formulário;
- fase de operação;
- - A expiração curta.

Antes da mutação, o servidor também verifica o registro de notas ao vivo.

Para uma ação financeira ou irreversível única, o HMAC não impede que um estado válido seja reproduzido no prazo de expiração. Armazenar e consumir um nonce exatamente uma vez em uma loja de repetição compartilhada por cada instância de processador. A lição injeta um armazenamento limitado e cortado com TTL e mantém sua reivindicação atômica enquanto realiza a exclusão na memória. Uma base de dados de produção deve associar a alegação de não-existência e a mutação numa única transação ou em um limite de escrita condicional equivalente.

Validar a interação antes de reivindicar o não-conhecimento.`cancel`Não realiza mutações e deixa o estado retrativavel até a expiração.`decline`É terminal, então a lição consome o nonce sem excluir nada.

```figure
t3-roots-boundary
```

## Construí-lo

`code/main.py`demonstra uma moderna`notes_delete`Ferramenta:

- `tools/list`Retorna um descritivo determinista e caché com o espaço de trabalho e o esquema de título necessários.
- O âmbito é um explícito`workspaceUri`- Não.
- A configuração do servidor autoriza esse espaço de trabalho para o principal da lição.
- A normalização URI rejeita confusão de prefixos e transmissão codificada.
- Toda exclusão destrutiva requer a elicitação de modo forma.
- A elicitação viaja para dentro .`resultType: "input_required"`- Não .
- Assinação .`requestState`liga a lista exata de candidatos e os argumentos originais.
- Uma loja de repetição injetada rejeita o mesmo estado aceito ou recusado em todas as instâncias do servidor.
- A retest usa um novo ID de solicitação e retorna `resultType: "complete"`- Não .

O armazém de dados está na memória, o que facilita a inspecção do comportamento do protocolo.

## Usá-lo

A partir da raiz do repositório:

```bash
cd phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Pontos de controlo previstos:

- A Discovery anuncia ferramentas sem raízes.
- Retorno de descoberta de ferramentas `notes_delete`com`resultType`, identidade do servidor e sugestões de cache.
- Pedido de identificação`1`Retorna o formulário em `inputRequests.delete_choice`- Não .
- Pedido de identificação`2`ecoa o estado assinado e completa a exclusão.
- Um caminho de prefixo e um caminho de travessia codificado falham na contenção.
- Um título alterado não pode reutilizar o estado de confirmação original.
- Um declínio deixa a nota inalterada.
- Dois objetos do servidor compartilhando o estado de nota e repetição não podem executar uma confirmação.
- Declarações de formulário vazios e explícitos funcionam, enquanto o suporte apenas para URLs retorna exatas `-32021`Requisitos do formulário.
- Falhas de versão não suportadas utilizam o exato `-32022`Forma dos dados.
- Uma notificação sem id não produz resposta JSON-RPC.

## Envia-o

`outputs/skill-elicitation-form-designer.md`Designa o escopo explícito, verificações de autorização, formulário MRTR, ramos de resposta e vinculação de estado. Recusou-se a tratar as raízes desatualizadas como uma caixa de areia ou a coletar segredos através do modo de formulário.

## Exercícios

1. Substitua o armazenamento de repetição em memória com SQLite. Use uma transação para reivindicar o nonce e excluir a nota, então provar que dois processos não podem ambos comprometer.
2. Adicionar`url`• a capacidade de negociação e um fluxo de configuração fora da banda.`inputResponses`- Não .
3. Substitua o mapa de notas na memória com um banco de dados temporário SQLite. Reverifique a autorização e contenção dentro da transação de mutação.
4. Adicione uma política de ligação simbólica para uma implementação real de um sistema de arquivos. Explique por que a contenção léxica URI sozinha não pode impedir uma fuga de ligação simbólica.
5. Projetar um adaptador 2025-11-25 que mapeie a saída do processador MRTR moderno para a elicitação iniciada pelo servidor legado.

## Termos-chave

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Roots | Deprecated informational workspace hints, not authorization or sandboxing |
| Explicit scope | Workspace, directory, or resource handle visible in request arguments |
| Containment | Normalized path-component check that keeps a target inside a boundary |
| Elicitation | Client feature for obtaining user input during an MCP operation |
| Form mode | In-band structured user input using a restricted flat schema |
| URL mode | Out-of-band interaction for sensitive or external workflows |
| MRTR | Stateless input-required result followed by a fresh retry |
| `requestState` | Opaque state echoed exactly and integrity-checked by the server |
| Decline | Explicit user refusal |
| Cancel | Dismissal or incomplete interaction without approval |

## Compatibilidade do legado

Para um colega fixado em 2025-11-25,`roots/list`- Não .`notifications/roots/list_changed`, e servido ao vivo iniciado .`elicitation/create`Não permita que uma lista de raiz herdada ultrapasse a autorização do servidor e não carregue suposições de sessão de protocolo no processador moderno.

## Mais leitura

- [MCP 2026-07-28 Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Roots deprecation](https://modelcontextprotocol.io/specification/2026-07-28/client/roots)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
