# Segurança MCP: Metadados envenenados, roteamento e estado MRTR

> Estadeless não significa sem confiança, significa que cada pedido expõe as provas que um servidor e gateway precisam para validar a chamada de forma independente.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Tratar as descrições das ferramentas, anotações, informações do cliente e informações do servidor como dados não confiáveis.
- Detectar envenenamento de metadados, alterações no descriptor e colisões de nomes entre servidores.
- Validar os metadados de solicitação 2026-07-28 e cabeçalhos de roteamento HTTP Streamable.
- Proteger o MRTR `requestState`contra a adulteração e a vinculação da confirmação a argumentos exatos.
- Aplicar limites de autorização e taxa a um principal, não uma sessão de protocolo removido.

## O problema

Um modelo lê descrições de ferramentas para decidir o que chamar. Um roteador lê nomes de ferramentas para decidir onde enviar uma solicitação. Um usuário lê rótulos para decidir o que aprovar. Um descriptor malicioso pode atingir os três.

A orientação oficial de segurança do MCP é direta: descrições e anotações devem ser tratadas como não confiáveis a menos que vêm de um servidor confiável. Mesmo assim, a confiança da implantação pode mudar. Uma atualização do servidor, pacote comprometido, erro de registro ou fusão de gateway podem alterar o que o modelo vê.

O protocolo atual também muda o limite de segurança. Em 2026-07-28 não há aperto de mão central e nenhuma sessão de transporte. Um projeto de segurança que basta contratar a aprovação, os limites de taxas ou o histórico de auditoria apenas por`Mcp-Session-Id`Não é um projeto atual.

## O conceito

### Sete superfícies de ataque que vale a pena verificar

Use uma lista concreta em vez das vagas instruções para ter cuidado.

1. **Metadata poisoning.**Uma descrição contém instruções não relacionadas com o comportamento declarado da ferramenta.
2. **Descriptor rug pull.**Uma alteração de nome, descrição, esquema ou anotação previamente aprovada.
3. **Cross-server shadowing.**Dois backends expõem o mesmo nome de ferramenta não qualificado e o roteamento escolhe um silenciosamente.
4. **Header and body confusion.** `Mcp-Method`ou `Mcp-Name`Não concorda com o pedido JSON-RPC.
5. **Capability escalation.**Um peer reclama uma extensão ou recurso cliente e o servidor erra essa declaração de autorização.
6. **MRTR state tampering.**Um cliente muda .`requestState`, responde a uma pergunta diferente, ou reutiliza a confirmação com argumentos diferentes.
7. **Supply-chain identity confusion.**Um nome de exibição familiar é tratado como prova da identidade do editor ou do servidor.

As superfícies se sobrepõem. A fixação de hash ajuda com as alterações do descrito, mas não prova que o primeiro descrito foi seguro. A digitalização estática capta frases óbvias, mas não instruções sutis. O espaçamento de nomes impede uma classe de colisão, mas não um servidor malicioso com espaçamento de nomes.

### O envelope de pedido atual é prova, não identidade

