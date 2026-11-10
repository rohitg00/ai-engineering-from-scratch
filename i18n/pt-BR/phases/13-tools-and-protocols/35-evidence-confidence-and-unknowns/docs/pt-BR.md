# Evidências, Confiança e Desconhecidos na Análise Binária

> Uma descoberta sobre um programa compilado é um registro com um hash, uma confiança, uma autoridade e uma lista de o que não pode mostrar.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~105 minutes

## Objetivos de aprendizagem

- Construir um registro de evidências baseado nos dados rea.`Evidence`com confiança observada, derivada e inferida.
- Compute ids de conteúdo-hash que permanecem os mesmos quando o arquivo se move para outra pasta.
- Registrem o que cada fornecedor não pode mostrar como limitações que viajam com o registro.
- Recusar-se a declarar um resultado até que uma execução observada da função o apoie.
- Mantenha os desconhecidos residuais como registros revisados unidos por uma cadeia de hash.
- O provedor de cache responde sob uma chave exata e recusa uma repetição obsoleta.

## O problema

Perguntas a um agente o que ?`grade`em `ledger-x86_64-O1.o`O agente chama rea, lê o pseudódromo Ghidra e responde 0. Um revisor pergunta como o agente sabe. O agente tem um bloco de texto que Ghidra imprimido. Para o caminho padrão, esse texto lê`uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);`Os bytes naquele momento dizem:`xor eax, eax`- Não .

