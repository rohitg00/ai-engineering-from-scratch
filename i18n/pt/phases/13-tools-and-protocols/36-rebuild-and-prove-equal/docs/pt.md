# Reconstruir e provar iguais: testes diferenciais, comparação de bytes e o ciclo de evidências

> Passar os testes prova concordância com os testes, por isso a igualdade precisa de uma grade que atinja todas as bordas e bytes que correspondem após a mascaragem da realocação.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 34 (lifting to pseudocode), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~110 minutes

## Objetivos de aprendizagem

- Escreva uma reconstrução da lista de instruções e nomeie o registro de evidências de onde veio.
- Construir uma grade de entrada com uma classe por perigo: zero de proteção, valores negativos, divisão truncada, sobreflow de 32 bits e uma armadilha de divisão.
- Execute o original e a reconstrução num programa e grava todas as células, incluindo uma armadilha.
- Recomplicar a reconstrução com as bandeiras originais e comparar bytes de função após mascarar campos de realocação.
- Leia as constantes que um relocação aponta e compare-as, para que um literal errado não possa passar.
- Descarrega o servidor MCP da rea de um pequeno cliente de estúdio e grava cada passo com a identificação da prova.
- Crie um registro de prova fechado com falha cuja identidade é um hash sobre as suas alegações e links de evidências.

## O problema

