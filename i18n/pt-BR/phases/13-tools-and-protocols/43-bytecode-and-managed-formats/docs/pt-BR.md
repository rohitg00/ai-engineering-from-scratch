# Além do código nativo: Python, JVM, .NET e WebAssembly Bytecode

> Um arquivo de código de byte é um programa mais as notas do compilador sobre isso, e esta lição constrói os leitores que mostram quais notas cada recipiente guarda.

**Type:** Build
**Languages:** Python, TypeScript, Java, C#, WebAssembly text
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow)
**Time:** ~150 minutes

## Objetivos de aprendizagem

- Leia o 16 bytes `.pyc`cabeçalho do PEP 552 e desmarca o objeto do código sem o `marshal`Modulo, para ficheiros escritos por quatro versões de intérprete.
- Parsear um arquivo de classe JVM a partir do JVMS Capítulo 4: pool constante, campos, métodos, o `Code`atributo, e as tabelas que `javac -g`- E acrescenta.
- Desmontar os códigos opcodes JVM em `Ledger.class`e provar a listagem contra`javap -c`Em quatro edifícios da mesma fonte.
- Leia um módulo WebAssembly secção por secção, decodifique cada corpo de função e prove o resultado contra `wasm-objdump -d`- Não .
- Passear os metadados ECMA-335 de um conjunto .NET do diretório de dados PE para o `MethodDef`As linhas e o CIL de cada método, verificados com base na biblioteca de leitores que a ILSpy utiliza.
- Medir, para uma função em cinco recipientes, quais nomes, tipos e estrutura de controle cada formato mantém e quais perdem.

## O problema

Construíste .`ledger.py`e encontrou`ledger.cpython-314.pyc`em `__pycache__`Perguntaste ao agente o que o ficheiro contém, o agente executou um decompiler.`Unsupported opcode`E uma linha que dizia:`# WARNING: Decompyle incomplete`O agente concluiu que o ficheiro foi obfuscado.

O arquivo não foi obfuscado.`2b 0e`O agente não leu o cabeçalho, por isso não conseguiu distinguir.

A lição 33 mostrou o que o código nativo perde: nomes de parâmetros, tipos e os`switch`que se tornou uma mesa de saltos. Os contêineres de código de byte perdem menos, e cada um perde algo diferente. Um pyc mantém todos os nomes variáveis e nenhum tipo. Um arquivo de classe guarda tipos e mantém nomes locais apenas quando você pede. Um módulo de Wassm mantém a estrutura de controle e deixa cair nomes, a menos que uma seção personalizada os carregue. Uma montagem .NET mantém nomes de parâmetros em uma tabela e deixa nomes locais em um arquivo separado. Não se pode julgar a saída de um decompiler em qualquer um deles até saber com que notas o recipiente teve que começar.

Esta lição cria quatro leitores na biblioteca padrão Python. Cada um lê o contêiner a partir de seu primeiro byte, lista uma função e é verificado contra a própria ferramenta do formato em fixtures que você construiu.`grade`de`ledger`lado a lado nos cinco recipientes.

```figure
re-43-five-containers
```

## O cabeçalho da pyc é de quatro palavras

O PEP 552 define o cabeçalho como quatro palavras de 32 bits. O primeiro é o número mágico. O segundo é um campo de bits. Set de bits 0 significa que o arquivo é baseado em hash. Set de bits 1 significa `check_source`Com bit 0 limpo, as palavras três e quatro são o mtime da fonte e o tamanho da fonte. Com bit 0 conjunto, eles possuem um SipHash de 64 bits da fonte.

O número mágico vive em`Include/internal/pycore_magic_number.h`A regra desde 3.11 é que o Python 3.n começa em 2900 + 50n, e cada alteração de código de byte dentro de um ciclo de liberação adiciona um. O token armazenado é o número de 16 bits seguido por `\r\n`Python 3.15.0 foi lançado em 2026-10-09 e não está instalado na máquina que construiu essas instalações, então seu número vem do arquivo de cabeçalho e não de um arquivo aqui.

Os aparelhos contêm dois ficheiros pyc por intérprete. `compile_pyc.py`Escreveu-as com `py_compile.compile(..., dfile="ledger.py")`para que o nome do arquivo armazenado seja `ledger.py`Os primeiros 16 bytes dos arquivos 3.14:

```text
checked-hash   2b 0e 0d 0a  03 00 00 00  c7 16 c7 fc c5 1d 81 01
timestamp      2b 0e 0d 0a  00 00 00 00  8d 60 cf 6a  f1 01 00 00
```

Leia o cabeçalho do timestamp palavra por palavra. `03 00 00 00`ou `00 00 00 00`É a palavra da bandeira.`8d 60 cf 6a`é 0x6acf608d = 1791975565, o mtime de `ledger.py`Quando o ficheiro foi criado. `f1 01 00 00`O arquivo de hash verificado tem bandeiras 3 e oito bytes hash em vez disso. Os quatro intérpretes concordam em tudo no cabeçalho exceto a palavra mágica:

| Interpreter | Magic bytes | Word | File bytes | `grade.co_code` bytes | `grade` instructions |
|---|---|---|---|---|---|
| 3.11.14 | `a7 0d 0d 0a` | 3495 | 1054 | 80 | 31 |
| 3.12.12 | `cb 0d 0d 0a` | 3531 | 937 | 62 | 26 |
| 3.13.12 | `f3 0d 0d 0a` | 3571 | 943 | 70 | 26 |
| 3.14.6 | `2b 0e 0d 0a` | 3627 | 965 | 96 | 35 |

`read_pyc_header()`em `code/main.py`Retorna estes campos e nomeia a versão da palavra. `importlib.util.MAGIC_NUMBER`dá os mesmos quatro bytes para o intérprete em execução. `python3 code/main.py compare`compila a fonte com cada `python3.11`- Não .`python3.15`Encontrado em`PATH`Para cada um, imprime o cabeçalho que o nosso leitor vê ao lado dos fatos que o intérprete relata sobre si mesmo.

## Marshal escreve o código Objeto Campo por Campo

