# A ligação, carregamento e eliminação de binários: PLT, GOT, importações, fixups e identificação de funções

> Um programa vinculado chama funções que não contém. Esta lição lê as tabelas que o editor de links escreveu para essas chamadas em três formatos, segue uma chamada para o espaço que o carregador preenche e encontra as funções de uma construção depois que seus nomes foram eliminados.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 and arm64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow), 38 (calling conventions)
**Time:** ~160 minutes

## Objetivos de aprendizagem

- Decida, a partir de um registro de realocação e das tabelas de símbolos, o que o editor de links faz dele: uma distância fixa, uma entrada PLT com um slot GOT ou uma realocação dinâmica.
- Leia a seção dinâmica, o PLT e o GOT de um executável ELF independente de posição e siga uma chamada através deles com as fórmulas psABI.
- Leia um objeto COFF (20 bits de cabeçalho de arquivo, 40 bits de entradas de seção, símbolos de 18 bits, relocalizações de 10 bits) e os diretórios de importação, exportação e relocalização de base de uma imagem PE32+.
- Decodificar uma cadeia de correção ligada Mach-O palavra por palavra e combinar cada palavra contra`dyld_info`- Não .
- Diga o que .`strip`remove e o que sobrevive em cada formato, e execute o programa despojado para provar que ainda funciona.
- Recuperar a função inicia de uma construção de arm64 despojada com `LC_FUNCTION_STARTS`, prefácio de digitalização, e alvos de chamada, pontuação de cada método contra a tabela de símbolos do gêmeo não desmontado, e nomear as funções com uma assinatura em forma de FLIRT.

## O problema

Você ligou .`main.c`contra`libledger.dylib`E perguntou a um agente qual é o seu funcionamento.`main`ligações em`0x1000005a0`O agente desmontou as instruções e leu .`bl 0x100000694`Esse endereço contém 12 bytes:`adrp x16`- Não .`ldr x16, [x16, #0x38]`- Não .`br x16`O agente seguiu a carga até ...`0x100004038`, ler os oito bytes `00 00 00 00 00 00 10 80`, e relatou uma chamada através de um ponteiro corrupto para o espaço do núcleo.

Depois despojou-se da construção estática do mesmo programa e perguntou quantas funções ele tem.`nm`, viu um nome,`__mh_execute_header`, e respondeu a um.

Ambas as respostas lêem o arquivo como se fosse o processo em execução.`0x100004038`é uma fixação em cadeia. Bit 63 diz "bind", 12 bits dizem onde a próxima fixação é, e os bits baixos dizem qual importação para ligar.`_puts`Antes de`main`O arquivo despojado perdeu a sua tabela de símbolos e foi mantido.`LC_FUNCTION_STARTS`, que lista todas as cinco funções começa em nove bytes.

Esta lição constrói cinco leitores em Python. Um leitor COFF para nossos próprios objetos e um leitor PE32+ para os diretórios de importação, exportação e realocação de base. Um leitor Mach-O para comandos de carga, estubes, a tabela de símbolos indiretos, a cadeia de fixação em cadeia e o exportador tri, verificado palavra por palavra contra `dyld_info`. Um leitor ELF para a seção dinâmica, o PLT e o GOT, mais um planejador que diz o que um link PIE de nossos objetos criaria. Um buscador de funções para uma construção desmontada com quatro métodos e uma pontuação para cada um. Um criador de assinatura na forma de FLIRT, com bytes de realocação com cartão selvagem e um CRC16 da cauda.

Os executáveis arm64 e o dylib foram ligados, despojados e executados.`clang -target`, e não há editor de links ELF ou PE instalado, por isso as duas imagens ligadas nesses formatos foram escritas byte por byte das especificações por dois scripts Python na pasta de fixtures. `llvm-objdump`Não foram executados, e o texto diz assim onde importa.

```figure
re-40-call-through-three-formats
```

## O que o editor de links faz com uma mudança

Lição 32 - Registros de realocação e lição 33 - Aplicada `S + A - P`a um `lea`Um registro dá nomes a um lugar .`P`, um tipo, um símbolo `S`, e um adicionado `A`. A tabela 4.9 da x86-64 psABI dá uma fórmula por tipo, com `L`para o local da entrada PLT do símbolo, `G`por sua compensação de Deus,`GOT`para o endereço GOT, e `B`Três resultados cobrem os nossos objetos.

O editor de links escreve o valor no campo e o registro desaparece. `R_X86_64_PC32`O distância entre dois bytes de uma imagem nunca muda, independentemente da direcção da carga.

O editor de links faz uma entrada PLT e uma entrada GOT. `R_X86_64_PLT32`contra uma função indefinida é este caso.`L + A - P`A entrada salta através do buraco.`R_X86_64_JUMP_SLOT`registar em `.rela.plt`Diz ao linker dinâmico para preencher o espaço.

O editor de links mantém uma realocação para o carregador. `R_X86_64_64`é um endereço absoluto de oito bytes, e um executável independente de posição não sabe o seu endereço até que ele carrega.`R_X86_64_RELATIVE`com fórmula `B + A`em `.rela.dyn`- Não .

`main-x86_64-O1.o`Tem 18 registos: 14 em `.text`, 2 em .`.data.rel.ro`, e 2 em `.rodata`- Não .`plan_dynamic_link()`em `code/main.py`aplica-lhes as três regras juntamente com `ledger-x86_64-O1.o`- Não .

| Record | Count | Decision | Why |
|---|---|---|---|
| `R_X86_64_PC32` to `.rodata`, `.L.str`, `fns`, the table in `.rodata` | 16 | in place | the symbol is defined in the inputs |
| `R_X86_64_PLT32` to `percent_change`, `grade`, `total`, `grade_label` | 4 | direct, no PLT | defined in `ledger-x86_64-O1.o`, so the link editor reduces PLT32 to PC32 |
| `R_X86_64_PLT32` to `puts` twice and `printf` twice | 4 | PLT entry and GOT slot | undefined, provided by a shared library |
| `R_X86_64_64` to `grade` in `fns[]` | 2 | `R_X86_64_RELATIVE` | an absolute field in a PIE |

Duas importações dão um `.plt`de 48 bytes (PLT0 mais duas entradas de 16), a `.got.plt`de 40 bytes (três slots reservados mais dois), e um `.rela.plt`Os dois registros relativos dão um `.rela.dyn`Estes números vêm da especificação aplicada aos nossos registos.`tiny-dyn-x86_64`Implementa a parte PLT do presente plano para as mesmas duas importações, e os seus tamanhos correspondem ao plano.

O compilador escreve `PLT32`Em cada chamada, definida ou não definida, desde as binutils 2.31 (H.J. Lu, 2018-02-13) e LLVM 7.0.0 (D43383, 2018-02-20).`PLT32`Em um objeto, portanto, diz "uma chamada", e não diz nada sobre se uma entrada PLT vai existir.`R_X86_64_GOTPCRELX`E ...`R_X86_64_REX_GOTPCRELX`(`G + GOT + A - P`) solicitar um espaço GOT sem PLT, que `-fno-plt`Produz e que o editor de links pode relaxar para um direct `lea`ou `call`quando o símbolo é local (psABI apêndice B). `R_X86_64_32`E ...`R_X86_64_32S`Não há nenhum tipo de endereço em um PIE e a ligação falha.

## A Seção Dinâmica, a PLT e a GOT

O capítulo 5 do gABI diz que um executável que participa de ligações dinâmicas tem um `PT_INTERP`programa, que deve preceder qualquer segmento carregável, e um `PT_DYNAMIC`, que abrange o `.dynamic`A secção é uma matriz de`Elf64_Dyn`pares, uma etiqueta assinada e um valor, terminado por `DT_NULL`- Não .

`tiny-dyn-x86_64`é 5.184 bytes escritos por `build_tiny_dyn_elf.py`A secção dinâmica do gABI e do psABI contém 12 pares de`0x1000`- Não .

| Tag | Number | Value | Meaning |
|---|---|---|---|
| `DT_NEEDED` | 1 | `libc.so.6` | a string table offset, `0xb`, the library to load |
| `DT_HASH` | 4 | `0x1a0` | the SysV hash table |
| `DT_STRTAB` | 5 | `0x188` | `.dynstr` |
| `DT_SYMTAB` | 6 | `0x140` | `.dynsym`, 24 bytes per entry |
| `DT_STRSZ` | 10 | `0x15` | 21 bytes of strings |
| `DT_SYMENT` | 11 | `0x18` | 24 |
| `DT_PLTGOT` | 3 | `0x10c0` | `.got.plt` |
| `DT_PLTRELSZ` | 2 | `0x30` | two 24-byte records |
| `DT_PLTREL` | 20 | 7 | the records are `DT_RELA` |
| `DT_JMPREL` | 23 | `0x1b8` | `.rela.plt` |
| `DT_FLAGS_1` | `0x6ffffffb` | `0x08000000` | `DF_1_PIE`, a GNU tag |
| `DT_NULL` | 0 | 0 | end |

