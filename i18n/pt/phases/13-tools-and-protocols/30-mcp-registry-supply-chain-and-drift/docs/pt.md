# Cadeia de abastecimento do Registo de MCP: Admissão, derivação e rollback

> Uma entrada no registo diz o que um editor declarou, e a admissão de produção prova o que você trouxe, o que observou, o que aprovou e o que pode restaurar com segurança.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 17 (gateways and registries), Phase 13 · 18 (production authentication)
**Time:** ~90 minutes

## Objetivos de aprendizagem

- Publicação separada do Registo, proveniência do pacote, descoberta no tempo de execução e aprovação local.
- Verifique um espaço de nomes do servidor MCP sem confiar no nome dentro de seu próprio registro.
- Pin publicação imutável, fonte de execução, proveniência e evidência do descrito ao vivo.
- Detectar alterações no estado do registo e derivação do tempo de execução após a admissão.
- Redirecionar o roteamento para uma versão previamente admitida sem reescrever o histórico.
- Manter um livro de admissões que explique cada decisão.

## O problema

Encontraste ?`com.example/inventory`A descrição parece ser certa, o pacote existe, o servidor responde.`server/discover`- Não .

Não é um facto, é uma cadeia de fatos de diferentes autoridades:

1. Um editor autenticado para um espaço de nomes apresentou um registro.
2. Um registo de embalagens serviu um artefato com uma identidade e digestão específicas.
3. Um endpoint em execução relatou uma versão de protocolo, capacidades, ferramentas e informações do servidor de diagnóstico.
4. A sua organização decidiu que esta combinação exata era permitida.

A colapso desses fatos em it está no registro, então confie que  cria um ponto cego da cadeia de suprimentos. Uma publicação válida ainda pode ser depreciada. Uma etiqueta de pacote pode apontar para um artefato inesperado se você não pinar seu digesto. Um servidor pode adicionar uma ferramenta destrutiva após a revisão. Um rollback pode silenciosamente escolher uma versão que nunca foi admitida.

O sistema é um controlador de admissão com provas em todas as fronteiras.

## O Registro é um índice, não o seu sistema de aprovação

O Registro oficial do MCP armazena os metadados do servidor.`server.json`Registros de nomes de uma versão do servidor e declara um ou mais pacotes ou endpoints remotos. regras de publicação adicionar autenticação de namespace, verificações de propriedade do pacote, regras de registro restritas, e uma localização de metadados de editor estreita.

Os controles respondem às perguntas de publicação.

| Boundary | Question | Evidence owner |
|---|---|---|
| Namespace | Was the publisher allowed to use this name? | Registry authentication plus your verified namespace input |
| Record | What did the publisher declare for this version? | Immutable `server.json` digest |
| Execution source | Which package or remote endpoint will execute? | Declared source fields, verified ownership result, transport, and trusted digest |
| Runtime | What does the endpoint expose now? | `server/discover` and tool descriptors |
| Admission | Did your policy approve this exact set? | Local pin and ledger entry |
| Operations | Is it still safe, and what can replace it? | Drift checks, status sync, health, and rollback route |

A versão do esquema do Registro e a versão do protocolo MCP são independentes.`2025-12-11`schema do servidor enquanto o servidor ao vivo suporta MCP `2026-07-28`Nunca deduzir um do outro.

```figure
mcp-registry-admission
```

## Sete controlos numa única decisão de admissão

### 1. Verificação do espaço de nomes

Os nomes do Registo Oficial usam espaços de nomes autenticados. Um domínio verificado pode mapear para um prefixo de domínio invertido. Por exemplo, controle de `example.com`pode estabelecer`com.example/*`- Não .

Não aceitar uma verificação de prefixos de linha:

```python
server_name.startswith("com.example")
```

Isso também aceita .`com.exampleevil/tool`Dividir o nome em`/`, exigir um arco-íris não vazio, e comparar o segmento do espaço de nomes exatamente. mais importante, passar o espaço de nomes verificado para admissão do resultado de autenticação. Não derivar confiança do registro não confiável.

Os namespaces com suporte ao GitHub e os namespaces com suporte ao domínio usam diferentes caminhos de autenticação. Normalize qualquer caminho em uma entrada de admissão: a cadeia exata de namespace verificada.

### 2. Avenida de origem

Para um registo de embalagem, a declaração e o artefato recolhido devem juntar-se em campos explícitos:

- Tipo de registo de pacotes
- Identificador de embalagem
- versão do pacote
- Resultado verificado de propriedade
- Digest de artefatos baixados