O byte 16 de cada dispositivo é `e3`- Isso é .`0x80 | ord('c')`: o código de tipo marshal para um objeto de código com `FLAG_REF`conjunto, que diz ao leitor para lembrar o objeto para mais tarde `r`As referências. A documentação do Marshal diz que o formato é desdocumentado de propósito e que os objetos de código não são compatíveis entre as versões. Ambas as declarações são verdadeiras, e o formato ainda é pequeno o suficiente para ser lido. `Python/marshal.c`Enumera os códigos de tipo: `N`Nenhum.`i`um int de 32 bits, `s`bytes, `z`E ...`Z`Cartas curtas ASCII, `(`E ...`)`- Duplos,`c`um objeto de código, `r`Os contêineres reservam o seu espaço de referência antes dos filhos, para que o leitor faça o mesmo.

`w_complex_object()`escreve um objeto de código em ordem fixa. para 3.11 a 3.15 é`argcount`- Não .`posonlyargcount`- Não .`kwonlyargcount`- Não .`stacksize`- Não .`flags`como 32 bits de inches, então `code`- Não .`consts`- Não .`names`- Não .`localsplusnames`- Não .`localspluskinds`- Não .`filename`- Não .`name`- Não .`qualname`Como objetos, então `firstlineno`, então`linetable`E ...`exceptiontable`Decodificar o código do módulo objeto do arquivo 3.14 à mão a partir do byte 17:

```text
00 00 00 00   argcount 0
00 00 00 00   posonlyargcount 0
00 00 00 00   kwonlyargcount 0
01 00 00 00   stacksize 1
00 00 00 00   flags 0
f3 22 00 00 00   type 's' with FLAG_REF, 34 bytes of co_code follow
80 00  52 06  74 00  52 01  17 00  74 01 ...
```

Os bytes de código são dois por instrução: `80 00`É o que é`RESUME 0`- Não .`52 06`É o que é`LOAD_CONST 6`- Não .`74 00`É o que é`STORE_NAME 0`, e `17 00`É o que é`MAKE_FUNCTION`A lista 3.14 nas instalações imprime as mesmas cinco declarações de nível de módulo.`code`vêm as constantes, que contêm os quatro objectos de código aninhados, e depois deles `names`- Não .`('LABELS', 'percent_change', 'grade', 'total', 'grade_label')`- Não .

`Unmarshaller`em `code/main.py`Leia este layout e o mais antigo que 3.9 e 3.10 usaram, onde `nlocals`- Não .`varnames`- Não .`freevars`, e `cellvars`O que é que se passa?`CodeObject`com os mesmos nomes de atributos que o objeto real tem. `varnames`filtros`localsplusnames`por o `CO_FAST_LOCAL`Um pouco .`localspluskinds`- Para o ...`grade`Em cada um dos quatro arquivos que ele retorna .`('score', 'bucket')`- Não .`firstlineno`10 e um não vazio.`linetable`O teste .`test_unmarshaller_agrees_with_the_running_interpreter`compara cada campo com `marshal.loads()`Os outros três arquivos são legíveis pelo nosso código e não legíveis por`marshal`- Sob este intérprete.

## Quatro intérpretes, quatro bytecodes para classificação

A desdocumentação apresenta um aviso em cada versão: o bytecode é um detalhe de implementação do CPython e não há garantia de que ele permaneça o mesmo.`python3.1N -m dis ledger.py`Foi capturado para cada intérprete.

Em 3.11 `grade`Começa assim:

```text
 11           2 LOAD_FAST                0 (score)
              4 LOAD_CONST               1 (10)
              6 BINARY_OP                2 (//)
             10 STORE_FAST               1 (bucket)
 12          12 LOAD_FAST                1 (bucket)
             14 LOAD_CONST               2 (9)
             16 COMPARE_OP               5 (>=)
             22 POP_JUMP_FORWARD_IF_FALSE     2 (to 28)
```

`BINARY_OP`O segundo byte está localizado no offset 6 e a próxima instrução em 10. Os dois bytes entre eles são uma entrada de cache de PEP 659, o intérprete adaptativo especializado. `COMPARE_OP`O 16 é seguido por 22, por isso tem duas entradas no cache.`show_caches=True`. 3.12 substitui `LOAD_CONST`- E mais .`RETURN_VALUE`com`RETURN_CONST`, renomear o salto para `POP_JUMP_IF_FALSE`, e os psicólogos .`grade`De 80 a 62 bytes. 3,13 impressões de rótulos `L1`- Não .`L4`Em vez de compensar e dar o CLI `-C`para caches e `-O`para compensações. 3.14 remove `RETURN_CONST`- Mais uma vez, acrescenta.`LOAD_SMALL_INT`E ...`LOAD_FAST_BORROW`, e inserções `NOT_TAKEN`após cada salto condicional:

```text
 12         20       LOAD_FAST_BORROW         1 (bucket)
            22       LOAD_SMALL_INT           9
            24       COMPARE_OP             188 (bool(>=))
            26       CACHE                    0 (counter: 0)
            28       POP_JUMP_IF_FALSE        3 (to L1)
            30       CACHE                    0 (counter: 0)
            32       NOT_TAKEN
```

O `-C -O`listagem mostra 13 `CACHE`Entradas dentro `grade`- Cinco anos depois .`BINARY_OP`, um após o outro .`COMPARE_OP`, um após o outro .`POP_JUMP_IF_FALSE`O dispositivo adaptativo mostra para que são os caches.`dis.dis(grade, adaptive=True)`impressões digitais`RESUME_CHECK`E ...`COMPARE_OP_INT`onde a listagem simples tinha `RESUME`E ...`COMPARE_OP`, e `total`- Espetáculos`FOR_ITER_LIST`- Não .`BINARY_OP_ADD_INT`, e `JUMP_BACKWARD_NO_JIT`As formas especializadas vivem no mesmo`co_code`Uma pyc nunca as contém, porque a especialização acontece na memória.

É por isso que os decompiladores têm limites de versão. uncompyle6 3.9.3 diz que aceita código de byte de Python 1.0 a 3.8. decompyle3 3.9.3 lê 3.7 e 3.8. xdis 6.3.0, o desmonteador de versão cruzada por trás de ambos, lê até 3.13. pycdc tem tabelas de código optico até `python_3_13.cpp`no seu arquivo de construção, e em uma impressão de código op desconhecido `Unsupported opcode`PyLingual reivindica todas as versões lançadas desde 3.6 e usa intérpretes de 3.8 a 3.15 para recompilar e verificar sua própria saída. Para um arquivo 3.14 os três primeiros rejeitam ou falham, e apenas os dois últimos aplicam-se. Leia a palavra mágica antes de escolher uma ferramenta.

## O arquivo de classe mantém um dicionário próprio