O GABI diz porquê .`DT_JMPREL`É separado: "conteve o endereço das entradas de realocação associadas exclusivamente à tabela de ligação do procedimento. Separar essas entradas de realocação permite que o linker dinâmico as ignore durante a inicialização do processo, se a ligação preguiçosa estiver habilitada". `DF_BIND_NOW`em `DT_FLAGS`- Não .`DF_1_NOW`em `DT_FLAGS_1`, ou `LD_BIND_NOW`O sistema de ligação dinâmica processá-los no início.

### PLT0 e entrada para os enchimentos

A secção 5.2 da psABI dá as duas formas na Figura 5.2. Aqui estão os bytes do nosso arquivo:

```text
     1f0: ff 35 d2 0e 00 00    pushq  0xed2(%rip)      # 0x10c8 = GOT+8
     1f6: ff 25 d4 0e 00 00    jmpq   *0xed4(%rip)     # 0x10d0 = GOT+16
     1fc: 0f 1f 40 00          nopl   (%rax)

     200: ff 25 d2 0e 00 00    jmpq   *0xed2(%rip)     # 0x10d8 = GOT+24, the slot for puts
     206: 68 00 00 00 00       pushq  $0x0             # index 0 into DT_JMPREL
     20b: e9 e0 ff ff ff       jmp    0x1f0            # PLT0
```

Faça a aritmética uma vez. O deslocamento relativo ao RIP é relativo à próxima instrução. `0x1f6 + 0xed2 = 0x10c8`, que é `.got.plt + 8`- Não .`0x1fc + 0xed4 = 0x10d0`, que é `.got.plt + 16`- Não .`0x206 + 0xed2 = 0x10d8`, o quarto slot.`0x210 - 0x20 = 0x1f0`Cada entrada é de 16 bytes, então a entrada para `exit`Começa em`0x210`, empurra .`$0x1`, e lê .`0x10e0`- Não .

O GOT reserva três espaços. psABI 5.2: entrada zero contém o endereço de `_DYNAMIC`, e "entras um e dois na tabela global de compensação também são reservados".`.got.plt`lê `0x1000, 0, 0, 0x206, 0x216`. glibc preenche o espaço 1 com o seu `struct link_map`e o espaço dois com `_dl_runtime_resolve`Quando carregar o ficheiro, a caixa 3 é segura.`0x206`O processo de`pushq`- Por dentro .`puts@plt`. psABI: o espaço "initiaalmente ... contém o endereço da seguinte instrução pushq".

Então , a primeira chamada é executada .`call 0x200`- Não .`jmpq *0x10d8`Terras em`pushq $0`- Não .`jmp 0x1f0`empurra GOT+8 e pulsa através de GOT+16 no resolutor, que lê registro 0 de `DT_JMPREL`- Não .`R_X86_64_JUMP_SLOT puts`- Não , parece .`puts`- Para cima .`libc.so.6`, escreve o seu endereço em `0x10d8`A segunda chamada é feita.`call`- Não .`jmpq *0x10d8`Drepper escreve que "o custo geral para todos, exceto para a primeira chamada é, portanto, 'apenas' um salto indireto".`%r11`explica uma escolha de registro na lição 38: é um registro de arranque, por isso "o código no PLT não precisa derramar nenhum registro".

O site de chamada em `.text`lê `e8 d4 ff ff ff`- Não .`0x227`, e `0x22c - 0x2c = 0x200`- Não .`llvm-objdump`impressões digitais`callq 0x200 <puts@plt>`para o mesmo e nomea a entrada do `.rela.plt`- O que é que é?`plt_entries()`Também o nomeia.

### O que o ficheiro não tem

O ficheiro não tem .`PT_GNU_RELRO`. Jakub Jelinek propôs a RELRO na lista de binótiles em 2004-01-06: mover as secções escritas apenas durante a realocação para o início do segmento de escrita, para que o linker dinâmico possa `mprotect`O script padrão do GNU Id coloca`.init_array`- Não .`.fini_array`- Não .`.data.rel.ro`- Não .`.dynamic`, e `.got`dentro, e mantém apenas os três espaços reservados de`.got.plt`dentro, 24 bytes, porque os outros slots são escritos preguiçosamente.`-z now`conjuntos `DF_BIND_NOW`e move o todo.`.got.plt`dentro, RELRO completo, porque nada é escrito depois do arranque.`_dl_protect_relro`chamadas`mprotect(start, end - start, PROT_READ)`na faixa alinhada com a página. `-fno-plt`Vai um passo mais longe no lado do compilador: chamadas passam por `jmpq *name@GOTPCREL(%rip)`O manual do CCG diz que "todos os símbolos externos são resolvidos no momento da carga".

O ficheiro também não tem seções de versão.`libc.so.6`Adiciona`.gnu.version`, um `Elfxx_Half`por`.dynsym`entrada, e `.gnu.version_r`, a `Verneed`para cada biblioteca com `Vernaux`registos para cada nome de versão. `printf@GLIBC_2.2.5`significa: a entrada de `printf`em `.gnu.version`O índice de desempenho é o `Vernaux`de quem`vna_other`é igual ao índice que tem `vna_name`"GLIBC_2.2.5", no quadro `Verneed`de quem`vn_file`O índice 0 é local, 1 é global e o bit 15 (`VERSYM_HIDDEN`- Não .`0x8000`) oculta uma versão do editor de links.

A tabela de hash é um SysV `DT_HASH`com um balde e uma cadeia de três entradas, 24 bytes.`DT_HASH`ou `DT_GNU_HASH`Este arquivo não exporta nada e não foi executado aqui, por isso, se o glibc aceita uma tabela de um balde não é verificado.

### .dynsym, .symtab e strip

O GABI faz`.dynsym`E ...`.dynstr`secções atribuídas e `.symtab`E ...`.strtab`O linker dinâmico lê o primeiro par e nunca o segundo. Drepper: "A tabela de símbolos normais não é usada no tempo de execução e, portanto, não é necessário despojar um binário dele. Não tem impacto no desempenho".

GNU `strip --strip-all`remove`.symtab`- Não .`.strtab`- Não .`.debug_*`, e `.comment`Cada secção atribuída permanece:`.interp`- Não .`.dynsym`- Não .`.dynstr`- Não .`.gnu.hash`- Não .`.gnu.version*`- Não .`.rela.dyn`- Não .`.rela.plt`- Não .`.plt`- Não .`.text`- Não .`.rodata`- Não .`.eh_frame`- Não .`.init_array`- Não .`.dynamic`- Não .`.got`- Não .`.got.plt`- Não .`.data`- Não .`.bss`Os cabeçalhos da secção ficam, a menos que adicionem.`--strip-section-headers`(artigo 2.41) ou executar `llvm-strip --strip-sections`- Não .`--strip-debug`- Mantém os símbolos.`--only-keep-debug`escreve o arquivo de depuração que `--add-gnu-debuglink`nomes do desenhado, com um CRC32 em `.gnu_debuglink`, e `ld --build-id`escreve`.note.gnu.build-id`Então um depurador pode combinar os dois.

## O objeto COFF

`clang -target x86_64-pc-windows-msvc -O1 -fno-asynchronous-unwind-tables -c`Produzido `main-x86_64.obj`E ...`ledger-x86_64.obj`. A página de formato PE define o objeto: um cabeçalho de arquivo de 20 bytes, sem cabeçalho opcional, uma tabela de secções de entradas de 40 bytes, uma tabela de símbolos de registros de 18 bytes e registros de realocação de 10 bytes por secção.

`CoffObject`em `code/main.py`O cabeçalho do arquivo diz máquina.`0x8664`, 10 secções, 37 registos de símbolos,`SizeOfOptionalHeader`0 Os nomes das tabelas das secções `.text`- Não .`.data`- Não .`.bss`, seis secções chamadas`.rdata`, e `/16`Um nome que começa com`/`é um desvio decimal na tabela de cordas, que começa com o seu próprio tamanho de quatro bytes; `/16`resolve `.llvm_addrsig`, que é o nome `llvm-objdump -h`- Impressões.