Também valida o transporte do pacote declarado. Um registro com apenas um endpoint remoto é válido e não pode ser rejeitado por falta de um pacote. Para uma fonte remoto, junte o URL declarado e o tipo de transporte à propriedade do endpoint verificada de forma independente e a digestão da conexão confiável ou evidência de implantação.

O código de lição suporta ambos os tipos de fonte e hashes a fonte selecionada juntamente com a fonte do Registro, nome do servidor, versão do Registro, digestão de registro e digestão de evidências.

Nunca aceite um digesto fornecido apenas pelo artefato que você está tentando verificar, calcule-o em um limite de tração confiável, ou receba-o de um serviço de pacote cujo resultado de verificação você valida.

### 3. Aplique a decisão, não apenas a versão

As versões do Registro são identificadores de publicações únicos. Os metadados publicados são imutáveis. Um registro alterado requer uma nova versão. É recomendado a versão semântica, mas o Registro não a requer e não aceita intervalos de versões.

Isso significa que`^1.4`Não é um pin de admissão. Nem é o mais recente.

```json
{
  "server": "com.example/inventory",
  "version": "1.0.0",
  "recordDigest": "...",
  "source": {"kind": "package", "registryType": "pypi"},
  "sourceDigest": "...",
  "toolsetDigest": "...",
  "provenanceDigest": "...",
  "registryStatus": "active"
}
```

A fixação de várias camadas permite identificar qual limite mudou. Uma alteração de digestão de registro sob a mesma versão do Registro é uma falha de integridade do Registro. Uma alteração de digestão de fonte sob a mesma coordenada do pacote ou implantação remota é uma falha de integridade da fonte de execução. Uma alteração de digestão de conjunto de ferramentas é a deriva de tempo de execução.

### 4. Detecção de deriva ao vivo

A entrada deve observar o servidor que realmente receberá tráfego.`server/discover`, lista ou de outra forma obter os descritores de ferramentas expostos através do seu caminho de confiança, e verificar:

- `2026-07-28`Está dentro .`supportedVersions`
- todas as capacidades necessárias localmente estão presentes
- Cada descriptor de ferramenta tem a superfície de identidade e esquema necessária
- O digestor de descrição normalizado corresponde ao pin admitido em verificações posteriores

O resultado opcional `_meta["io.modelcontextprotocol/serverInfo"]`O valor é um contexto de exibição, registro e depuração auto-relatado. Registá-lo como evidência de diagnóstico, mas nunca o use para estabelecer espaço de nomes, propriedade do pacote, propriedade do ponto final, admissão ou qualquer outra decisão de segurança.`serverInfo`alias fora `_meta`Não é o campo contratual e não deve ser promovido para ser uma prova de diagnóstico.

Normalize apenas campos cuja ordem não tem significado. A amostra classifica a lista de ferramentas por nome estável antes de hashing, de modo que uma alteração inofensiva da ordem de lista não causa derivação. Não descartam campos de descrição. Uma nova ferramenta, esquema alterado, descrição alterada ou novas anotações alteram o pin.

A amostra trata descriptórios malformados e qualquer alteração na digestão de descriptórios como deriva, quarentena o pin, remove sua rota ativa e bloqueia essa versão como um alvo de retrocesso. Uma política de produção pode permitir uma mudança editorial apenas através de uma nova revisão, porque as descrições influenciam a seleção de ferramentas de modelo.

### 5. O status do registo é estado vivo

A API do Registro liga um nível de resposta `_meta`Objeto ao lado de cada registro do servidor.`_meta["io.modelcontextprotocol.registry/official"]`- Passa a resposta .`_meta`Objeção à admissão e leitura `_meta["io.modelcontextprotocol.registry/official"].status`- Um directo .`_meta.status`Não confundir os metadados de resposta com os próprios registros de publicação `_meta`O estatuto pode ser:

- `active`: devolvido por defeito e elegível para admissão local
- `deprecated`: ainda pode ser detectado com um aviso, mas não é mais uma escolha automática segura
- `deleted`: oculto por padrão enquanto o seu registro histórico permanece disponível através de visualizações apagadas ou incrementais

Situação de sincronização após admissão. Se uma versão ativa se tornar obsoleta ou excluída, quarentena seu pin e pare de encaminhar novos trabalhos para ele. Guarde a evidência. A exclusão da lista padrão não é permissão para excluir sua trilha de auditoria.

Os metadados personalizados fornecidos pelo editor pertencem apenas ao `_meta.io.modelcontextprotocol.registry/publisher-provided`Os dados de resposta gerenciados pelo Registro são separados. Não deixe que um editor defina o seu próprio status oficial.

### 6. O "rollback" significa a restauração da rota