Pediu ao rea o dossier de funções de`percent_change`em nosso`ledger-x86_64-O1.o`Ghidra 12.1.4 devolveu pseudocód, e o agente escreveu este C a partir dele:

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
```

Passam quatro testes:`(100, 150)`dá 50, `(200, 100)`dá -50, `(0, 5)`dá 0, `(50, 100)`O agente também foi reconstruído.`grade`Como quatro `if`O relatório diz que foi verificado.

Esse relatório não responde a nenhuma das seguintes perguntas:

- O que é que o original volta quando `(after - before) * 100`Não cabe em 32 bits?
- O que é que a versão original retorna para uma pontuação de 110?
- A reconstrução compila-se para os mesmos 16 bytes que o original?
- Quando duas funções compiladas têm os mesmos bytes, as suas realocações apontam para as mesmas constantes?
- De que registro provém a reconstrução e o agente leu a listagem ou o pseudocódio?
- Que status a prova obtém em um host sem um compilador C?

Cada alvo nesta lição é um programa que escrevemos e compilamos.

```figure
re-36-prove-equal
```

## O que as evidências dizem

O agente de loop em `code/main.py`Fiz seis chamadas para rea 6.5.0 no estúdio.`code/fixtures/runs/agent-run.json`O servidor respondeu .`initialize`com versão de protocolo `2025-11-25`Três chamadas devolveram registos de evidências:

| Step | Tool | Time | Evidence id |
|---|---|---|---|
| 2 | `analyze_function percent_change` | 6.31 s | `ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd` |
| 3 | `analyze_function grade` | 0.02 s | `ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1` |
| 4 | `read_bytes 0x1000b4, 20` | 0.00 s | `ev_c26146cfedf4c1ee146d8ff00cfa9a5d3f5335bdd9c97ccf4e1af5f6ea3ed6bc` |

A primeira chamada pagou pela importação e auto-análise da Ghidra.`confidence: "observed"`- Não .`authority: "shipped-artifact"`, e o SHA-256 do objeto,`9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f`Ghidra carrega o objeto realojável com `.text`- Não .`0x100000`- Então ...`percent_change`- Está sentado em`0x100000`E ...`grade`- Não .`0x100010`- Não .

O pseudcódigo para `percent_change`É onde o `long`provenientes de:

```c
undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)
{
  long lVar1;
  undefined1 auVar3 [16];
  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
    auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
    return auVar3;
  }
  ...
}
```

O decompiler viu .`cltd`E ...`idivl`Escrever os dois .`edx`E ...`eax`E modelado um valor de retorno de 16 bytes com uma divisão de 64 bits.

```
0x100000: TEST EDI, EDI
0x100002: JZ 0x0010000d
0x100004: SUB ESI, EDI
0x100006: IMUL EAX, ESI, 0x64
0x100009: CDQ
0x10000a: IDIV EDI
0x10000c: RET
0x10000d: XOR EAX, EAX
0x10000f: RET
```

Cada operação tem 32 bits de largura.`IMUL EAX, ESI, 0x64`multiplicado em 32 bits e mantém a metade baixa. `CDQ`- extensão de sinais`eax`em`edx`, e `IDIV EDI`Divide o par de 64 bits por um divisor de 32 bits.`100 * (after - before) / before`em `int`- Não .

O `grade`O pseudocódio chama uma tabela,`*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)`, e uma expressão padrão ilegível construída a partir de `0x66666667`A lista mostra a divisão por 10 como `IMUL RAX, RAX, 0x66666667`- Não .`SAR RCX, 0x22`- Não .`SHR RAX, 0x3f`- Não .`ADD ECX, EAX`Então ...`ADD ECX, -0x6`- Não .`CMP ECX, 0x4`, e `JA`Mantém dez de 6 a 10.`XOR EAX, EAX`antes da comparação é o padrão de 0. `LEA RCX, [0x1000b4]`E ...`MOV EAX, dword ptr [RCX + RAX*0x4]`ler uma tabela de cinco entradas de 4 bytes.

Passo 4 ler esses 20 bytes: `01000000 02000000 03000000 04000000 04000000`A mesa é...`1, 2, 3, 4, 4`para dez, 6, 7, 8, 9, 10. Isso é o `switch`em `ledger.c`, com `case 10`E ...`case 9`Partilha do valor 4.

As duas provas nas páginas de provas da rea começaram na lista e em`read_bytes`O primeiro pseudocódio da bola DX foi`FUN_00406400(void)`Não há entrada de pilha, e a visão de instruções corrigiu.

## Escreva os candidatos

A pasta `code/fixtures/candidates/`O sistema de correção de dados é um sistema de correção de dados que possui oito reconstruções, uma função por arquivo.

| File | Source | What it does |
|---|---|---|
| `percent_change_mul_first.c` | `100 * (after - before) / before` | the listing in C |
| `percent_change_split.c` | `(after * 100 - before * 100) / before` | different text, same bytes after clang folds it |
| `percent_change_wide.c` | `(int)(((long)after - before) * 100 / before)` | the pseudocode's `long`, divides before it wraps |
| `percent_change_div_first.c` | `(after - before) / before * 100` | divides first, so rounding differs |
| `grade_switch.c` | `switch (score / 10)` with the five cases | the original source |
| `grade_table.c` | `unsigned slot = score / 10 - 6; slot < 5 ? points[slot] : 0` | the listing in C |
| `grade_thresholds.c` | `if (score >= 90) return 4; ...` | no upper bound on the top band |
| `grade_case10_wrong.c` | `case 10: return 3;` | one table entry wrong |

Cada arquivo compila com o comando de fixação, `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`Os objetos compilados são feitos ao lado das fontes para que os testes sejam executados em um host sem clang.

## 1a Perna: Execução e comparação

A definição de McKeeman de 1998 de testes diferenciais requer "dois ou mais sistemas comparáveis" alimentados "casos de teste gerados mecanicamente", e trata um resultado diferente, uma colisão ou uma queda como um candidato a bug. Ele nomeou a parte difícil: "O problema mais feio no teste é avaliar o resultado de um teste". A função original é o oráculo aqui. Não precisamos de saber a resposta certa. Precisamos do original e da reconstrução para discordar em nenhum lugar numa rede que atinja todos os perigos.

### Desenhar a grade

`input_grid()`em `code/main.py`construi 92 células.`percent_change`É preciso cada par de dez .`before`valores e sete `after`Valores:

```
before: 0, 1, -1, 3, -3, 7, 100, -100, 2147483647, -2147483648
after:  0, 5, -5, 105, 536870911, 2147483647, -2147483648
```

Para o`grade`É preciso 22 pontuações: ambos os lados de cada banda, negativos, 0, 110, e os dois `int`Limitações.`classify()`O Overflow tem 32 células, negativo 17, limite 14, plano 12 e guarda zero 7. Truncation negativa tem 5, redondeamento 2, além do interruptor 2, e armadilha 1.

Cada classe existe por uma razão.`TEST EDI, EDI`As células negativas verificam a divisão truncadora: C e `idiv`Rondado em direcção a zero, então `-9 / 10`é 0 e `-10 / 10`é -1. células redondas verificar que a multiplicação acontece antes da divisão, então `(105 - 100) * 100 / 100`O fluxo de fluxo excede o fluxo de fluxo de fluxo.`(after - before) * 100`A única célula de armadilha torna o produto embalado igual.`INT_MIN`com`before`igual a -1.

Yang, Chen, Eide e Regehr construíram Csmith para gerar programas sem comportamento indefinido. Uma desacordo do oráculo sobre comportamento indefinido é ruído e nunca um relatório de bug. O fluxo assinado é indefinido em C. Nosso oráculo é um objeto compilado com um comportamento fixo, então as células de fluxo estão no escopo. A lição é saber quais células repousam no padrão e quais repousam nos bytes compilados.

### O condutor e a armadilha

`code/driver.c`lê uma célula por linha do stdin e imprime as entradas, o resultado original e o resultado da reconstrução. `build_harness()`compõe o candidato com `-Dpercent_change=cand_percent_change -Dgrade=cand_grade`Em um host x86-64 Linux, o original é o próprio objeto fixado. Em qualquer outro host é`ledger.c`Compilado de forma nativa e registos do relatório `original_kind: fixture-source`- Não .

O motorista instala um `SIGFPE`- O que é ?`sigsetjmp`E ...`siglongjmp`- Para o ...`before = -1`E ...`after = 536870911`, a diferença é 536870912 e o produto de 32 bits envolve para -2147483648.`idiv`Com esse dividendo e um divisor de -1 aumenta a exceção de erro de divisão. O coeficiente não se encaixa em 32 bits (Intel SDM Volume 2, IDIV).`trap`- Não .

No AArch64, `sdiv`O oráculo depende da arquitetura, e o relatório diz qual foi executado.

### Resultados

`prove_behaviour(PLAUSIBLE)`construi o `long`Os dez casos ingênuos passam, a grade falha em 28 células:

| Function | Inputs | Class | Original | Rebuild |
|---|---|---|---|---|
| `percent_change` | 3, 2147483647 | overflow | -133 | -1431655899 |
| `percent_change` | 100, 2147483647 | overflow | -101 | 2147483547 |
| `percent_change` | 2147483647, 5 | overflow | 0 | -99 |
| `grade` | 110 | beyond the switch | 0 | 4 |
| `grade` | 2147483647 | beyond the switch | 0 | 4 |

Todos os 26 .`percent_change`falhas são células de sobreflow com `|before| > 1`- Para o ...`before`igual a 1 ou -1 o coeficiente de 64 bits truncado de volta ao valor envolto, de modo que essas células concordam por acaso.`grade`falha porque o interruptor original não tem motivo para dezenas de 11 e acima, e `110 / 10`É 11.

`prove_behaviour(EQUAL)`construi .`percent_change_mul_first.c`E ...`grade_switch.c`Todas as 92 células concordam.`percent_change_div_first.c`falha em dois dos quatro casos ingênuos, que é o único caso que um teste escrito à mão encontra.

`oracle_disagreements()`Verifica uma segunda coisa.`percent_change_model()`E ...`grade_model()`são modelos Python da lista, com `wrap32()`para o multiplicar de 32 bits e `idiv32()`O relatório compara o modelo com o original observado em cada célula. Zero discordâncias significa que o modelo e o binário concordam em cada célula. O modelo é evidência derivada e a corrida é evidência observada. O relatório mantém-os em campos separados.

## Segunda perna: Recompile e compare

Comportamento em uma grade é uma perna. A segunda perna pergunta se a reconstrução, compilada com o mesmo compilador e bandeiras, produz os mesmos bytes. O projeto DX-Ball relatou "63 bytes correspondentes" para seu ajudante. O projeto TH04 relatou uma correspondência de 2.139 bytes. Cada um usou o compilador de seu próprio período. rea não pode fazer isso.`compare_functions`O texto do fornecedor de line-diffs e anexa a limitação "Assembleia é texto opaco do fornecedor; normalização de realocação não está disponível".

### Leia o objeto

`ElfObject`em `code/main.py`lê um objeto ELF64 realojável com `struct.unpack_from`Verifica a magia, a classe de 64 bits, dados de pequeno endio,`e_machine`62, e `e_type`1. Depois, ele anda os cabeçalhos da secção, a tabela de cordas,`.symtab`, e cada `.rela`Seção.`percent_change`Começa em`.text`O valor de compensação 0 com tamanho 16 e `grade`- Não .`0x10`com tamanho 46. `total`Começa em`0x40`com tamanho 31 e `grade_label`- Não .`0x60`com tamanho 63.

Os 16 bytes de `percent_change`são`85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`A função não tem realocações.`grade`tem um: offset `0x26`dentro da função, tipo `R_X86_64_PC32`, símbolo`.rodata`, adição`0x10`- É do 7 bytes .`leaq`em compensação`0x23`, cujos últimos quatro bytes são o campo de deslocamento.

### Mascar, depois compare os registos

Em um objeto RELA o adendo vive no registro de realocação, e os quatro bytes de campo são zero.`grade_switch.o`Uma simples byte comparar passa enquanto as duas mudanças nomeam lugares diferentes. `mask_relocations()`O campo de campo é igual a zero em ambos os lados, então o mesmo método é válido para objetos REL e para Mach-O, onde o campo carrega o adendo.

Então ...`prove_bytes()`Comparar os registros de realocação por secção de offset, tipo e meta.`.rodata+0x10`E o candidato diz:`.rodata-0x4`O adendo é diferente porque o objeto candidato não tem`labels.rel`Uma adição diferente é um deslocamento diferente, não uma função diferente.

### Leia as constantes os pontos de realocação em

Para um campo relacionado ao PC que termina sua instrução, a CPU adiciona o próximo endereço de instrução, então o alvo é símbolo mais adição mais 4.`.rodata+0x14`, e no candidato é .`.rodata+0x0`- Não .`read_table()`Aqui, há cinco entradas de 4 bytes.`1, 2, 3, 4, 4`- Não .

A contagem cinco vem da lista:`CMP ECX, 0x4`com`JA`admite índices 0 a 4, e `[RCX + RAX*0x4]`lê 4 bytes por índice. `CLAIMS`em `code/main.py`registos que se formam para `grade`e registos de zero realocações para `percent_change`- Não .

Esta etapa existe devido a um bug documentado pelo projeto TH08. A sua comparação mais antiga "reproduzia o endereço-alvo no campo de realocação da instrução, em seguida, comparou bytes de instrução sem verificar os dados flutuantes-literários nesse endereço. fonte `0.0`Assim , pode parecer exato contra o objectivo .`128.0`." A correcção verificou 1.548 referências flutuantes-literárias e corrigido mais doze. `grade_case10_wrong.c`O código de 46 bytes é igual ao original, o registro de realocação tem a mesma forma, e a sua tabela é`1, 2, 3, 4, 3`Só o cheque constante falha.

### Resultados

| Candidate | Size | Masked bytes | Relocation records | Table | Status |
|---|---|---|---|---|---|
| `percent_change_mul_first` | 16 vs 16 | equal | none | none | pass |
| `percent_change_split` | 16 vs 16 | equal | none | none | pass |
| `percent_change_wide` | 16 vs 26 | size differs | none | none | fail |
| `percent_change_div_first` | 16 vs 18 | size differs | none | none | fail |
| `grade_switch` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_table` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_thresholds` | 46 vs 39 | size differs | 1 vs 0 | none | fail |
| `grade_case10_wrong` | 46 vs 46 | equal | same shape | `1,2,3,4,4` vs `1,2,3,4,3` | fail |

Dois resultados merecem uma segunda olhada.`percent_change_split.c`tem texto de origem diferente e bytes idênticos, porque o clang trata o transbordamento assinado como indefinido e dobra `after * 100 - before * 100`em um multiplicar.`grade_table.c`também corresponde byte por byte, então o compilador chegou à mesma tabela a partir de um índice de matriz e de um `switch`Uma correspondência de byte prova que este compilador, com estas bandeiras, produziu o mesmo código do candidato.

O tamanho é um diagnóstico e não uma aceitação. As páginas de evidências da rea registam um candidato de 1.825 bytes com o comprimento certo e 467 bytes diferentes.`wide`reconstruir é 26 bytes porque `movslq`- Não .`imulq`- Não .`cqto`, e `idivq`A lista tinha-nos dito a largura antes de qualquer compilação.

## O Agente Loop Over rea

65 das ferramentas MCP da rea não têm comando CLI, e `verify_reconstruction`É um deles.`McpStdioClient`em `code/main.py`É o menor cliente que chega até eles.`npx -y rea-agents@6.5.0 mcp`, escreve uma solicitação JSON-RPC por linha para stdin, e lê um objeto JSON por linha de stdout em um thread. Envia `initialize`com versão de protocolo `2025-11-25`, então`notifications/initialized`, então`tools/call`O prazo de devida por chamada é de 330 s, o mesmo número que permite um arranque a frio da Ghidra.

`agent_loop()`Faz as seis chamadas e grava cada uma:

```json
{
  "step": 2,
  "tool": "analyze_function",
  "arguments": {"procedure": "percent_change"},
  "seconds": 6.31,
  "is_error": false,
  "evidence_id": "ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd",
  "confidence": "observed",
  "authority": "shipped-artifact",
  "limitations": ["Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals.", "..."],
  "result_sha256": "..."
}
```

Os registos completos da Evidência são armazenados sob os seus identificadores no mesmo arquivo.`table_address()`encontra o `LEA`O operand no `grade`lista e alimenta-o para `read_bytes`- Não .`open_binary`- Não .`get_evidence_bundle`, e `close_binary`Não retornará nenhum registro de provas e será registrado com um ID nulo.

`run_agent(live=True)`- quando`npx`Está no caminho e `GHIDRA_INSTALL_DIR`O teste é um passo mais adiante.`code/tests/fake_rea_server.py`é um servidor alternativo que responde a cada `tools/call`O cliente e o loop são controlados em cada teste, sem rea, Ghidra ou Java instalados.

### O que o verificador da rea pode e não pode dizer

rea's `verify_reconstruction`A prova e os retornos passam, falham ou são desconhecidos por reivindicação. Sua limitação fixa diz: "Pass significa cada reivindicação declarada aprovada; não estabelece equivalência global de implementação". Uma reivindicação sobre uma função compara o texto do provedor de `compare_functions`Uma alegação comportamental compara duas capturas de processos registadas de `compare_process_captures`Quando um registro de origem tem cobertura incompleta de chamadas, uma alegação sobre chamadas é `unknown`Nada dentro do rea compila uma função reconstruída ou executa-a sobre a sua rede de entrada.

O livro de obrigações da rea espera um registro de prova com `predicate_type: "rea.reconstruction-proof"`- Não .`operation: "verify_reconstruction_obligations"`- Não .`confidence: "observed"`, e `normalized_result.passed === true`Nenhuma ferramenta pública emite um.`build_proof()`em `code/main.py`- A minar:

```json
{
  "predicate_type": "rea.reconstruction-proof",
  "operation": "verify_reconstruction_obligations",
  "confidence": "observed",
  "authority": "controlled-replay",
  "normalized_result": {
    "passed": true,
    "status": "pass",
    "claims": [
      {"claim_id": "percent_change.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "percent_change.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "grade.referenced-constants", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]}
    ]
  },
  "evidence_links": ["ev_e88b10dc...", "ev_67b6d3f9..."],
  "evidence_id": "ev_..."
}
```

O ID é`ev_`Mais o SHA-256 do registro sem o ID, através de chave ordenada JSON compacto. `aggregate()`é fechado em caso de falha: `fail`Ganha, então.`unknown`, e uma lista de reivindicações vazia é `unknown`Em um host sem compilador C , as duas alegações de comportamento são`unknown`, o registro diz`unknown`Mesmo quando ambas as reivindicações de byte passarem. `authority`É o que é`controlled-replay`, porque a prova vem do nosso próprio arame e não do único ficheiro do objeto.

## O que a pesquisa diz

Liu, Raff e Micinski mediram oito sistemas de descompilação em nove configurações em 2026. Os candidatos que passaram em cada teste que o índice de referência inclui ainda divergiram em entradas de fuzz. A taxa foi de 4,9 por cento no geral e até 13 por cento para um sistema. Em 300 funções de biblioteca do GitHub e 287 funções baseadas em CVE, o modelo de refinamento mais forte aumentou a taxa de construção do Ghidra de 75% para 90%. Nas mesmas funções, a taxa de correspondência comportamental caiu de 74% para 62%. Eles rastrearam a causa para campos inventados, tipos, callees e guardas que substituíram os desconhecidos visíveis que um decompiler tradicional deixa para trás.

O nosso .`percent_change_wide.c`O pseudocódio ofereceu uma forma de`long`O novo modelo foi desenvolvido em uma série de unidades de controle de dados, que foram desenvolvidas em uma série de testes, que foram realizadas em uma série de testes, que foram realizados em uma série de testes, que foram realizados em uma série de testes, que foram realizados em uma série de testes, que foram realizados em dez unidades de controle de dados, e que não foram realizados em 26 células de sobrevoo.

DecompileBench mediu 23.400 funções de 130 programas reais. Ele descobriu que os métodos LLM 52,2% menos na corretão de funcionalidade do que os decompiladores industriais, com pontuações de compreensão mais altas.

As três provas que o campo usa são as três pernas que você pode construir. Phoenix e DREAM recompilam a saída e executam os testes do programa original. McKeeman e Csmith executam entradas geradas contra o original com entradas mantidas dentro de comportamento definido. Ramos e Engler verificam duas funções C com execução simbólica limitada, o que prova a igualdade em todos os caminhos explorados até um tamanho de entrada. Esta lição constrói as duas primeiras. A terceira é o laboratório de prática no livro de evidências da lição 35, quando uma grade é pequena demais para confiar.

## Construí-lo

- O arame da biblioteca padrão:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
```