Os 37 registros incluem registros auxiliares. Um símbolo de seção (classe de armazenamento 3) contém um que contém o comprimento da seção, a contagem de realocação, uma soma de verificação e uma seleção COMDAT.`.rdata`Seções têm a seleção 2, "qualquer", e contêm uma cadeia literal cada sob um nome MSVC-malformado: `??_C@_04JDDJEAHN@even?$AA@`O editor de links mantém uma cópia de cada um.`.file`com o registo auxiliar "main.c". `llvm-objdump -t`Imprime isto como `[ 0]`- Não .`AUX scnlen ...`- Não .`[ 2]`, e assim por diante, ignorando os índices auxiliares, e o teste compara o nosso índice e pares de nomes com esse texto.

As mudanças: 14 `IMAGE_REL_AMD64_REL32`em `.text`E 4 `IMAGE_REL_AMD64_ADDR64`em `.rdata`- Não .`REL32`é "o endereço relativo de 32 bits do byte após a realocação".`R_X86_64_PC32`com o `-4`incorporado: o registo ELF contém adição `-4`porque o registo tem um campo adicionado e o registo COFF não tem nenhum. `ledger-x86_64.obj`Tem três .`REL32`- Não .`0x36`- Não .`0x84`, e `0x93`, e lição 32's `ledger-x86_64-O1.o`Tem os seus três.`R_X86_64_PC32`O código é o mesmo e os formatos diferem apenas no que diz respeito à redacção dos quatro.`ADDR64`é um endereço absoluto de oito bytes, o `labels`Tabela de puntuações de cordas, e se torna uma realocação de base na imagem, como `R_X86_64_64`torna-se`R_X86_64_RELATIVE`- Não .

| | ELF `Elf64_Rela` | COFF relocation | Mach-O `relocation_info` |
|---|---|---|---|
| record size | 24 bytes | 10 bytes | 8 bytes |
| fields | offset, type and symbol in `r_info`, addend | offset, symbol index, type | address, then a 32-bit word with symbolnum:24, pcrel:1, length:2, extern:1, type:4 |
| addend | explicit | none, lives in the field | none, or an `ARM64_RELOC_ADDEND` record before the real one |
| the call to `puts` | `R_X86_64_PLT32 puts-0x4` | `IMAGE_REL_AMD64_REL32 puts` | `ARM64_RELOC_BRANCH26 _puts` |

## A imagem do PE: Importações, exportações e realocações de base

`tiny-x86_64.exe`é 2.560 bytes escritos por `build_tiny_pe.py`Tem o mesmo trabalho que o pequeno ELF:`puts`E ...`exit`de`msvcrt.dll`Exporta também um nome e realoca uma base, por isso, os três diretórios que esta lição precisa estão todos presentes. `pefile`2024.8.26 e `llvm-objdump -p`Ambos as captações são acessórios.

A lista do MS-DOS começa com:`MZ`e em compensação`0x3c`- É o que se passa .`e_lfanew`- Não .`0x40`- Em .`0x40`A assinatura`PE\0\0`Depois , o cabeçalho do arquivo COFF: máquina `0x8664`, 4 secções, `SizeOfOptionalHeader`240, características `0x22`O cabeçalho opcional começa com o `Magic`campo, `0x20b`, o que significa PE32+. `AddressOfEntryPoint`É o que é`0x1000`- Não .`ImageBase`É o que é`0x140000000`- Não .`SectionAlignment` `0x1000`- Não .`FileAlignment` `0x200`- Não .`SizeOfImage` `0x5000`- Não .`Subsystem`3 (consola). `DllCharacteristics` `0x8160`decodificações para `HIGH_ENTROPY_VA 0x0020`- Não .`DYNAMIC_BASE 0x0040`- Não .`NX_COMPAT 0x0100`, e `TERMINAL_SERVER_AWARE 0x8000`Em seguida, 16 diretórios de dados de RVA e tamanho.`0x2080`tamanho`0x4d`, Importar em `0x2000`tamanho`0x28`, Base Relocation em `0x4000`tamanho`0xc`, IAT em`0x2040`tamanho`0x18`- Não .

Os endereços em uma imagem são RVAs, offsets da base de carga. A tabela de seção mapeia-os para arquivo offsets: `.text`RVA `0x1000`no arquivo `0x200`- Não .`.rdata`RVA `0x2000`- Não .`0x400`- Não .`.data`RVA `0x3000`- Não .`0x600`- Não .`.reloc`RVA `0x4000`- Não .`0x800`- Não .`PeImage.rva_to_offset()`É aquela mesa.

### O diretório de importações

Na RVA `0x2000`O nosso tem um: Tabela de busca de importação `0x2028`, timestamp 0, cadeia de remessa 0, nome `0x2068`, Tabela de endereços de importação `0x2040`. O nome RVA aponta para "msvcrt.dll". A tabela de busca contém entradas de 64 bits terminadas por zero. Bit 63 conjunto significa importação por ordinal, com o ordinal em bits 15 a 0. Bit 63 claro significa bits 30 a 0 são o RVA de uma entrada de sugestão / nome: uma sugestão de 16 bits, "um índice na tabela de indicadores de nome de exportação", em seguida, o nome ASCII. Os nossos são `0x2058`(indicação 0, "puts") e `0x2060`(indicação 0, "saída").

A especificação diz que o IAT é "identico ao conteúdo da tabela de busca de importação até que a imagem seja ligada".`0x2040`O teste verifica que os 24 bytes estão em `0x2028`igual aos 24 bytes em `0x2040`. "Durante a ligação, as entradas na tabela de endereços de importação são sobrewritten com os endereços de 32 bits (para PE32) ou 64 bits (para PE32+) dos símbolos que estão sendo importados". O carregador do Windows faz isso antes do ponto de entrada correr. Não há ligação preguiçosa e nenhum estúbo. O código chega diretamente à ranura:

```text
    100b: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1011 + 0x102f = 0x2040, the IAT slot of puts
    1013: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1019 + 0x102f = 0x2048, the IAT slot of exit
```

`FF /2`As duas instruções têm os mesmos bytes porque cada uma fica oito bytes atrás da outra e lê um slot oito bytes atrás da outra. `iat_calls()`Escanera a secção de código para `ff 15`, adiciona seis e o deslocamento e nomeia a fenda do diretório de importação.

### O diretório de exportação

Na RVA `0x2080`A tabela de 40 bytes do diretório de exportação: bandeiras, timestamp, versão, um nome RVA apontando para "tiny-x86_64.exe", base ordinal 1, entrada de tabela de endereços 1, indicador de nome. Seguem três tabelas.`0x20a8`Detém uma RVA, `0x1000`. A tabela de indicadores de nomes de exportação em `0x20ac`O quadro ordinário de exportação em `0x20b0`Detém um índice imparcial de 16 bits, 0. Nome `k`mapas para endereçar a entrada `ordinals[k]`, e o ordenal exportado é `ordinals[k] + ordinal base`A especificação acrescenta uma regra que não usamos: uma entrada de endereço que aponta para dentro da seção de exportação é uma cadeia de remetente, como `MYDLL.expfunc`, e a tabela de indicadores de nome é "ordenada lexicamente para permitir pesquisas binárias".

### Realocações de bases

`.reloc`Cada bloco começa com uma página RVA e um tamanho de bloco, depois entradas de 16 bits com o tipo nos quatro bits superiores e uma página ofusada na doze inferior. Nosso bloco: página `0x3000`, tamanho 12, entrada `0xa000`Tipo 10,`IMAGE_REL_BASED_DIR64`, compensação 0, e uma entrada de engarrafamento do tipo 0, `IMAGE_REL_BASED_ABSOLUTE`Os oito bytes na RVA`0x3000`- Não .`0x1400020d0`, a base de imagem mais o RVA da cadeia "ligado à mão". Se o carregador colocar a imagem em qualquer outro lugar, ele adiciona a diferença a esse campo. A especificação: "Os arquivos de imagem não contêm relocações COFF ... Uma imagem contém informações de relocalização na forma de relocações de base na seção .reloc (a menos que a imagem tenha o atributo IMAGE_FILE_RELOCS_STRIPPED). " `/DYNAMICBASE`está ligado por padrão no link.exe atual, por isso as imagens carregam `.reloc`E ...`DYNAMIC_BASE`- Não .