O JVMS Java SE 25, secção 4.1, dá o layout como uma estrutura: `magic`- Não .`minor_version`- Não .`major_version`- Não .`constant_pool_count`, a piscina constante,`access_flags`- Não .`this_class`- Não .`super_class`Interfaces, campos, métodos, atributos.`0xCAFEBABE`Uma máquina virtual Java SE 25 aceita versões principais 45 a 69, e uma menor de 65535 marca um arquivo de pré-visualização.`Ledger-g.class`são`ca fe ba be 00 00 00 41 00 5e`: maior 65 é Java 21, e `0x5e`= 94 é o número constante de poças. `Ledger-jdk25.class`, construído por javac 25.0.2 a partir da mesma fonte, começa `ca fe ba be 00 00 00 45`- Major 69.

A piscina constante é onde o arquivo de classe mantém seu próprio dicionário.`#13`No`-g`construção é um `Methodref`que aponta para a classe `#8`e nome e tipo `#14`. Seguindo os índices dá `Ledger.grade:(I)I`, que é exatamente o que `javap -v`impressões digitais depois `//`O descriptor .`(I)I`É um .`int`Parâmetro e um `int`Resultado.`([I)I`- Não .`total`diz que o parâmetro é um `int`array. Cada método, campo e classe que o código toca tem tal entrada, e o verificador na seção 4.10 recusa um arquivo cujas instruções discordam com eles.`ClassFile`classe em `code/main.py`lê todas as 17 etiquetas constantes da tabela 4.4 e trata um `Long`ou `Double`Ele aumenta em uma etiqueta desconhecida e em bytes após o último atributo.

Atributos dependem da classe, cada campo, cada método e o `Code`JVMS diz que a máquina virtual deve ignorar atributos que não conhece, e é por isso que as tabelas de depuração podem ser adicionadas ou retiradas sem mudar um corpo de método.`-g`gera todas as informações de depuração, incluindo as variáveis locais, que o padrão gera números de linha e apenas o arquivo fonte, e que `-g:none`As três construem medidas que:

| Build | Bytes | Constant pool count | `LineNumberTable` | `LocalVariableTable` | `SourceFile` | `grade` code bytes |
|---|---|---|---|---|---|---|
| `javac -g` | 1832 | 94 | 7 methods | 6 methods | yes | 50 |
| `javac` | 1581 | 82 | 7 methods | none | yes | 50 |
| `javac -g:none` | 1404 | 79 | none | none | no | 50 |

Os 50 bytes de código de `grade`Os três arquivos são idênticos e o teste verifica-o.`-g`adiciona para `grade`É um .`LocalVariableTable`linha: início 0, comprimento 50, slot 0, nome `score`, descriptor `I`Sem ele , um decompiler vê o slot 0 de tipo .`int`E tem de inventar um nome.`StackMapTable`permanece em cada construção porque o verificador precisa dele, e o `BootstrapMethods`O atributo permanece porque `main`concatenar cordas através de `invokedynamic`- Não .

## Descifrar comutador de tabela de mão

O capítulo 6 do JVMS define cada instrução como um byte de opcode e os operandos que nomeam opcode.`tableswitch`E ...`lookupswitch`Comecem com 0 a 3 bytes de enchimento para que os operandos de 32 bits começem em um endereço que é um múltiplo de 4.

Os bytes de `grade`de pc 4 em `Ledger-g.class`- Não .

```text
aa                 tableswitch at pc 4
00 00 00           padding to pc 8
00 00 00 2c        default: 4 + 44 = 48
00 00 00 06        low 6
00 00 00 0a        high 10
00 00 00 2a        case 6:  4 + 42 = 46
00 00 00 28        case 7:  4 + 40 = 44
00 00 00 26        case 8:  4 + 38 = 42
00 00 00 24        case 9:  4 + 36 = 40
00 00 00 24        case 10: 4 + 36 = 40
```

Trinta e seis bytes, uma instrução e tudo.`switch (score / 10)`O processo de construção do mesmo.`switch`Na lição 33 precisava de um controlo de limites, um `lea`, a `movslq`, um `add`Aqui os alvos estão na instrução, e também o fato de que eles pertencem juntos.

`disassemble_jvm()`abrange todos os 202 códigos opcodes definidos com as suas largura de operand, segue a regra do empolgação e torna operands o caminho `javap`- Não.`compare_with_javap()`Parse os capturados .`javap -c -p`texto, incluindo o texto multilínea `tableswitch`O teste é feito com a utilização de um bloco de comando, e verifica a compensação, a mnemônica e o operando para cada instrução.`test_branch_offsets_are_relative_to_the_branch_instruction`Cheques`ifne`na pc 1 aterragem em 6, `if_icmpge`A 13 de aterragem no 33, e `goto`A 30 horas, aterrissando em 10.

O radar2 6.2.4, construído a partir da fonte para estas lições, lê o mesmo arquivo. `rabin2 -I`Relatórios `arch java`- Não .`lang java 21`- Não .`linenum true`, e `lsyms true`, que é a leitura da versão e das duas tabelas de depuração. `pd 14 @ sym.Ledger.grade`Imprima o `tableswitch`Com flechas para os seus cinco alvos.`Unable to parse code attribute: 2`O documento de informação é um documento que é um dos principais elementos de informação sobre o processo de elaboração de um documento.`javap`como o oráculo. Os decompiladores para este formato são maduros em comparação com o Python. CFR 0.152 é licenciado pelo MIT. Procyon 0.6.0 e Vineflower 1.12.0 são Apache-2.0, e Vineflower é um garfo Fernflower com suporte Java 21. Fernflower vive dentro do repositório da comunidade IntelliJ. O JADX 1.5.6 cobre o formato Android DEX, e o JD-GUI teve sua última versão em 2019. Harrand, Soto-Valero, Monperrus e Baudry mediram oito deles em 2020. A melhor produziu uma saída sintática correta para 84% das classes e semânticamente equivalente para 78%. O seu meta-descompiler recuperou 37,6% das classes que nenhuma ferramenta manteve. Tipos, nomes e pilhas verificadas tornam o formato decompilável. Não fazem um único decompiler completo.

## Um módulo de esgoto é uma lista de seções

