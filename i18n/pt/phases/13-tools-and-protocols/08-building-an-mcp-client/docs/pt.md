# Construir um cliente MCP: Descoberta, Routing e Dual-Era Fallback

> Um cliente MCP moderno repete seu contrato em cada solicitação. Sua decisão de compatibilidade mais difícil é saber quando um servidor antigo é realmente velho e quando um servidor moderno está relatando um erro corrigível.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 07
**Time:** ~85 minutes

## Objetivos de aprendizagem

- Construir todos os MCPs `2026-07-28`Requerimento com metadados atuais.
- Probe os servidores de estúdio com `server/discover`e selecionar uma versão com suporte mútuo.
- Autorize uma sonda de legado limitado apenas para pares explicitamente autorizados.
- Aceitar uma era legada só depois de validar um positivo .`initialize`Resultado para uma revisão apoiada.
- Combinar listas de ferramentas deterministas sem sobreescrever silenciosamente colisões.
- Roteia ligações para o colega que possui cada ferramenta sem inventar sessões de protocolo.

## O problema

Um agente host geralmente fala com mais de um servidor MCP. Ele deve descobrir cada servidor, fundir catálogos de ferramentas, resolver nomes duplicados, chamadas de rota e recuperar da falha de transporte.

O `2026-07-28`A revisão torna o estado estável mais simples porque cada solicitação é autônoma. A compatibilidade torna a inicialização mais sutil.

- um servidor moderno que admita a versão preferida;
- um servidor moderno que retorna uma versão ou um erro de cabeçalho reconhecido;
- Um servidor legado que nunca ouviu falar .`server/discover`O artigo 2.o
- Um servidor antigo que fica em silêncio até receber .`initialize`- Não .

Tratar cada erro de sonda como legado é perigoso. Uma solicitação moderna malformada, um servidor sobrecarregado, um processo morto e um servidor antigo podem produzir o mesmo tempo ou fechamento da conexão. Esses sinais são ambíguos. O cliente deve combinar intenção explícita do operador com evidências positivas de protocolo antes de escolher a era legada.

## O conceito

### Um colega, não uma sessão de protocolo

Manter um registro de transporte para cada processo ou ponto final do servidor:

- Função de manobra ou de envio de transporte;
- Era e versão do protocolo selecionados;
- capacidades de servidor descobertas pela última vez;
- Última lista de ferramentas deterministas;
- Identificadores pendentes de pedido de correlação;
- saúde dos transportes.

Este é o contato de contabilidade do cliente. Não é o estado de sessão do protocolo. No MCP moderno, o servidor ainda recebe a versão atual e as capacidades em cada solicitação.

### Construir todas as solicitações modernas a partir do zero

```python
def modern_request(request_id, method, params, version, capabilities):
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": {
            **params,
            "_meta": {
                "io.modelcontextprotocol/protocolVersion": version,
                "io.modelcontextprotocol/clientCapabilities": capabilities,
                "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
            },
        },
    }
```

Não anexe metadados uma vez a um objeto de conexão e suponha que ele chegou ao fio.

### Descoberta moderna

`server/discover`Retorna versões suportadas, recursos do servidor, instruções, dicas de cache e identidade recomendada do servidor. Um cliente escolhe a versão moderna mais alta com suporte mútuo.

O Discovery é opcional para um cliente moderno, mas é recomendado no estúdio. Alguns servidores legais aceitam uma operação antes da inicialização, por isso enviar `tools/list`O primeiro pode produzir um sucesso ambíguo.`server/discover`cria uma era limpa.

### A sonda de compatibilidade com o estúdio

Um cliente de estúdio de dupla era envia `server/discover`A sua utilização é uma forma de comunicação de dados que permite a informação sobre os resultados de um processo de análise de dados.

1. **DiscoverResult.**O servidor é moderno. Selecione uma versão mutuamente suportada e continue com metadados por pedido.
2. **Recognized modern error.**O servidor é moderno.`-32022`, escolher entre `data.supported`Para erros de cabeçalho ou de capacidade, corrija a solicitação. Não envie `initialize`- Não .
3. **Ambiguous signal.**Um erro JSON-RPC não reconhecido, tempo de entrega, fechamento de conexão ou resposta vazia não identifica uma era.