Uma imagem PE não tem tabela de símbolos para desligar.`PointerToSymbolTable`"deve ser zero para uma imagem porque a informação de depuração COFF está obsoleta", e os nomes vivem em um PDB separado.`.pdata`, cujo `RUNTIME_FUNCTION`As entradas nomeam o início e o fim de cada função que atribui pilha ou chama outra função.

## A imagem Mach-O: comandos de carga, colchões e tabela de símbolos indiretos

`ledger_main`é o arm64 executável ligado. `otool -h`Impressão de 19 comandos de carga e bandeiras `0x00200085`- Não .`MH_NOUNDEFS 0x1`- Não .`MH_DYLDLINK 0x4`- Não .`MH_TWOLEVEL 0x80`, e `MH_PIE 0x200000`Os 19 comandos são quatro.`LC_SEGMENT_64`(`__PAGEZERO`- Não .`__TEXT`- Não .`__DATA_CONST`- Não .`__LINKEDIT`), dois `LC_LOAD_DYLIB`(`@rpath/libledger.dylib`Então ...`/usr/lib/libSystem.B.dylib`), e um cada um `LC_DYLD_CHAINED_FIXUPS`- Não .`LC_DYLD_EXPORTS_TRIE`- Não .`LC_SYMTAB`- Não .`LC_DYSYMTAB`- Não .`LC_LOAD_DYLINKER`- Não .`LC_UUID`- Não .`LC_BUILD_VERSION`- Não .`LC_SOURCE_VERSION`- Não .`LC_MAIN`- Não .`LC_RPATH`- Não .`LC_FUNCTION_STARTS`- Não .`LC_DATA_IN_CODE`, e `LC_CODE_SIGNATURE`- Não .`MachoFile.command_names()`Retorna a mesma lista na mesma ordem que `otool -l`- Não .

`__TEXT`Começa em`0x100000000`- Não .`__text`é 256 bytes em `0x100000558`- Não .`main`E nada mais, porque as quatro funções do livro vivem no Dylib.`__stubs`é 84 bytes em `0x100000658`, sete estubes de doze bytes.`__DATA_CONST`Começa em`0x100004000`com`__got`, 64 bytes, oito espaços de ponteiros de tipo secção `S_NON_LAZY_SYMBOL_POINTERS`, e `__const`, 32 bytes, o `fns[]`E ...`names[]`Tabelas de `main.c`- Não .

### Um tronco, a mão

O estômago para o`_puts`Está em`0x100000694`- Não .

```text
    30 00 00 90    adrp x16, 0x100004000
    10 1e 40 f9    ldr  x16, [x16, #0x38]
    00 02 1f d6    br   x16
```

`0x90000030`É o que é`adrp`O registo é o mínimo de cinco bits, 16.`immlo`é bits 30 a 29, 0. `immhi`é 23 bits a 5, 1. O valor é `immhi << 2 | immlo = 4`, em páginas de 4.096 bytes, então a página de destino é a página da instrução,`0x100000000`, mais `0x4000`- Não .`0xf9401e10`É o que é`ldr`com um offset de 12 bits sem assinatura escalado por 8: bits 21 a 10 são 7, vezes 8 é `0x38`, então a carga diz`0x100004038`- Não .`0xd61f0200`É o que é`br x16`O arm64 na fonte do ID64 é exactamente esta instrução de três.`StubAtom`- Não .

O nome que pertence ao slot vem da tabela de símbolos indiretos. `LC_DYSYMTAB`A secção de "Stubs" diz:`reserved1`onde a sua linha de índices começa e em`reserved2`Quão grande é cada estúdio (12).`reserved1`e oito bytes por slot. `__stubs`inicia-se no índice 0 e `__got`no índice 7, por isso, colher 5 mapas para a entrada de tabela de símbolos 10, `_puts`, e no espaço 7 de `__got`mapas para a mesma entrada. `otool -Iv`Impressões de ambos os corredores, e `indirect_table()`Reproduz cada linha.

### Espaço de nomes de dois níveis

`nm -m`impressões digitais`(undefined) external _puts (from libSystem)`E ...`(undefined) external _grade (from libledger)`A biblioteca vem do próprio registro de símbolos.`nlist.h`define`GET_LIBRARY_ORDINAL(n_desc)`como bits 15 a 8 de `n_desc`, 1 para o primeiro `LC_LOAD_DYLIB`, 2 para o segundo, `0xfe`para a pesquisa dinâmica, `0xff`para o executável. `ld(1)`: "Com -two_levelnamespace (a padrão), o linker só procura dilibs na linha de comando para símbolos e registros em que dilib eles foram encontrados". `nm_lines()`O filme retrata os 12 discos de`n_type`- Não .`n_sect`- Não .`n_desc`, e `n_value`, e o ensaio compara a sua linha de saída por linha com a capturada `nm -m`- Liga-te com o`-Wl,-flat_namespace`e ler .`otool -h`Para ver o `MH_TWOLEVEL`- Desaparecem.

## Fixups em cadeia, byte por byte

`LC_DYLD_CHAINED_FIXUPS`é um `linkedit_data_command`- Não .`dataoff 0x8000`- Não .`datasize 208`Os 208 bytes seguem .`fixup-chains.h`- Não .

O cabeçalho é de sete campos de 32 bits: `fixups_version 0`- Não .`starts_offset 32`- Não .`imports_offset 80`- Não .`symbols_offset 112`- Não .`imports_count 8`- Não .`imports_format 1`(`DYLD_CHAINED_IMPORT`), `symbols_format 0`(não comprimido). `llvm-objdump --macho --chained-fixups`Imprime estes sete valores e o teste compara-os.

No offset 32, `dyld_chained_starts_in_image`- Não .`seg_count 4`E quatro compensações, uma por segmento, zero para segmentos sem correções.`__DATA_CONST`Tem um.`dyld_chained_starts_in_segment`lê `size 24`- Não .`page_size 0x4000`- Não .`pointer_format 6`(`DYLD_CHAINED_PTR_64_OFFSET`, "alvo é vm compensado"), `segment_offset 0x4000`- Não .`max_valid_pointer 0`- Não .`page_count 1`, e um `page_start`de 0. `DYLD_CHAINED_PTR_START_NONE`- Não .`0xffff`, significaria uma página sem problemas.

A cadeia começa no arquivo de compensação `0x4000 + 0`Cada palavra de 64 bits tem duas coisas: o que escrever e onde a próxima palavra está.

```text
  dyld_chained_ptr_64_bind    ordinal:24  addend:8  reserved:19  next:12  bind:1 = 1
  dyld_chained_ptr_64_rebase  target:36   high8:8   reserved:7   next:12  bind:1 = 0
```

Leia a primeira palavra.`0x8010000000000000`Bit 63 está definido, um enredo.`next`é de bits 62 a 51, `0x002`, em unidades de 4 bytes, então a próxima correção é 8 bytes.`0x4058`- Não .`0x00000000000006db`- 63 pontos, rebase.`next`É 0, o fim da cadeia.`0x6db`, um vm de compensação, e a base da imagem `0x100000000`- É o que faz .`0x1000006db`, a cadeia "odd" em `__cstring`A palavra antes dela.`0x00100000000006d6`, rebases `names[0]`Para "até".

O passeio visita doze palavras: oito ligações em `__got`com ordens 0 a 7, dois enlaces em `__const`com 0 ordinal (ambas entradas de `fns[]`ponto em `_grade`), e os dois subsídios de `names[]`- Não .`chained_fixups()`Retorna-os com os seus offsets de arquivo e palavras brutas, e o teste compara os doze `(offset, raw)`par com `dyld_info -fixup_chain_details`, que imprime `raw: 0x8010000000000000 bind: (next: 002, bindOrdinal: 0x000000)`- Para a primeira vez.

A tabela de importações no offset 80 contém oito entradas de 32 bits: `lib_ordinal:8`- Não .`weak_import:1`- Não .`name_offset:23`, com nomes no offset 112.`_grade`- Não .`_grade_label`- Não .`_percent_change`- Não .`_total`da biblioteca 1, e 4 a 7 são `___stack_chk_fail`- Não .`___stack_chk_guard`- Não .`_printf`- Não .`_puts`da biblioteca 2. `fixup_rows()`liga as duas tabelas para as linhas `dyld_info -fixups`impressões digitais, tais como `__DATA_CONST __got 0x100004038 bind libSystem/_puts`, e o teste compara os doze.