A especificação central define um módulo como o preâmbulo `00 61 73 6d 01 00 00 00`, a corda .`\0asm`E versão 1, seguida de secções. Cada seção é um byte id, um `u32`Id 1 a 13 são as seções conhecidas, cada uma no máximo uma vez e em ordem. Id 0 é uma seção personalizada com um nome, permitido em qualquer lugar. Todos os números inteiros são LEB128, por isso `e4 00`é de 100 e `80 08`É 1024.`wasm-objdump -h`- Não .`ledger.wasm`O artigo 1.o do Tratado define sete secções e `WasmModule`encontra os mesmos sete com os mesmos deslocamentos de carga útil:

| Section | Payload | Count | What it holds for ledger |
|---|---|---|---|
| Type | 10 to 26 | 3 | `(i32) -> nil`, `(i32, i32) -> i32`, `(i32) -> i32` |
| Import | 28 to 39 | 1 | `env.log` with type 0 |
| Function | 41 to 46 | 4 | type index for each defined function |
| Memory | 48 to 51 | 1 | one page, no maximum |
| Export | 53 to 110 | 5 | `memory` and the four function names |
| Code | 113 to 271 | 4 | bodies of 23, 63, 44, and 23 bytes |
| Data | 273 to 290 | 1 | `F\0D\0C\0B\0A\0` at offset 1024 |

A divisão entre as seções Função e Código existe para que um navegador possa começar a compilar antes de o arquivo inteiro chegar.`grade`O vector local é `01 7f`: um grupo de um `i32`- Isso é .`bucket`, com o seu tipo e sem o seu nome.

O fluxo de controlo é estruturado por construção.`block`- Não .`loop`, ou `if`As etiquetas são indexadas por profundidade de nidificação. `br_table`O sistema de transferência de dados é um sistema de transferência de dados que permite a transferência de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados`grade`em arquivo de compensação `0xa3`- Não .

```text
0e                  br_table
0b                  11 labels follow
04 04 04 04 04 04   buckets 0 to 5: label 4, the outermost block, returns 0
03 02 01 00         buckets 6, 7, 8, 9: labels 3, 2, 1, 0
00                  bucket 10: label 0, shared with 9
04                  default label 4
```

Cada rótulo é uma profundidade.`block`, e o código após o seu`end`É o que é`i32.const 4`seguida por `br 4`O resultado é o número 6.`block`instruções diante da mesa, das onze etiquetas e das cinco `br`instruções depois de ser o todo `switch`, e um validador rejeita qualquer ramo que saia da estrutura. `disassemble_wasm()`acompanha a profundidade, por isso os ramos de listagem como `wasm-objdump`, abrange cada código op de um único byte de `unreachable`- Não .`i64.extend32_s`, e coincide com os capturados .`wasm-objdump -d`Em 77 das 77 instruções para ambas as construções.

Os nomes são o único que um módulo simples deixa cair.`wasm-objdump`impressões ainda`<grade>`porque a seção Export mapeia essa cadeia para o índice de função 2, e o leitor faz o mesmo.`wat2wasm --debug-names`adiciona uma seção personalizada chamada `name`Com subseções para o nome do módulo, nomes de funções e nomes locais. O arquivo cresce para 425 bytes. O leitor encontra `{0: 'score', 1: 'bucket'}`para a função 2 e `{0: 'values', 1: 'count', 2: 'sum', 3: 'i'}`para a função 3. `wasm-strip`O repositório de convenções de ferramentas descreve mais dois portadores.`.debug_*`Seções de aluguel.`sourceMappingURL`A seção custom pode apontar para um mapa fonte cujos números de coluna são deslocados em byte para o binário.

A ferramenta foi movida durante 2026.`wasm-decompile`, e a construção Homebrew nesta máquina tem exatamente as onze ferramentas restantes.`print`- Não .`objdump`, e `demangle`. Binaryen versão_133 fornece `wasm-dis`O radar 6.2.4 também lê o módulo.`rabin2 -I`Diz:`arch wasm`É o símbolo de`grade`Começa em`0x8e`, onde o vetor local começa, enquanto `wasm-objdump`etiquetas a função em `0x8b`A sua listagem usa a mnemônica mais antiga.`get_local`- Não .`set_local`, e `brtable 11 4 4 ...`com a contagem do rótulo impressa. Os bytes são os mesmos em todas as três ferramentas e as ortografias diferem, por isso uma comparação deve nomear a ferramenta com que foi capturada. A pesquisa para esta lição não encontrou nenhum módulo de processador WebAssembly no diretório de processadores da Ghidra, e essa listagem não foi lida em sua totalidade. O plugin ghidra-wasm v2.4.0 de terceiros visa Ghidra 12.0. A especificação em si é um documento vivo. A página do W3C para `wasm-core-2`é um projecto de recomendação de candidato de 13 de Outubro de 2026, cujo resumo descreve a versão 3.0, e o projecto de redação tem a mesma data.

## Os metadados ECMA-335 são a própria base de dados do programa

Um conjunto .NET é um arquivo PE. `LedgerNet.dll`Começa com `MZ`, tem três secções denominadas `.text`- Não .`.rsrc`, e `.reloc`, e declara máquina `0x14c`O diretório de dados 14 do cabeçalho opcional, o cabeçalho de execução CLR, aponta para RVA `0x2008`. A ECMA-335 II.25.3.3 define os 72 bytes que se encontram:

```text
48 00 00 00   Cb 72
02 00 05 00   MajorRuntimeVersion 2, MinorRuntimeVersion 5
78 21 00 00   MetaData RVA 0x2178
84 07 00 00   MetaData size 1924
01 00 00 00   Flags: COMIMAGE_FLAGS_ILONLY
05 00 00 06   EntryPointToken 0x06000005, MethodDef row 5, which is Main
```

A raiz de metadados em RVA `0x2178`Começa com a assinatura.`42 53 4a 42`, que diz:`BSJB`, depois a versão 1.1 e a cadeia `v4.0.30319`Cinco cabeçalhos de fluxo seguem:`#~`em compensação`0x6c`, então`#Strings`- Não .`#US`- Não .`#GUID`, e `#Blob`O II.24.2 diz que cada tipo de corrente ocorre no máximo uma vez.`#~`O fluxo começa com um `HeapSizes`byte, zero aqui, então cada cadeia, GUID e índice de manchas é de dois bytes de largura, e um 64 bits `Valid`Mascara que nomeia as tabelas presentes.