Os erros de protocolo modernos reconhecidos incluem:

- `-32020`Cabeça de cabeça
- `-32021`FaltaRequeridoCapacidade do cliente
- `-32022`Não suportadoProtocolVersion

Os erros modernos reconhecidos permanecem modernos mesmo quando o peer está na lista de permisos legados. Uma vez que um servidor prova que entende o vocabulário de erros moderno, enviando `initialize`Seria uma redução de classificação.

Não trate`-32601`A mesma regra aplica-se a um timeout, a uma conexão fechada ou a uma resposta vazia.

### A listagem de permisos é a intenção do operador, não é evidência.

A compatibilidade legada deve ser uma propriedade explícita de uma configuração de pares fixada:

```python
client.add_server("archive", archive_transport, allow_legacy=True)
```

Ligue essa escolha ao comando ou ponto final configurado. Não use um wildcard que permita que um servidor arbitrário opte por uma semântica mais fraca. Um peer sem `allow_legacy=True`falha após um resultado ambiguo de descoberta e nunca recebe`initialize`- Não .

O autor autoriza a sonda, não seleciona a era, o cliente envia uma.`initialize`No caso de um prazo de transporte obrigatório, exige-se:

- um JSON-RPC `2.0`Resposta com o identificador de pedido correspondente;
- É exactamente um .`result`E não .`error`O artigo 2.o
- A.`protocolVersion`no conjunto de revisões legais configurados do cliente;
- um valor de objeto `capabilities`campo;
- A.`serverInfo`objeto com cadeia não vazia `name`E ...`version`campos.

Um timeout, fechamento de conexão, resposta de erro, resultado mal formado, id incompatível ou revisão não suportada não é fechado. Somente um resultado positivo estruturalmente válido seleciona a era legada. O código passa `legacy_probe_timeout_ms`O adaptador de transporte; um estúdio ou adaptador HTTP real deve aplicar esse prazo, em vez de apenas registrá-lo.

Cache a era selecionada para o grupo de transporte.

### O legado é um ramo de compatibilidade

Uma vez que a sonda limitada retorne provas de legado positivo válidas, o cliente usa a versão legada selecionada exatamente como definida nessa revisão:

1. Verificar o envelope de resposta e a identificação de correlação.
2. Verificar que a revisão negociada está no conjunto de legado configurado.
3. Registrar as capacidades validadas e a identidade do servidor.
4. Enviar .`notifications/initialized`Só depois de todos os cheques passarem.
5. Use formas de solicitação legais para a vida útil do transporte.

Este ramo existe para interoperabilidade com pares conhecidos. Não é o design padrão para novos servidores ou novas solicitações. Se o transporte reiniciar ou seu ponto final mudar, descartar o cache de era de pares e negociar novamente.

### Ferramentas de detecção e armazenamento em cache

Para cada colega ativo, telefone `tools/list`Um resultado moderno inclui`resultType`- Não .`ttlMs`, e `cacheScope`Respeitar a indicação de frescura no contexto da autorização correta.

Os clientes devem tratar um desaparecido .`resultType`de um servidor legado como `"complete"`Não exigem campos de cache modernos para uma resposta de uma era anterior negociada.

O servidor deve retornar ordenação determinista. O cliente também deve ordenar antes da fusão para que a ordem do registro local não dependa do tempo de inicialização do processo.

### Combinação de espaços de nomes seguros de colisão

Dois servidores podem expô-los .`search`- Escolher uma política declarada:

1. **Prefix on collision.**Mantenha o primeiro nome canônico e expõe as colisões posteriores como `<server>/<tool>`- Não .
2. **Reject on collision.**Não carregue o duplicado e surja um erro de configuração claro.
3. **Silent overwrite.**Nunca usem isto, mas esconde qual servidor recebe uma ação selecionada pelo modelo.