Uma publicação imutável não é editada durante o rollback.

Um alvo seguro deve:

1. Têm um registro de admissão preenchido.
2. Ainda tem um status de Registro ativo sob a sua política.
3. Não estar em quarentena por causa de provas de segurança.
4. Ainda resolve o pacote fixado e o conjunto de descriptores ao vivo.
5. Passe os exames de saúde atuais.

A amostra concentra-se nas três primeiras condições. Um reconciliador real deve recolher o pacote e verificar o ponto final ao vivo antes da ativação.

### 7. Aplicar um livro de admissão

Uma base de dados de admissões diz o que é ativo.

Cada entrada de amostra contém uma sequência, tempo, evento, servidor, versão, resultado, razões, evidências, o hash da entrada anterior e seu próprio hash. Alterar um resultado anterior rompe a verificação dessa entrada e de cada link posterior.

Isto é evidente, não mágicamente à prova de manipulação. Ancorar o livro-razão periódico em um domínio de confiança separado, como metadados de lançamento assinados ou armazenamento de escrita única. Restringir quem pode anexar. Mantenha tokens de autorização, credenciais de pacote, argumentos de ferramentas e dados de endpoint privados fora de evidência.

## Construí-lo

O controlador está ligado .`code/main.py`Ele usa apenas a biblioteca padrão Python.

Comece com a demonstração finita:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
npx tsx code/main.ts
```

A demonstração realiza cinco operações:

1. Admite .`1.0.0`com espaços de nomes, proveniência do pacote, protocolo, capacidades e ferramentas correspondentes.
2. Admite .`1.1.0`e torná-lo ativo.
3. Observe uma ferramenta de exclusão inesperada no tempo de execução.
4. Observar o status do Registo para `1.1.0`Tornar-se`deprecated`- Não .
5. Restaurar o roteamento para o ainda admitido `1.0.0`- Não.

Forma esperada:

```json
{
  "admitted": [true, true],
  "driftAllowed": false,
  "rollbackAllowed": true,
  "activeVersion": "1.0.0",
  "ledgerValid": true
}
```

Leia a execução nesta ordem:

1. `namespace_for_domain()`E ...`namespace_matches()`estabelecer a autoridade de nomeamento exacta.
2. `digest()`E ...`normalized_tools()`produzir evidências deterministas.
3. `RegistryAdmissionController.admit()`A publicação, a proveniência, o tempo de execução e a política.
4. `check_live()`Comparar uma nova observação com o pin.
5. `observe_registry_status()`Quarantena de versões cujo estado de registro muda.
6. `rollback()`Activa apenas um alvo elegível previamente admitido.
7. `AdmissionLedger.verify()`detecta alterações no histórico registrado.

## Usá-lo

Coloque o controlador entre a descoberta e o roteamento:

```text
Registry sync -> artifact verifier -> live discovery -> admission controller -> route table
                                               |                 |
                                               v                 v
                                          evidence store    admission ledger
```

Usar identidades separadas para esses trabalhos. Um trabalhador de sincronização do Registro precisa de acesso leitura a metadados. Um verificador de artefatos precisa de acesso de busca de pacotes. Um reconcilador de rota precisa de permissão para ativar um pin aprovado. Nenhum deles precisa de todas as credenciais.

Faça o estado de implantação explícito. Approvado significa a política aprovada pela evidência. Activo significa que a rota atualmente a seleciona. Quaranteado significa que não pode receber novos trabalhos. Supersed significa que outra versão admitida está ativa. Não codifique os quatro significados em um booleano.

Execute admissão antes de exposição de um servidor em `tools/list`- Caso contrário, o cliente poderá descobrir uma ferramenta durante a lacuna entre a publicação e a avaliação das políticas.

## Laboratório Interativo

Vão ver uma fronteira a falhar de uma vez.

### Laboratório A: Colisão no espaço de nomes

Abra um shell Python do diretório de código:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/code
python3 -q
```

Então corre:

```python
from main import namespace_matches
namespace_matches("com.example/inventory", "com.example")
namespace_matches("com.exampleevil/inventory", "com.example")
```

O primeiro resultado é:`True`O segundo é:`False`Substituir a comparação exacta por `startswith`- e observe por que o segundo nome atravessa a fronteira.

### Laboratório B: deriva do descrito

```python
from main import *
times = iter(f"2026-08-21T12:00:{n:02d}+00:00" for n in range(10))
c = RegistryAdmissionController(clock=lambda: next(times))
meta = {OFFICIAL_META_KEY: {"status": "active"}}
c.admit(sample_record("1.0.0"), meta, "com.example", evidence_for("1.0.0"), sample_live("1.0.0"))
c.check_live("com.example/inventory", "1.0.0", sample_live("1.0.0", True))
```