| Table | Id | Rows | Row size | What the rows say |
|---|---|---|---|---|
| Module | 0x00 | 1 | 10 | the module name and its GUID |
| TypeRef | 0x01 | 21 | 6 | `System.Object`, `System.Console`, 19 more |
| TypeDef | 0x02 | 4 | 14 | `<Module>`, `Ledger`, and two compiler helpers |
| Field | 0x04 | 2 | 6 | `Labels` and a static array initialiser |
| MethodDef | 0x06 | 6 | 14 | the five methods and `.cctor` |
| Param | 0x08 | 5 | 6 | `before`, `after`, `score`, `values`, `score` |
| MemberRef | 0x0a | 16 | 6 | 12 attribute constructors and the 4 methods that `Main` calls |
| CustomAttribute | 0x0c | 12 | 6 | attributes the compiler and the SDK add |
| StandAloneSig | 0x11 | 3 | 2 | the three local variable signatures |
| Assembly, AssemblyRef, ClassLayout, FieldRva, NestedClass | | 1, 2, 1, 1, 1 | | identity, references, layout |

Um tamanho de linha não é armazenado em nenhum lugar. II.22 dá a cada coluna um tipo, e II.24.2.6 dá a regra de tamanho.`HeapSizes`. Um índice de tabela simples é de dois bytes, enquanto que essa tabela tem menos de 65536 linhas. Um índice codificado que pode apontar para n tabelas com bits de tag b é de dois bytes, enquanto cada uma dessas tabelas tem menos de 2^(16-b) linhas. `CliAssembly`O sistema.Reflexão.Dumagem de metadados nas instalações informa os mesmos tamanhos e os mesmos deslocamentos de tabela, que é como o teste prova a aritmética.

III.1.9 define o token: o alto byte é a tabela, os três bytes baixos são a linha baseada em 1. `0x06000002`É o que é`MethodDef`linha 2. Essa linha tem RVA `0x2060`, nome`Grade`, e uma mancha de assinatura .`00 01 08 08`: convenção de chamada padrão, um parâmetro, retorno `int32`, parâmetro `int32`É o meu .`ParamList`pontos na linha 3 de `Param`, cujo nome é `score`A tabela do Param é por isso que a ILSpy pode imprimir .`Grade(int score)`de uma construção de libertação despojada.`0x2060`O corpo do método começa com um cabeçalho de gordura:

```text
13 30         flags 0x13: fat, init locals; size 3 dwords
02 00         MaxStack 2
2d 00 00 00   CodeSize 45
01 00 00 11   LocalVarSigTok 0x11000001
```

`StandAloneSig`linha 1 é válida `07 01 08`- Não .`LOCAL_SIG`, um local,`int32`O local tem um tipo e não tem nome. ECMA-335 mantém os nomes locais no formato de intercâmbio de defeitos da Partilha V, e o SDK .NET os escreve para um PDB. Este dispositivo foi construído com `DebugType`Nenhum, portanto, nenhuma mesa e nenhum arquivo tem o nome.`bucket`- Não .`PercentChange`tem um cabeçalho pequeno em vez disso: seu primeiro byte `3a`É o que é`0x0e << 2 | 2`, um corpo de 14 bytes sem habitantes locais e uma pilha padrão de 8.

Os 45 bytes de código de `Grade`Decodificar com a tabela de código optico da Parte III. `switch`é opcode `0x45`seguida por um `u32`Conto e tantos outros.`int32`Objetivos relativos à instrução após a tabela:

```text
IL_0000: 02           ldarg.0
IL_0001: 1f 0a        ldc.i4.s 10
IL_0003: 5b           div
IL_0004: 0a           stloc.0
IL_0005: 06           ldloc.0
IL_0006: 1c           ldc.i4.6
IL_0007: 59           sub
IL_0008: 45 05 00 00 00 08 00 00 00 06 00 00 00 04 00 00 00 02 00 00 00 02 00 00 00
                      switch (IL_0029, IL_0027, IL_0025, IL_0023, IL_0023)
IL_0021: 2b 08        br.s IL_002b
IL_0023: 1a 2a        ldc.i4.4, ret
```

O compilador subtraiu 6 antes do `switch`O caso 6 é o primeiro alvo.`disassemble_cil()`representa tokens através das tabelas: `ldsfld Labels`- Não .`call Grade`- Não .`call System.Console::WriteLine`, e `ldstr ' '`do `#US`O oráculo para tudo isto é`MetaDump`, um curto programa C# nos aparelhos construídos em`System.Reflection.Metadata`Imprime o número de filas de cada tabela, tamanho e offset, RVA de cada método, assinatura, nomes de parâmetros e bytes IL, e os 226 campos de `System.Reflection.Emit.OpCodes`- Não .`compare_with_metadump()`O quadro de tempo de execução tem 218 códigos opcodes mais oito`prefix`A tabela da lição tem 219 entradas porque inclui`no.`do ponto III.2.2, que a tabela de emissões nunca teve.

Ferramentas para o formato: ILSpy 11.0 (MIT, lançado 2026-08-12) é executado no macOS através de sua versão de desktop Avalonia. `ilspycmd`11.1.0.9782 Impressões IL com `-il`e seleciona um método por token com `-m 0x06000002`. dnSpyEx 6.6.0 continua dnSpy apenas no Windows.`ildasm`Navio como pacotes NuGet em vez de dentro do SDK. radar2 6.2.4 lê os metadados também: `rabin2 -I`Diz:`arch cil`E ...`class PE32`, e `is`listas `Ledger.Grade(int:score):int`O sistema foi construído com o .NET SDK 8.0.205 porque é o SDK instalado na máquina de construção. .NET 10 está atual desde 2025-11-11 e escreve as mesmas estruturas ECMA-335.

## O que cada recipiente guarda

- Não .`grade`De todos os cinco recipientes numa mesa.`python3 code/main.py keeps`, que passa os leitores sobre os aparelhos:

| Container | Body bytes | Function name | Parameter names | Parameter and return types | Local names | Line numbers | Control flow |
|---|---|---|---|---|---|---|---|
| ELF object, clang -O0 | 118 | `grade` in `.symtab` | none | none | none | none, no `.debug_*` sections | 5 jumps and 1 indirect jump through a relocation table |
| CPython 3.14 pyc | 96 | `co_qualname` | `score` | none | `bucket` | `co_linetable`, first line 10 | 4 compare and `POP_JUMP_IF_FALSE` pairs |
| JVM class, `javac -g` | 50 | constant pool | `score` in `LocalVariableTable` | `(I)I` | none beyond the parameter | `LineNumberTable`, 6 rows | 1 `tableswitch` |
| WebAssembly | 63 | Export section | only with a name section | `(i32) -> i32` | only with a name section | none | 6 nested blocks, 1 `br_table`, 4 `br` |
| .NET assembly | 45 | `MethodDef` | `score` in `Param` | `static int32(int32)` | none, types only in `StandAloneSig` | none without a PDB | 1 `switch`, 1 `br.s` |