Armazenar nomes canônicos e locais. O modelo vê o nome canônico.`tools/call`utiliza o nome local declarado pelo servidor proprietário.

### Roteamento de uma chamada

O roteamento é uma busca pura:

```text
canonical tool name
  -> peer name + local tool name
  -> new JSON-RPC request id
  -> modern request metadata or explicit legacy shape
  -> matching response id
```

Não enviar uma chamada quando o transporte do proprietário não estiver disponível.`tools/list`. As solicitações modernas durante o voo perdidas num transporte quebrado podem ser retomadas com um novo ID JSON-RPC quando a política de segurança da operação o permitir.

### Notificações e subscrições

As alterações modernas de listas e recursos só ocorrem num cliente aberto `subscriptions/listen`O cliente envia o filtro de notificação, espera.`notifications/subscriptions/acknowledged`, e correlaciona os eventos com o ID do pedido de escuta nos metadados da notificação.

Ao desconectar, abra um novo pedido de escuta e reencadeie as listas ou recursos relevantes.`Last-Event-ID`- Não .

### Não há solicitações iniciadas pelo servidor

Os servidores modernos não chamam o cliente com solicitações independentes de JSON-RPC para amostragem, elicitação ou raízes.`input_required`, e o cliente retrata o pedido original após cumprir os pedidos de entrada incorporados.

Não bloqueie o leitor de resposta do seu colega ao cumprir a entrada. Preserve a correlação e crie um novo ID JSON-RPC para a retest.

```figure
tp-client-merge
```

## Usá-lo

`code/main.py`O sistema de transporte recebe um orçamento de tempo para que o ramo de compatibilidade não possa esconder uma sonda ilimitada.

```bash
cd code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Os testes provam limites que as demonstrações normais não conseguem:

- Os pedidos modernos repetem metadados;
- `-32022`Reprova a descoberta moderna sem inicialização;
- erros modernos reconhecidos nunca degradados, mesmo para um colega autorizado;
- O tempo de saída, a ligação fechada, respostas vazias e erros não reconhecidos não desencadeiam `initialize`sem autorização;
- um colega autorizado só se torna legado após um documento válido, apoiado `initialize`Resultado;
- Os resultados de legado mal formados e não suportados deixam o peer indisponível;
- Uma era seleccionada com sucesso é armazenada em cache para a vida útil do transporte.

## Envia-o

Esta lição vai avançar .`outputs/skill-mcp-client-harness.md`. Ele prepara o estampamento de solicitações moderno, negociação da era do estúdio, fusão determinista do espaço de nomes, roteamento e um ramo de compatibilidade legado fechado.

## Exercícios

1. Faça um falso retorno de servidor .`-32022`Confirmar o cliente falha em vez de enviar `initialize`- Não .
2. Permitir um servidor legado falso, fazer seu limite `initialize`- Não. - Não.`unknown`E não está disponível.
3. Adicionar`cacheScope: "private"`As informações de um conteúdo são fornecidas por um cliente para dois conteúdos de autorização.
4. Mudar a política de colisão para rejeição e fazer com que a inicialização falhe com ambos os nomes de pares no erro.
5. Adicionar um finito `subscriptions/listen`Em perda de fluxo, re-escuta com um novo ID de solicitação e ferramentas de re-requisito.

## Termos-chave

| Term | Meaning |
|------|---------|
| Peer | Client-side record for one server transport and its discovered data |
| Protocol era | Modern per-request metadata or legacy initialization semantics |
| Discovery probe | Initial `server/discover` used to identify the stdio era |
| Recognized modern error | Error that proves modern behavior and forbids legacy fallback |
| Legacy allowlist | Operator configuration permitting one bounded compatibility probe for a pinned peer |
| Positive legacy evidence | Valid, correlated `initialize` result for an explicitly supported legacy revision |
| Merged namespace | Canonical tool names across all active peers |
| Collision policy | Prefix or reject rule for duplicate tool names |
| Era cache | Selected modern or legacy behavior stored for one transport peer |
| Transport recovery | Restart or reconnect, rediscover, relist, and retry safely with a new id |

## Mais leitura

- [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