Inscreva as razões e o estado da rota. O registro do pacote e do Registro não mudou. A superfície da ferramenta de execução mudou, então o controlador colocou em quarentena e desativou o pin. É por isso que o controle da cadeia de suprimentos deve continuar após a instalação.

### Laboratório C: status e retrocesso

Admite .`1.1.0`, marque-o desfeito, e tente ambos os alvos de volta:

```python
c.admit(sample_record("1.1.0"), meta, "com.example", evidence_for("1.1.0"), sample_live("1.1.0"))
c.observe_registry_status("com.example/inventory", "1.1.0", "deprecated")
c.rollback("com.example/inventory", "1.1.0", "unsafe retry")
c.rollback("com.example/inventory", "1.0.0", "restore known release")
c.ledger.verify()
```

O alvo em quarentena é rejeitado, o pin ativo anterior é aceito, o livro permanece válido.

## Laboratório de Prática

Extender o controlador com um portão de aprovação para duas pessoas.

Requisitos:

- As aprovações devem ser armazenadas como referências de provas assinadas, não como nomes mutáveis no pin.
- Requer duas identidades diferentes de revisor para um conjunto de ferramentas que contém uma ferramenta com `destructiveHint: true`- Não .
- Rejeitar duplicadas identidades de revisores.
- Preservar a tentativa de admissão original no livro-razão quando a aprovação for incompleta.
- Adicionar testes para zero, um, duplicado e duas aprovações distintas.
- Não registem assinaturas, credenciais ou argumentos completos de ferramentas privadas.

O sucesso significa que uma ferramenta destrutiva não pode se tornar ativa até que ambas as identidades aprovem o registro exato, o pacote e o conjunto de ferramentas.

## Artigo enviado

Esta lição vai avançar .`outputs/skill-mcp-registry-admission.md`. Utilize-o como um runbook plano e reutilizável ao revisar uma nova versão do Registro ou investigar a deriva. Ele define as entradas, regras de recusa, conjunto de evidências, reconciliação de status e prova de retrocesso sem depender dos nomes de classes de amostra.

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A verificação deve provar:

- limites exatos do espaço de nomes rejeitar prefixos semelhantes
- Apenas o status oficial do Registo com espaços de nomes pode tornar uma versão elegível
- O pacote não verificado ou incompatível e a prova remota são rejeitados
- Metadados editores não podem imitar metadados geridos pelo Registo
- Ordem de ferramentas é normalizado sem esconder alterações de descriptório
- as estruturas de embalagens e ferramentas malformadas são rejeitadas de forma segura
- `serverInfo`permanece diagnóstico e nunca fornece autoridade de admissão
- Descrição de quarentena de deriva, desativa e bloqueia o retorno ao pin
- mudanças de status em pinos ativos de quarentena
- O rollback não pode selecionar uma versão em quarentena ou desconhecida
- Deteta-se uma alteração do livro de conta

## Modos de falha de produção

| Failure | Why it happens | Required response |
|---|---|---|
| Name looks valid but namespace was never authenticated | Policy trusted record text | Reject until a trusted namespace verifier supplies the exact prefix |
| Same package coordinate returns new bytes | Mutable upstream or compromised distribution | Stop activation, retain both digests, investigate the fetch boundary |
| “Latest” changes without review | Floating selection escaped the pin | Resolve only exact admitted versions and digests |
| New tool appears after approval | Runtime drift or a different deployment | Quarantine the route and capture a fresh descriptor observation |
| Deprecated version remains active | Status sync is missing or delayed | Reconcile status on a schedule and before activation |
| Deleted record disappears from default sync | Client requested only active records | Use incremental or deleted-aware reconciliation and preserve local history |
| Rollback target was never admitted | Route control and approval state are disconnected | Refuse rollback and run a new admission for the target |
| Ledger verifies locally after an attacker rewrites all entries | Hash chain has no external anchor | Publish signed ledger heads to a separate trust domain |
| Evidence contains bearer tokens or tool arguments | Logging copied whole requests | Redact at collection time and store only the minimum proof |

## Regra de funcionamento

Resposta de publicação Poderá esta identidade publicar este nome? Resposta de admissão Vamos executar este artefato exato e expor esse comportamento exato? Mantém essas decisões separadas, pin cada junção, e fazer o rollback escolher evidências em vez de memória.

## Mais leitura

- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [Official Registry OpenAPI contract](https://registry.modelcontextprotocol.io/openapi.yaml)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