A tabela explica os resultados do decompiler que você verá.`int total(const int *, int)`com o `int total(long param_1, uint param_2)`que Ghidra inferido a partir de código nativo, porque o código nativo não mantém nenhuma dessas colunas. Um pyc mantém todos os nomes e nenhum tipo, e seu fluxo de controle é saltos cuja forma muda a cada versão, então os decompiladores Python quebrar por versão e recuperar nomes de graça. Um arquivo de classe mantém tipos e pilhas verificadas, mantém nomes quando`-g`O que é que é o "Centro de`switch`Um módulo de Wassm mantém a estrutura por construção, por isso `wasm2wat`Uma montagem .NET mantém a descrição mais completa, porque as tabelas de metadados são normativas, e ainda precisa de um PDB para o nome de um local.

A tabela diz o que o decompiler teve que trabalhar com, e quais de suas saídas copiar um fato armazenado e que inferir um. Um nome de parâmetro na saída ILSpy é uma cópia. Um nome local na mesma saída é uma inferência a menos que um PDB estivesse presente.

## Construí-lo

Executa a demonstração:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
```

A saída é um relatório JSON. Para cada pyc ele dá os dois cabeçalhos, o arquivo e `grade`tamanhos, a contagem de instruções e nomes de opcodes da lista capturada, e se o intérprete em execução pode lê-lo. Para cada classe construir ele dá a versão, tamanhos, contagens de tabela debug, e o `javap`Para cada edifício de Wassm, ele fornece secções, tipos, funções, conteúdo de nome-secção e os`wasm-objdump`Para a montagem, o sistema fornece o cabeçalho CLI, os fluxos, os números de filas de tabela, os métodos e o sistema. Reflexão.Contrato de metadados.`PATH`- Não .

Leia `code/main.py`na ordem seguinte:

1. `Reader`Detém o cursor e as larguraes inteiras. `uleb()`E ...`sleb()`São os leitores LEB128 que o Wasm e o .NET precisam.
2. `read_pyc_header()`- Não .`Unmarshaller`, e `PycFile`Leia um PC.`parse_dis_text()`Leia os capturados .`dis`Listagem de dados para que a comparação entre versões não precise de quatro intérpretes no momento do ensaio.
3. `ClassFile`lê o arquivo da classe e `disassemble_jvm()`Descreve o código.`parse_javap_code()`E ...`compare_with_javap()`são os cheques do Oráculo.
4. `WasmModule`lê as secções e `disassemble_wasm()`Decodifica uma expressão com a sua profundidade.`compare_with_wasm_objdump()`É o cheque do oráculo.
5. `CliAssembly`caminha PE, cabeçalho CLI, raiz de metadados, fluxos e tabelas. `TABLE_SCHEMAS`E ...`CODED_INDEXES`são II.22 e II.24.2.6 como dados. `disassemble_cil()`Decodifica um corpo e `compare_with_metadump()`- Verifica.
6. `NativeObject`Leia o ELF suficiente para listar símbolos de função e toma a lição 33 como seu texto. `what_each_keeps()`E ...`figure_data()`construindo a comparação.

Há mais cinco comandos.`python3 code/main.py pyc FILE`- Não .`class FILE`- Não .`wasm FILE`, e `dll FILE`imprimir a estrutura e uma lista de cada função num ficheiro que lhes fornecer. `python3 code/main.py compare`compilações `ledger.py`Com todos os intérpretes em .`PATH`e imprime o que cada um escreveu.

## Usá-lo

Use os leitores nesta ordem num recipiente que construiu.

1. Leia os primeiros bytes e nome o formato.`0d 0a`é um pyc, `ca fe ba be`um arquivo de classe, `00 61 73 6d`um módulo, `4d 5a`com o diretório de dados 14 um conjunto de configuração.
2. Leia o cabeçalho e anote a versão de produtor que ele chama. Para um pyc que é a palavra mágica, para um arquivo de classe a versão principal, para uma montagem as cadeias de versão de tempo de execução e metadados.
3. Verifique todos os decompiladores que pretende executar contra essa versão antes de executá-la.
4. Execute o leitor e a própria ferramenta do formato no mesmo arquivo e compare-os linha por linha. Uma desajuste é um bug no leitor ou uma mudança na ferramenta, e qualquer um deles deve ser entendido antes que a listagem seja evidência.
5. Preencha a tabela de mantém para a função que você se importa, marque cada fato como conservado ou perdido e nomeie a tabela, atributo ou seção de onde veio.
6. Só depois ler a saída do decompilador, marcar cada nome e digitar nele como uma cópia de um fato mantido ou como uma inferência.

Mantenha os arquivos de texto do oráculo com os contêineres. Quando um intérprete, JDK, SDK ou versão wabt mudar, reconstruir com `build_fixtures.sh`e recapturar, porque uma listagem alterada é uma fixação alterada.

## Laboratório Interativo

### Lab A: ler o cabeçalho, depois o objeto do código

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats/code
python3 -q
```

- Correr .

```python
from main import *
pyc = load_pyc("ledger.cpython-311.pyc")
pyc.header.to_dict()
pyc.module.names
pyc.functions()["grade"].varnames
len(pyc.functions()["grade"].code)
```

Escreva a palavra mágica antes da primeira chamada.`ledger.cpython-314.pyc`E comparar os dois.`code`Então, tente.`import marshal; marshal.loads(pyc.data[16:])`No arquivo 3.11 sob o seu intérprete e leia o erro.

### Laboratório B: a cadeia constante da piscina

```python
cls = load_class("Ledger-g.class")
cls.constant(13)
cls.constant(14)
cls.describe_constant(13)
[row["text"] for row in jvm_listing(cls, "grade")]
```

Segue-me .`#13`- Não .`#8`E ...`#14`, depois para o`Utf8`- As inscrições, à mão antes de ligar.`describe_constant`Então carrega .`Ledger-gnone.class`e ligar .`cls.method("grade").attribute_names()`- Em ambos.`Code`A matriz é a mesma, os atributos não são.