Com o clang no caminho, a demonstração compila os dois pares de candidatos e executa 92 células para cada um.`unknown`- Não .

Forma esperada em um arm64 Mac:

```json
{
  "host": "aarch64 Darwin",
  "originalKind": "fixture-source",
  "gridCells": 92,
  "plausible": {"naivePassed": true, "gridMismatches": 28, "oracleDisagreements": 0},
  "equal": {"naivePassed": true, "gridMismatches": 0, "oracleDisagreements": 0},
  "legTwo": {
    "percent_change_mul_first": {"status": "pass", "reasons": []},
    "percent_change_wide": {"status": "fail", "reasons": ["size 16 vs 26 bytes"]},
    "grade_case10_wrong": {"status": "fail", "reasons": ["referenced constants differ: [1, 2, 3, 4, 4] vs [1, 2, 3, 4, 3]"]}
  },
  "agentRun": {"mode": "replayed fixture", "server": {"name": "rea", "version": "6.5.0", "protocolVersion": "2025-11-25"}},
  "proof": {"status": "pass", "evidence_id": "ev_..."}
}
```

Leia `code/main.py`na ordem seguinte:

1. `wrap32()`- Não .`c_div()`- Não .`idiv32()`, e os dois .`*_model()`As funções possuem a semântica inteira da listagem.
2. `input_grid()`E ...`classify()`construir e marcar as células 92.
3. `build_harness()`E ...`execute()`compilar um programa do original, os candidatos renomeados, e `driver.c`, depois, executar as células.
4. `prove_behaviour()`Retorna o relatório de primeira linha com desajustes e desacordos de modelo.
5. `ElfObject`lê cabeçalhos, símbolos e `.rela`Registros.`mask_relocations()`E ...`read_table()`Preparar a comparação.
6. `prove_bytes()`Retorna o relatório de dois pés com tamanhos, intervalos mascarados, forma de realocação e tabelas.
7. `McpStdioClient`E ...`agent_loop()`- A condução real e a gravação de cada passo.
8. `build_proof()`E ...`aggregate()`- O registro não fechado.

