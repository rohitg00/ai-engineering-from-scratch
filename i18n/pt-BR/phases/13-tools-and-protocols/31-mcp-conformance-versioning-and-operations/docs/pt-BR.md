# Engenharia de Conformidade do MCP: Versão, Evidência e Operações

> Um servidor não é conformista porque seu caminho feliz trabalhou através de um SDK. A conformidade vive no fio, nos limites de versão, através de intermediários e durante o rollback.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 17 (gateways), Phase 13 · 30 (registry admission)
**Time:** ~100 minutes

## Objetivos de aprendizagem

- Transforma as regras normais do MCP em transcrições de ar e negativas.
- Mantém-te rigoroso .`2026-07-28`comportamento separado do legado limitado de retorno.
- Distinguir campos aditivos desconhecidos de campos invalidos desconhecidos `resultType`- Não .
- Compare a evidência JSON-RPC crua com uma visão normalizada do SDK.
- Prova a integridade do cabeçalho e do corpo através de um verdadeiro limite de proxy.
- Portas de lançamento com transcrição editada, saúde e evidências de reversão.

## O problema

O seu cliente chama .`tools/list`O teste de integração passa.

Esse resultado deixa sem resposta perguntas importantes:

- A solicitação contou com metadados modernos do protocolo por solicitação?
- - Sim , sim .`MCP-Protocol-Version`- Não .`Mcp-Method`, e `Mcp-Name`coincide com o corpo JSON-RPC?
- A resposta continha um código válido ?`resultType`- Ou o SDK sintetizou um?
- O cliente preservaria um futuro campo aditivo?
- Um erro reconhecido na época moderna desencadearia acidentalmente um aperto de mão?
- Um proxy preservou o status de origem e o erro JSON-RPC?
- O serializer de notificação emitiu uma resposta proibida?
- As operações podem provar por que uma libertação foi promovida ou revertida sem guardar segredos?

Conformance é um conjunto de invariantes observáveis. Construir um arame que capture esses invariantes antes que o tráfego de produção tem que descobri-los.

```figure
mcp-conformance-operations
```

## Comece com Eras de Versão

MCP `2026-07-28`O sistema de informação é um sistema de informação que utiliza metadados autônomos por pedido.`params._meta.io.modelcontextprotocol/protocolVersion`E ...`params._meta.io.modelcontextprotocol/clientCapabilities`As chaves com espaços de nome precisos são importantes .`protocolVersion`ou `clientCapabilities`Os aliases são malformados. Quando os cabeçalhos de roteamento espelhados estão presentes na fronteira HTTP, seus valores devem concordar com o corpo JSON-RPC.`resultType`- Não .

Versões através de `2025-11-25`Usar a era anterior de inicialização. Um resultado legado sem `resultType`A data de receção da receita deve ser definida como completa apenas após o cliente ter selecionado a data anterior.

Não crie um validador permitido que aceite ambas as formas ao mesmo tempo. Use dois ramos:

| Branch | Entry evidence | Missing `resultType` | Initialization |
|---|---|---|---|
| Modern | Successful `server/discover` or recognized modern response | Invalid | Not the default path |
| Legacy | Configured allowlist plus a valid legacy `initialize` result after an inconclusive modern probe | Interpreted as complete | Required by that era |

A separação impede que um colega moderno mal formado seja recompensado com validação mais fraca.

### Modo rigoroso

O modo rigoroso requer provas de comportamento moderno.`server/discover`O que é que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é que é o que é que é o que é que é o que é que é o que é que é o é.`-32020`- Não .`-32021`, ou `-32022`- Não .

### Modo de retrocesso

O modo Fallback executa uma sonda moderna limitada. Um timeout, resposta vazia, conexão fechada ou resposta não reconhecida é inconclusivo. Não prova que o peer é legado. Somente um endpoint explicitamente configurado ou alistado para compatibilidade pode receber uma sonda legada limitada, e o cliente seleciona o ramo legado apenas após validar a sonda.`initialize`Resultados e revisão negociada do legado.

Fallback não é try legacy após qualquer erro. Um erro moderno reconhecido contém informações úteis de correção.

Isso impede que um atacante, ou seja, que um proxy de interrupção ou filtragem seja forçado a rebaixar a classificação ao deixar cair a resposta moderna.