### Laboratório C: profundidade e rótulos

```python
module = load_wasm("ledger.wasm")
[(row["depth"], row["text"]) for row in wasm_listing(module, "grade")]
module.function_name(2)
load_wasm("ledger-names.wasm").names["locals"][2]
```

Encontrar o`br_table`- E depois, se você quiser, leia a profundidade.`end`As linhas seguidas e combinar cada uma com um número de rótulo na tabela.`ledger.wat`e encontrar o`block $six`Esse rótulo tem 3 nomes.

### Laboratório D: de token para bytes

```python
asm = load_assembly("LedgerNet.dll")
asm.method("Grade")
body = asm.method_body(asm.method("Grade")["RVA"])
body.fat, body.max_stack, body.code_size, hex(body.local_signature_token)
asm.token_text(0x11000001)
[row["text"] for row in cil_listing(asm, "GradeLabel")]
```

Calcule o deslocamento de arquivo de RVA `0x2060`do `.text`cabeçalho de secção à mão e comparar com `asm.rva_to_offset(0x2060)`Então olha para cima .`asm.row(0x08, 3)`e encontrar onde o nome `score`- As vidas.

## Laboratório de Prática

Adicione uma quinta linguagem fonte à comparação, ou um sexto fato à tabela.

Requisitos:

- Escreva uma função com um loop e uma variável local em uma linguagem cujo compilador você tem, por exemplo Kotlin para um arquivo de classe ou Rust para um módulo Wasm. Compromete a saída e a listação do oráculo com o comando exato em `build_fixtures.sh`- Não .
- Faça com que o leitor correspondente concorde com o oráculo em todas as instruções.
- Extensão`what_each_keeps()`O novo recipiente, e um facto adicional para cada recipiente: se o corpo transporta uma mesa de excepção ou `try`Região.
- Adicionar o novo recipiente para `figure_data()`e regenerar.`site/figures-re-43.js`- Não .
- Escreva um teste que falha quando um leitor relata um fato como mantido sem nomear a tabela, atributo ou seção que o mantém.

O sucesso significa`python3 code/main.py keeps`mostra a nova linha com evidências para cada célula, e cada comparação do oráculo ainda concorda.

## Lição Artifacto

Esta lição inclui `outputs/skill-bytecode-and-managed-formats.md`. Use-o para transformar um contêiner de código de byte em um relatório de cabeçalho, uma lista verificada de uma função e uma tabela de fatos que marca cada nome, tipo e estrutura como mantidos ou perdidos. Requer a própria ferramenta do formato como um oráculo, uma verificação de versão antes de qualquer decompilador e uma declaração de onde cada fato perdido teria vivido.

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A verificação deve provar:

- Os quatro cabeçalhos pyc carregam palavras mágicas 3495, 3531, 3571, e 3627, bandeiras 3, e um hash de 8 bytes, e os arquivos de timestamp carregam bandeiras 0, mtime 1791975565, e tamanho 497
- Cada palavra mágica para 3.11 e mais tarde fica na faixa do `2900 + 50n`regra dá a sua liberação
- O unmarshaler retorna os mesmos nomes, constantes, bytes de código, nomes de variáveis e tabela de linhas como `marshal.loads()`no arquivo o intérprete em execução escreveu
- Os quatro arquivos guardam os nomes dos módulos.`('score', 'bucket')`Para`grade`, primeira linha 10, e `ledger.py`como nome do arquivo
- `grade.co_code`É 80, 62, 70 e 96 bytes em todas as quatro versões e as listas capturadas têm 31, 26, 26 e 35 instruções
- A lista 3.11 tem `POP_JUMP_FORWARD_IF_FALSE`, 3.12 e 3.13 têm `RETURN_CONST`, e 3.14 tem `LOAD_SMALL_INT`- Não .`LOAD_FAST_BORROW`, e `NOT_TAKEN`
- O 3.14 `-C -O`lista mostra 13 entradas no cache em `grade`Cinco deles depois .`BINARY_OP`, e os programas de listagem adaptativa `COMPARE_OP_INT`
- Um cabeçalho sem `0d 0a`, um cabeçalho truncado, e um corpo que não é um objeto de código levantar `FormatError`
- uma lista de instruções existe apenas para o pyc escrito pelo intérprete em execução e corresponde ao capturado `dis`saída
- Os arquivos de classe têm maior 65 ou 69, tamanhos 1581, 1832, 1404 e 1581, e contos constantes de pool 82, 94, 79, e 82
- constante`#13`resolve `Method Ledger.grade:(I)I`E ...`#47`- Não .`String F`
- O desmontagem da JVM concorda com `javap -c -p`em 108 das 108 instruções em todas as quatro construções
- `tableswitch`no pc 4 é 36 bytes com baixo 6, alto 10, padrão 48, e metas 46, 44, 42, 40, 40
- Os três níveis de depuração alteram os números de atributos e deixam os 50 bytes de código de `grade`idênticos
- `ifne`- Não .`if_icmpge`, e `goto`Os objetivos são relativos ao código optic da filial
- Uma mágica errada, bytes atrasados e um aumento indefinido de código op.`FormatError`
- As sete secções de Wassm têm o deslocamento da carga útil .`wasm-objdump -h`impressões, e os nomes de construção adiciona um `name`Secção de aluguel, 293 a 425.
- - os tipos, os`env.log`importação, as cinco exportações e o segmento de dados em 1024 decodificação, conforme escrito em `ledger.wat`
- O desmonteador de Wassm concorda com `wasm-objdump -d`em 77 das 77 instruções em ambas as construções
- `grade`tem 6 blocos aninhados, um `br_table`com rótulos `4 4 4 4 4 4 3 2 1 0 0`e padrão 4 na profundidade 6, e um `i32`local
- Os nomes das funções vêm de exportações sem uma secção de nome e nomes locais apenas com ele
- LEB128 `e4 00`É 100, `7f`é -1, `80 08`é 1024, e tipos de blocos render como `wasm-objdump`
- Um preâmbulo errado, versão 2, e um aumento desconhecido do código op.`FormatError`
- O conjunto é PE32 com máquina `0x14c`, cabeçalho CLI na RVA `0x2008`, tempo de execução 2,5, `ILONLY`, e ponto de entrada `0x06000005`
- A versão de metadados é `v4.0.30319`, existem cinco correntes, e as 14 tabelas têm as linhas contadas e os tamanhos das linhas que o oráculo relata
- O leitor .NET concorda com System.Reflection.Metadata em 246 de 246 verificações
- `Grade`tem parâmetro `score`, assinatura `static int32(int32)`, um cabeçalho gordo com `MaxStack`2 e 45 bytes de código, e um `int32`local sem nome
- CIL `switch`Objetivos, `br.s`- Não .`ldsfld`- Não .`call`, e `ldstr`operands resolvem através das tabelas e montões
- A tabela de códigos opticos do CIL abrange todos os códigos opticos de execução e somente adiciona `no.`
- A tabela de manutenção informa o nome do parâmetro em quatro recipientes e em nenhum para o código nativo, e tipos em três
- Cada linha do oráculo na demonstração lê n de n
- A figura interativa incorpora os mesmos dados `figure_data()`produz