Cada pedido de 2026-07-28 contém:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "elicitation": {"form": {}}
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "security-lab",
      "version": "1.0.0"
    }
  }
}
```

Validar a versão e a forma de capacidade em cada solicitação. Use as capacidades para escolher uma forma de resposta compatível. Não use `clientInfo`- como um principal autenticado.

O mesmo aviso aplica-se a `io.modelcontextprotocol/serverInfo`É útil para registos e depuração. Não é um certificado, prova de registro ou decisão de autorização.

### Validar o roteamento antes da política

Para o`tools/call`, Streamable HTTP inclui:

```text
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.export
```

O método de cabeçalho deve ser igual ao método do corpo.`params.name`Rejeitar discordar com`-32020`Antes de selecionar um backend, aplicar RBAC ou consumir um token de limite de taxa.

Esta ordem encerra uma ambigüidade comum: um componente autoriza o corpo enquanto outro percorre o cabeçalho.

A validação por fio segue uma sequência exata. Valida os tipos de JSON-RPC e metadados, compare os valores do cabeçalho com o corpo, e verifique se a versão correspondente é suportada. Um cabeçalho incompatível retorna HTTP 400 com `-32020`. Se o cabeçalho e o corpo concordarem em uma versão não suportada, retorne HTTP 400 com `-32022`E ...`data`- Exactamente .`{"supported":["2026-07-28"],"requested":"<actual>"}`Um método desconhecido retorna HTTP 404 com `-32601`- Não .

Cada objeto de erro inclui opcional `data`Quando o contrato necessita de informações de recuperação estruturadas, a notificação não contém`id`Uma notificação HTTP aceita retorna 202 com um corpo vazio.

### Enfiar o descriptor inteiro

Um hash de descrição sozinho não apresenta alterações de esquema e anotação. Canonizar e hash os campos de descrição aprovados pelo usuário:

```python
normalized = json.dumps(tool, sort_keys=True, separators=(",", ":"))
digest = hashlib.sha256(normalized.encode()).hexdigest()
```

Guarde o digest sob uma chave qualificada , como `notes.export`, juntamente com a prova da editora e o tempo de aprovação fora deste exemplo de brinquedo.

Em cada refresco:

- - A chave desconhecida: quarentena até revisão.
- A mesma chave, digestão diferente: quarentena como um tapete de tiros até ser reaprovado.
- Nome duplicado não qualificado: requer espaçamento de nomes determinista.
- Bateria do scanner: bloquear e rever o descriptório completo.

A igualdade de hash prova estabilidade, não segurança.

### A digitalização estática é um triângulo

Padrões simples podem marcar tags de papel, redirecionamento de instruções, ocultação, acesso secreto e destinos de rede obscuros.

Uma descrição segura pode conter uma frase marcada em um aviso legítimo. Uma descrição maliciosa pode evitar todas as frases.

### Espaço de nomes antes da fusão

Suponha que dois servidores expõem ambos .`search`Nunca deixe que a ordem da descoberta decida qual ganha.

```text
notes.search
issues.search
```

O nome qualificado é o nome do gateway público. Registrar o mapeamento de backend separadamente. Os nomes estáveis fazem aprovação, auditoria, hash pins, e `Mcp-Name`Routing refere-se ao mesmo objeto.

### Capacidades são declarações de compatibilidade

Por pedido `clientCapabilities`Diz a um servidor quais protocolos o cliente pode processar. Não concede ao cliente acesso a ferramentas, dados ou ações.

A autorização ainda vem da política de recursos e de capital autenticada.

1. A autenticação das credenciais de transporte.
2. Valida versão, cabeçalhos e forma de solicitação.
3. Verifique a compatibilidade das capacidades.
4. Autorize o principal, ferramenta, recurso e argumentos.
5. Execução ou solicitação de entrada do utilizador.

### Proteger a confirmação MRTR sem estado

Uma ferramenta consequente pode precisar de confirmação do usuário. O MCP atual usa Requests Multi Round-Trip em vez de um callback de servidor para cliente.

Primeira resposta:

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "confirm": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Export notes to archive?",
        "requestedSchema": {
          "type": "object",
          "properties": {
            "confirm": {"type": "boolean"}
          },
          "required": ["confirm"]
        }
      }
    }
  },
  "requestState": "opaque-integrity-protected-value"
}
```