A expressão e a instrução produzem 0 para cada entrada. O agente não sabia disso.[NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)O estudo de 2026 colocou texto dentro de binários e descobriu que os modelos propunha a ação insegura implantada em 35 dos 40 casos ([arXiv 2607.12507](https://arxiv.org/abs/2607.12507))).

A rea 6.5.0 dá ao agente um vocabulário para isso.`Evidence`registro com um `confidence`de`observed`- Não .`derived`, ou `inferred`, um `authority`, e uma lista de`limitations`A habilidade embalada diz ao agente: "Toda conclusão deve distinguir observações, inferências e desconhecidos. Cite IDs de Evidência, preserve limitações e cobertura incompleta, e nunca implica que a análise estática observou execução".

Três coisas rea deixa para você. Seus snapshots cache resultados exatos de consulta, não análise. Sua verificação passa uma reivindicação quando uma dimensão de comparação é inalterada, e seu próprio comentário diz que um passe "não estabelece equivalência global de implementação".`verified`- Não.

Esta lição construi a peça que falta em Python simples. Você escreve um livro que armazena todos os fatos sobre o dispositivo como um registro com um hash de conteúdo. Você faz previsões sobre`percent_change`E ...`grade`Importa dois registros reais reais e a imagem de onde vieram, e o seu livro conta com cada hash rea escrito.

```figure
re-evidence-ledger
```

## Três palavras para confiança, cinco para autoridade

`confidence`é um enum com três valores, nunca um número. `authority`Quando um produtor não diz nada, rea usa`shipped-artifact`com`observed`- Não .

| Value | Meaning on the fixture | Records in this lesson |
|---|---|---|
| `observed` | A fact read from bytes or from a run | the ELF reader's section and symbol reads, the two Ghidra records, 17 host runs |
| `derived` | A fact computed from observed records | the switch table model, the division model, every unknown mutation |
| `inferred` | An expectation that no observation states yet | 18 predictions |
| `shipped-artifact` | The file on disk was the source | every read of `ledger-x86_64-O1.o` |
| `controlled-replay` | A run you controlled produced the fact | the host runs of `harness.c` |
| `analyst-inference` | Your own judgement | predictions and unknown mutations |
| `historical-reference` | An older source tree or document | none here |
| `external-service` | A service outside the file and the host | none here |

O primeiro trata de pseudocódio como uma observação do comportamento. É uma observação do que Ghidra imprimiu. O segundo trata de uma lista vazia como prova de ausência.`code/main.py`codifica ambas as regras.

## O registro

Um registro tem exatamente 16 campos, e rea 6.5.0 rejeita qualquer outro campo. `code/main.py`mantém os mesmos nomes que rea, então um registro de cada lado valida no outro.`relationship_coverage`, diz o quão completo é uma lista de chamadores ou chamados.`complete`- Não .`partial`, ou `unknown`, ou `null`Quando a operação não relaciona ligações.

| Field | What it holds |
| --- | --- |
| `evidence_id` | `ev_` and 64 hex digits, a hash of the content |
| `subject` | `name`, `digest.sha256`, `format`, `architecture`, `local_path`, or `null` |
| `provider` | `id`, `name`, `version` or `null` |
| `analysis_profile` | the provider's settings and their digest, or `null`, always present |
| `predicate_type` | a tag, `rea.analysis` by default |
| `operation`, `parameters` | the tool and its input |
| `raw_result`, `normalized_result` | provider output and the canonical result |
| `confidence`, `authority` | the enums above |
| `environment` | `id`, `platform`, `architecture`, `isolation`, or `null` |
| `limitations` | plain sentences |
| `relationship_coverage` | `status` `complete`, `partial`, or `unknown` with diagnostics, or `null` |
| `locations` | `address`, `address-range`, `artifact-path`, `file-offset`, `file-offset-range` |
| `evidence_links` | the `ev_` ids this record rests on |

Este é o verdadeiro disco que escrevi para .`grade`O arquivo completo é:`code/fixtures/rea-evidence-grade.json`, 37.573 bytes.

```json
{
  "evidence_id": "ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1",
  "subject": {
    "name": "ledger-x86_64-O1.o",
    "digest": { "sha256": "9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f" },
    "format": "elf",
    "architecture": "x86_64",
    "local_path": "/private/tmp/aiefs-re/phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/fixtures/ledger-x86_64-O1.o"
  },
  "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
  "analysis_profile": {
    "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
    "parameters": { "jump_table_evidence": "typed-case-default-blocks-v1", "import_mode": "ephemeral-source-immutable" },
    "digest": "9c7f6b24be69294e61da046e4583e3856cb9e40433b149c1bf8bb534d2fe03ef"
  },
  "operation": "analyze_function",
  "parameters": { "procedure": "grade" },
  "confidence": "observed",
  "authority": "shipped-artifact",
  "environment": null,
  "limitations": [
    "Default-space addresses use lowercase 0x-prefixed hexadecimal; other address spaces use <percent-encoded-space>:0x<hex>.",
    "Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals."
  ],
  "relationship_coverage": {
    "status": "complete",
    "diagnostics": [
      "Only resolved Ghidra call references are returned; unresolved computed or indirect calls remain unknown, while function classifications distinguish thunks and externals."
    ]
  },
  "locations": [],
  "evidence_links": []
}
```

O verdadeiro .`parameters`O objeto do perfil tem 25 chaves.`limitations`Uma limitação é parte do conteúdo, então deixar cair uma altera o ID, e o seu livro maior rejeitaria o registro.

Observe o que o registro não diz. `environment`É o que é`null`Porque Ghidra leu um ficheiro e não encontrou nada.`locations`é vazio porque este relatório operacional endereça dentro `normalized_result`- Não .`relationship_coverage`tem o estatuto`complete`O diagnóstico diz que apenas as referências de chamadas resolvidas Ghidra são devolvidas e que chamadas computadas ou indiretas não resolvidas permanecem desconhecidas.

## O ID é um hash de conteúdo, e o caminho não está nele

reacomputadores `evidence_id`Como `ev_`mais SHA-256 sobre o JSON canônico RFC 8785 de uma projeção do registro.`digest`- Não .`format`, e `architecture`e gota .`name`E ...`local_path`- Cai .`relationship_coverage`quando o seu valor é `null`, então um registro sem ligações de ligação mantém a mesma identidade que antes do campo existir.`raw_result`e todas as limitações, são hashed.

RFC 8785 classifica chaves de objeto, remove espaço branco e fixa os formulários de número e cadeia. Para registros cujos números são inteiros, a biblioteca padrão do Python produz os mesmos bytes:

```python
def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
```

`code/main.py`Rejeita flutuações antes de hash, porque RFC 8785 e Python imprimem algumas flutuações de forma diferente.

| rea value | Recomputed by `code/main.py` |
|---|---|
| `ev_67b6d3f992eaf49a…` for `grade` | equal |
| `ev_e88b10dc0c6400e5…` for `percent_change` | equal |
| profile digest `9c7f6b24be69294e…` over `{provider, parameters}` | equal |
| `query_26122aebe9d8abae…` for the `grade` snapshot entry | equal |
| `query_0f95ef38038d3666…` for the `percent_change` entry | equal |

A mesma observação dos mesmos bytes obtém a mesma identificação em qualquer máquina e em qualquer pasta.`local_path`Na lista acima, os nomes de uma pasta em um Mac. O ID não muda quando você copiar a fixa para `/home/you/re`- Não .`rebind_subject_path()`O disco não é um disco de música, mas é um disco de música que permite mostrar um disco sob um novo caminho.`sha256`- Não .`format`, ou `architecture`O mesmo acontece com o `rebindEvidenceToTargetPath`Quando reproduz um registro de instantâneo para um alvo em um novo caminho.

`validate_evidence()`recalcula a identificação e rejeita uma desatividade com a frase de rea, "O identificador semântico de evidências não corresponde ao seu registro".`analysis_profile.provider`diferem de sua `provider`O teste .`test_tampered_id_and_mismatched_profile_are_rejected`Edita uma linha de pseudocódio dentro do real `grade`Registo e observa o livro de conta recusa-lo.

## Observe o objeto por si mesmo

Antes de qualquer fornecedor, o livro-guia lê o arquivo. `observe_object()`Paralisa os cabeçalhos das secções ELF64, `.symtab`- Não .`.strtab`, e `.rela.text`com`struct.unpack_from`- Escreve um .`inspect_object`registro e um `read_function_bytes`Todos os cinco são`observed`com autoridade `shipped-artifact`, porque a fonte era o arquivo no disco.

| Record | Content | Id |
|---|---|---|
| `inspect_object` | five sections with offsets, sizes, and hashes, four functions, three relocations | `ev_645e0a145f28bd5c…` |
| `read_function_bytes percent_change` | 16 bytes at `.text+0x00` | `ev_2572a7d254ad15cb…` |
| `read_function_bytes grade` | 46 bytes at `.text+0x10`, SHA-256 `ffcb75c2a7bb1104…` | `ev_a467c2427bfc0c56…` |
| `read_function_bytes total` | 31 bytes at `.text+0x40` | `ev_b1e845cea2543073…` |
| `read_function_bytes grade_label` | 63 bytes at `.text+0x60` | `ev_c50041be26e6b7f4…` |

`llvm-objdump -t`concorda: `grade`- Não .`0000000000000010`com tamanho `2e`As três mudanças em`.rela.text`são`R_X86_64_PC32`contra`.rodata`em compensações `0x36`- Não .`0x84`, e `0x93`, com adições `0x10`- Não .`0x24`, e `-0x4`Cada disco tem um .`file-offset-range`localização e uma limitação: "Os bytes de seção são lidos do arquivo no disco. O leitor não aplica nenhuma realocação e não executa nenhum código".

A lição 32 constrói o leitor inteiro. Aqui, é de 60 linhas, porque esta lição é sobre o que você grava sobre a leitura.

## Derive a Tabela e diga que você a derivou

Os 46 bytes de `grade`contêm quatro padrões que a lição 33 decodificou:

| Bytes | Instruction | Offset in `grade` |
|---|---|---|
| `48 69 c0 67 66 66 66` | `imul rax, rax, 0x66666667` | 3 |
| `48 c1 f9 22` | `sar rcx, 34` | 13 |
| `83 c1 fa` | `add ecx, -6` | 23 |
| `83 f9 04 77 0c` | `cmp ecx, 4` then `ja` | 28 |

Um multiplicador por `0x66666667`Seguido por um turno de 34 é uma divisão assinada por 10. O arquivo tem o número 10.`derive_grade_model()`escreve esse fato como uma limitação: "O divisor 10 é uma derivação do multiplicador 0x66666667 e do turno 34. O arquivo tem o número 10. "

O `add ecx, -6`O primeiro caso é de 6.`cmp ecx, 4`com um salto sem assinatura admite cinco casos, 6 a 10.

O `lea`- Não .`.text+0x33`Carrega a realocação com adição `0x10`. Uma PC32 realocaliza medidas a partir do final do deslocamento de 4 bytes, de modo que a tabela começa em `.rodata+0x14`Cinco palavras de " indiano " .`1, 2, 3, 4, 4`- O interruptor .`ledger.c`O compilador transformou o interruptor em uma tabela de busca de valores de devolução.

O registro resultante `ev_605106bff2d9998f…`- Não .`confidence` `derived`, e o seu `evidence_links`Nome dos dois registros observados em que se apoia. Remova o registro de bytes do livro principal e o registro derivado tem um link pendurado.`ev_a467c242…`- Não .

Agora, compare com Ghidra, o pseudocódio para os mesmos bytes:

```c
uint grade(int param_1)
{
  uint uVar1;
  uint uVar2;

  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}
```

Ghidra aplicou a mudança e nomeou a mesa `DAT_001000b4`, que é `.rodata+0x14`Depois de colocado`.text`- Não .`0x100000`Para o valor padrão, ele imprimiu uma expressão que é sempre 0 e nunca diz 0.`native_value_flow`Marca essas operações `is_dead: true`O registro é uma observação fiel de Ghidra. O significado que você lê dele é derivado, e o valor que você espera de uma corrida é inferido.

O `percent_change`O registro mostra o outro fracasso.`undefined1 [16] percent_change(int param_1,int param_2,ulong param_3)`A fonte diz:`int percent_change(int before, int after)`- Não .`idiv`escreve`EDX:EAX`, e o caminho zero sai .`EDX`O decompiler deduz um retorno de 16 bytes e um terceiro parâmetro.`native_api.return_type.confidence`Para`grade`É o que é`"low"`Tratar uma assinatura recuperada como a inferência do prestador e registrá-la dessa forma.

## As previsões são registros inferidos

Uma previsão é uma afirmação sobre o comportamento que nenhuma observação afirmou. `claim_suite()`construiu 18 deles a partir dos modelos derivados e da fonte. `record_prediction()`Armazena cada um como um disco com `confidence` `inferred`E ...`authority` `analyst-inference`, ligado aos registos em que se baseia.

| Claim | Predicted value | Rests on |
|---|---|---|
| `percent_change(12400, 15500)` | 25, from 310000 / 12400 | division model `ev_076a9167…` |
| `percent_change(0, 5)` | 0, the zero guard | division model |
| `percent_change(100, 50)` | -50 | division model |
| `percent_change(-7, 3)` | -142, because `idiv` truncates toward zero | division model |
| `grade(55)` | 0, index -1 fails the unsigned compare | table model `ev_605106bf…` |
| `grade(60)`, `grade(69)` | 1, 1 | table model |
| `grade(70)`, `grade(85)` | 2, 3 | table model |
| `grade(95)`, `grade(100)`, `grade(105)` | 4, 4, 4 | table model |
| `grade(110)`, `grade(-5)` | 0, 0 | table model |
| `total(1, 2, 3)`, `total()` | 6, 0 | source record `ev_2f1e6d25…` |
| `grade_label(85)` | `"B"` | source record and table model |
| `grade(score)` for 90 to 100 | 4 for all eleven inputs | table model |

`predict()`usa semântica C, não semântica Python. `c_div()`Truncas para zero, e `wrap32()`Põe cada intermediário em 32 bits. Python's `//`Rondas em direcção ao infinito negativo, então `(3 - -7) * 100 // -7`A lição 36 torna esta grade muito maior.

Cada previsão abre um desconhecido residual.`observed`Evidências com autoridade `controlled-replay`e recomenda uma sonda:`execute_function`A pergunta para a reivindicação de primeira classe diz "A classificação ((95) == 4 mantém-se quando a função compilada é executada?"

## Verifique se eles estão em contato com uma corrida

`code/fixtures/harness.c`inclui`ledger.c`e imprime um resultado por invocação. `observe_runs()`Compila-o com o primeiro de `clang`- Não .`cc`, ou `gcc`Cada entrada na grade é executada uma vez.

```json
{
  "operation": "execute_function",
  "parameters": { "function": "grade", "args": [95] },
  "normalized_result": { "result": 4, "stdout": "4\n", "exit_code": 0 },
  "confidence": "observed",
  "authority": "controlled-replay",
  "environment": { "id": "host-process", "platform": "darwin", "architecture": "arm64", "isolation": "process" },
  "limitations": [
    "The run executed a host build of ledger.c, not the x86-64 object. The claim about the object rests on the shared source and on the compiler.",
    "One run observes one input. It proves nothing about other inputs."
  ]
}
```

O assunto de um registro de execução é o binário de arneses, um arquivo Mach-O arm64 neste Mac, com seu próprio SHA-256.`course-harness`com a linha de versão do compilador, aqui `Apple clang version 17.0.0 (clang-1700.6.3.2)`- O .`evidence_links`Nomear o registro fonte `ev_2f1e6d251543d017…`, porque a corrida e o objeto compartilham`ledger.c`E nada mais.

Leia a primeira limitação duas vezes. O objeto x86-64 nunca foi executado nesta máquina. O que foi executado foi uma segunda construção da mesma fonte para outra arquitetura. Isso ainda é uma observação, e é a mais forte disponível sem um emulador, então a reivindicação passa com essa frase anexada. Um relatório que omite isso perdeu informações necessárias ao leitor.

As 17 corridas de entrada única concordam com as previsões.`code/fixtures/run-evidence.json`Detém esses 17 registos e o registro de origem, exportado com `--record`Em 2026-10-13. Quando não houver compilador,`build_ledger()`O relatório diz que o mercado de trabalho é um mercado de trabalho.`runs`campo.

## Regras de promoção

Uma reivindicação passa de inferida a apoiada apenas através de corridas observadas. `check_claim()`- Não .`execute_function`registos com a mesma função e argumentos, compara cada resultado com a previsão e conta as entradas cobertas:

| Status | Condition | rea's completion ledger |
|---|---|---|
| `pass` | every input has an agreeing run and none disagrees | `pass` |
| `fail` | any run disagrees | `fail` |
| `unknown` | some inputs have runs, others have none | `unknown` |
| `unsupported` | no input has a run | `unsupported` |

`promote_claim()`É a forma estrita.`ClaimError`Quando qualquer identificação é `inferred`ou `derived`. Ele é levantado quando um id nomea uma série de outra função ou de outros argumentos. Ele é levantado quando a lista está vazia e quando as corridas cobrem menos entradas do que a reivindicação.`grade(55)`Não pode promover.`ev_7be90c0c…`na figura e observar a queda da reivindicação para `unsupported`enquanto dois registos sobre `grade`- Não.

A alegação de alcance mostra o caso parcial. Apenas dois de seus onze entradas, 95 e 100, aparecem na grade de execução. `check_claim()`Retorno `unknown`com`covered`2 de 11, e `promote_claim()`O livro principal não arredondou isso.

`completion_ledger()`Espelhos rea's `EvidenceCompletionLedger`O seu ID é`ecl_`Mais o hash dos seus registos, e `complete`É verdade só quando`pass`- É igual .`total`As impressões da demonstração .`ecl_da64933ea13befed…`com`complete: false`, por causa daquela reivindicação de um alcance.

## Os desconhecidos são registos com uma cadeia de hash

Rea armazena um resíduo desconhecido como um registro rigoroso. `code/main.py`mantém os mesmos campos e as mesmas invariantes.

O ID é`unk_`Mais SHA-256 sobre `{domain, question, scope_digest}`O problema é que, quando o espaço branco da pergunta se desmorona em espaços individuais, dois analistas que fazem a mesma pergunta sobre o mesmo arquivo obtêm a mesma identificação.`scope_digest`é o SHA-256 do objeto.

Cada alteração é uma nova revisão.`previous_revision_digest` `null`Cada revisão posterior nomeia os`revision_digest`da primeira, e a digestão cobre todos os campos, exceto a si mesma.`verify_unknown_chain()`Ele verifica que cada link aponta para a revisão anterior. Ele verifica que a evidência de mutação de cada nome de revisão está no livro principal.

Cada mutação é em si uma evidência, como acontece com o provedor `rea-unknown-registry`- O nosso carregou .`confidence` `derived`- Não .`authority` `analyst-inference`A limitação diz: "Uma mutação de registro registra o que o analista decidiu.

É por isso que os 81 registros da demonstração incluem 36 registros de mutação derivados: 18 aberturas e 18 atualizações.

Em cada revisão são aplicadas três invariantes:

- Só um .`resolved`O desconhecido carrega um`resolution`, e apenas a revisão 1 não tem antecessor.
- A.`contradicted`Nome desconhecido, pelo menos, um identificador contraditório e nenhum identificador aparece em ambas as listas.
- A.`verified`A resolução deve indicar pelo menos um identificador de prova com a confiança e autoridade necessárias.

A terceira regra é a de que o livro-razão recusa mais frequentemente. As notas de fluxo de trabalho da rea dizem: "Somente evidências observadas qualificativas podem verificar uma resolução". `resolve_unknown()`Por conseguinte, rejeita o modelo de tabela, rejeita um registo observado com autoridade `shipped-artifact`, e aceita o registro de corrida `ev_f4ffbe8f922ec7fe…`A revisão resolvida para `grade(95)`É a revisão 2, e o seu `previous_revision_digest`É o que é`ffca840b55a8a188…`, o digest da revisão 1.

`update_unknown()`- Toma .`expected_revision`e eleva .`revision-conflict`Quando está ultrapassado, como a rea.`update_unknown`A reação correta é a de que as notas da rea dão: ler novamente a revisão actual e decidir novamente.

Um desconhecido permanece aberto após a demonstração:`unk_f2eb0d7f84c80a19…`, "A classificação ((score) == 4 para cada pontuação de 90 a 100 mantém quando a função compilada é executada?" Seu status é `investigating`, suas identidades de suporte incluem as duas corridas, e sua sonda ainda nomeia as nove entradas sem uma corrida.

## Um cache de respostas não é um banco de dados de análise

rea tem três coisas que parecem um cache.`-readOnly -deleteProject`E apagado ao fechar.`AnalysisSnapshotCache`O arquivo instantâneo contém até 10.000 entradas para uma identidade binária.`target`- Não .`binding`- Não .`entries`- Não .`workflow_entries`, e um `evidence_bundle`- Não .

A chave do cache é `query_`Mais SHA-256 sobre `{target, binding, operation, parameters}`- Não .`target`É o que é`{sha256, kind, format, architecture}`, e um `raw-binary`O alvo também tem `entry_point`- Não .`binding`A análise de dados e de dados de dados é feita por um fornecedor e pelo perfil de análise inteiro, incluindo o digest.`jump_table_evidence`de`typed-case-default-blocks-v1`a um `v2`, e a digestão muda, então cada chave muda.

`code/fixtures/rea-snapshot.json`O arquivo rea foi escrito durante as duas corridas, 142.690 bytes. rea escreveu com permissões apenas do proprietário, e a cópia comprometida é legível por todos.`AnswerCache.import_snapshot()`recalcula cada um .`query_id`E recusa o arquivo quando qualquer diferença.`target`ou `binding`Diferente da ativa, com a redação de rea `profile_mismatch`Recusou uma imagem de quem`format_version`Não é .`course-answer-cache-1`- Não .

Três medições desta máquina.`grade`A consulta levou 8,6 segundos, com uma importada Ghidra fresca.`percent_change`Uma consulta contra o mesmo snapshot levou 8,5 segundos, porque uma consulta diferente é um cache perdido.`grade`A consulta levou 2,1 segundos e retornou o registro idêntico com o idêntico `evidence_id`. A repetição na memória em rea adiciona a limitação "Cariada a partir de um snapshot local de análise de REA; esta chamada não re-exerceu o provedor. "`lookup()`adiciona uma frase do mesmo tipo, para que o leitor possa distinguir uma repetição de uma resposta nova.

Uma mutação termina o cache. Em rea 6.5.0, um renome ou um comentário limpa o cache de instantâneo antes que rea envie a chamada ao provedor. Uma resposta falhada não pode provar que a escrita foi retirada, então uma escrita falhada também interrompe a repetição. Uma importação de metadados que altera o banco de dados faz o mesmo.

## Por que um agente precisa disto?

Um agente que conduz rea através do MCP vê o registro completo de cada chamada e pode citar`evidence_id`A pesquisa de 2026 diz onde isso vai mal. A confiança excessiva na saída de ferramentas foi uma das quatro fraquezas do estudo NDSS BAR. No estudo de texto plantado, mostrando conteúdo binário como dados sozinhos ainda deixou 15 propostas inseguras de 40, e verificações de proveniência com autorização de ferramentas removendo-as.[arXiv 2606.06838](https://arxiv.org/abs/2606.06838)Na binária com centenas de funções, apenas 10 a 15 por cento receberam análise real antes que o agente produziu estubes.

O livro-razão responde a cada um destes com um registro, e o agente relata apenas o que o livro-razão contém.`unsupported`Uma reivindicação com algumas corridas é`unknown`Um texto do fornecedor é`observed`Dá ao agente o ficheiro de habilidades.`outputs/`E fazer do livro o único lugar onde escrever conclusões, que vale para Claude, Cursor, Codex, OpenClaw, Hermes, ou qualquer agente que leia SKILL.md.

## Construí-lo

Execute a demonstração de biblioteca padrão:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
```

A demonstração lê o objeto, importa os dois registros rea, verifica o instantâneo rea e deriva os dois modelos.

```json
{
  "records": 81,
  "by_confidence": { "observed": 25, "derived": 38, "inferred": 18 },
  "rea_snapshot": { "entries": 2, "replay_hit": true, "stale_profile_refused": true },
  "grade_table": [1, 2, 3, 4, 4],
  "runs": "live: Apple clang version 17.0.0 (clang-1700.6.3.2)",
  "claims": [ { "claim_id": "grade(95)", "status": "pass", "covered": "1/1" }, { "claim_id": "grade(90..100)", "status": "unknown", "covered": "2/11" } ],
  "completion_ledger_id": "ecl_da64933ea13befed9483f8b00447bb3f4ceb74324c01e2515eff03f3af3ca750",
  "complete": false,
  "unknowns": { "resolved": 17, "investigating": 1 }
}
```

Sem um compilador C,`runs`lê `imported 17 recorded run records from run-evidence.json`E o resto é o mesmo.

Leia `code/main.py`na ordem seguinte:

1. `canonical_json()`E ...`compute_evidence_id()`Mantém a receita de hash e a projeção semântica.
2. `create_evidence()`E ...`validate_evidence()`construir e verificar um registro.
3. `EvidenceLedger.record()`E ...`import_bundle()`armazenar registos e recusar conflitos.
4. `open_unknown()`- Não .`update_unknown()`, e `resolve_unknown()`manter a cadeia de revisão.
5. `observe_object()`lê o ELF e `derive_grade_model()`- Ele lê a mesa.
6. `claim_suite()`- Não .`predict()`, e `record_prediction()`Escreva o nível inferido.
7. `observe_runs()`transforma cada arame em um registro observado.
8. `check_claim()`- Não .`promote_claim()`, e `completion_ledger()`aplicar as regras de promoção.
9. `AnswerCache`As chaves respondem como as fotos da Rea e recusam as antigas.

## Usá-lo

Mantenha um livro de conta por alvo e por investigação. Coloque o SHA-256 do alvo em cada assunto e digeste o escopo da pergunta em cada desconhecido.`provider`Quando você reconstruir o dispositivo, o assunto digere alterações e cada registro antigo se torna evidência de outro arquivo.

Escreva limitações no momento em que as conhece. O leitor que não aplica nenhuma realocação diz isso. A execução de uma construção host diz isso. O modelo que infere um divisor diz isso. Um registro escrito sem suas limitações parece mais forte do que os fatos permitem, e um leitor posterior não pode reparar isso.

Tratar cada texto fornecedor como dados. As cadeias e pseudocódios do alvo são textos que o alvo controla.`_meta.provenance.untrusted_content: true`As instruções do servidor dizem ao modelo que trate o conteúdo-alvo como dados e que informe qualquer solicitação nele para executar, instalar, baixar ou enviar algo como uma tentativa de injeção rápida.

## Laboratório Interativo

### Laboratório A: recomputar um rea-id

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code
python3 -q
```

- Correr .

```python
from main import *
record = load_evidence_file(FIXTURES / "rea-evidence-grade.json")
record["evidence_id"] == compute_evidence_id(record)
record["subject"]["local_path"] = "/home/you/re/ledger-x86_64-O1.o"
record["evidence_id"] == compute_evidence_id(record)
record["limitations"].pop()
record["evidence_id"] == compute_evidence_id(record)
```

As duas primeiras comparações são verdadeiras. O caminho não está no hash. A terceira é falsa, porque uma limitação é conteúdo.

### Laboratório B: recusar uma promoção

```python
ledger, report = build_ledger(live_runs=False)
claim = [c for c in claim_suite(ledger.find(operation="derive_switch_model")[0], ledger.find(operation="derive_arithmetic_model")[0], ledger.find(operation="read_source")[0]) if c.claim_id == "grade(55)"][0]
promote_claim(ledger, claim, [ledger.find(operation="derive_switch_model")[0]["evidence_id"]])
```

O chamado é elevado .`ClaimError`E nomear o ID derivado. Agora passar o ID de execução:

```python
run = run_records_for(ledger, "grade", [55])[0]
promote_claim(ledger, claim, [run["evidence_id"]])["status"]
```

O status é `pass`, e os retornados `limitations`Levar a sentença de construção de hospedeiro.

### Laboratório C: recusar uma foto obsoleta

```python
import json
snapshot = json.loads(REA_SNAPSHOT_PATH.read_text())
target, binding = rea_snapshot_binding(snapshot)
AnswerCache(target, binding).import_snapshot(snapshot)
stale = dict(binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
AnswerCache(target, {"provider": binding["provider"], "analysis_profile": make_profile(binding["provider"], stale)}).import_snapshot(snapshot)
```

A primeira declaração de importação 2. A segunda aumenta `CacheError`com`profile_mismatch`Uma série de versões mudou e a imagem inteira é recusada.

### Lab D: quebrar a cadeia

```python
unknown_id = [u for u, r in ledger.unknowns.items() if r[-1]["status"] == "investigating"][0]
ledger.verify_unknown_chain(unknown_id)
ledger.unknowns[unknown_id][0]["severity"] = "critical"
ledger.verify_unknown_chain(unknown_id)
```

A primeira chamada retorna, a segunda aumenta.`EvidenceIntegrityError`, porque a revisão 1 não corresponde mais ao seu próprio digest e a revisão 2 indica um digest que já não existe.

## Laboratório de Prática

Feche o desconhecido aberto e adicione um segundo provedor.

Requisitos:

- Extensão`run_grid()`Então, as nove entradas faltantes da reivindicação de intervalo são executadas, então confirme os movimentos desconhecidos para `resolved`na revisão 3.
- Adicionar`llvm-objdump -d`como segundo fornecedor com o seu próprio `provider`objecto e registar a sua lista de `grade`Como `observed`- Não .
- Escreva um`derived`Um registro que indica as duas listas, Ghidra e llvm-objdump, decodifica as mesmas 14 instruções e liga as duas.
- Abre um desconhecido para `grade_label(105)`com severidade `high`, já que o índice da tabela 4 diz `labels[4]`, e resolvê-lo com uma corrida.
- Exportar o livro de conta com `export_bundle()`Importá-lo num novo livro e provar que cada cadeia ainda verifica.

O sucesso significa um relatório em que cada frase cita um ID do pacote e o único`unknown`A reivindicação desapareceu.

## Laboratório de graduação

Cinco perguntas sobre os dispositivos desta lição.`code/lab_answers.json`Escrever números como números ou como cadeias hexáceas como `"0x40"`, e listas como listas JSON.

1. `t1`: o ID de prova que a computação_evidência_id dá para rea-evidência-grade.json.
2. `t2`: o número de limitações no registo de notas.
3. `t3`O nível de cobertura da nota é o seguinte:
4. `t4`A confiança e a autoridade do registo de notação, como uma lista de duas cordas.
5. `t5`: o SHA-256 do objecto do registo de nota.

Verifique as suas respostas:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/lab.py
npx tsx code/lab.ts
```

O verificador calcula cada valor esperado a partir de `code/main.py`- O que é que é?`PASS`- Não .`FAIL`ou `TODO`Para cada tarefa e uma pontuação, e sai de 0 apenas quando os cinco passarem. `python3 code/lab.py my-answers.json`Verifica outro ficheiro.`code/tests/test_lab.py`prova que o verificador aceita as respostas certas e rejeita as erradas.

### Veja como corre.

O [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?symbols=off)A máquina mantém um livro de evidências com quatro bandejas: observado, derivado, inferido e desconhecido. Este link abre a execução com a tabela de símbolos desligada, de modo que o nome e o fim do arquivo da função são desconhecidos e os arquivos de início são inferidos.

## Lição Artifacto

Esta lição produz`outputs/skill-evidence-ledger.md`Diz ao agente como escrever cada descoberta como um registro com confiança, autoridade, limitações e links.`pass`- Não .`fail`- Não .`unknown`, ou `unsupported`- Não .

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Os 28 testes provam:

- ambas rea `evidence_id`valores, o perfil e ambos os instantâneos `query_id`Valores recomputados a partir do conteúdo
- Um caminho alterado mantém a identificação e uma limitação alterada muda-a
- um registro alterado, um fornecedor de perfil incompatível, um float e um valor enum desconhecido são rejeitados
- um registro duplicado de devolução `duplicate`, um recorde conflituoso aumenta, e uma importação de pacote é atômica
- as importações de lote de corrida registadas com 18 registos e sem ligações penduradas
- Um desconhecido abre na revisão 1, recusa uma obsoleta `expected_revision`, e resolve apenas com observado `controlled-replay`Evidências
- Uma revisão editada quebra a cadeia
- A promoção recusa evidências inferidas, derivadas, vazias e não relacionadas e passa com um acordo
- A cobertura parcial é `unknown`e uma corrida discordante é `fail`
- O cache atinge a chave exata e perde outros parâmetros
- O cache recusa uma versão de perfil com problemas, um alvo errado, uma versão de formato errado e uma chave alterada
- O leitor do ELF concorda com `llvm-objdump`sobre compensações, tamanhos, bytes e realocações, e a tabela diz `1, 2, 3, 4, 4`
- As previsões usam divisão C, e as corridas gravadas concordam com todas as 17 reivindicações de entrada única
- Com um compilador presente, as corridas ao vivo concordam também

## Modos de falha de produção

| Failure | What the weak report says | What the ledger requires |
|---|---|---|
| Pseudocode read as behaviour | "grade returns 0 for failing scores" | an `execute_function` record for that input, or `unsupported` |
| Decompiler signature trusted | "percent_change returns 16 bytes" | the signature marked as the provider's inference with its `low` confidence |
| Empty list read as absence | "the function has no callers" | an `unknown` status, or a coverage field when the tool provides one |
| Path hashed into the id | "the record changed" after a copy | the semantic projection without `name` and `local_path` |
| Limitation dropped from a copy | a record that looks stronger than the source | id mismatch and rejection on import |
| Partial grid rounded up | "all scores from 90 pass" | `unknown` with `covered` 2 of 11 |
| Host run presented as the object's run | "the x86-64 object returned 25" | the host-build limitation carried on the claim |
| Unknown closed by a sentence | "resolved, see above" | a `verified` resolution with observed ids of the required authority |
| Stale revision overwritten | two analysts' edits collide | `revision-conflict` and a reread |
| Old snapshot replayed after a release | answers from a changed contract | `profile_mismatch` on import |
| Cache kept after a rename | a replay that hides a metadata write | invalidation before dispatch and a failed export |

## Regra de funcionamento

Registre o que você leu, o que calculou e o que espera como três tipos de registro com três palavras. Feche um desconhecido com um id, nunca com uma frase. Reproduzir uma resposta apenas sob a chave exata com que foi armazenada, e recusar quando uma cadeia de versões difere.

## Mais leitura

- [rea 6.5.0 source, `src/domain/evidence.ts` and `src/domain/residualUnknown.ts`](https://github.com/morluto/rea)
- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Agent Failure Patterns in CTF Reverse Engineering, NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)
- [When Binaries Talk Back: Representation-Confusion Attacks on LLM-Assisted Reverse Engineering, arXiv 2607.12507](https://arxiv.org/abs/2607.12507)
- [Agentic decompilation study, arXiv 2606.06838](https://arxiv.org/abs/2606.06838)
- [When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370](https://arxiv.org/abs/2609.05370)
- rea 6.5.0 fonte em tag `3b79af2`que esta lição descreve: `src/domain/evidence.ts`- Não .`.agents/skills/reverse-engineer-anything/SKILL.md`- Não .`docs/cli.md`- Não .`src/domain/reconstructionVerification.ts`- Não .`src/application/ReconstructionObligationCandidates.ts`- Não .`docs/tool-design.md`- Não .`src/domain/evidenceCompletionLedger.ts`- Não .`src/domain/residualUnknown.ts`- Não .`src/application/investigation/UnknownEvidence.ts`- Não .`.agents/skills/reverse-engineer-anything/references/evidence-workflows.md`- Não .`src/application/binary/AnalysisSnapshotCache.ts`- Não .`src/domain/analysisSnapshot.ts`- Não .`src/application/binary/BinarySession.ts`- Não .`src/application/binary/BinarySessionRecords.ts`- Não .`docs/mcp-contracts.md`- Não .