## Modos de falha de produção

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Decompiler older than the interpreter | `Unsupported opcode`, output marked incomplete, or a claim of obfuscation | The magic word, the release it names, and the tool's documented ceiling |
| pyc read with the wrong interpreter | `marshal.loads` raises or returns garbage | Our unmarshaller reads names, constants, and sizes from any 3.9 to 3.15 file, and instructions come from the matching `dis` |
| Specialised opcodes mistaken for the file's content | `COMPARE_OP_INT` in a listing | A pyc holds the unspecialised form, specialisation happens in memory after warm-up |
| Local names reported for a default javac build | `var1`, `var2` presented as source names | `LocalVariableTable` is present only with `-g`, the 50 code bytes are identical either way |
| Branch target off by the instruction length | A JVM listing whose jumps land mid-instruction | Offsets relative to the branch opcode, checked against `javap` |
| Switch padding skipped | A `tableswitch` with a wrong default and shifted cases | Zero to three padding bytes to a 4-aligned pc, 36 bytes for five cases |
| Wasm names assumed stripped | "no symbols" | Exports name every exported function, locals need the `name` section, `wasm-strip` removes only that section |
| Three tools, three spellings | `get_local` versus `local.get`, a function at `0x8b` versus `0x8e` | Same bytes, and the listing that the comparison was captured with |
| Table row size guessed | Every row after the first table misread | Row sizes from `HeapSizes`, row counts, and coded index widths, equal to the oracle's |
| Local names expected in a release assembly | `V_0` presented as the source name | Locals have types in `StandAloneSig` and names only in a PDB that `DebugType` none did not write |
| Reader guesses an unknown opcode or type code | A plausible mnemonic | `FormatError` with the offset, and the oracle comparison stops there |
| Oracle captured from another build | Tests pass on stale text | `build_fixtures.sh` names every tool version and writes `versions.txt` and `sha256.txt` |

## Regra de funcionamento

Leia o cabeçalho primeiro e nomear o produtor que ele aponta. Leia o contêiner com um leitor que recusa o que ele não sabe, e verifique sua listagem contra a própria ferramenta do formato no mesmo arquivo.

## Mais leitura

- [PEP 552: Deterministic pycs](https://peps.python.org/pep-0552/)
- [CPython `Include/internal/pycore_magic_number.h`](https://github.com/python/cpython/blob/main/Include/internal/pycore_magic_number.h)
- [Python `marshal` module documentation](https://docs.python.org/3/library/marshal.html)
- [CPython `Python/marshal.c`](https://github.com/python/cpython/blob/main/Python/marshal.c)
- [Python 3.14 `dis` module documentation](https://docs.python.org/3.14/library/dis.html)
- [PEP 659: Specializing Adaptive Interpreter](https://peps.python.org/pep-0659/)
- [PEP 626: Precise line numbers for debugging and other tools](https://peps.python.org/pep-0626/)
- [PEP 790: Python 3.15 Release Schedule](https://peps.python.org/pep-0790/)
- [uncompyle6 on PyPI](https://pypi.org/project/uncompyle6/)- Não .[decompyle3 on PyPI](https://pypi.org/project/decompyle3/)- Não .[xdis on PyPI](https://pypi.org/project/xdis/)- Não .[pycdc on GitHub](https://github.com/zrax/pycdc)- Não .[PyLingual on GitHub](https://github.com/syssec-utd/pylingual)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 4: The class File Format](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-4.html)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 6: The Java Virtual Machine Instruction Set](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-6.html)
- [javac manual, Java SE 25](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html)E ...[javap manual](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html)
- [CFR](https://www.benf.org/other/cfr/)- Não .[Procyon](https://github.com/mstrobel/procyon)- Não .[Vineflower](https://github.com/Vineflower/vineflower)- Não .[Fernflower in intellij-community](https://github.com/JetBrains/intellij-community/tree/master/plugins/java-decompiler/engine)- Não .[JADX](https://github.com/skylot/jadx)
- [Harrand, Soto-Valero, Monperrus, Baudry, "Java Decompiler Diversity and its Application to Meta-decompilation" (JSS 2020)](https://arxiv.org/abs/2005.11315)
- [ECMA-335, Common Language Infrastructure, 6th edition (June 2012)](https://ecma-international.org/publications-and-standards/standards/ecma-335/)
- [PE Format, Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [System.Reflection.Metadata.Ecma335.TableIndex](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.metadata.ecma335.tableindex)
- [ILSpy on GitHub](https://github.com/icsharpcode/ILSpy)- Não .[ilspycmd on NuGet](https://www.nuget.org/packages/ilspycmd)- Não .[dnSpyEx on GitHub](https://github.com/dnSpyEx/dnSpy)
- [WebAssembly Core Specification: Binary Format, Modules](https://webassembly.github.io/spec/core/binary/modules.html)E ...[Values](https://webassembly.github.io/spec/core/binary/values.html)
- [WebAssembly Core Specification: Custom Sections (name section)](https://webassembly.github.io/spec/core/appendix/custom.html)
- [WebAssembly tool-conventions: Debugging](https://github.com/WebAssembly/tool-conventions/blob/main/Debugging.md)
- [wabt 1.0.42 release notes](https://github.com/WebAssembly/wabt/releases/tag/1.0.42)- Não .[wasm-tools](https://github.com/bytecodealliance/wasm-tools)- Não .[Binaryen](https://github.com/WebAssembly/binaryen)- Não .[ghidra-wasm-plugin](https://github.com/nneonneo/ghidra-wasm-plugin)
- [radare2 on GitHub](https://github.com/radareorg/radare2), versão 6.2.4 construída a partir da fonte para esta lição
