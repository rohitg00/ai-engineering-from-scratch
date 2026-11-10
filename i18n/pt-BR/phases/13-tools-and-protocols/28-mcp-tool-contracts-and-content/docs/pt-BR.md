# Contratos e conteúdo das ferramentas de MCP

> Uma ferramenta é segura para automatizar apenas quando a descoberta, os argumentos, os resultados, a paginagem e o transporte de metadados concordam em um contrato.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 07, 09, and 10
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Defina as entradas e saídas das ferramentas com JSON Schema 2020-12.
- Validar resultados estruturados sem supor que sejam objetos JSON.
- Escolha entre texto, imagem, áudio, links de recursos e recursos incorporados.
- Rejeitar inseguros .`x-mcp-header`definições antes de uma ferramenta chegar ao modelo.
- Encodear valores de parâmetro-título e verificar a paridade exata de cabeçalho-corpo.
- Paginação do cursor transversal sem interpretar os valores do cursor.
- Dependência e autorização`completion/complete`Sugestões.

## O problema

Chamando uma função Python é fácil. Chamando uma capacidade remota através de um host de IA é um problema de contrato.

O servidor publica um descritivo. O cliente transforma esse descritivo em contexto de modelo e interface de usuário. O modelo cria argumentos. Um gateway pode encaminhar a solicitação de cabeçalhos espelhados. O servidor executa a ferramenta. O cliente decide se o resultado é seguro e válido o suficiente para retornar ao modelo.

Uma fronteira fraca corrompe toda a cadeia.

Consideremos cinco falhas:

- O descritivo diz que o resultado é um objeto, mas o servidor retorna uma matriz.
- O cliente deixa de fazer páginas quando `nextCursor`É uma corda vazia.
- Um parâmetro de token é espelhado em um cabeçalho HTTP e torna-se visível aos intermediários.
- Um valor de roteamento Unicode é enviado como um cabeçalho bruto, então o gateway e a origem interpretam diferentes bytes.
- Um ponto final de conclusão sugere um ambiente de produção para um telefonista que não pode acessá-lo.

Nenhuma destas falhas é corrigida por um melhor incentivo, pois exigem contratos explícitos de protocolo e aplicação.

## O gasoduto de contrato

Trata cada chamada de ferramenta como cinco portas:

1. **Discover.**Leia uma lista determinista de ferramentas.
2. **Admit.**Validar cada descriptório e aplicar a política de segurança local.
3. **Invoke.**Validar argumentos e criar metadados de transporte.
4. **Execute.**Execute o manual e classifique as falhas corretamente.
5. **Consume.**Validar os blocos de conteúdo e as saídas estruturadas antes da utilização do modelo.

```figure
mcp-contract-pipeline
```

O host é o proprietário dos portões de entrada e consumo. Um servidor não pode forçar um cliente a confiar em suas anotações, esquemas ou saídas.

## JSON Schema é um limite de tempo de execução

Em MCP `2026-07-28`- Não .`inputSchema`E ...`outputSchema`usar JSON Schema. Quando `$schema`Não existe, o dialeto padrão é 2020-12.

O esquema de entrada deve ser um objeto de esquema. Uma ferramenta sem argumentos deve ainda dizer exatamente o que aceita:

```json
{
  "type": "object",
  "additionalProperties": false
}
```

Isto é mais rigoroso do que ...`{ "type": "object" }`, que aceita propriedades arbitrárias.

Um esquema de saída é opcional. Uma vez que um servidor publica um, cada ferramenta completa
Resultado compromete-se a retornar conforme `structuredContent`, incluindo os resultados
com`isError: true`. A bandeira de erro classifica o resultado da execução; não
O contrato de saída publicado deve ser revogado pelo cliente.
de confiar no descrito.

### Conteúdo estruturado é qualquer valor JSON

Não codifique .`structuredContent`Como um dicionário.

- um objeto;
- uma matriz;
- uma corda;
- um número;
- um booleano;
- `null`- Não .

Esta ferramenta retorna uma matriz:

```json
{
  "name": "tag_catalog",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "array",
    "items": {"type": "string"}
  }
}
```

O seu resultado bem sucedido é válido:

```json
{
  "resultType": "complete",
  "content": [
    {
      "type": "text",
      "text": "[\"contracts\", \"mcp\", \"stateless\"]"
    }
  ],
  "structuredContent": ["contracts", "mcp", "stateless"],
  "isError": false
}
```