Gravar a era selecionada ao lado de cada transcrição.

## Construir um corpo de transcrições

Um dispositivo de transcrição registra o que cruzou a fronteira, não apenas a chamada do SDK:

```json
{
  "name": "golden-modern-list",
  "era": "modern",
  "headers": {
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": "tools/list"
  },
  "request": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {}
      }
    }
  },
  "responseStatus": 200,
  "responseBody": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "resultType": "complete",
      "tools": []
    }
  }
}
```

Mantenha duas classes de aparelhos.

### Transcrições douradas

As transcrições douradas provam comportamento aceito:

- Recursos de pesquisa e de pesquisa
- Resultado completo com campos exigidos
- `input_required`resultado quando o método pode solicitar mais entrada
- Resultado de extensão apenas após a publicidade da capacidade correspondente
- resultado legado sem `resultType`, mas apenas na era do legado selecionado
- Processamento de notificações sem resposta JSON-RPC

A transcrição dourada é precisa, não grande.

### Transcrições negativas

As transcrições negativas provam comportamento de recusa:

- Descoincidência de cabeçalho e corpo
- Falta de capacidades de execução por pedido
- versão de protocolo não suportada
- Falta-me a modernidade`resultType`
- desconhecido ou não anunciado `resultType`
- resposta `jsonrpc`Outras que `2.0`ou um ID que difere em valor ou tipo JSON
- uma resposta que contenha ambas as coisas `result`E ...`error`, ou nenhum
- um erro sem um número inteiro `code`e corda`message`
- um erro de protocolo conhecido mapeado para o estado HTTP errado
- resposta emitida para uma notificação
- Envelope JSON-RPC mal formado
- falha de proxy de um erro de protocolo

Para cada caso negativo, afirme o limite de rejeição e o código de erro estável. A chamada falhou é muito fraca.`-32020`podem parecer um fracasso enquanto contam histórias completamente diferentes aos operadores.

O dispositivo de descoincidência de cabeçalhos deve incluir a resposta HTTP 400 JSON-RPC real do servidor com o ID de solicitação correspondente e código de erro `-32020`Aplicar automaticamente quando o validador local observar .`HeaderMismatch`A verificação de resposta não é uma bandeira de fixação opcional. Um caso com HTTP 500 e nenhum corpo falha mesmo quando o código de rejeição local foi correto. Um arnes que para depois de seu próprio validador de solicitação lança testou apenas a si mesmo, não o comportamento de fio do servidor.

O projeto oficial de conformidade MCP é útil como um conjunto externo e referência de versão. Guarde suas transcrições locais também. Eles capturam seu proxy, SDK, autenticação, extensões e caminho de lançamento, que um conjunto geral não pode conhecer.

## Os valores de cabeçalho devem corresponder ao corpo de RPC

No moderno Streamable HTTP, os intermediários podem encaminhar ou aplicar políticas usando cabeçalhos espelhados. O corpo JSON-RPC continua sendo a fonte de verdade do protocolo.

Validação na ordem seguinte:

1. Analisar e validar os tipos de envelopes e metadados JSON-RPC.
2. Comparar`MCP-Protocol-Version`com`params._meta.io.modelcontextprotocol/protocolVersion`- Não .
3. Comparar`Mcp-Method`com`method`- Não .
4. Quando o método tiver um nome de roteamento, compare `Mcp-Name`com o valor corporal correspondente.
5. Após a igualdade ser estabelecida, decida se a versão e o conjunto de capacidades correspondentes são suportados.

Esta ordem distingue o desajuste .`-32020`de versão não suportada `-32022`Também impede que um gateway autorize o nome do cabeçalho enquanto a origem executa um nome diferente.

Os nomes de campos HTTP são insensíveis a casos, enquanto seus valores permanecem sensíveis a casos. Normalize os nomes de cabeçalhos antes de procurar e rejeite duplicados conflitantes. Para um espaço branco inseguro, não ASCII ou de liderança ou seguimento `Mcp-Name`, decodificar o exato`=?base64?{Base64EncodedValue}?=`Rejeita um sentinela incompleto, inválido Base64, inválido UTF-8, ou valor cru inseguro com `-32020`. O espaço branco circundante é inválido mesmo quando o corpo contém os mesmos caracteres, porque esse valor requer a codificação sentinela antes do transporte.