## Usá-lo

Para provar que uma nova função é igual, repita estes passos:

1. Traga-me .`analyze_function`Para a função e registar a identificação da prova.
2. Escreva o candidato a partir das largura de operação da listagem.
3. Lista todas as vezes, adicionar, subtrair e dividir na listagem. Adicione entradas de grade que envolvem cada uma em sua largura.
4. Adicione ambos os lados de cada constante de comparação na lista.`grade`São 6 e 4 depois da subtração.
5. Adicione todos os divisores que podem atrapalhar o alvo e registre qual arquitetura executou a grade.
6. Corra as duas pernas e leia as razões antes do status.
7. Mantenha o registro da prova ao lado do candidato.`evidence_links`Diga ao leitor sobre qual registo se baseia a reivindicação.

Rereuse ambas as pernas após qualquer atualização do compilador. Uma correspondência de byte é uma declaração sobre um compilador com um conjunto de bandeiras.

## Laboratório Interativo

### Laboratório A: o modelo e a execução

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code
python3 -q
```

- Correr .

```python
from main import *
percent_change_model(3, INT_MAX)
percent_change_model(-1, 536870911, "x86_64")
percent_change_model(-1, 536870911, "aarch64")
report = prove_behaviour(PLAUSIBLE)
report.naive_passed, len(report.mismatches), report.mismatches[0]
```

A primeira chamada dá -133, o produto embalado dividido por 3. A segunda dá `'trap'`O relatório mostra que 10 casos ingênuos foram aprovados e 28 células de rede falharam.`report.oracle_disagreements`com uma lista vazia.

### Laboratório B: ler o objeto

```python
obj = ElfObject(ORIGINAL_OBJECT)
grade = obj.function("grade")
grade.size, grade.data[0x26:0x2a].hex(), grade.relocations
read_table(obj, grade.relocations[0], 5, 4)
```

Os bytes de campo são `00000000`Os nomes das realocações`.rodata`com adição`0x10`, e a mesa diz:`[1, 2, 3, 4, 4]`- Não .

### Laboratório C: quebrar uma constante

```python
report = prove_bytes("grade", CANDIDATES / "grade_case10_wrong.o")
report.masked_equal, report.relocations_match, report.tables_equal, report.reasons()
```

Os bytes coincidem, os registros coincidem e as tabelas não. Agora edite `grade_case10_wrong.c`Então ...`case 10`Retorna 4 novamente, recompile-o com o comando de fixação e veja o status mudar para `pass`- Não .

### Laboratório D: unidade rea

Com rea 6.5.0 e Ghidra 12.1.4 instaladas:

```bash
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
python3 code/main.py --live
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
npx tsx code/main.ts --live
```

O primeiro .`analyze_function`Ghidra importa o objeto. Compare os novos IDs de evidência com a execução comprometida. Os mesmos bytes sob o mesmo perfil de análise dão os mesmos IDs, porque o id é um hash de conteúdo que exclui o caminho do arquivo.

## Laboratório de Prática

Estender as duas pernas para `total`E ...`grade_label`do mesmo objeto.

Requisitos:

- Para o`total`Construa células com contagem 0, contagem negativa, um elemento e somas que se enrolam em 32 bits.
- Para o`grade_label`, a função chama`grade`em linha e lê `labels.rel`, uma tabela de cinco ofertas de cadeia relativas com as suas próprias realocações em `.rela.rodata`- Não .
- Adicionar um`CLAIMS`Entrada para `grade_label`com duas relocalizações e uma tabela de cinco entradas de 4 bytes, e comparar as cadeias que as entradas apontam para.
- Registrar quais células o modelo e a execução discordam, se houver, e explicar cada uma da listagem.
- Adicionar uma reivindicação por perna por função ao registro de prova e manter o agregado fechado.

O sucesso significa que o registro de prova enumera quatro funções, cada alegação carrega um ID de prova, e `grade_label`falha quando uma linha de rótulos difere.

## Laboratório de graduação

Cinco perguntas sobre os dispositivos desta lição.`code/lab_answers.json`Escrever números como números ou como cadeias hexáceas como `"0x40"`, e listas como listas JSON.

1. `t1`: percent_change_model(3, 105) em x86_64.
2. `t2`: percent_change_model(0, 5) em x86_64.
3. `t3`: grade_model(100).
4. `t4`: o número de células na input_grid().
5. `t5`: o número de células da grade onde o modelo x86_64 se encontra em armadilhas.

Verifique as suas respostas:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/lab.py
npx tsx code/lab.ts
```