Então o "político corrupto" em `0x100004038`O Dyld anda esta cadeia uma vez, quando carregado, e escreve o endereço de `_puts`- Para o espaço. A sessão WWDC22 da Apple colocou assim: "no local de ponteiro de 64 bits no DATA, alguns dos bits contêm o offset para o próximo local de fixação. Também está incluído um bit que diz se a correção é um bind ou um rebase. " Xcode 13 tornou o formato o padrão para um alvo de implantação do macOS 12 ou iOS 15, e Xcode 13.3 o estendeu para macOS 11 e iOS 13.4. Não há ligação preguiçosa neste formato. Cada slot está ligado antes .`main`- É um bom momento.

### O layout que substituiu

`ledger_main_nochain`é a mesma ligação com `-Wl,-no_fixup_chains`- Tem .`LC_DYLD_INFO_ONLY`Em vez disso, com quatro tabelas codificadas em byte: rebase 8 bytes, bind 72, lazy bind 120, export 64. Também tem três seções que faltam ao arquivo em cadeia: `__TEXT,__stub_helper`(108 bytes), um `__got`de apenas 16 bytes de armazenamento `___stack_chk_guard`E ...`dyld_stub_binder`, e `__DATA,__la_symbol_ptr`(56 bytes, sete slots). `dyld_info -fixups`listas sete `lazy-bind`linhas e sete rebases que apontam cada fenda preguiçosa em seu próprio trampolino em `__stub_helper`O trampolino empurra um índice e salta para o`dyld_stub_binder`, que resolve o nome e escreve a fenda.`__la_symbol_ptr`É o que é`.got.plt`- Não .`__stub_helper`é PLT0 e o `pushq $index`, e `dyld_stub_binder`É o que é`_dl_runtime_resolve`- Não .`code/main.py`Relata as compensações e as secções deste ficheiro e não decodifica os códigos de bind; o laboratório de prática solicita isso.

### O processo de exportação

`LC_DYLD_EXPORTS_TRIE`Cada nó é um tamanho terminal uleb128, então, se não é zero, uleb128 bandeiras e um uleb128 offset, então um byte de conteúdo infantil e, para cada criança, uma borda de cadeia e um uleb128 node offset. `exports_trie()`- Vai andando.`libledger.dylib`- Ele volta .`_percent_change 0x410`- Não .`_grade 0x428`- Não .`_total 0x464`- Não .`_grade_label 0x498`, os quatro offsets `dyld_info -exports`Em um executável, ele retorna.`__mh_execute_header`- Não .`_fns`, e `_main`- Não .

## Que tira deixa

A Apple's `strip(1)`diz que sem opções em um executável ligado dinamicamente que se comporta como `-u -r`: salvar símbolos não definidos e símbolos referenciados dinamicamente. `-x`remove símbolos locais. `-N`remove toda a tabela de símbolos e a tabela de cordas. "Para bibliotecas compartilhadas dinâmicas, o nível máximo de deslixo é geralmente -x", porque "Somente símbolos globais são usados pelo processo de ligação dinâmica".

Observado nos nossos aparelhos.`strip ledger_main`- Não .`LC_SYMTAB`De 12 a 10 registos e removidos `_main`- Não .`_fns`, e `_names`- as oito importações não definidas permanecem, porque a DILD precisa de seus nomes para se vincularem, e`__mh_execute_header`- Não . - Não .`REFERENCED_DYNAMICALLY`O décimo registro é um tipo de pontapé .`N_OPT`nomeado`radr://5614542`, que as ferramentas da Apple escrevem para que a mesa nunca esteja vazia;`nm`O programa desnudado imprime as mesmas três linhas do original e sai de 0.`LC_FUNCTION_STARTS`Ainda tem um começo.`main`- Não .

`strip libledger.dylib`Sem opções, foi mais longe do que o habitual.`-x`- Não .`LC_SYMTAB`tem 0 registos e `nm`O trie de exportação ainda lista as quatro funções no mesmo deslocamento, porque o dyld liga através do trie e nunca através.`LC_SYMTAB`- Não .`LC_FUNCTION_STARTS`O laboratório C liga um novo.`main.c`contra o Dyllib despojado para mostrar que o editor de links também é servido pelo trio.

| What | ELF after `--strip-all` | PE image | Mach-O after `strip` |
|---|---|---|---|
| static symbol table | gone | never present in an image | local and defined names gone, undefined imports stay |
| names the loader binds | `.dynsym` and `.dynstr` stay | import directory stays | imports stay in `LC_SYMTAB` and in the chained imports table |
| exported names | `.dynsym` stays | export directory stays | exports trie stays |
| function starts | `.eh_frame` FDEs, unless built without unwind tables | `.pdata` for non-leaf functions | `LC_FUNCTION_STARTS` stays |
| debug information | `.debug_*` gone | in the PDB, never in the image | in the dSYM, never in the image |
| section or load command headers | stay unless `--strip-section-headers` | stay | stay |

## Encontrar Funções Sem Símbolos

`static-arm64-O2`ligações`main-arm64-O2.o`E ...`ledger-arm64-O2.o`em um executável com cinco funções em `__text`- Não .`nm -n`O que é verdade é que o arquivo não foi cortado:`_main`- Não .`0x100000500`(244 bytes), `_percent_change`- Não .`0x1000005f4`(24), `_grade`- Não .`0x10000060c`60), `_total`- Não .`0x100000648`(248), `_grade_label`- Não .`0x100000740`(72). `static-arm64-O2.stripped`Não tem .`N_SECT`símbolo dentro `__text`- Não .`FunctionFinder`- É um bom trabalho .`score()`Comparar cada lista com a verdade.

### LC_FUNCTION_STARTS

Os pontos de comando em nove bytes em `__LINKEDIT`- Não .`80 0a f4 01 18 3c f8 01 00`O formato é uleb128 deltas, o primeiro do `__TEXT`Endereço.`80 0a`É o que é`0x500`, então o primeiro começo é`0x100000500`- Não .`f4 01`É o que é`0xf4`- Então ...`0x1000005f4`- Não .`18`dá`0x10000060c`- Não .`3c`dá`0x100000648`- Não .`f8 01`dá`0x100000740`, e `00`Cinco de cinco, sem falsos positivos, em`-O0`e em`-O2`O editor de links escreve esta tabela para o desvinculador e o repórter de acidente, e`strip`Ghidra lê-o no seu analisador "A Função Mach-O Começa",`dyld_info -function_starts`Imprima-o e o LIEF expõe-o como`function_starts`- Não .

### Escanar o prólogo

Os padrões de arranque do Ghidra AARCH64 começam com `fd 7b bf a9`, que é `stp x29, x30, [sp, #-0x10]!`Nos nossos arquivos encontra 0 de 5 em ambos os níveis.`sub sp, sp, #N`Primeiro e depois .`stp x29, x30, [sp, #M]`O modelo de pré-indice nunca ocorre.`sub sp, sp, #imm`- Não .`(word & 0xff0003ff) == 0xd10003ff`, encontra 5 de 5 em `-O0`, onde cada função tem um quadro, e 1 de 5 em `-O2`, onde`percent_change`- Não .`grade`- Não .`total`, e `grade_label`são funções de folha sem quadro. `percent_change`Começa com `cbz w0, ...`Uma varredura de prólogo relata o que o compilador escolheu emitir, e a lição 38 mostrou quão frequentemente isso é nada.

Nenhum dos escaneamentos produziu um falso positivo aqui, porque o programa é pequeno. padrões de um byte como o x86-64 `55`de`push rbp`O que é que os arquivos de padrão x86-64 de Ghidra combinam um padrão pós-patrão como `55 48 89 e5`com um padrão prévio, como `ret`ou `nop`que deve acabar com a função anterior.

### Alvos de ligação

Todos .`bl`em `__text`nomeia uma função começa, porque uma `bl`no meio de uma função é algo que um compilador não emite para C. A codificação é `0x94000000`com um contraste de palavras assinado de 26 bits.`bl`- Não .`0x1000005a0`lê `3d 00 00 94`- Não .`0x3d`é 61, vezes 4 é `0xf4`, o alvo é`0x100000694`- Em .`ledger_main`É o ponto de partida para o`_puts`Na construção estática,`call_targets()`Recolhe os alvos dentro .`__text`, deixa cair aqueles que aterrissam .`__stubs`, e adiciona o `LC_MAIN`Entrar, porque nada chama.`main`A Nucleus (Andriesse, Slowinska, Bos, 2017) construiu sua detecção de funções sobre essa ideia de código gerado pelo compilador, e Andriesse e outros mediram em 2016 que os limites de funções são a parte mais difícil da desmontagem, mais difícil do que os limites de instrução.