Um intermediário pode rejeitar HTTP mal formado antes que uma solicitação chegue ao servidor MCP, de modo que sua falha pode ser um erro HTTP sem JSON-RPC. Captar se uma rejeição veio do intermediário ou da origem. O servidor MCP de origem deve usar o contrato de erro de protocolo quando lida com uma solicitação JSON-RPC válida.

## Campos desconhecidos não são resultados desconhecidos

A compatibilidade com o futuro exige duas regras diferentes.

### Campo aditivo desconhecido

Objetos de resultado e `_meta`Os mapas podem ganhar campos. Um validador deve preservar ou ignorar um campo aditivo de acordo com a sua função, a menos que o campo viole um contrato reservado.`futureHint`Além de um resultado conhecido.

Se você é um proxy transparente, a preservação de um campo desconhecido é geralmente mais segura do que despojá-lo. Se você é um cliente de aplicativo, ignorá-lo pode ser válido. Seu teste diferencial ainda deve revelar que o SDK omitiu-o, então o comportamento é deliberado.

### Desconhecido .`resultType`

`resultType`O estudo de base de dados foi desenvolvido em`complete`ou `input_required`Uma extensão só pode adicionar outro valor quando a sua capacidade foi anunciada.`task`no contexto da capacidade negociada.

O cliente não sabe o ciclo de vida que ele desejaria.

A mesma resposta bruta pode, portanto, conter um campo desconhecido aceitável e um tipo de resultado desconhecido inaceitável.

O discriminador é apenas a primeira camada. Valida a carga útil específica do método depois dele.`tools/list`O resultado precisa de um `tools`array cujos descritores têm nomes únicos não vazios, descrições úteis e raiz de objeto `inputSchema`Valores.`task`O resultado é válido apenas para um candidato elegível `tools/call`com a capacidade de tarefas e requer`taskId`, status conhecido, criação e atualização de timestamps, e `ttlMs`, mais um intervalo de votação facultativo válido.`completion/complete`O resultado requer uma `completion`Objeto com valores de cadeia não superiores a 100, um inteiro opcional não negativo `total`que não seja menor que os valores devolvidos, e um Boolean opcional `hasMore`- Um bom ortografia .`resultType`Não pode fazer um conformante de carga útil mal formado.

## A variante de notificação

Uma notificação JSON-RPC não tem `id`O receptor não deve enviar uma resposta de sucesso ou erro JSON-RPC.

Para uma forma de notificação HTTP aceita, o arnes espera um HTTP `202`com um corpo vazio.`2026-07-28`Não define nenhuma notificação de base de cliente a servidor sobre Streamable HTTP. A amostra usa uma notificação de extensão de curso com espaço de nomes apenas para testar a invariante de serializador de uma maneira. Não a apresente como um novo método de base.

Teste o serializer, não só o manipulador.`None`enquanto o middleware o enrola em um objeto de sucesso JSON.

## Adicionar um SDK Diferencial

Os SDKs muitas vezes transformam objetos de fio em tipos de linguagem convenientes. Isso é útil, mas um objeto normalizado não pode provar o que foi recebido.

Para cada dispositivo de alto risco, captura:

1. Status bruto, cabeçalhos e corpo de resposta antes da decodificação do SDK.
2. Valor de retorno normalizado ou exceção do SDK.
3. A projeção semântica esperada para a era selecionada.
4. Campos levantados, sintetizados, despojados ou alterados pelo SDK.

A amostra permite a remoção de contabilidade de fios conhecida apenas com o SDK, tais como `resultType`- Não .`_meta`- Não .`ttlMs`, e `cacheScope`O relatório de avaliação da aplicação de dados é um relatório de avaliação da aplicação de dados.`futureHint`Porque esse campo semântico desconhecido desapareceu.

Não suponha que todas as diferenças sejam um bug do SDK. O ponto é tornar a transformação visível. Decida se o seu componente é um endpoint de aplicação, que pode ignorar um campo aditivo, ou um intermediário transparente, que deve preservá-lo.

Execute o diferencial contra cada SDK e versão que você envia. Se dois SDKs normalizarem a mesma transcrição de forma diferente, a política de lançamento deve dizer qual comportamento é aceitável em vez de escolher a saída mais conveniente após o fato.