O verificador calcula cada valor esperado a partir de `code/main.py`- O que é que é?`PASS`- Não .`FAIL`ou `TODO`Para cada tarefa e uma pontuação, e sai de 0 apenas quando os cinco passarem. `python3 code/lab.py my-answers.json`Verifica outro ficheiro.`code/tests/test_lab.py`prova que o verificador aceita as respostas certas e rejeita as erradas.

### Veja como corre.

O [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)Mas, como é verdade, a máquina termina com um pseudocódio e arquivou como inferido: a página não o prova.

## Habilidade de saída

Esta lição produz`outputs/skill-rebuild-and-prove-equal.md`. Utilize-o para transformar a evidência de função e a reconstrução de um candidato em uma prova de duas pernas e um registro de prova. A habilidade requer a listagem antes do pseudocódio, uma grade com cada classe de perigo, mascagem de realocação mais uma verificação constante e um agregado fechado em falha.

## Verifique

Execute a demonstração e a suite de testes:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Os 35 testes provam:

- `c_div()`Truncas para zero e `wrap32()`segue o complemento de dois
- O modelo dá -133 para `(3, INT_MAX)`- Não .`trap`para a célula de armadilha em x86-64 e -2147483648 em AArch64
- A grade tem 92 células e todas as classes de perigo, e os casos ingênuos evitam todas as classes duras.
- O leitor ELF encontra quatro funções nos offsets e tamanhos gravados
- `percent_change`é de 16 bytes sem realocações e `grade`Tem um .`R_X86_64_PC32`- Não .`0x26`
- Os bytes do campo de realocação são zero e a mascaragem não altera nada neste objeto RELA
- Os oito candidatos comprometidos atingem o status esperado, com as razões registadas
- `grade_case10_wrong`passa bytes mascarados e falha apenas o controle constante
- As corridas registradas para a perna 1 mostram dez passes ingênuos, 28 desatempedos e zero desentendimentos do modelo
- com um compilador, ambos os pares reconstruem e reiniciam com o mesmo resultado
- O agente executado destina-se ao objeto comprometido por SHA-256, em ordem, com `ev_`Identificação em cada etapa da prova
- O `read_bytes`registro é igual à tabela que o leitor ELF encontra
- O cliente dirige o servidor falso e registra as mesmas identidades de provas que a execução real
- Um resultado de erro do servidor entra no registro de execução
- `aggregate()`é fechado e o ID da prova recompõe do seu conteúdo