## Uma assinatura em forma de FLIRT

Hex-Rays descreve o FLIRT em sua documentação: um padrão é "os primeiros 32 bytes de uma função onde todos os bytes variantes são marcados", os bytes variantes vêm de fixups e referências externas, os padrões vivem em uma árvore, e além do padrão "calculamos o CRC16 dos bytes a partir da posição 33 até o primeiro byte variante" e armazenamos esse comprimento. Duas funções com o mesmo padrão e CRC são separadas por um byte de cauda em uma posição onde diferem, depois pelos nomes que referem. Uma colisão que nada separa é "resolvida pela inteligência natural". Funções menores de quatro bytes sem referências externas são excluídas, e "o arquivo de assinatura não contém nenhum byte das bibliotecas originais, exceto os nomes das funções".

`signatures_from_object()`construiu isso a partir de `ledger-arm64-O2.o`E ...`main-arm64-O2.o`, a forma como o FLAIR o constrói a partir de objetos de uma biblioteca.`relocation_info`O registro cobre uma palavra de quatro bytes, e esses bytes tornam-se variantes.`.pat`O layout de linha, documentado no parser de rizin, é o padrão, o comprimento do CRC, o CRC16, o comprimento da função, `:0000`e o nome, e `^offset name`Para cada nome referido:

```text
A00000342800004B890C8052087D091B000DC01AC0035FD6 00 0000 0018 :0000 _percent_change
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 003C :0000 _grade ^0000 l_switch.table.grade ^0001 l_switch.table.grade
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 0048 :0000 _grade_label ^0000 l_switch.table.grade_label ^0001 l_switch.table.grade_label ^0002 _labels ^0003 _labels
```

`_percent_change`é de 24 bytes, então seu padrão é a função inteira e o comprimento CRC é 0. `_grade`é de 60 bytes com sua primeira realocação em 36 bytes, então o CRC cobre quatro bytes.`.pat`uso de parseres: polinômio `0x8408`, valor inicial `0xffff`O valor para a cadeia ASCII "123456789" é `0x6e90`, e os pinos de teste que.

`match_signatures()`Tenta cada assinatura em cada início de função da construção desmontada, padrão primeiro, depois CRC.`-O0`Todas as cinco funções têm os seus nomes e nada entra em colisão.`-O2`As duas linhas acima colíderam.`grade_label`em linha .`grade`, então as duas funções compartilham seus primeiros 36 bytes e os quatro bytes CRC. Ambas as assinaturas coincidem em`0x10000060c`e em`0x100000740`A cauda divide-os: em 44 bytes`_grade`- Não .`20`E ...`_grade_label`- Não .`28`, que é `ldr w0, [x9, w8, uxtw #2]`contra`ldr x8, [x9, w8, uxtw #3]`O relatório registra as colisões e o byte que as decidiu.

O teste .`test_object_bytes_equal_linked_bytes_outside_relocated_words`verifica a premissa: cada byte não variante de cada função objeto é igual ao byte no mesmo deslocamento no executável vinculado, então o editor de links mudou apenas as palavras relocados. `_total`Não tem realocação nem variante de byte.

### O que as ferramentas fazem com a mesma ideia

O IDA Pro 9.4 envia assinaturas FLIRT por processador e o `sigmake`ferramenta para construí-los; IDA Free cobre apenas os x86 e x86-64 e é para uso não comercial. Lumina é um servidor que segmenta metadados de função por md5 da função e evita funções abaixo de 32 bytes. Ghidra 12.1.4 (Apache-2.0) tem ID de função: um hash completo sobre mnemônicos e modos de endereçamento que é "robusto contra mudanças devido ao linking" e um hash específico que adiciona operandos constantes, marcados por instrução correspondente, com funções de pai e filho como tie-breakers; suas bases de dados enviadas cobrem apenas bibliotecas do Visual Studio, e você popula o seu próprio a partir de seus próprios binários. Binary Ninja 6.0 Krypton (comercial, com uma edição gratuita) usa WARP (Apache-2.0): a função GUID é um UUIDv5 sobre os GUIDs de bloco básicos, cada um um um UUIDv5 sobre bytes de bloco após zeroar "todas as instruções realocaveis" e soltar NOPs, com chamado, chamador e funções adjacentes como restrições. BinDiff 8 (Apache-2.0) combina funções entre dois binários com uma ordem fixa de passos, desde o hash match através de índices MD de fluxo de gráfico para chamar de sequência match, e pesa a semelhança de bordas, blocos, instruções e o índice MD de fluxo de gráfico. Diafora 3.4.3 (AGPL-3.0, apenas IDA) adiciona o produto de pequenos primos, onde cada mnemônico mapeia um primos e uma função é o produto, uma impressão digital multiset livre de ordem. O radar2 6.2.4 (LGPL-3.0) tem assinaturas (`zg`- Não .`z/`- Não .`zb`) e lê-se FLIRT `.sig`arquivos com `zfs`• a rizina 0.9.1 (LGPL-3.0) cria `.pat`ou `.sig`de um binário aberto com `Fc`e aplica um com `Fs`- Não .

O IDA e o Binary Ninja estão fechados e são descritos aqui a partir de sua documentação. o radar2 e o rizin não estão instalados nesta máquina, e seus comandos são citados de seus livros e fontes.`clang`- Não .`ld`- Não .`llvm-objdump`- Não .`otool`- Não .`nm`- Não .`strip`, e `dyld_info`LIEF leu todos os formatos aqui, incluindo os objetos COFF, que tem suportado desde 0.17.0, e relatou dez ligações e duas bases em`ledger_main`, os mesmos 12 arranjos . As ferramentas de roupas só lêem os ficheiros ELF .`main-x86_64.obj`com`PEFormatError: 'DOS Header magic not found.'`e ler a pequena imagem.

## Construí-lo