## Capturar provas de proxy

A maioria das falhas de MCP de produção ocorrem em mais de um processo.

| View | Minimum evidence |
|---|---|
| Ingress | request headers, JSON-RPC body, content type, authenticated route, receive time |
| Origin | forwarded headers and body digest, origin status, response headers and body |
| Egress | client-visible status, headers, body, and send time |

A amostra detecta duas transformações comuns:

- um erro HTTP 400 ou 404 JSON-RPC de origem torna-se um proxy genérico 500
- O corpo de saída JSON-RPC difere do corpo de origem

Adicionar afirmações específicas de implementação para o tipo de conteúdo, `Accept`, compressão, SSE escopo de solicitação, cabeçalhos de cache e correlação de rastreamento. Captar ambos os lados da terminação TLS quando a política permite. Nunca registar credenciais apenas para provar o caminho.

## Reescrever antes que a evidência deixe a memória

A redação é parte de operações de conformidade, não um trabalho de limpeza posterior. Aplique-a antes da serialização, hashing, registros, artefatos de teste ou uploads falhos.

A caixa de amostra dobra os nomes das chaves e remove os separadores antes de serem combinados, substituindo, em seguida, recursivamente os valores sob chaves como `Authorization`- Não .`Cookie`- Não .`Set-Cookie`- Não .`X-Api-Key`- Não .`accessToken`- Não .`clientSecret`- Não .`registrationAccessToken`- Não .`token`- Não .`password`- Não .`secret`, e `api_key`- A canonização e o denilista devem usar a mesma forma para que as variantes camelCase, com fitas, sublinhadas e pontilhadas não possam contornar a política da outra.`query`Pode ainda conter dados pessoais ou regulamentados.

A pesquisa de dados é uma das principais fontes de dados que são utilizadas para a análise de dados.

## Faça da saúde e do regresso parte da porta

A conformidade com o protocolo é necessária, mas não suficiente para a liberação.

Defina uma janela de saúde antes do lançamento:

- Número mínimo de amostras
- Taxa máxima de erro
- Percêncilo máximo de latência
- Saturação ou limites de recursos
- duração da observação
- comparação com a linha de base admitida

Defina também as provas de retrocesso antes do lançamento:

- versão anterior exata
- Digestão de provas de admissão
- SHA-256 artefatos e pinos de descrição
- estado atual do Registo
- Resultado de saúde atual
- Procedimento de restauração da rota
- Uma certificação sobre esses campos exatos de uma identidade de controlador de libertação confiável

Exigir que o objetivo de retrocesso seja verificado e saudável antes da promoção, não apenas depois do candidato falhar.

Se um candidato falhar e o alvo de reestruturação não tiver essa evidência, detém o tráfego em vez de adivinhar.

Não reduzir a preparação para verificações de veracidade, como uma versão não vazia, `healthy: "yes"`A amostra requer tipos exatos, um status ativo, três digestos SHA-256, um assinante de confiança e uma atestativa válida HMAC-SHA-256 sobre a carga útil completa de retrocesso. Sua chave de demonstração determinista é um dispositivo não secreto. Injecte uma chave protegida, resultado de verificação KMS ou verificador de atestados de chave pública no limite de liberação na produção.

O portão de liberação também recusa transcrição vazia, diferencial SDK ou evidências de proxy. Cada fonte deve levar digestões de evidências válidas. Uma janela verde de saúde não pode preencher uma fronteira que nunca foi observada.

## Construí-lo