Para compatibilidade, os resultados estruturados também devem incluir JSON serializado em um bloco de texto. O texto não é a fonte de validação. `structuredContent`- Não, não.

### Um pequeno validador ainda ensina a fronteira

A lição usa um subconjunto deliberado de JSON Schema porque fica dentro da biblioteca padrão Python.

- Tipo de objeto, matriz, cadeia, número inteiro, número, booleano e zero;
- Propriedades exigidas;
- `additionalProperties: false`O artigo 2.o
- elementos de matriz;
- Valores enum;
- comprimento mínimo da corda.

A lição reutiliável é onde a validação ocorre: após a descoberta dos descritivos, antes da execução dos argumentos e antes do consumo para resultados estruturados.

## Os blocos de conteúdo têm custos diferentes

O `content`A matriz pode combinar vários tipos de conteúdo.

| Type | Use it for | Main boundary |
|------|------------|---------------|
| `text` | Human and model-readable summaries | Treat text as untrusted output |
| `image` | Visual evidence encoded as base64 | Validate media type and size |
| `audio` | Spoken or recorded output encoded as base64 | Validate media type and duration limits |
| `resource_link` | A URI the client may fetch later | Reauthorize the later resource read |
| `resource` | Data embedded directly in the result | Enforce payload and content limits now |

Um link de recurso não é prova de que o recurso aparece em `resources/list`O cliente ainda aplica a sua política de recursos quando segue o URI.

Um recurso embucado evita outra viagem de ida e volta, mas aumenta o tamanho da resposta atual. Use links para artefatos grandes ou que mudam de forma independente. Use recursos embutidos para pequenas evidências que devem viajar atômicamente com o resultado.

A lição é:`evidence_bundle`O cliente valida cada bloco antes de aceitar o resultado.

## `x-mcp-header`Está encaminhando metadados

Uma propriedade lá dentro .`inputSchema`pode declarar `x-mcp-header`. Em Streamable HTTP, o cliente reflete esse argumento em `Mcp-Param-{name}`- Não .

```json
{
  "region": {
    "type": "string",
    "x-mcp-header": "Region"
  }
}
```

Com o`region: "eu-west"`, o transporte pode emitir:

```http
Mcp-Param-Region: eu-west
```

A anotação existe para que um balanceador de carga, gateway ou motor de política possa encaminhar sem analisar o corpo JSON.

O protocolo limita a anotação:

- O nome do cabeçalho não é vazio e segue a sintaxe do token de nome de campo HTTP;
- Os nomes dos cabeçalhos são únicos, independentemente do caso;
- O tipo de propriedade é string, inteiro ou booleano;
- `number`Não é permitido;
- A anotação aparece apenas num membro direto de `inputSchema.properties`O artigo 2.o
- Os valores inteiros permanecem dentro de `-9007199254740991`através de`9007199254740991`- Não .

A regra de localização é sintática e fechada.
Não apenas as propriedades que o seu validador entende.
anotação sob o objeto aninhado `properties`, a `oneOf`ramo, `items`, a
definição alcançada por `$ref`Resolver uma referência faz
Não transformar o nó referenciado em uma propriedade direta de nível superior.

Esta lição acrescenta uma política de implantação: rejeitar descriptórios que refletem nomes como `password`- Não .`secret`- Não .`token`- Não .`api_key`, ou `authorization`A especificação oficial aconselha os autores do servidor a não refletir parâmetros sensíveis.

Verifique o nome da cabeçalha, não o seu valor.`Mcp-Param-Region`- Sim .`eu-west`fora do evento de auditoria.

### Valores de codificação antes de criar cabeçalhos HTTP

Um valor de parâmetro só pode viajar como texto plano quando é uma cadeia não vazia
de caracteres ASCII visíveis de `!`através de`~`e não se assemelha ao
Tudo o resto usa esta forma exata:

```text
=?base64?{Base64UTF8}?=
```

`Base64UTF8`É base 64 padrão sobre os bytes UTF-8 exatos. Não cortar,
Encode Unicode, cadeias vazias, espaços,
Os elementos de controlo devem ser identificados em conformidade com o artigo 10.o, n.o 1, do Regulamento (UE) n.o 1095/2011.
Valor a partir de `=?base64?`Encoder um valor que parece sentinela novamente é
o que permite ao receptor recuperar o texto original literal em vez de decodificar
- Como uma sintaxe de transporte.