## Modos de falha de produção

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Rebuild keeps the decompiler's `long` | "ten tests pass" | 26 overflow cells differ from the original |
| Thresholds replace a switch | "every grade band passes" | 110 and larger return 0 in the original |
| Divide before multiply | "formula is algebraically equal" | rounding cells differ, naive cases fail |
| Trap cell skipped | "no crashes" | x86-64 raises `#DE`, AArch64 returns `INT_MIN`, the report names the host |
| Byte compare without masking | "bytes equal" | relocation records name different offsets |
| Masking without reading constants | "bytes equal after masking" | `1,2,3,4,3` differs from `1,2,3,4,4` |
| Size taken as acceptance | "same length" | differing bytes inside the same length |
| Different compiler or flags | "bytes differ, rebuild wrong" | the same source gives different bytes, so the compare is void |
| Model treated as observation | "model agrees" | the run is observed, the model is derived, disagreements are listed |
| Claim without evidence id | "verified" | every claim links an `ev_` record of the function it covers |
| No compiler on the CI host | "passed" | behaviour claims are `unknown` and the aggregate is `unknown` |
| Pseudocode read as source | "decompiler says long" | the listing shows `IMUL EAX`, `CDQ`, `IDIV EDI` |

## Regra de funcionamento

Escreva a reconstrução da listagem e nomeie o registro de que veio. Exerça-a contra o original em uma grade que envolve cada intermediário e cruza cada constante comparada. Recompilá-la com as bandeiras originais, masqueie os campos de realocação, compare os registros e leia as constantes que apontam para. Registre cada alegação com seu ID de evidência e deixe uma alegação não verificada permanecer desconhecida.