O cliente obtém entrada e retenta o método original com um novo ID JSON-RPC:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes.export",
    "arguments": {"query": "private", "destination": "archive"},
    "requestState": "opaque-integrity-protected-value",
    "inputResponses": {
      "confirm": {
        "action": "accept",
        "content": {"confirm": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

Cada um .`inputRequests`valor é um pedido integrado completo com `method`E ...`params`A chave deve corresponder à entrada correspondente em `inputResponses`Uma elicitação de formulário usa uma raiz-objeto`requestedSchema`, e o cliente deve ter declarado a capacidade de elicitação de formulário antes que o servidor o solicite.

A capacidade atual possui duas declarações válidas. `{"elicitation":{}}`A Comissão propõe que a Comissão adopte um plano de acção para a criação de um sistema de informação e de informação.`{"elicitation":{"form":{}}}`Uma declaração de URL apenas como `{"elicitation":{"url":{}}}`O servidor retorna HTTP 400 com `-32021`E ...`data.requiredCapabilities`igual a `{"elicitation":{"form":{}}}`- Não .

Tratar`requestState`Como entrada hostil. Assine ou criptografe, válida e vincula-a ao método, ferramenta, argumentos exatos, propósito, expiração, principal e um nonce único quando reproduzir as matérias.

O livro de conta não deve viver dentro de um objeto de gateway. O modelo executável injeta um armazenamento de repetição limitado, cortado TTL que pode ser compartilhado por várias instâncias de gateway. Sua reivindicação atômica é o limite de execução: apenas uma aceitação validada ou declínio terminal explícito consome estado. Uma resposta malformada ou `cancel`A frota de produção precisa da mesma reivindicação condicional em armazenamento duradouro compartilhado.

Não armazenar contexto de confirmação oculto em uma sessão de protocolo. Qualquer instância do servidor deve ser capaz de validar a retentação.

### Regra de dois para chamadas de alto risco

Classificar uma chamada ao longo de três eixos:

- Consome entradas não confiáveis.
- Pode acessar dados sensíveis.
- Isto provoca uma consequente acção externa.

Um único passo automático não deve combinar os três. Dividir, reduzir privilégios ou solicitar entrada explícita do usuário através do MRTR. Esta é uma heurística de design, não uma capacidade de protocolo.

### Reduzir a autoridade antes da execução

A independência não é segurança sozinha. Elimina o histórico de protocolo oculto, mas um pedido autocontenido ainda pode pedir a um administrador superpotente para vazamento de dados ou fazer uma mudança irreversível. A segurança vem de reduzir a autoridade em cada fronteira:

1. **Typed verb.**Expor uma operação limitada como `archive_note`Não é um genérico .`run`ou `request`ferramenta que possa expressar poderes não relacionados.
2. **Validated arguments.**Use um esquema fechado onde seja prático, rejeite campos desconhecidos, normalize identificadores uma vez, tamanhos de limites e valida o destino, o inquilino e a propriedade de recursos antes da avaliação da política.
3. **Current authorization.**Ligue o principal autenticado ao verbo exato, recurso, ambiente e argumentos normalizados. Anotativas de ferramentas e recursos do cliente não concedem essa autoridade.
4. **Action-bound approval.**Para uma chamada consequente, amarrar a aprovação a um digest do verbo digitado e argumentos normalizados, além de principal, política de expiração e única vez. Qualquer campo alterado requer uma nova decisão.
5. **First-class refusal.**Rejeitar o modelo, a aprovação expirada, o declínio do usuário e o destino inseguro como resultados comuns que não executam efeitos colaterais.
6. **Redacted audit evidence.**Registre quem perguntou, qual descrição e versão de política admitida foram usadas, qual alvo normalizado foi autorizado, por que a decisão permitiu ou recusou, e se a execução começou.

Cada passo restringe o que o componente seguinte pode fazer. O processador final deve receber um comando de domínio já validado, não texto de modelo bruto mais credenciais amplas. Repita toda a cadeia em uma retry MRTR, atualização de tarefa ou chamada de gateway. Uma aprovação anterior não transforma pedidos posteriores em tráfego de sessão confiável.

### Caminhos de interação atuais e antigos

Roots, Sampling e Logging são obsoletos para novas implementações 2026-07-28. Um gateway pode manter o código do canal de solicitação anterior apenas como um caminho de compatibilidade com versão.

Não construam uma nova defesa em torno de um limitador de amostragem por sessão. Aplique quotas para o principal autenticado, emissor, recurso, ferramenta e janela de tempo. Para o trabalho interativo atual, inspecione as solicitações de entrada e respostas do MRTR.

### Verificações de transporte sem nacionalidade

- Aceitar mensagens MCP modernas no único ponto final POST.
- Retorna 405 para GET e DELETE modernos.
- Não se preocupe nem dependa de`Mcp-Session-Id`- Não .
- Ignore sessões legais e reproduzir cabeçalhos como entradas de autoridade.
- Retorna JSON ou SSE de escala de solicitação para esse POST.
- Utilização`subscriptions/listen`Apenas para as notificações de alterações de longa duração que tenham sido aprovadas.

```figure
tp-tool-poisoning
```

## Construí-lo

`code/main.py`Implementa um pequeno modelo de gateway de segurança em processo. Canonikaliza e pinha descricionadores de ferramentas completas, relata envenenamento e sombreamento de metadados, valida o envelope de solicitação moderno e os valores de roteamento e realiza uma exportação confirmada em duas rodadas com assinatura `requestState`E uma loja de reprodução compartilhada.

O modelo começa depois que um adaptador HTTP analisou o corpo JSON e cabeçalhos de roteamento.`Content-Type`ou `Accept`. Conecte o mesmo despachador ao adaptador HTTP Streamable completo da lição 09 , o que requer `Content-Type: application/json`e um `Accept`valor que contém ambos `application/json`E ...`text/event-stream`- Não .

- É o que é ?

```bash
cd phases/13-tools-and-protocols/15-mcp-security-tool-poisoning
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

A amostra mutará intencionalmente um descritivo. O scanner e a comparação digest produzem resultados independentes.`input_required`resposta e uma nova tentativa sem Estado.

## Usá-lo

Substitui`SAFE_TOOLS`Com uma imagem normalizada de seus próprios servidores aprovados. Mantenha as credenciais e segredos fora da imagem. Revise cada descriptório novo ou alterado antes de atualizar sua digestão.

Em um gateway, execute as mesmas verificações durante a descoberta e novamente antes da expedição. Um cache pode reduzir o trabalho de descoberta, mas uma aprovação em cache deve expirar ou ser invalidada quando o descritivo muda.

## Envia-o

Esta lição vai avançar .`outputs/skill-mcp-threat-model.md`. Produz um modelo de ameaça de protocolo de corrente em metadados, roteamento, capacidade, autorização, MRTR, cache, registro e limites de compatibilidade.

## Exercícios

1. O processo de reexame deve ser executado em conformidade com o artigo 10.o, n.o 1, do Regulamento (UE) n.o 1095/2010.
2. Substitua o armazenamento de repetição na memória por um inserto condicional persistente e prove que dois processos não podem ambos reivindicar um nonce.
3. Injectar uma falha após a recorrência de repetição, mas antes de uma exportação simulada. Defina e teste a regra de transação ou de idempotencia que torna a recuperação segura.
4. Mudança de ferramenta `inputSchema`Confirme que o pincer completo o pega.
5. Adicionar uma política que recusa o caching público quando `tools/list`Diferença por principal.
6. Modela um servidor mais antigo atrás do gateway. Coloque todos os apertos de mão e comportamento de sessão atrás de um explícito`2025-11-25`ramo de compatibilidade.

## Termos-chave

| Term | Meaning |
|------|---------|
| Metadata poisoning | Instructions or deceptive claims embedded in a tool descriptor |
| Rug pull | Change to a previously approved descriptor |
| Tool shadowing | Ambiguous routing caused by duplicate unqualified names |
| Header mismatch | Routing header and JSON-RPC body disagreement, error `-32020` |
| Hash pin | Digest of the complete approved descriptor |
| MRTR | Stateless response and retry pattern for server-requested input |
| `requestState` | Opaque round-trip value that must be treated as untrusted input |
| Capability declaration | Statement of protocol compatibility, not authorization |
| Implicit form support | An empty `elicitation` capability object, equivalent to form support |
| Qualified tool name | Stable gateway name such as `notes.search` |

## Mais leitura

- [MCP security and trust guidance](https://modelcontextprotocol.io/specification/2026-07-28#security-and-trust--safety)
- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