- O arame da biblioteca padrão:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
npx tsx code/main.ts
```

A demonstração exibiu exatamente quinze transcrições douradas e negativas, incluindo resultados de conclusão válidos e mal formados, compara um resultado bruto com uma visão SDK, inspeciona um proxy que desmoronou um erro de origem, avalia a saúde, autentica a evidência de retrocesso e seleciona esse alvo.

Forma esperada:

```json
{
  "transcriptsPassed": 15,
  "transcriptsTotal": 15,
  "sdkDroppedFields": ["futureHint"],
  "proxyIssues": [
    "proxy collapsed a protocol error into HTTP 500",
    "proxy changed the origin JSON-RPC body"
  ],
  "releaseAction": "rollback",
  "evidenceDigest": "..."
}
```

Leia `code/main.py`na ordem seguinte:

1. `validate_request()`Impõe as regras de pedido e cabeçalho específicas da época.
2. `validate_result()`Separar os discriminadores de legado desaparecidos, os valores modernos válidos, as extensões e os valores desconhecidos.
3. `select_era()`Implementa uma política de retrocesso rigorosa e limitada.
4. `run_transcript()`Avalia as luzes douradas e negativas.
5. `compare_sdk_view()`expõe as diferenças de normalização.
6. `inspect_proxy()`Comparar as provas de entrada, origem e saída.
7. `redact()`Remove segredos óbvios antes de haver provas.
8. `rollback_evidence_ready()`valida os campos de pines exatos e a certificação de liberação confiável.
9. `ReleaseGate.evaluate()`Junta-se à conformidade não vazia, SDK, proxy, saúde e evidências de retrocesso.

## Usá-lo

- Aponte o arame em quatro pontos:

1. Em cada alteração de implementação com um adaptador de teste em processo.
2. Contra os binários de cliente e servidor construídos sobre o transporte real.
3. Através do proxy ou gateway implantado num ambiente de colocação em cena.
4. Durante o lançamento de canários com saúde viva e evidências de retrocesso.

Mantenha os mesmos nomes de casos estáveis em várias camadas. `negative-header-body-mismatch`O processo de análise de dados deve ser o mesmo que o processo de análise de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de

Armazenar esquemas de fixação no controle de versão. Armazenar evidências de execução editadas no seu sistema de liberação. Armazenar capturas brutas de curta duração apenas sob controles de acesso a incidentes.

## Laboratório Interativo

### Laboratório A: provar a fronteira da era

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/code
python3 -q
```

- Correr .

```python
from main import *
validate_result({"tools": []}, "legacy")
validate_result({"tools": []}, "modern")
```

A chamada legada é infértil .`complete`O chamado moderno suscita`ProtocolViolation`Agora teste de retorno:

```python
select_era({"kind": "timeout"}, "fallback")
select_era(
    {"kind": "timeout"},
    "fallback",
    legacy_allowed=True,
    legacy_evidence={"kind": "initialize_success", "protocolVersion": LEGACY_VERSION},
)
select_era({"kind": "jsonrpc_error", "code": -32021}, "fallback")
```

O primeiro timeout não é fechado porque o silêncio não é evidência legada. A segunda chamada seleciona legado apenas porque a configuração permite e um resultado de inicialização legado válido foi observado. O erro de capacidade faltante reconhecido prova o ramo moderno.

### Laboratório B: campo aditivo versus discriminador

```python
validate_result({"resultType": "complete", "tools": [], "futureHint": True}, "modern")
validate_result({"resultType": "future_mode", "tools": []}, "modern")
```

O primeiro resultado preserva `futureHint`O segundo é rejeitado porque o discriminador do ciclo de vida é desconhecido.

### Laboratório C: inspecionar uma transformação do SDK

```python
compare_sdk_view(
    {"resultType": "complete", "tools": [], "futureHint": {"mode": "new"}},
    {"tools": []},
)
```

Decida se o seu componente pode ignorar `futureHint`Não apague silenciosamente o diferencial.

### Laboratório D: reparar o proxy

Modifique a troca de demonstração para que a saída preserve o status de origem e corpo.`python3 main.py`Os problemas de proxy devem desaparecer, mas o diferencial SDK ainda bloqueia a promoção.`futureHint`na visão SDK e observar a mudança de ação para `promote`Quando todas as provas forem retiradas.

## Laboratório de Prática

Adicionar transcrições SSE de pedido ao arame.

Requisitos:

- Capture status de resposta, tipo de conteúdo, eventos SSE ordenados e terminação do stream.
- Prove que cada evento JSON-RPC tem um resultado ou erro válido específico da era.
- Adicione um caso negativo para um proxy que amortece o fluxo completo antes de encaminhar.
- Adicionar um caso negativo para um evento SSE cujo ID JSON-RPC difere da solicitação.
- Redigir os dados do evento antes de escrever provas.
- Incluir a duração do fluxo, a latência do primeiro evento e a contagem de eventos na janela de saúde.
- Faça com que o portão de liberação escolha apenas um alvo de retrocesso comprovado quando o fluxo falhar.