## Mais leitura

- [McKeeman, Differential Testing for Software, Digital Technical Journal 10(1), 1998](https://www.cs.tufts.edu/comp/150FP/archive/bill-mckeeman/DifferentailTesting.pdf)
- [Yang, Chen, Eide, Regehr, Finding and Understanding Bugs in C Compilers, PLDI 2011](https://doi.org/10.1145/1993498.1993532)
- [Ramos, Engler, Practical, Low-Effort Equivalence Verification of Real Code, CAV 2011](https://doi.org/10.1007/978-3-642-22110-1_55)
- [Schwartz, Lee, Woo, Brumley, Native x86 Decompilation Using Semantics-Preserving Structural Analysis, USENIX Security 2013](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Liu, Raff, Micinski, When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370, 2026](https://arxiv.org/abs/2609.05370)
- [Gao et al., DecompileBench, Findings of ACL 2025](https://aclanthology.org/2025.findings-acl.1194/)
- [Tan et al., LLM4Decompile, arXiv 2403.05286, 2024](https://arxiv.org/abs/2403.05286)
- [System V gABI, Chapter 4, Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)
- [x86-64 psABI repository, relocation types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, IDIV](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm Architecture Reference Manual for A-profile, DDI 0487, SDIV](https://developer.arm.com/documentation/ddi0487/latest)
- [rea 6.5.0 MCP contracts](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/mcp-contracts.md)
- [rea 6.5.0 reconstruction obligation ledgers](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/reconstruction-obligation-ledgers.md)
