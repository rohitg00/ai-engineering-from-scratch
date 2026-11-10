# Anatomia do Programa: Um Leitor ELF do zero

> Um programa compilado é um conjunto de tabelas que apontam um para o outro. Um leitor que você escreveu fornece saída que você pode verificar byte por byte.

**Type:** Build
**Languages:** Python (stdlib), TypeScript, C (fixture only)
**Prerequisites:** Phase 0 · 01 (Dev Environment) with clang installed, Python 3.10 or later, hexadecimal arithmetic
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Estabelecer a regra de autorização para cada alvo nesta pista e os quatro limites de 17 U.S.C. 1201 ((f).
- Leia o cabeçalho ELF, a tabela de cabeçalho secção e ambas as tabelas de cadeia com `struct.unpack`- Não .
- Decodificar`.symtab`- e`.rela`registos com os nomes do gABI e do x86-64 psABI.
- Retorna os bytes exatos de uma função nomeada e mapeie cada arquivo compensado para a estrutura que a possui.
- Leia cabeçalhos de programa e mapear um endereço virtual para um arquivo compensado através de `PT_LOAD`- Não .
- Leia os comandos de carga de um objeto Mach-O e nomeie a ideia ELF que cada um corresponde.

## Antes de começar: Autorização e Lei

Cada alvo das lições 32 a 36 é um programa que escreveu e compilado.`code/fixtures/ledger.c`Não há licença para ler, não há proteção para passar e não há terceiros cujo código você abre. A faixa nunca abrange proteções de software, verificações de licenças ou programas que você não possui.

A regra existe porque a lei trata o desmonte como copiar. Em *Sega Enterprises Ltd. V. Accolade, Inc.*, 977 F.2d 1510 (9o Cir. 1992), o tribunal considerou que as cópias intermediárias feitas durante a desmontagem são cópias ao abrigo da Lei de Direitos Autorais. Ele declarou então que "quando o desmonte é a única maneira de obter acesso às ideias e elementos funcionais incorporados em um programa de computador protegido por direitos autorais e quando há uma razão legítima para procurar esse acesso, o desmonte é um uso justo da obra protegida por direitos autorais, como questão de lei". 

O segundo caso é *Sony Computer Entertainment, Inc. v. Connectix Corp. *, 203 F.3d 596 (9th Cir. 2000). A Connectix copiou o BIOS da PlayStation enquanto construía um emulador, e o tribunal considerou essas cópias de uso justo. Ambos os casos protegiam o estudo. Nenhum protegeu o código copiado no produto final.

Dois estatutos estabelecem os limites. 17 U.S.C. 1201 ((f) permite que uma pessoa que " tenha legalmente obtido o direito de utilizar uma cópia de um programa de computador " contorne um controlo de acesso " com o único propósito de identificar e analisar os elementos do programa necessários para alcançar a interoperabilidade de um programa de computador criado de forma independente com outros programas ". Quatro limites: uma cópia legal, o propósito da interoperabilidade, elementos que não estavam já "prontamente disponíveis" e análise que não infrinja. A secção 1201 ((f) é apenas uma exceção à regra de evasão. A questão da cópia permanece com uso justo.

Na União Europeia, a Diretiva 2009/24/CE, Artigo 5 ((3)), abrange o estudo. Uma pessoa com direito de usar uma cópia pode "observar, estudar ou testar o funcionamento do programa para determinar as ideias e princípios que subjacentes a qualquer elemento do programa".

O artigo 6.o permite a decomposição sem autorização do titular dos direitos quando "é indispensável obter as informações necessárias para alcançar a interoperabilidade de um programa de computador criado de forma independente". As condições correspondem a 1201 ((f). O titular da licença realiza os atos, as informações não estavam já prontamente disponíveis e os atos permanecem dentro das partes necessárias. O artigo 6.o, n.o 2, proíbe o uso do resultado para qualquer outro objetivo ou para um programa que seja substancialmente semelhante em expressão. O artigo 8.o torna nulos os termos contratuais contrários ao artigo 6.o ou ao artigo 5.o (3)

| Source | What it allows | Conditions |
|---|---|---|
| 17 U.S.C. 1201(f) | Circumventing an access control to analyze a program | Lawful copy, interoperability purpose, information not readily available, no infringement |
| Directive 2009/24/EC Art. 5(3) | Observing, studying, and testing a running program | A right to use the copy, acts within normal loading and running |
| Directive 2009/24/EC Art. 6 | Decompilation | Licensee, interoperability purpose, information not readily available, confined to the needed parts |
| *Sega v. Accolade* | Disassembly as fair use | The only way to reach the ideas and functional elements, a legitimate reason |
| *Sony v. Connectix* | Intermediate copies during reverse engineering | A non-infringing final product |

As notas são baseadas nos estatutos e nos pareceres, e não constituem aconselhamento jurídico. Se um futuro objectivo não for seu, obtenha autorização por escrito antes de abrir o processo e mantém a autorização com as suas provas.

## O problema

Compila-te .`ledger.c`E correu .`llvm-objdump -t`As listas de saída `percent_change`por valor `0000000000000000`com tamanho `0000000000000010`Que 16 bytes do arquivo de 1.768 bytes são essa função?`R_X86_64_PC32 .rodata+0x10`em compensação`0x36`, e os quatro bytes naquele ponto no arquivo são zero.`0x10`Quando a mesa começa em`0x14`- Não .

rea responde às perguntas de layout com `inspect_binary_layout`, e essa ferramenta só existe no Linux x64 com pwntools 4.15.0 atrás `REA_PWNTOOLS_PYTHON`Neste Mac, não está.`address_to_file_offset`precisa de uma sessão Ghidra e uma cópia completa dos bytes do arquivo original com um SHA-256 correspondente. `inspect_artifact`O conteúdo de um contêiner é o que ele possui por caminho e hash de conteúdo.`struct.unpack`Os testes comparam cada tabela com`llvm-objdump`texto capturado uma vez nas acessórios.

```figure
elf-byte-map
```

## O arquivo são tabelas que apontam para tabelas

O Sistema V gABI, capítulo 4, figura 4-1, desenha duas visões de um arquivo. A visão de ligação tem um cabeçalho ELF, uma tabela de cabeçalho de programa opcional, seções e uma tabela de cabeçalho de seção necessária. A visão de execução tem um cabeçalho ELF, uma tabela de cabeçalho de programa necessária, segmentos e uma tabela de cabeçalho de seção opcional. O gABI adiciona uma frase que rege todo o leitor: "Somente o cabeçalho ELF tem uma posição fixa no arquivo". Todas as outras estruturas são encontradas por um offset armazenado em outra estrutura.

O gABI também fixa os tipos escalares e diz que "ELF não usa campos de bits". `Elf64_Addr`E ...`Elf64_Off`são 8 bytes, `Elf64_Half`é 2, `Elf64_Word`é 4, e `Elf64_Xword`O x86-64 psABI, secção 4. 1.1, requer `ELFCLASS64`- Não .`ELFDATA2LSB`- Não .`e_machine` `EM_X86_64`(62), e `e_flags`0. - pequena endea com largura fixa média `struct.unpack`com um `<`O prefixo lê todos os registos numa chamada.

Os primeiros 64 bytes de `ledger-x86_64-O1.o`- Não .

```text
00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............
00000010: 0100 3e00 0100 0000 0000 0000 0000 0000  ..>.............
00000020: 0000 0000 0000 0000 2804 0000 0000 0000  ........(.......
00000030: 0000 0000 4000 0000 0000 4000 0b00 0100  ....@.....@.....
```

Leia-os contra a página "ELF Header" da GABI. `e_ident`é o 16 bytes `7f 45 4c 46`(a magia), classe 2 (64 bits), dados 1 (little-endian), versão 1, OS ABI 0 (Sistema V), e empilhamento.

Então ...`e_type` `0x0001`É o que é`ET_REL`, um objeto realojável.`e_machine` `0x003e`é 62, `EM_X86_64`- Não .`e_entry`é zero porque um objeto não tem ponto de entrada. `e_phoff`é zero porque um objeto não tem cabeçalhos de programa. `e_shoff`É o que é`0x428`, o arquivo de deslocamento da tabela de cabeçalhos de secção. A última linha mantém `e_ehsize` `0x40`- Não .`e_phentsize`0 , `e_phnum`0 , `e_shentsize` `0x40`- Não .`e_shnum` `0x0b`(11 cabeçalhos), e `e_shstrndx` `0x0001`- Não .

O leitor transforma essa linha em uma chamada:

```python
fields = struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
```

A cadeia de formato é a figura gABI lida de esquerda para direita: duas meia-palavras, uma palavra, três valores de 8 bytes, uma palavra e seis meia-palavras. O leitor recusa um arquivo cuja magia, classe ou ordem de byte difere, e ele recusa `e_shentsize`ou `e_phentsize`Os valores que não são 64 e 56. Uma largura errada faria cada compensação posterior errada, então o cheque fica no topo.

## Títulos de secções e tabelas de duas cordas

Cada cabeçalho de secção é um `Elf64_Shdr`de 64 bytes (gABI Figura 4-8): `sh_name`- Não .`sh_type`- Não .`sh_flags`- Não .`sh_addr`- Não .`sh_offset`- Não .`sh_size`- Não .`sh_link`- Não .`sh_info`- Não .`sh_addralign`, e `sh_entsize`A cadeia de formato é `<IIQQQQIIQQ`- Não .`sh_name`é uma compensação para a secção cujo índice é `e_shstrndx`, e o nome termina no primeiro byte zero.`e_shstrndx`é 1, e o clang nomeou essa seção `.strtab`, por isso uma tabela serve tanto os nomes das secções como os nomes dos símbolos.

O leitor imprime os 11 cabeçalhos do objeto -O1:

```text
Idx Name             Type         Flags   Offset     Size       Addr Link Info Align
  0                  NULL                    0x0      0x0        0x0    0    0     0
  1 .strtab          STRTAB                0x368     0xbe        0x0    0    0     1
  2 .text            PROGBITS     AX        0x40     0x9f        0x0    0    0    16
  3 .rela.text       RELA         I        0x2a8     0x48        0x0   10    2     8
  4 .rodata          PROGBITS     A         0xe0     0x50        0x0    0    0     8
  5 .rela.rodata     RELA         I        0x2f0     0x78        0x0   10    4     8
  6 .rodata.str1.1   PROGBITS     AMS      0x130      0xa        0x0    0    0     1
  7 .comment         PROGBITS     MS       0x13a     0x2f        0x0    0    0     1
  8 .note.GNU-stack  PROGBITS              0x169      0x0        0x0    0    0     1
  9 .llvm_addrsig    LLVM_ADDRSIG E        0x368      0x0        0x0   10    0     1
 10 .symtab          SYMTAB                0x170    0x138        0x0    1    9     8
```

O índice 0 é o cabeçalho zero reservado. `.text`contém 159 bytes de código no arquivo de compensação `0x40`, logo após o cabeçalho, com bandeiras `A`(alocadas na memória) e `X`(executivo). `.rodata`contém 80 bytes de dados apenas para leitura. `.rodata.str1.1`tem as cinco cordas de rótulo `F\0D\0C\0B\0A\0`, 10 bytes, com bandeiras `M`(mergível) e `S`- Não, não.

`.comment`Detém o selo de compiler de 47 bytes `\0Apple clang version 17.0.0 (clang-1700.6.3.2)\0`- Não .`.llvm_addrsig`tem tipo `0x6fff4c03`, dentro da gama específica do sistema operacional `SHT_LOOS`- Não .`SHT_HIOS`que as reservas do gABI e do LLVM `ELF.h`A bandeira dele.`E`É o que é`SHF_EXCLUDE`, então um linker deixa cair.

O `sh_link`E ...`sh_info`As colunas são os indicadores entre as tabelas. `.rela.text`- Não .`sh_info`2 e `sh_link`10: corre a secção 2 e toma os seus símbolos da secção 10. `.symtab`- Não .`sh_link`1, a tabela de cordas para os nomes dos símbolos e `sh_info`9, o índice do primeiro símbolo não local. `sh_addr`é zero em cada linha porque um objeto não tem endereços ainda.

Duas regras gABI permitem que o leitor desenhe um mapa completo do arquivo. Seções "são contíguas e não se sobrepõem", e um arquivo "pode conter espaço inativo". O leitor classifica cada estrutura por offset e preenche os buracos:

```text
     0x0 +64    header   ELF header
    0x40 +159   section  .text
    0xdf +1     gap      inactive space
    0xe0 +80    section  .rodata
   0x130 +10    section  .rodata.str1.1
   0x13a +47    section  .comment
   0x169 +7     gap      inactive space
   0x170 +312   section  .symtab
   0x2a8 +72    section  .rela.text
   0x2f0 +120   section  .rela.rodata
   0x368 +190   section  .strtab
   0x426 +2     gap      inactive space
   0x428 +704   table    section header table
```

As três lacunas totalizam 10 bytes, e cada uma é alinhamento. `.rodata`- Não .`sh_addralign`8, então começa em `0xe0`Em vez de`0xdf`- Não .`.symtab`Tem alinhamento 8, por isso sete bytes ficam desutilizados depois `.comment`A tabela de cabeçalhos da secção em si está alinhada com 8.

Seções de tipo `SHT_NOBITS`Não ocupar bytes de arquivo em tudo, então o mapa os salta. Nada neste objeto tem esse tipo.`.bss`num programa ligado, e um leitor que confia.`sh_size`- Não. - Está lá o ficheiro.

## Símbolos: ligação, tipo, secção, valor, tamanho

Um `Elf64_Sym`é de 24 bytes (gABI Figura 4-18): `st_name`- Não .`st_info`- Não .`st_other`- Não .`st_shndx`- Não .`st_value`- Não .`st_size`, formato `<IBBHQQ`- Não .`st_info`O gABI designa as ligações `STB_LOCAL`0 , `STB_GLOBAL`1, `STB_WEAK`2, e os tipos `STT_NOTYPE`0 , `STT_OBJECT`1, `STT_FUNC`2 , `STT_SECTION`3, `STT_FILE`4. Os dois bits mais baixos de `st_other`manter a visibilidade,`STV_DEFAULT`0 aqui em todo.

```text
Idx            Value   Size Bind   Type    Section          Name
  0              0x0      0 LOCAL  NOTYPE  *UND*
  1              0x0      0 LOCAL  FILE    *ABS*            ledger.c
  2              0x0     20 LOCAL  OBJECT  .rodata          labels.rel
  3              0x0      0 LOCAL  SECTION .rodata          .rodata
  4              0x2      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.1
  5              0x4      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.2
  6              0x6      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.3
  7              0x8      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.4
  8              0x0      0 LOCAL  SECTION .rodata.str1.1   .rodata.str1.1
  9              0x0     16 GLOBAL FUNC    .text            percent_change
 10             0x10     46 GLOBAL FUNC    .text            grade
 11             0x40     31 GLOBAL FUNC    .text            total
 12             0x60     63 GLOBAL FUNC    .text            grade_label
```

O índice 0 é o símbolo reservado indefinido. `st_shndx`nome da seção que define o símbolo, com três valores reservados: `SHN_UNDEF`0 , `SHN_ABS` `0xfff1`para o nome do ficheiro, e `SHN_COMMON` `0xfff2`Os símbolos da secção têm um nome vazio, por isso`llvm-objdump`A regra gABI de que "todos os símbolos com STB_LOCAL ligando precedem os símbolos fracos e globais" aparece como as primeiras nove linhas, e `.symtab`registados em 9 de`sh_info`Por isso.

Em um objeto realojável`st_value`é um deslocamento dentro da seção do símbolo, porque `sh_addr`O arquivo de compensação de uma função é, portanto, `sh_offset + st_value - sh_addr`, e o seu comprimento é `st_size`- Não .

```python
section = elf.sections[symbol.st_shndx]
file_offset = section.sh_offset + (symbol.st_value - section.sh_addr)
code = elf.data[file_offset : file_offset + symbol.st_size]
```

Para o`percent_change`É isso.`0x40 + 0`, e os 16 bytes são `85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`Os tamanhos importam tanto quanto os arranques.`grade`termina em `.text`compensação`0x3e`Os dois bytes .`66 90`que seguem são um `nop`O compilador adicionou para que `total`Começa em`0x40`O que é que é um símbolo de um "título" é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título" que é um "título "título" que é um "título "título" que é um "título "título "`st_size`A lição 36 mascara-os antes de comparar uma reconstrução.

## Relocalizações: o que significam os bytes zero

Um `Elf64_Rela`é de 24 bytes (gABI Figura 4-23): `r_offset`- Não .`r_info`, e um assinado`r_addend`, formato `<QQq`O GABI se divide .`r_info`com duas macros: `ELF64_R_SYM(i)`É o que é`i >> 32`E ...`ELF64_R_TYPE(i)`É o que é`i & 0xffffffff`- Num ficheiro realojável .`r_offset`é um deslocamento dentro da seção nomeada pela tabela `sh_info`Os nomes e fórmulas dos tipos vêm do x86-64 psABI, Tabela 4.9.`S`é o valor do símbolo, `A`O aditivo, `P`O local a ser parcheado e `L`a entrada do PLT. `R_X86_64_64`É o que é`S + A`- Não .`R_X86_64_PC32`É o que é`S + A - P`, e `R_X86_64_PLT32`É o que é`L + A - P`- Não .

O objeto -O1 tem oito registos:

```text
  .rela.text       0x36 R_X86_64_PC32          .rodata+0x10
  .rela.text       0x84 R_X86_64_PC32          .rodata+0x24
  .rela.text       0x93 R_X86_64_PC32          .rodata-0x4
  .rela.rodata      0x0 R_X86_64_PC32          .rodata.str1.1
  .rela.rodata      0x4 R_X86_64_PC32          .L.str.1+0x4
  .rela.rodata      0x8 R_X86_64_PC32          .L.str.2+0x8
  .rela.rodata      0xc R_X86_64_PC32          .L.str.3+0xc
  .rela.rodata     0x10 R_X86_64_PC32          .L.str.4+0x10
```

- Despejam o primeiro.`0x36`Está dentro .`grade`, que abrange `0x10`- Não .`0x3e`- As instruções no`0x33`É o que é`48 8d 0d 00 00 00 00`, a `lea`de um endereço RIP relativo, e o seu deslocamento de quatro bytes fica em `0x36`O processador adiciona o deslocamento ao endereço da próxima instrução.`0x3a`- Não .

O compilador quer que o resultado seja `.rodata + 0x14`, onde uma tabela de cinco entradas de valores de 32 bits `1, 2, 3, 4, 4`Então o valor armazenado deve ser`(.rodata + 0x14) - 0x3a`A fórmula .`S + A - P`com`P = 0x36`dá`.rodata + A - 0x36`- Definição dos dois dados iguais .`A = 0x14 - 4 = 0x10`O adendo contém o offset-alvo menos os quatro bytes entre o deslocamento e o fim da instrução.

Essa tabela é como o clang compilou o `switch`em `grade`O código calcula.`score / 10`com um multiplicador por `0x66666667`O objeto -O1 ELF não mantém nenhum símbolo para a tabela.`.rodata`Mais um adicionado, e apenas a construção do arm64 da mesma fonte chama-o `l_switch.table.grade`O segundo disco, em`0x84`em `grade_label`, pontos numa segunda tabela de valores de 8 bytes em `.rodata + 0x28`O terceiro, em`0x93`, pontos em `.rodata + 0x0`, o início de `labels.rel`- Não .

Os cinco .`.rela.rodata`registos preencher `labels.rel`Cada entrada fica em compensação .`4i`E recebe o adicionado.`4i`- Então ...`S + A - P`reduz-se ao endereço da cadeia menos a base da tabela. `grade_label`lê uma entrada com `movslq`O primeiro registro chama o símbolo da seção`.rodata.str1.1`com adição 0 porque a cadeia `F`É o primeiro byte dessa seção.`.L.str.1`- Não .`.L.str.4`, os rótulos locais do compilador para `D`- Não .`C`- Não .`B`, e `A`- Não .

A mesma fonte compila em três tabelas diferentes em três níveis de otimização. O leitor mostra a diferença sem um desmonte:

| Build | Where `labels` lives | How `grade` selects | How `grade_label` reaches `grade` |
|---|---|---|---|
| -O0 | `.data`, five 8-byte pointers, five `R_X86_64_64` records | A jump table in `.rodata`: five `R_X86_64_PC32` records pointing into `.text` | A call with `R_X86_64_PLT32 grade-0x4` |
| -O1 | `.rodata` as `labels.rel`, five 32-bit relative entries | A value table at `.rodata+0x14`, one `R_X86_64_PC32` | Inlined, no call |
| -O2 | Same as -O1 | Same as -O1 | Inlined, `total` grows to 140 bytes |

-0 a 0`switch`É uma mesa de salto real cujas cinco entradas apontam para trás.`.text`- Não .`+0x91`- Não .`+0x8c`- Não .`+0x87`- Não .`+0x82`, e `+0x86`- A chamada para ...`grade`- É o mesmo.`-0x4`A Comissão propõe que os Estados-Membros adoptem medidas de controlo para a aplicação da legislação comunitária.`lea`No -O1, o optimizador viu que cada caso retorna uma constante e substituiu os saltos com uma tabela de resultados.

## Títulos de Programação: O Visto do Carregador

Um objeto relocable não tem cabeçalhos de programa, então `e_phnum`Um executável ou um objeto compartilhado tem eles, e o carregador não lê nada mais.`Elf64_Phdr`é de 56 bytes (gABI Figura 5-1): `p_type`- Não .`p_flags`- Não .`p_offset`- Não .`p_vaddr`- Não .`p_paddr`- Não .`p_filesz`- Não .`p_memsz`- Não .`p_align`, formato `<IIQQQQQQ`O GABI fixa três regras para o`PT_LOAD`Eles aparecem em ascensão.`p_vaddr`ordem, e um `p_memsz`maior do que `p_filesz`significa zero preenchimento.`p_vaddr`é congruente com `p_offset`Modulo `p_align`- Não .

Cada alvo nesta faixa é um programa que você construiu, e nenhum linker neste Mac produz um executável Linux a partir de `ledger.o`Então , o dispositivo`tiny-x86_64`vem de`code/fixtures/build_tiny_elf.py`, que escreve 736 bytes com `struct.pack`O arquivo contém um cabeçalho ELF, dois cabeçalhos de programa, um 36-byte.`_start`, um 3 bytes `.rodata`, uma tabela de símbolos e seis cabeçalhos de secções.`_start`escreve`ok\n`No Linux x86-64 ele é executado. Aqui é um ajuste para o caminho de cabeçalho do programa.

```text
Program headers:
  PT_LOAD          r-x offset=0x0 vaddr=0x400000 filesz=0x2e0 memsz=0x2e0 align=0x1000
  PT_GNU_STACK     rw- offset=0x0 vaddr=0x0 filesz=0x0 memsz=0x0 align=0x10

entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

O single .`PT_LOAD`mapeia todo o arquivo de 736 bytes em `0x400000`O leitor mapeia um endereço para um arquivo compensado encontrando o `PT_LOAD`que o contém e computação `p_offset + (address - p_vaddr)`Para o ponto de entrada que é`0 + (0x4000b0 - 0x400000) = 0xb0`, o início de `.text`- Não .

Este é o cálculo por trás da rea.`address_to_file_offset`Para um alvo Ghidra, essa ferramenta retorna.`{address, file_offset}`O fornecedor do Hopper também volta .`provider_file_offset`E ...`image_base_file_offset`A ferramenta necessita de uma cópia original completa do ficheiro e o SHA-256 dessa cópia deve corresponder ao alvo.`inspect_binary_layout`adiciona uma linha para manter: "Um endereço vinculado não é um endereço de tempo de execução". Uma carga executável independente de posição em uma base escolhida pelo kernel, e o offset de arquivo é a única coordenada estável.

Os cabeçalhos do programa também explicam por que um executável despojado ainda está em execução. Um linker pode remover a tabela de cabeçalhos de seção inteiramente, e `e_shoff`Uma ferramenta que percorre secções não vê nada.

## As mesmas ideias em Mach-O

A Apple não publica nenhuma especificação de prosa para Mach-O. Os cabeçalhos na fonte XNU são a especificação: `EXTERNAL_HEADERS/mach-o/loader.h`- Não .`nlist.h`, e `reloc.h`- O aparelho .`ledger-arm64-O1.o`É o mesmo.`ledger.c`construído com `clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -c`- Não .

A.`mach_header_64`é 32 bytes: `magic`- Não .`cputype`- Não .`cpusubtype`- Não .`filetype`- Não .`ncmds`- Não .`sizeofcmds`- Não .`flags`- Não .`reserved`A magia é`0xfeedfacf`- Não .`MH_MAGIC_64`- Não .`cputype`É o que é`0x0100000c`- Não .`CPU_TYPE_ARM64`- Não .`filetype`é 1, `MH_OBJECT`- Não .`ncmds`é 5 e `sizeofcmds`é 616: os comandos de carga ocupam os 616 bytes após o cabeçalho, e cada um começa com `{cmd, cmdsize}`A bandeira .`0x2000`É o que é`MH_SUBSECTIONS_VIA_SYMBOLS`- Não .

```text
Load commands:
  0 LC_SEGMENT_64                cmdsize=472 at 0x20
  1 LC_BUILD_VERSION             cmdsize=24 at 0x1f8
  2 LC_LINKER_OPTIMIZATION_HINT  cmdsize=16 at 0x210
  3 LC_SYMTAB                    cmdsize=24 at 0x220
  4 LC_DYSYMTAB                  cmdsize=80 at 0x238
```

`LC_SEGMENT_64`0x19) é a resposta Mach-O para ambas as tabelas ELF.`segment_command_64`- Não .`segname`- Não .`vmaddr`- Não .`vmsize`- Não .`fileoff`- Não .`filesize`- Não .`maxprot`- Não .`initprot`- Não .`nsects`, e `flags`Então ...`nsects`registos de tipo `section_64`, 80 bytes cada, seguindo o mesmo comando.`loader.h`comentar sobre `MH_OBJECT`Diz que as seções vivem "em um segmento sem nome sem tampão de segmento".`fileoff`648, `filesize`456, e cinco secções.

```text
  Idx Section                    Addr   Size Offset Reloff Nreloc Type
    1 __TEXT,__text               0x0   0xd0    648   1104      6 S_REGULAR
    2 __DATA,__const             0xd0   0x28    856   1152      5 S_REGULAR
    3 __TEXT,__cstring           0xf8    0xa    896      0      0 S_CSTRING_LITERALS
    4 __TEXT,__const            0x108   0x40    912      0      0 S_REGULAR
    5 __LD,__compact_unwind     0x148   0x80    976   1192      4 S_REGULAR
```

Cada secção nomeia o seu segmento-mãe em `segname`, por isso duas secções chamadas`__const`são distintos porque um é`__DATA,__const`E o outro .`__TEXT,__const`As mudanças são por secção até`reloff`E ...`nreloc`, onde o ELF tem um separado `.rela.X`secção por alvo.

Cada um .`relocation_info`É 8 bytes.`r_address`Um campo de 32 bits segue, embalado como`r_symbolnum`(Bits 24), `r_pcrel`(1) `r_length`(2) `r_extern`(1) e `r_type`(4) Os seis `__text`Os registos são três pares de`ARM64_RELOC_PAGE21`E ...`ARM64_RELOC_PAGEOFF12`, um par por mesa de referência.`adrp`- E mais .`add`faz o que um x86-64 `lea`- É verdade, por isso, cada referência precisa de dois registos.`__DATA,__const`Os registos são`ARM64_RELOC_UNSIGNED`com`r_length`3, então cada um corre um punteiro absoluto de 8 bytes.

A -O1 a construção do arm64 manteve-se`labels`como ponteiros simples onde a construção x86-64 fez uma tabela relativa.

`LC_SYMTAB`(0x2) é válido `symoff`1240, `nsyms`17 anos.`stroff`1512, `strsize`176, e 1512 mais 176 é 1688, o tamanho do arquivo.`nlist_64`é de 16 bytes: `n_strx`- Não .`n_type`- Não .`n_sect`- Não .`n_desc`- Não .`n_value`- Não .`n_type`É um campo de trabalho.`N_TYPE`(mascareta)`0x0e`) igual a `N_SECT`(`0xe`) significa definido na secção cujo ordinal baseado em 1 é `n_sect`- Não .`N_EXT`(`0x01`) marca um símbolo externo.

`nlist_64`Não tem campo de tamanho.`_percent_change`O leitor toma o seguinte endereço do símbolo na mesma secção, `_grade`- Não .`0x18`. Os símbolos C têm um liderança `_`Aqui, então a função é `_percent_change`- Não .

`LC_DYSYMTAB`(0xb) registra a mesma regra local-primeira que a ELF `sh_info`- Não .`ilocalsym`0 , `nlocalsym`13, `iextdefsym`13, `nextdefsym`4. `LC_BUILD_VERSION`(0x32) registos `platform`1 (macOS), `minos`26.0 e `sdk`26.2 embalado `XXXX.YY.ZZ`O comando é por isso que o arm64 fixture é comprometido como bytes. Uma construção em um Mac com outro SDK produz um arquivo diferente.

O leitor é o que eu quero.`compare_formats`coloca os dois arquivos lado a lado:

| Idea | ELF, `ledger-x86_64-O1.o` | Mach-O, `ledger-arm64-O1.o` |
|---|---|---|
| File identity | `e_ident` `7f 45 4c 46`, class 64, data LSB | `magic` `0xfeedfacf` |
| Machine | `e_machine` 62, `EM_X86_64` | `cputype` `0x100000c`, `CPU_TYPE_ARM64` |
| File kind | `e_type` 1, `ET_REL` | `filetype` 1, `MH_OBJECT` |
| Where the tables are | `e_shoff` `0x428`, 11 section headers | 5 load commands, 616 bytes after the header |
| The code | `.text` at `0x40`, size `0x9f`, flags `AX` | `__TEXT,__text` at 648, size `0xd0`, in the unnamed segment |
| Symbol names | `.symtab` (section 10), names in `.strtab` through `sh_link` 1 | `LC_SYMTAB` `symoff` 1240, `nsyms` 17, names at `stroff` 1512 |
| Symbol size | `st_size`: `percent_change` is 16 bytes | No field: next symbol minus this one, 24 bytes |
| Relocations | `.rela.text`, 3 records, `R_X86_64_PC32` | `__text` `reloff` 1104, 6 records, `PAGE21` and `PAGEOFF12` |
| Function bytes | `percent_change`: 16 bytes at `0x40` | `_percent_change`: 24 bytes at `0x288` |

Rea lê Mach-O através de `inspect_macho`, que corre`otool -h -l`- Não .`nm -gjU`- Não .`dyld_info -imports -exports`, e `dwarfdump --uuid`através de`xcrun`O teu leitor não precisa de nada, e lê o mesmo.`symoff`E ...`stroff`Que ...`otool -l`As impressões digitais.`open_binary`O instrumento de rea detecta ELF, MZ, PE e Mach-O fino ou universal dos bytes mágicos.`e_machine`Isso é os primeiros 20 bytes do que você construiu aqui. para um arquivo sem cabeçalho, você dá`format: raw-binary`O provedor Ghidra recusa um binário universal e pede uma fatia magra.`0xcafebabe`- Não .

## Construí-lo

Execute o leitor de biblioteca padrão:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
```

A demonstração diz:`ledger-x86_64-O1.o`e imprime seu cabeçalho, seções, símbolos, relocalizações e mapa de offset de arquivo.`ledger-arm64-O1.o`, e imprime a tabela de comparação.`tiny-x86_64`- Linhas esperadas:

```text
percent_change: 16 bytes at file offset 0x40: 85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3
grade: 46 bytes at file offset 0x50: 48 63 c7 48 69 c0 67 66 66 66 ...
entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

Passe um caminho para ler um arquivo: `python3 code/main.py code/fixtures/ledger-x86_64-O0.o`O leitor escolhe ELF ou Mach-O dos primeiros quatro bytes.

Leia `code/main.py`na ordem seguinte:

1. `ElfFile._read_header()`verifica a magia, a classe, a ordem de byte e os tamanhos de entrada, e depois desembaga o cabeçalho.
2. `ElfFile._read_sections()`E ...`read_cstring()`ler a tabela de cabeçalhos de secções e resolver nomes através de `e_shstrndx`- Não .
3. `ElfFile._read_symbols()`Divisões`st_info`, resolve nomes através de `sh_link`, e mantém os índices da secção reservada legíveis.
4. `ElfFile._read_relocations()`anda a cada vez.`SHT_RELA`secção, divisões `r_info`, e os tipos de nomes do quadro 4.9.
5. `ElfFile.function_span()`E ...`function_bytes()`transformar um símbolo em um intervalo de arquivos e os bytes nele.
6. `ElfFile.file_offset_map()`classifica todas as estruturas por compensação e preenche o espaço inativo.
7. `ElfFile._read_program_headers()`E ...`address_to_file_offset()`Manutenção de executáveis.
8. `MachOFile`lê o cabeçalho, os comandos de carga,`LC_SEGMENT_64`com as suas secções, `LC_SYMTAB`- Não .`LC_BUILD_VERSION`, e realocações por secção.
9. `compare_formats()`Nomes da mesma ideia em ambos os arquivos com os valores leídos de cada um.

## Usá-lo

Importa o leitor das aulas posteriores com `from main import ElfFile`Depois de adicionar a lição `code`diretório de `sys.path`A lição 33 pede-lhe .`function_bytes`E ...`relocations_for(".text")`A lição 35 registra a sua saída como evidência observada. a lição 36 pede que os offsets de realocação sejam mascarados antes de uma comparação em byte.

Compile o seu próprio C em um objeto com o mesmo `clang -target x86_64-unknown-linux-gnu -c`Adicionar um nome de realocação apenas quando a tabela 4.9 x86-64 psABI o enumera. Adicionar um tipo de seção apenas quando o gABI ou a cadeia de ferramentas produtor documentá-lo. Quando o leitor encontra um valor para o qual não tem nome, ele imprime o número em hexadecimal em vez de adivinhar.

## Laboratório Interativo

### Laboratório A: o cabeçalho à mão

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code
python3 -q
```

- Correr .

```python
import struct
from main import ElfFile, FIXTURES
data = (FIXTURES / "ledger-x86_64-O1.o").read_bytes()
data[:4], data[4], data[5]
struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
elf = ElfFile(data)
elf.header.e_shoff, elf.header.e_shnum, elf.sections[elf.header.e_shstrndx].name
```

O show de tuplos .`e_type`1, `e_machine`62, e `e_shoff`1064, que é `0x428`A última linha mostra que a secção 1`.strtab`, tem os nomes das secções.

### Laboratório B: o quadro de valores por trás do interruptor

```python
rodata = elf.section_bytes(elf.section(".rodata"))
[int.from_bytes(rodata[i : i + 4], "little") for i in range(0x14, 0x28, 4)]
[int.from_bytes(rodata[i : i + 8], "little") for i in range(0x28, 0x50, 8)]
[r for r in elf.relocations_for(".text") if r.symbol == ".rodata"]
```

As duas tabelas são ledas .`1, 2, 3, 4, 4`Verifique-os contra .`ledger.c`- Não .`grade(65)`Computação`65 / 10 - 6 = 0`e lê a entrada 0, que é 1, o valor de `case 6`- Não .`grade(100)`O valor é 4 , o valor compartilhado por `case 10`E ...`case 9`- Não .

### Laboratório C: três construções de uma fonte

```python
for level in ("O0", "O1", "O2"):
    obj = ElfFile.from_path(FIXTURES / f"ledger-x86_64-{level}.o")
    print(level, [s.name for s in obj.sections if s.name in (".data", ".rodata")])
    print(level, sorted({r.type_name for r in obj.relocations}))
    print(level, {s.name: s.st_size for s in obj.symbols if s.type == "FUNC"})
```

O objeto -O0 tem um `.data`Os objetos -O1 e -O2 não têm`.data`E um tipo.`total`é 66 bytes em -O0, 31 em -O1, e 140 em -O2.

### Laboratório D: a mesma função em Mach-O

```python
from main import MachOFile
macho = MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
[(c.name, c.cmdsize) for c in macho.load_commands]
macho.function_span("_percent_change")
macho.function_bytes("_percent_change")[:4].hex()
```

O espaço é de 24 bytes no arquivo de 648 offset. Os primeiros quatro bytes são `a0000034`, a forma de instrução de pequeno porte .`0x340000a0`, que `llvm-objdump -d`impressões como `cbz w0, 0x14`É o que eu quero .`before == 0`O mesmo teste que o x86-64 codifica como `85 ff 74 09`- Não .

## Laboratório de Prática

Extenda o leitor para um programa ligado. Em uma máquina Linux x86-64, construa `clang -O1 -shared -fPIC code/fixtures/ledger.c -o libledger.so`E ...`clang -O1 code/fixtures/ledger.c -o ledger_main`com um `main`adicionar, e depois executar o leitor em ambos.

Requisitos:

- Leia `.dynsym`com o mesmo `Elf64_Sym`- a disposição, desde `SHT_DYNSYM`É 11 e o registro é inalterado.
- Leia `.dynamic`Como `Elf64_Dyn`registos de `d_tag`E ...`d_val`, e nome `DT_NEEDED`- Não .`DT_STRTAB`- Não .`DT_SYMTAB`- Não .`DT_RELA`, e `DT_JMPREL`da página gABI "Seção dinâmica".
- Lista os símbolos não definidos com `st_shndx` `SHN_UNDEF`As importações e as importações`R_X86_64_JUMP_SLOT`registos em `.rela.plt`como os sites de chamadas que os alcançam.
- Mapa de cada um`PT_LOAD`Segmento para as seções que contém, usando a regra gABI de que "um segmento de arquivo objeto contém uma ou mais seções".
- Prova com `address_to_file_offset`que os bytes de cada função definida no objeto compartilhado são os bytes `function_bytes`- Não.
- Captura .`llvm-objdump -h -t -r -p`E ...`llvm-objdump -T`texto para ambos os arquivos em `code/fixtures/`e comparar o leitor com eles em testes.

O sucesso significa que a lista de importação, o mapa de segmento e cada intervalo de funções concordam com a saída da ferramenta capturada, sem nenhuma execução de ferramentas durante os testes.

## Laboratório de graduação

Cinco perguntas sobre os dispositivos desta lição.`code/lab_answers.json`Escrever números como números ou como cadeias hexáceas como `"0x40"`, e listas como listas JSON.

1. `t1`: e_shoff do livro-razão-x86_64-O1.o, como número.
2. `t2`: st_size of percent_change no livro-razão-x86_64-O1.o.
3. `t3`: de texto .text em livro-razão-x86_64-O1.o, como hex.
4. `t4`: nomes dos tipos de realocação no livro-razão-x86_64-O0.o, ordenados, como lista.
5. `t5`: os cinco valores int em .rodata+0x14 no livro-razão-x86_64-O1.o, como uma lista.

Verifique as suas respostas:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/lab.py
npx tsx code/lab.ts
```

O verificador calcula cada valor esperado a partir de `code/main.py`- O que é que é?`PASS`- Não .`FAIL`ou `TODO`Para cada tarefa e uma pontuação, e sai de 0 apenas quando os cinco passarem. `python3 code/lab.py my-answers.json`Verifica outro ficheiro.`code/tests/test_lab.py`prova que o verificador aceita as respostas certas e rejeita as erradas.

### Veja como corre.

O [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)A máquina executa esta lição como suas duas primeiras estações.`percent_change`, e o gabinete abre-se .`.text`Desliga os símbolos para ver quais fatos a tabela de símbolos apresenta.

## Lição Artifacto

Esta lição produz`outputs/skill-program-anatomy-elf-from-scratch.md`. Use-o com Claude, Cursor, Codex, OpenClaw, Hermes ou qualquer agente que leia SKILL.md. A habilidade transforma um objeto compilado ou executável que o usuário construiu em um relatório de layout. O relatório dá a faixa de arquivos de cada estrutura, símbolo e realocação, verificada contra a saída da ferramenta capturada.

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A suíte prova:

- Cada secção, nome, tamanho, endereço e tipo coincide com o capturado.`llvm-objdump -h`texto para os três objetos x86-64 e o pequeno executável
- Cada valor de símbolo, vinculação, tipo, seção, tamanho e nome correspondem ao capturado `llvm-objdump -t`texto
- Cada deslocamento de compensação, nome de tipo, símbolo e adendo coincide com o capturado `llvm-objdump -r`texto, incluindo `R_X86_64_PLT32`E ...`R_X86_64_64`em -O0
- Os dois cabeçalhos do programa de`tiny-x86_64`- A par dos capturados .`llvm-objdump -p`texto, e os objetos não têm nenhum
- `percent_change`é 16 bytes em arquivo de compensação `0x40`com os bytes esperados, e cada função está dentro `.text`
- O mapa de offset de arquivo cobre cada byte de cada fixação uma vez, com as três lacunas de alinhamento do objeto -O1 em seus lugares
- o ponto de entrada de `tiny-x86_64`mapas para arquivos de compensação `0xb0`através de`PT_LOAD`, e um objeto realojável recusa o mapeamento de endereços
- O cabeçalho Mach-O, cada comando de carga, o segmento, as cinco seções,`LC_SYMTAB`, e `LC_BUILD_VERSION`- A par dos capturados .`--private-headers`texto
- Os símbolos Mach-O e as 15 realocações correspondem aos capturados .`llvm-objdump`- o texto e`_percent_change`é 24 bytes no offset 648
- Uma mágica errada, uma classe de 32 bits, um arquivo de grande endea, uma tabela truncada, um binário universal e um arquivo de fonte C todos aumentam.`FormatError`
- `build_tiny_elf.py`Reproduza o comprometido `tiny-x86_64`Byte por byte
- o módulo de figuras `site/figures-re-32.js`Carrega os bytes exatos de `ledger-x86_64-O1.o`

## Modos de falha de produção

| Failure | What the weak reading reports | What the reader must prove |
|---|---|---|
| `st_value` used as a file offset | "`percent_change` is at 0" | Offset is `sh_offset + st_value - sh_addr`, here `0x40` |
| Padding counted as code | "`grade` is 48 bytes" | `st_size` is 46 and the `66 90` after it belongs to no symbol |
| Section names read from the wrong table | Garbage names or an exception | `e_shstrndx` names the table, here section 1 |
| `sh_size` trusted for `SHT_NOBITS` | A read past the end of the file | `.bss` has no file bytes and the map skips it |
| Zero bytes read as the operand | "`lea 0(%rip)`" | The `.rela.text` record at `0x36` names `.rodata+0x10` |
| Addend read as the target offset | "the table starts at `0x10`" | `S + A - P` with the instruction end gives `0x14` |
| Sections walked on a stripped executable | "the file has no code" | `PT_LOAD` maps every address the loader uses |
| A linked address treated as a runtime address | A wrong offset under a random base | The file offset from `PT_LOAD` is the stable coordinate |
| A Mach-O section looked up by `sectname` alone | Two `__const` sections collapse into one | `segname,sectname` is the name |
| A size field expected in `nlist_64` | An exception or zero bytes | The next symbol in the same section ends the function |
| A universal binary read as one Mach-O | "magic `0xcafebabe` is unknown" | Refuse it and ask for a thinned slice |
| The arm64 object rebuilt on another Mac | "the fixture changed" | `LC_BUILD_VERSION` records the SDK, so the committed bytes are the fixture |

## Regra de funcionamento

Leia o cabeçalho em que você pode confiar, siga os offsets que ele possui e nomee cada campo da especificação que o define. Mantenha a saída da ferramenta comparada como um recurso comprometido, para que a comparação seja executada sem a ferramenta. Quando um valor não tem nome na especificação, imprima o número. O leitor que você pode verificar byte por byte é aquele que cada lição posterior baseia-se.

## Mais leitura

- [System V gABI, chapter 4: Object Files](https://www.sco.com/developers/gabi/latest/ch4.intro.html)e o [ELF Header](https://www.sco.com/developers/gabi/latest/ch4.eheader.html)- Não .[Sections](https://www.sco.com/developers/gabi/latest/ch4.sheader.html)- Não .[Symbol Table](https://www.sco.com/developers/gabi/latest/ch4.symtab.html), e [Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)Páginas
- [System V gABI, chapter 5: Program Header](https://www.sco.com/developers/gabi/latest/ch5.pheader.html)E ...[Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V ABI, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI), Tabela 4.9 Tipos de realocação
- [Apple XNU `loader.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)- Não .[`nlist.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h), e [`reloc.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/reloc.h)
- [17 U.S.C. 1201](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section1201&num=0&edition=prelim)E ...[Directive 2009/24/EC](https://eur-lex.europa.eu/eli/dir/2009/24/oj/eng)
- [Sega v. Accolade, 977 F.2d 1510](https://law.resource.org/pub/us/case/reporter/F2/977/977.F2d.1510.92-15655.html)E ...[Sony v. Connectix, 203 F.3d 596](https://law.resource.org/pub/us/case/reporter/F3/203/203.F3d.596.99-15852.html)
- [rea 6.5.0 `docs/binary-diagnostics.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/binary-diagnostics.md)E ...[`docs/ghidra-provider.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/ghidra-provider.md)