O sucesso significa que o mesmo caso corre diretamente e através do proxy, com um relatório que identifica o limite exato que mudou o comportamento.

## Artigo enviado

Esta lição vai avançar .`outputs/skill-mcp-conformance-release-gate.md`. Usá-lo para transformar um servidor, cliente, gateway ou mudança do SDK em uma matriz de conformidade versão e decisão de lançamento. O artefato requer evidências de fio bruto, casos negativos, seleção explícita de era, diferenciais do SDK, prova de proxy, redação, limiares de saúde e evidências de rollback.

## Verifique

Execute a suíte demo e determinista:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A verificação deve provar:

- Cada transcrição dourada e negativa incluída atinge o resultado esperado .
- As solicitações modernas exigem as chaves de metadados exatas com espaços de nomes
- Os nomes de cabeçalhos HTTP são combinados de forma insensible e codificados `Mcp-Name`Os valores são decodificados exatamente
- Desconforto de cabeçalho e corpo retorna o código de desconforto moderno
- versão de resposta, ID, resultado ou exclusão de erro, forma de erro e mapeamento HTTP são validados
- são aplicados os requisitos de ferramentas específicas para o método, tarefas e cargas úteis para a conclusão
- Cada observação .`HeaderMismatch`requer um HTTP 400 JSON-RPC real `-32020`Resposta
- cru`Mcp-Name`O espaço branco é rejeitado enquanto as viagens de ida e volta do espaço branco são exactamente codificadas por sentinela
- um desaparecido`resultType`é válido apenas na era de legado selecionada
- campos aditivos sobrevivem à validação em bruto enquanto os tipos de resultados desconhecidos falham
- Os tipos de resultados de extensão exigem a sua capacidade anunciada
- erros modernos reconhecidos nunca causam o retorno do legado
- as notificações não produzem resposta JSON-RPC
- A eliminação da contabilidade do SDK e a perda de campo semântico são distinguidas
- O erro de proxy é detectado e as credenciais são redigidas recursivamente em camelCase e variantes separadoras
- A promoção requer transcrição não vazia, SDK, proxy e evidências operacionais saudáveis
- A promoção e o retorno exigem um objetivo de retorno autenticado, fichado, ativo e saudável.

## Modos de falha de produção

| Failure | What the weak test reports | What the harness must prove |
|---|---|---|
| SDK synthesizes a missing discriminator | “tools/list passed” | Raw modern result lacked `resultType` and is invalid |
| Client downgrades after `-32021` | “legacy retry worked” | Recognized modern error forbids fallback |
| Unknown result type treated as complete | “response parsed” | Unadvertised lifecycle discriminator is rejected |
| Proxy authorizes one tool and origin executes another | “request reached server” | `Mcp-Name` equals the body routing name at every hop |
| Harness throws before reading the server response | “header mismatch test passed” | HTTP 400 and JSON-RPC `-32020` response are captured and validated |
| Proxy turns origin 400 into generic 500 | “upstream error” | Origin and egress statuses and JSON-RPC bodies are preserved |
| Notification middleware emits `{result: null}` | “handler returned none” | Final egress body is empty and no JSON-RPC response exists |
| SDK strips an additive field | “typed objects match” | Raw and normalized views show the exact dropped field |
| Failure artifact leaks a bearer token | “debug bundle uploaded” | Redaction occurred before hashing, logging, or upload |
| Credential key style bypasses redaction | “denylist contains api_key” | CamelCase and separator variants share one canonical denylist form |
| Canary has no samples but appears healthy | “zero errors” | Minimum sample count is enforced |
| Rollback selects an unknown build | “previous deployment restored” | Target version, admission digest, pins, status, and health are present |

## Regra de funcionamento

Teste os bytes que você envia, os bytes de cada intermediário, a semântica que cada SDK expõe e as operações de evidência usarão sob pressão. A compatibilidade é um ramo explícito. O rollback é uma ação de liberação apoiada por evidências. Nenhum deve ser um efeito colateral acidental de um parser permisivo.

## Mais leitura

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP version negotiation](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Official MCP conformance project](https://github.com/modelcontextprotocol/conformance)