Executa a demonstração:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
npx tsx code/main.ts
```

A saída é um relatório JSON com cinco partes. `elf`Detém as contas de realocação dos dois objetos, o plano de ligação e a seção dinâmica, PLT e GOT de `tiny-dyn-x86_64`- Não .`coff`Detém as secções, as relocalizações, as funções e os nomes indefinidos dos dois objetos. `pe`Detém os títulos, os directórios, as importações, as exportações, as transferências de bases e as chamadas de IAT de `tiny-x86_64.exe`- Não .`macho`- É o que se passa .`ledger_main`Com os seus estubes, arranjos em cadeia, filas de arranjos e exportações, o layout legado de `ledger_main_nochain`, o Dylib, e os dois relatórios de strip.`identification`O que é verdade? Os quatro métodos com pontuações e as assinaturas com as suas colisões.`-O0`E ...`-O2`- Não .

Forma esperada:

```json
{
  "elf": {"linkPlan": {"pltSymbols": ["puts", "printf"], "sizes": {".plt": 48, ".got.plt": 40, ".rela.plt": 48, ".rela.dyn": 48}, "...": "..."}, "tiny-dyn-x86_64": {"...": "..."}},
  "coff": {"main-x86_64.obj": {"...": "..."}},
  "pe": {"imports": [{"dll": "msvcrt.dll", "iat": "0x2040", "...": "..."}], "...": "..."},
  "macho": {"ledger_main": {"flags": "0x200085", "fixupRows": ["__DATA_CONST __got 0x100004000 bind libledger/_grade", "..."], "...": "..."}, "strip": {"...": "..."}},
  "identification": {"O2": {"methods": {"functionStarts": {"recall": "5/5"}, "prologueSub": {"recall": "1/5"}, "...": "..."}, "correctNames": 5}}
}
```

Leia `code/main.py`na ordem seguinte:

1. `ElfFile`Leia cabeçalhos, secções, tabelas de símbolos e realocações, e `dynamic_entries()`- Não .`jump_slots()`- Não .`plt_entries()`, e `plt0()`Leia a imagem ligada.
2. `plan_dynamic_link()`Aplica-se o quadro 4.9 e a secção 5.2 aos registos de realocação de objetos realocaveis.
3. `CoffObject`lê o cabeçalho do arquivo, a tabela de secções, os símbolos de 18 bytes com os seus registros auxiliares e as transferências de 10 bytes.
4. `PeImage`lê o material MS-DOS, a assinatura PE, o cabeçalho opcional, os diretórios de dados, as secções e os diretórios de importação, exportação e realocação de base, e `iat_calls()`decodificadores`ff 15`- Não .
5. `MachoFile`lê comandos de carga, segmentos, `nlist`registros, a tabela de símbolos indiretos, colunas, fixações em cadeia, os testes de exportação e as transferências de objetos.
6. `FunctionFinder`- É o que eu faço .`score()`Comparar cada um com a verdade.
7. `signatures_from_object()`E ...`match_signatures()`construir e aplicar as assinaturas em forma de FLIRT.
8. O `parse_*`As funções de leitura são as que leem o texto da ferramenta capturada, comparado com os testes.

Mais comandos:`python3 code/main.py elf FILE`- Não .`coff FILE`- Não .`pe FILE`, e `macho FILE`Imprimir um relatório. `python3 code/main.py plan OBJECT...`Imprime o plano de ligação para qualquer conjunto de objetos ELF. `python3 code/main.py functions STRIPPED UNSTRIPPED OBJECT...`Marca os encontradores e as assinaturas em outro par de suas próprias construções.

## Usá-lo

Use os leitores nesta ordem num programa que construiu.

1. Leia os cabeçalhos e nomeie o formato e o tipo: objeto transferível, executável ou biblioteca compartilhada.
2. Lista das importações junto dos seus fornecedores: `DT_NEEDED`E ...`.dynsym`, o diretório de importações ou o quadro das importações em cadeia e `LC_LOAD_DYLIB`Cada chamada a um nome na lista deixa a imagem.
3. Siga uma chamada à mão até seu espaço. Escreva os bytes de chamada, os bytes de estúdio ou PLT, o endereço do espaço, a palavra no arquivo e o que o carregador escreve lá. Se a palavra no arquivo parece lixo, decodifique-o como uma correção antes de chamá-lo de lixo.
4. Comparar a tabela de símbolos com as exportações e a função inicia.`strip`Diz a que grupo pertencia um nome desaparecido.
5. Em uma construção despojada, execute os encontradores que você pode executar e pontua-los contra o gêmeo não despojado enquanto você ainda tem um.`LC_FUNCTION_STARTS`- Não .`.pdata`, ou `.eh_frame`, sobre padrões de byte, e usar alvos de chamada para preencher lacunas.
6. Construa assinaturas a partir de seus próprios objetos e aplique-as. Registre cada colisão e o byte que a divide. Um nome que duas assinaturas reivindicaram é um desconhecido até que a cauda ou um nome referenciado o decida.

Mantenha o texto da ferramenta capturada com os arquivos. Quando a cadeia de ferramentas mudar, recapture, porque uma listagem alterada é uma fixação alterada.

## Laboratório Interativo

### Laboratório A: o PLT à mão

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code
python3 -q
```

- Correr .

```python
from main import *
elf = load_elf("tiny-dyn-x86_64")
[(e.tag_name, e.text) for e in elf.dynamic_entries()]
elf.plt0()
[(e.symbol, hex(e.address), hex(e.slot), hex(e.slot_initial)) for e in elf.plt_entries()]
[hex(w) for w in elf.got_plt_words()]
```

Antes de cada chamada, calcule a resposta a partir dos bytes no texto acima.`IMPORTS`em `build_tiny_dyn_elf.py`A partir de três nomes, reconstruir e prever os novos tamanhos de`.plt`- Não .`.got.plt`, e `.rela.plt`antes de as ler.

### Laboratório B: um arranjo em cadeia

```python
exe = load_macho("ledger_main")
stub = next(s for s in exe.stubs() if s.symbol == "_puts")
stub.lines()
raw = int.from_bytes(exe.read(stub.slot, 8), "little")
hex(raw), raw >> 63, (raw >> 51) & 0xfff, raw & 0xffffff
[(i.index, i.name, i.library) for i in exe.chained_fixups()["imports"]]
```

Primeiro, decodifique a palavra de ligação no papel: o bit de ligação, o `next`campo em unidades de quatro bytes, o ordinal. Então leia a palavra oito bytes mais e confirme que é a próxima fixação.`0x100004058`e explicar por que é`next`É zero.

### Laboratório C: strip e relink

No diretório de acessórios, liga um programa novo ao dilib totalmente despojado:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code/fixtures
clang -target arm64-apple-macos -O1 main.c -L. -lledger.stripped -Wl,-rpath,@executable_path -o /tmp/relinked
nm /tmp/relinked | grep ' U '
dyld_info -exports libledger.stripped.dylib
```

O link é bem sucedido com uma biblioteca cujo `LC_SYMTAB`É vazio, porque o editor de links lê o export trie.`python3 ../main.py macho libledger.stripped.dylib`e comparar`symtab`- Não .`exports`, e `functionStarts`Depois , despoja a construção estática com`-N`Em vez disso, vejam o que é.`dyld_info -function_starts`Ainda há impressões digitais.

### Laboratório D: a colisão

```python
from main import *
stripped = load_macho("static-arm64-O2.stripped")
sigs = signatures_from_object(load_macho("ledger-arm64-O2.o"))
[s.pat_line() for s in sigs]
starts = FunctionFinder(stripped).function_starts()
match_signatures(sigs, stripped, starts)
```

Leia os dois registos de colisão e depois construa as assinaturas de`ledger-arm64-O0.o`, compará-los contra`static-arm64-O0.stripped`, e explicar a partir do `.pat`Linhas por que não ocorre colisão em `-O0`Então abreviar .`PATTERN_LENGTH`A partir de 16 e contar quantas funções chocam.

## Laboratório de Prática

Decodificar as tabelas de ligação antigas e adicionar o PE finder.

Requisitos:

- Descifrar o `LC_DYLD_INFO_ONLY`rebase, bind e lazy bind fluxos de opcode de `ledger_main_nochain`em linhas com segmento, seção, endereço, tipo e alvo, e torná-los iguais às 21 linhas no capturado `dyld_info -fixups`- Não.
- Adicionar um`PT_GNU_RELRO`programa de cabeçalho e um `DT_FLAGS`com`DF_BIND_NOW`- Não .`build_tiny_dyn_elf.py`- Não .`.got.plt`dentro da faixa coberta, e fazer `llvm-objdump -p`Diz nas instalações README que parte do RELRO completo esta reproduza e que parte apenas glibc pode executar.
- Escreva um`.pdata`leitores para uma imagem PE32+ e um buscador de funções que utiliza `RUNTIME_FUNCTION`Comece com endereços.`clang -target x86_64-pc-windows-msvc -c`Sem`-fno-asynchronous-unwind-tables`, lê-o .`.pdata`As alterações de posição são:
- Escreva um teste para cada leitor que compare com o texto capturado na ferramenta.

O sucesso significa`python3 code/main.py macho ledger_main_nochain`Imprime as mesmas 21 linhas de fixação que `dyld_info`As impressões digitais, o pequeno ELF carrega um`PT_GNU_RELRO`Que ...`llvm-objdump`As listas e os`.pdata`O "Finder" designa as funções que pode e lista as funções de folha que não pode.

## Lição Artifacto

Esta lição inclui `outputs/skill-linking-loading-and-stripped-binaries.md`Usá-lo para transformar um programa que você construiu numa lista de suas importações com os seus provedores, uma chamada rastreada até ao espaço que o carregador preenche, uma declaração de que `strip`O que é que é necessário para que o sistema seja removido e o que sobreviveu, e uma recuperação pontuação de funções começa e nomeia em uma construção despojada.

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
npx tsx code/main.ts
python3 code/tests/test_main.py
```

A verificação deve provar:

- a seção dinâmica de `tiny-dyn-x86_64`- Correntes`llvm-objdump -p`Tag por tag, e `DT_FLAGS_1`Carrega`DF_1_PIE`
- Os dois .`R_X86_64_JUMP_SLOT`Registros correspondentes`llvm-objdump -R`e nome`puts`E ...`exit`
- PLT0 empurra GOT+8 e salta através de GOT+16, cada entrada lê a sua fatia e empurra o seu índice, e cada fatia contém o seu próprio endereço `pushq`
- As seções e os cabeçalhos do programa da pequena partida ELF `llvm-objdump -h -p`
- Os registos de realocação dos dois objetos ELF coincidem `llvm-objdump -r`
- O plano de ligação encontra dois símbolos PLT, quatro chamadas diretas, duas realocações relativas, e os tamanhos da pequena imagem
- O quadro da secção COFF, 37 registos de símbolos com registos auxiliares e correspondência de realocações `llvm-objdump -h -t -r`, e `/16`resolve `.llvm_addrsig`
- Os três COFF `REL32`registos de `ledger`Sentar-se no três ELF `PC32`compensações
- os cabeçalhos de PE, `DllCharacteristics`, e os directórios de dados correspondem `llvm-objdump -p`
- o diretório de importação, as indicações de indicação/nome e a correspondência do IAT `llvm-objdump`E ...`pefile`, e o IAT é igual à tabela de busca antes de ligar
- O diretório de exportação e o `DIR64`decodificação de realocação base, e o ponteiro realocado nomea a cadeia "ligado à mão"
- `ff 15`na RVA `0x100b`Resolve-se na fenda do IAT de `puts`
- Banderas Mach-O, os 19 nomes dos comandos de carga, e as duas bibliotecas coincidem.`otool`
- Os sete estufos decodificam para os oito.`__got`slots e correspondências da tabela de símbolos indiretos `otool -Iv`
- As cabeçalhas de correlações em cadeia coincidem .`llvm-objdump --macho --chained-fixups`
- A cadeia de caminhada reproduz todas as doze palavras cruas de `dyld_info -fixup_chain_details`
- As linhas de fixação e a tabela das importações correspondem `dyld_info -fixups`E ...`-imports`
- As exportações são de acordo com o`dyld_info -exports`para o dillib e para a sua cópia despojada
- `nm_lines()`- É igual .`nm -m`para o executável e a sua cópia desmontada
- `strip`Removido .`_main`- Não .`_fns`, e `_names`, manteve nove nomes e um .`radr://5614542`A armação é a mesma.
- O layout antigo tem `LC_DYLD_INFO_ONLY`, sete ponteiros preguiçosos, e rebases em`__stub_helper`
- arm64 reubicações de objetos correspondem `llvm-objdump -r`
- `LC_FUNCTION_STARTS`recupera cinco de cinco em ambos os níveis e é igual `nm`E ...`dyld_info -function_starts`
- O `sub sp`O scan encontra cinco em cinco em `-O0`E um de cinco em `-O2`, e o `stp`O quadro não encontra nenhum
- `bl`objetivos mais os `LC_MAIN`Recuperação de entrada cinco de cinco
- As assinaturas nomeam as cinco funções em ambos os níveis e registam o `grade`colisão dividida por byte 44
- O CRC16 do "123456789" é `0x6e90`, e os oito bytes sob o par de carga GOT de `main`são variantes
- Cada byte de objeto não variante é igual ao byte ligado
- O modelo de demonstração e os dados de figura relatam os mesmos endereços e o módulo do site incorpora os mesmos dados no ES5

## Modos de falha de produção

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| A `bl` or `call` lands in a stub | "calls an unnamed function at 0x694" | the stub bytes, the slot it loads, and the import the slot binds |
| A GOT word read from the file | "corrupt pointer 0x8010000000000007" | bit 63 is bind, `next` is 2, ordinal 7 is `_puts` from library 2 |
| `PLT32` in an object | "every call goes through the PLT" | defined symbols are reduced to a direct distance, only undefined ones get an entry |
| Partial RELRO read as full | "GOT is read-only" | `.got.plt` slots after the three reserved ones sit outside `PT_GNU_RELRO` without `-z now` |
| COFF `REL32` compared with ELF `PC32` | "the Windows build has different relocations" | same offsets, the `-4` lives in the ELF addend and in the COFF field |
| IAT read before load | "imports point at strings" | the IAT equals the lookup table until the loader binds, and the strings are hint/name entries |
| A stripped dylib | "no symbols, nothing exported" | the exports trie and `LC_FUNCTION_STARTS` list every function |
| `nm` on a stripped executable | "one function" | `LC_FUNCTION_STARTS` lists five starts, nine bytes long |
| A prologue scan at `-O2` | "one function" | four leaf functions have no frame, call targets and the starts table find them |
| Two functions share 36 bytes | "grade_label is grade" | the tail byte at 44 and the lengths 60 and 72 split the collision |
| A tool run on another machine's build | the numbers in this text | recapture every listing from your own fixtures |

## Regra de funcionamento

Siga todas as chamadas externas do site de chamada até o espaço que o carregador preenche e decodifique a palavra nesse espaço como o formato define antes de chamá-lo de endereço. Desprender-se apenas depois de ter gravado o que o carregador ainda precisa. A função de recuperação começa a partir das tabelas que o editor de links escreveu antes de rastrear por bytes, marcar cada buscador contra um gêmeo com símbolos e gravar cada colisão de assinatura com o byte que o divide.

## Mais leitura

- [System V gABI, chapter 5: Program Loading and Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement: section 5.2 and Table 4.9](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Drepper, "How To Write Shared Libraries", version 4.1.2](https://akkadia.org/drepper/dsohowto.pdf)
- [Drepper, "ELF Symbol Versioning"](https://akkadia.org/drepper/symbol-versioning)
- [Jelinek, "Little hardening DSOs/executables against exploits", binutils list, 2004-01-06](https://www.sourceware.org/ml/binutils/2004-01/msg00070.html)
- [Taylor, "Linker relro", 2008](https://www.airs.com/blog/archives/189)
- [binutils commit bd7ab16b: PLT32 for calls, 2018-02-13](https://gnu.googlesource.com/binutils-gdb/+/bd7ab16b4537788ad53521c45469a1bdae84ad4a)E ...[LLVM D43383](https://reviews.llvm.org/D43383)
- [GNU Binutils: strip](https://sourceware.org/binutils/docs/binutils/strip.html)E ...[llvm-objcopy](https://llvm.org/docs/CommandGuide/llvm-objcopy.html)
- [Microsoft, PE Format](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [CALL instruction reference, FF /2](https://www.felixcloutier.com/x86/call)
- [Apple, mach-o/loader.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)E ...[mach-o/nlist.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)
- [Apple dyld, mach-o/fixup-chains.h](https://github.com/apple-oss-distributions/dyld/blob/main/include/mach-o/fixup-chains.h)
- [Apple ld64, stub_arm64.hpp](https://github.com/apple-oss-distributions/ld64/blob/main/src/ld/passes/stubs/stub_arm64.hpp)
- [Xcode 13 release notes: chained fixups](https://developer.apple.com/documentation/xcode-release-notes/xcode-13-release-notes)E ...[WWDC22 session 110362, "Link fast: Improve build and launch times"](https://developer.apple.com/videos/play/wwdc2022/110362/)
- [strip(1)](https://keith.github.io/xcode-man-pages/strip.1.html)- Não .[ld(1)](https://keith.github.io/xcode-man-pages/ld.1.html), e [dyld(1)](https://keith.github.io/xcode-man-pages/dyld.1.html)
- [Hex-Rays, IDA F.L.I.R.T. Technology: In-Depth](https://docs.hex-rays.com/core/flirt/concepts/ida-f.l.i.r.t.-technology-in-depth)E ...[Lumina overview](https://docs.hex-rays.com/add-ons/lumina/overview)
- [Ghidra Function ID help](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/FunctionID/src/main/help/help/topics/FunctionID/FunctionID.html)E ...[AARCH64 function start patterns](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/patterns/AARCH64_LE_patterns.xml)
- [Vector 35, WARP](https://github.com/Vector35/warp)E ...[Binary Ninja WARP guide](https://docs.binary.ninja/guide/warp.html)
- [BinDiff manual](https://www.zynamics.com/bindiff/manual/)E ...[BinDiff source](https://github.com/google/bindiff)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [rizin pat.c, the .pat parser](https://github.com/rizinorg/rizin/blob/dev/librz/sign/pat.c)- Não .[radare2 flirt.c](https://github.com/radareorg/radare2/blob/master/libr/anal/flirt.c), e [radare2 book: Zignatures](https://book.rada.re/signatures/zignatures.html)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)E ...[Andriesse, Slowinska, Bos, "Compiler-Agnostic Function Detection in Binaries" (EuroS&P 2017)](https://danielandriesse.com/papers/eurosp-2017.pdf)
- [Bao et al., ByteWeight (USENIX Security 2014)](https://www.usenix.org/conference/usenixsecurity14/technical-sessions/presentation/bao)E ...[Shin, Song, Moazzezi, "Recognizing Functions in Binaries with Neural Networks" (USENIX Security 2015)](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/shin)
- [LIEF changelog](https://lief.re/doc/latest/changelog.html)- Não .[pyelftools](https://github.com/eliben/pyelftools), e [pefile](https://github.com/erocarrera/pefile)