Booleans traduzir como minúsculas `true`ou `false`- Inteiros em base 10 e
deve permanecer dentro da faixa inteira segura do JavaScript. Valores fora dessa faixa
são rejeitadas em vez de arredondadas por um intermediário.

### O servidor verifica a cópia espelhada

A geração de cabeçalhos é apenas a metade do cliente.
O servidor deve:

1. Encontrar reconhecido .`Mcp-Param-*`Nomes sem consideração do caso de cabeçalho-nome;
2. Decodificar a forma exacta base64 sentinela quando presente;
3. Compare exatamente o texto decodificado com o argumento corpóreo JSON correspondente;
4. rejeitar uma falta, duplicação, inesperada, malformada ou incompatível
   - O cabeçalho reconhecido antes do envio.

A rejeição é HTTP `400`com código de erro JSON-RPC `-32020`Nem o
O valor do corpo nem a forma do cabeçalho codificado pertencem ao registo de auditoria.
apenas o nome do cabeçalho reconhecido e a categoria de rejeição.

`code/main.py`Modela este limite diretamente. [Lesson 09](../../09-mcp-transports/)
abrange a ordem de validação HTTP Streamable mais ampla, incluindo o método e
Paridade de protocolo versão.

## Os curadores de páginas são opacos

As operações de lista MCP usam pagination do cursor. O servidor seleciona o tamanho da página e formato do cursor. O cliente recebe uma decisão:

```python
if result.get("nextCursor") is None:
    break
cursor = result["nextCursor"]
```

Não escreva isto:

```python
if not result.get("nextCursor"):
    break
```

Uma cadeia vazia é um cursor válido.

Os clientes não devem decodificar um cursor, incrementá-lo, compará-lo com um cursor anterior para encomendar ou inferir um número de página. Um servidor pode assinar um cursor, ligá-lo a uma versão de catálogo ou mapeá-lo para estado privado. Esse é o detalhe de implementação do servidor.

O servidor de amostra retorna deliberadamente `""`O cliente deve enviar esse valor exato na segunda solicitação.

```text
<first request with no cursor>
<second request with cursor "">
```

Cursores inválidos produzem parâmetros inválidos JSON-RPC, código `-32602`- Não .

## A conclusão é uma superfície autorizada

`completion/complete`O sistema de listagem de recursos é útil para formulários interativos, mas pode filtrar nomes que os métodos de listagem comuns protegem.

Um pedido de conclusão indica uma referência e o argumento a ser concluído:

```json
{
  "method": "completion/complete",
  "params": {
    "ref": {
      "type": "ref/prompt",
      "name": "deployment_review"
    },
    "argument": {
      "name": "environment",
      "value": "st"
    }
  }
}
```

O resultado retorna no máximo 100 valores e pode relatar `total`- E mais .`hasMore`- Não .

Aplicar o mesmo limite de autorização utilizado pelo prompt ou recurso referenciado.`development`E ...`staging`Só um operador pode receber .`production`- Não .

A conclusão da produção também requer:

- A validação de entrada;
- Filtragem de informação para o telefonista;
- Solicitar desaconselho no cliente;
- Limitação de taxa no servidor;
- Contas de resultados limitados;
- registos que não exporem valores sensíveis de sugestão.

A conclusão é assistência, não descoberta de contorno.

## Duas camadas de erro

Mantenha os erros de protocolo separados dos erros de execução da ferramenta.

Utilize um erro JSON-RPC quando a solicitação MCP não pode ser enviada corretamente:

- Nome desconhecido da ferramenta;
- Forma de pedido malformada;
- Os metadados do pedido faltantes;
- Cursor inválido.

Use um resultado completo de ferramenta com `isError: true`Quando a invocação chegar à ferramenta e a ferramenta relatar uma falha a ser aplicada:

- Não está disponível uma fonte de relatório;
- Uma data está fora do intervalo suportado;
- Uma regra empresarial rejeita a operação solicitada.

Os modelos podem muitas vezes reparar um erro de execução da ferramenta. Eles não podem reparar um servidor que violeu seu próprio esquema de saída.

Se a ferramenta declarar um esquema de saída, modelar uma falha acionável dentro desse
O esquema.`route_report`A falha retorna a região solicitada com
`accepted: false`, ao lado de texto de erro legível por humanos e `isError: true`- Não .

## Construí-lo

`code/main.py`construi ambos os lados da fronteira com a biblioteca padrão Python.

O servidor implementa:

- Avalidação de metadados do MCP por pedido;
- `server/discover`Com ferramentas e capacidades de conclusão;
- Determinista`tools/list`Paginação;
- Quatro descrições de ferramentas, incluindo uma que deve ser rejeitada;
- saída estruturada de matriz;
- Todos os tipos de blocos de conteúdo atuais da ferramenta;
- um portal de paridade HTTP streamable que decodifica cabeçalhos de parâmetros reconhecidos e
  retorna HTTP `400`+ JSON-RPC `-32020`em caso de desajuste;
- A conclusão autorizada e limitada.

O cliente implementa:

- Admissão de descriptórios;
- árvore cheia`x-mcp-header`A validação da colocação e a política de campo sensível;
- A codificação exacta do valor ASCII ou base64 UTF-8 de forma simples e visível;
- um circuito de cursor opaco que segue uma cadeia vazia;
- A validação de argumentos e resultados;
- Avalidação do bloco de conteúdo;
- Eventos de auditoria de cabeçalhos que contenham nomes, mas não valores.

O descritivo deliberadamente inseguro é o ensino de dados.

## Usá-lo

A partir da raiz do repositório:

```bash
cd phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

As impressões demo admitidas ferramentas, o descrito rejeitado, ambos pagination
Requisitos, conteúdo estruturado de matriz, tipos de blocos de conteúdo, cabeçalho espelhado
nomes, quer seja o valor exigido de codificação, o status de paridade HTTP, e
Valores de conclusão filtrados pelo chamador.

## Laboratório Interativo

Abre .`code/main.py`e localização`TOOLS`- Não .

1. Mudança .`tag_catalog.outputSchema.type`de`array`- Não .`object`- Não .
2. A demo deve ser executada, o cliente deve rejeitar o array devolvido.
3. Restaurar o esquema.
4. Mantenha a primeira página.`nextCursor`Como `""`, então fazer a última página de volta
   `nextCursor: None`Em vez de omitir o campo.
5. Faça os testes e compare o rastro do cursor.
6. Adicionar`x-mcp-header: "Authorization"`para uma propriedade de corda.
7. A admissão do descrito de confirmação o rejeita antes da invocação.
8. Tente .`region`valores que contenham Unicode, uma linha nova, espaços circundantes e
   O texto literal `=?base64?SGVsbG8=?=`Decodificar cada cabeçalho emitido e provar
   O valor original sobrevive exatamente.
9. Mover a anotação para baixo `oneOf`- Não .`items`, ou um `$ref`Definição.
   Cada descriptor é rejeitado mesmo que esse ramo nunca seja usado pela demonstração.
10. Remova o cabeçalho reconhecido ou altere o seu valor decodificado.
    status dos retornos de limites `400`e código JSON-RPC `-32020`- Não .

O ponto não é memorizar uma forma JSON, é ver cada porta falhar na fronteira que a possui.

## Laboratório de Prática

Expandir o laboratório de contrato com um`search_evidence`- Uma ferramenta.

Requisitos:

1. O seu esquema de entrada aceita `query`- Não .`limit`, e um cofre .`region`Campo de roteamento.
2. O seu esquema de saída é uma matriz de objetos com `uri`- Não .`title`, e `score`- Não .
3. O resultado inclui texto de compatibilidade e um link de recursos por item.
4. Os argumentos rejeitam propriedades desconhecidas.
5. `limit`é limitada pela validação do pedido.
6. Um chamador sem acesso a um URI nunca vê esse URI através da conclusão ou saída da ferramenta.
7. Os testes incluem uma pontuação não conforme, uma anotação de cabeçalho inválida e uma lista de duas páginas.
8. Os testes de valor de cabeçalho abrangem os caracteres visíveis ASCII, Unicode, controles,
   espaço em branco, texto semelhante a sentinela, e ambos os limites inteiros seguros para JavaScript.
9. O dispositivo HTTP aceita nomes de cabeçalhos insensiveis para casos, mas rejeita falta
   ou valores reconhecidos incompatíveis com status `400`e código `-32020`- Não .

## Artigo enviado

`outputs/skill-mcp-contract-reviewer.md`É uma habilidade de revisão plana e reutilizável. Dê-lhe um descrito de ferramenta, resultados de amostra, comportamento de pagination e política de conclusão. Retorna uma decisão de admissão, plano de validação de resultados, política de cabeçalho e testes de falha concretos.

## Verifique

A lição é completa quando estas declarações são verdadeiras:

- `tools/list`Retorna a mesma ordem lógica em chamadas repetidas.
- O cliente realiza um segundo pedido quando `nextCursor`É o que é`""`- Não .
- O descritivo de cabeçalhos sensíveis inseguros é excluído, enquanto restam disponíveis outras ferramentas.
- Uma matriz passa o esquema de saída da matriz.
- Um objeto falha no mesmo esquema de matriz.
- Os resultados de erro não podem omitir ou violar um esquema de saída publicado.
- O texto, imagem, áudio, link de recurso e blocos de recursos incorporados validam.
- Os eventos de auditoria de cabeçalhos contêm nomes e não valores.
- ASCII simples visível permanece simples; Unicode, controle, enchido, vazio e
  Valores sentinela-parecem viagem de ida e volta através base64 UTF-8 codificação exata.
- Os números inteiros espelhados fora do alcance seguro do JavaScript são rejeitados.
- Anotativas no`oneOf`- Não .`items`, objetos aninhados, `$ref`definições, ou
  Os regimes de saída são rejeitados durante a admissão.
- Os nomes de cabeçalhos reconhecidos não sensíveis ao caso passam apenas quando o valor decodificado
  correspondem exatamente ao corpo; cópias faltantes ou incompatíveis produzem HTTP `400`
  e JSON-RPC `-32020`- Não .
- A conclusão do analista nunca volta .`production`- Não .
- Uma falha de ferramenta utiliza `isError: true`Uma chamada de protocolo mal formada utiliza JSON-RPC `error`- Não .

## Modos de falha de produção

| Failure | What the learner sees | Correct response |
|---------|-----------------------|------------------|
| Client assumes object output | Valid arrays fail or are silently wrapped | Validate against the published schema without object-only types |
| Empty cursor treated as false | Final pages disappear | Continue whenever `nextCursor` is present and non-null |
| Sensitive value mirrored | Secret appears in proxy, WAF, or trace data | Reject the descriptor and keep secrets in protected request data |
| Raw Unicode or whitespace mirrored | Gateway and origin disagree or the value is normalized | Use exact base64 UTF-8 sentinel encoding and compare after decoding |
| Annotation hidden in a schema branch | A client misses routing metadata during admission | Traverse the entire schema tree and allow only direct top-level properties |
| Large integer mirrored | JavaScript intermediary rounds the routing value | Reject values outside the JavaScript safe integer range |
| Header and body disagree | Gateway routes one target while the origin executes another | Reject before dispatch with HTTP `400` and JSON-RPC `-32020` |
| Output schema ignored | Downstream code consumes corrupt structure | Validate before model or application use |
| Resource link trusted automatically | Caller follows an unauthorized URI | Reauthorize every resource read |
| Completion shares global suggestions | Hidden tenant names leak | Filter by caller, reference, and authorization |
| Tool annotations treated as policy | Destructive operation bypasses confirmation | Enforce authorization and approval outside annotations |
| One malformed tool breaks discovery | Entire server becomes unavailable | Reject the bad descriptor and admit valid tools independently |

## Conexão Capstone

A pedra final da Fase 13 precisa de um gateway que possa fundir ferramentas de vários servidores.

Usar o artefato para classificar quatro peças de evidências de pedra:

- Descoberta determinista e completa em páginas;
- A validação do descrito antes da exposição do modelo;
- Output estruturado validado mais blocos de conteúdo limitados;
- Completar e encaminhar metadados que preservam os limites de autorização.

Não reivindique a compatibilidade do gateway com um sucesso `tools/call`Capture o descriptor, o rastreamento de página, o conjunto de ferramentas admitidas, o conjunto de ferramentas rejeitadas e um resultado validado.

## Termos-chave

| Term | Meaning |
|------|---------|
| `inputSchema` | JSON Schema object defining accepted tool arguments |
| `outputSchema` | Optional JSON Schema defining `structuredContent` |
| `structuredContent` | Any JSON value produced by a tool result |
| Content block | Typed text, image, audio, resource link, or embedded resource |
| `x-mcp-header` | Schema annotation that mirrors a primitive argument into Streamable HTTP metadata |
| Opaque cursor | Server-issued pagination token whose value the client does not interpret |
| Completion reference | Prompt name or resource URI/template whose argument is being completed |
| Admission | Client decision to expose or reject a discovered descriptor |

## Mais leitura

- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion)
- [MCP Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)
- [MCP Streamable HTTP Parameter Headers](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#custom-headers-from-tool-parameters)
