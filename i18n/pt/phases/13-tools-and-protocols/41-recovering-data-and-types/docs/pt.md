# Recuperação de dados e tipos: estruturas, arrays, objetos C++ e DWARF

> Um decompilador imprime `a->balance`quando tem uma tabela de tipo e `*(int *)(param_1 + 4)`Esta lição constrói a tabela a partir dos acessos, lê a verdadeira da DWARF 5, e mostra onde os dois concordam.

**Type:** Build
**Languages:** Python, TypeScript, C, C++, x86-64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~140 minutes

## Objetivos de aprendizagem

- Leia um acesso de membro estrutural como registro base mais deslocamento, e um acesso de matriz como base mais índice vezes passo, a partir das regras de endereçamento Intel SDM.
- Aplicar as regras de alinhamento do Sistema V à mão para `struct account`e explicar cada byte de enchimento.
- Construir um tipo de pass de recuperação que transforma os acessos em uma listagem em offsets de campo, largura, tipos, um passo e um tamanho, com a evidência para cada um.
- Escreva um leitor DWARF 5 para `.debug_info`- Não .`.debug_abbrev`- Não .`.debug_str_offsets`, e `.debug_addr`de um objeto realojável, e verificá-lo contra `llvm-dwarfdump`- Não .
- Compare o layout recuperado com o layout DWARF e nomee cada diferença como evidência faltante, acesso combinado ou tipo não comprovável.
- Leia um Itanium C ++ vtable, seu tipo de informação, e seus nomes desfigurados de relocalizações, e resolver uma chamada virtual para um slot.

## O problema

Compila-te .`account.c`Sem`-g`E perguntou a um agente o que?`bump`O agente enviou o objeto para a Ghidra 12.1.4 e recebeu isto:

```c
void bump(long param_1,int param_2)
{
  *(int *)(param_1 + 4) = param_2 + *(int *)(param_1 + 4);
  return;
}
```

A mesma fonte compilada com `-g`dá isto do mesmo decompiler:

```c
int bump(account *a,int by)
{
  a->balance = by + a->balance;
  return a->balance;
}
```

As instruções são idênticas em ambos os objetos. A diferença é uma tabela de tipo. Com a tabela o decompilador sabe que o primeiro parâmetro aponta para uma estrutura de 32 bytes cujo campo em offset 4 é um 4 byte `int`nomeado`balance`Sem ele , o decompiler só sabe que algo com 8 bytes de largura chegou .`%rdi`e que 4 bytes em `+4`foram leitas e escritas.

Tudo nessa tabela tem uma fonte. O offset 4 vem do byte de deslocamento de `addl 0x4(%rax), %ecx`A largura 4 vem do `l`O nome vem de um`DW_TAG_member`Entrada em `.debug_info`Esta lição constrói duas metades: um pass que recupera o que as instruções provam e um leitor que decodifica o que o compilador gravou.

```figure
re-41-struct-recovery
```

## Um acesso de membro é um deslocamento

O endereço efetivo é definido como `Offset = Base + (Index * Scale) + Displacement`, com uma escala de 1, 2, 4 ou 8 e um deslocamento de 8, 16 ou 32 bits.`RIP + Displacement`. Um acesso ao membro estrutural usa o primeiro formulário sem índice: o registo base contém o endereço do objeto e o deslocamento é o deslocamento do membro.

- Toma .`bump`- Não .`-O0`A lista de`llvm-objdump -d -r`Diz:

```text
       4: 48 89 7d f8                  	movq	%rdi, -0x8(%rbp)
       e: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      12: 03 48 04                     	addl	0x4(%rax), %ecx
      15: 89 48 04                     	movl	%ecx, 0x4(%rax)
```

Decodificar`03 48 04`com as regras da lição 33. `03`É o que é`ADD r32, r/m32`ModRM `48`É o que é`01 001 000`- Não .`mod = 01`significa um operando de memória com deslocamento de 8 bits, `reg = 001`É o que é`%ecx`- Não .`r/m = 000`É o que é`%rax`O byte de deslocamento é `04`A instrução lê 4 bytes em `%rax + 4`e adiciona-os a`%ecx`- O .`l`Sufixo que `llvm-objdump`Impressões é o tamanho da operanda, então o campo é de 4 bytes de largura.`%rax`Viu do espaço do quadro em `-0x8(%rbp)`, e esse espaço recebido .`%rdi`, o primeiro argumento inteiro da convenção de chamada do sistema V. Três fatos seguem: o primeiro parâmetro é um ponteiro, o objeto que aponta tem um campo de 4 bytes no offset 4, e `bump`Leia e escreve esse campo.

Nada nesses bytes diz`int`- Não .`balance`, ou `struct account`O restante de 28 bytes da estrutura são invisíveis para os seres humanos.`bump`- Não .

## Regras de Layout do Sistema V

O x86-64 psABI, seção 3.1.2, dá três regras para agregados. "As estruturas e as uniões assumem o alinhamento de seu componente mais estritamente alinhado. Cada membro é atribuído ao offset mais baixo disponível com o alinhamento apropriado. O tamanho de qualquer objeto é sempre um múltiplo do alinhamento do objeto".`char`1 e 1, `short`2 e 2, `int`4 e 4, `double`8 e 8, qualquer ponteiro 8 e 8.

Aplicar as regras às estruturas`account.c`- Não .

```c
struct account {
    char kind;
    int balance;
    short code;
    double rate;
    const char *label;
};
```

| Member | Size | Alignment | Lowest offset that fits | Padding before |
|---|---|---|---|---|
| `kind` | 1 | 1 | 0 | 0 |
| `balance` | 4 | 4 | 4 | 3 (bytes 1 to 3) |
| `code` | 2 | 2 | 8 | 0 |
| `rate` | 8 | 8 | 16 | 6 (bytes 10 to 15) |
| `label` | 8 | 8 | 24 | 0 |

O último membro termina em 32. O alinhamento mais rigoroso é 8, e 32 é um múltiplo de 8, então o tamanho é 32 sem tampão de cauda. Nove bytes dos 32 são tampões, e o psABI diz "O conteúdo de qualquer tampão é indefinido".

A ordem dos membros determina o tamanho.`double, pointer, int, short, char`O preenchimento compensa 0, 8, 16, 20, 22 e termina em 23, que ronda até 24. `sysv_layout()`em `code/main.py`Aplica as três regras e produz ambos os resultados.`ctypes`O módulo aplica as mesmas regras através da convenção do compilador host, e `ctypes.sizeof`- Não .`ctypes.alignment`, e o `.offset`de cada campo dar 32, 8, e `0, 4, 8, 16, 24`O programa em si imprime a terceira cópia quando você a construiu e a executou nesta máquina:

```text
sizeof 32 align 8
kind 0 balance 4 code 8 rate 16 label 24
sum 315 tag -3 projected 318.75 label_length 7
```

Esse conjunto nativo é o arm64. O Arm AAPCS64 afirma as mesmas regras agregadas em sua seção 5.10.1, e o documento arm64 da Apple mantém esses cinco tamanhos escalares, então os números concordam em ambos os alvos.`-target x86_64-unknown-linux-gnu`para que o leitor ELF da lição 33 e o leitor DWARF abaixo trabalhem sobre eles.

## Leia o resto da estrutura à mão

`bump`Ve um campo. Os outros quatro funções em `account.c`Todos os endereços abaixo são de:`account-x86_64-O0-g.objdump.txt`- Não .

`sum_balances`Indica uma matriz do estruto:

```text
      51: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      55: 48 63 4d ec                  	movslq	-0x14(%rbp), %rcx
      59: 48 c1 e1 05                  	shlq	$0x5, %rcx
      5d: 48 01 c8                     	addq	%rcx, %rax
      60: 8b 40 04                     	movl	0x4(%rax), %eax
```

`%rax`É o que é`list`- Não .`%rcx`É o que é`i`de sinal estendido para 64 bits, e `shlq $0x5`multiplicado por 32. Depois do `addq`- Não .`%rax`É o que é`list + 32 * i`, e a carga lê 4 bytes no deslocamento 4 do elemento `i`O conteúdo de mudanças é o único lugar neste objeto onde o tamanho do estruto aparece como um número.`0x49`- O que é ?`jmp 0x49`- Não .`0x72`- Não .

`tag`Leia dois campos estreitos:

```text
      8c: 0f be 00                     	movsbl	(%rax), %eax
      98: 0f bf 48 08                  	movswl	0x8(%rax), %ecx
```

`movsbl`carrega um byte no offset 0 e o estende, então o campo em 0 é um número inteiro de 1 byte assinado. `movswl`carrega dois bytes no offset 8 com extensão de sinal, então o campo em 8 é um número inteiro assinado de 2 bytes.`-O1`O primeiro acesso é `cmpb $0x6c, (%rdi)`, que ainda diz 1 byte em deslocamento 0 e não diz nada sobre o sinal.

`projected`Diz-se um flutuante:

```text
      cc: f2 0f 2a 40 04               	cvtsi2sdl	0x4(%rax), %xmm0
      d5: f2 0f 59 40 10               	mulsd	0x10(%rax), %xmm0
```

`cvtsi2sdl`converte um inteiro de 32 bits assinado da memória em um duplo, o que confirma que o offset 4 possui um inteiro de 4 bits assinado. `mulsd`multiplicado por um dobro da memória, assim, o offset 16 tem um valor de ponto flutuante de 8 bytes.

`label_length`lê um punhal e segue-o:

```text
      f3: 48 8b 40 18                  	movq	0x18(%rax), %rax
      f7: 48 63 4d f4                  	movslq	-0xc(%rbp), %rcx
      fb: 80 3c 08 00                  	cmpb	$0x0, (%rax,%rcx)
```

O `movq`Ele lê 8 bytes em offset 24. Por si só que é um inteiro de 8 bytes ou um ponteiro.`cmpb`O valor que é usado como endereço é um ponteiro.`cmpb`lê 1 byte em índice `%rcx`de que, e em`-O1`O ponteiro está avançado com `leaq 0x1(%rcx), %rcx`dentro do loop, então os elementos apontados para estão 1 byte de distância.

Coloque as cinco funções juntas e a estrutura é`{ i8 at 0, i32 at 4, i16 at 8, f64 at 16, pointer at 24 }`As diferenças de 1 a 3 e 10 a 15 são exatamente o padding previsto pelas regras psABI.`const char *`, o tipo declarado do byte assinado em 0, que a fonte escreve `char`, e que as cinco funções recebem o mesmo tipo.`main`, que passa um objeto de quadro para todos os cinco.`-O0`Os locais de ligação tornam visível: `leaq -0x70(%rbp), %rdi`seguida por `addq $0x20, %rdi`Antes de`callq bump`, e `addq $0x40, %rdi`Antes de`callq tag`Os compensados 0, `0x20`, e `0x40`são três elementos de uma matriz, e o `memcpy`de`0x60`Os bytes que o preenchem são 96 bytes, que é três elementos de 32.

## O Pass

`trace_function()`em `code/main.py`O contador é um registo de 64 bits ou um slot de quadro, como `-0x8(%rbp)`Cada titular tem um dos três valores.`Pointer`é uma raiz mais um offset constante mais um conjunto de passos, onde um passo registra que um múltiplo desconhecido de tantos bytes foi adicionado.`Index`é um número inteiro de valor desconhecido que é um múltiplo de uma escala.

O estado começa com os seis registos de argumentos do Sistema V .`Pointer("param0", 0)`através de`Pointer("param5", 0)`Então, cada instrução aplica uma regra:

- A.`movq`Uma escrita de 32 bits ou mais estreita num registo torna-o um `Index`com escala 1.
- A.`leaq`com uma base de indicador produz um indicador com o deslocamento adicionado e com um registo de índices adiciona `scale * index_scale`A. A.`leaq`cuja base é`%rbp`ou `%rsp`nome de um objeto de quadro, que é como `main`Passagens`rows`- Não .
- `shlq $n`em um `Index`multiplica a sua escala por `2^n`, e `imulq $k`multiplicado por `k`- Não .
- `addq`de um ponteiro e um índice mantém o ponteiro e adiciona a escala do índice aos passos. `addq $k`O indicador move o seu deslocamento e é igualmente registado como um incremento desse registo.
- Uma chamada torna todos os registros salvos de chamadores desconhecidos, e os registros de argumentos que contêm ponteiros são registrados como um site de chamada.
- Qualquer operando de memória cujo registo base detém um ponteiro torna-se um `Access`com a raiz e o deslocamento do punhal, a largura e o tipo do mnemônico, e uma bandeira de loja.

Largura e carinho vêm apenas do mnemónico.`access_width()`mapas do `b`- Não .`w`- Não .`l`, e `q`Sufixos para 1, 2, 4 e 8 bytes, `movsbl`E ...`movswl`para cargas estreitas assinadas, `movzbl`A não assinada, a`sd`E ...`ss`instruções de SCE escalar para flutuantes de 8 e 4 bytes, `cvtsi2sdl`para uma fonte de inteiros de 4 bytes assinada, e o 16 bytes `movaps`família para um vetor. `leaq`e o `nop`Os formulários não são acessos.

```python
if memory.base in FRAME_REGISTERS:
    return Pointer(f"frame({memory.base}{format_signed(memory.displacement) if memory.displacement else ''})", 0)
base = env.get(memory.base)
if not isinstance(base, Pointer):
    return Unknown
strides = set(base.strides)
if memory.index is not None:
    index_value = env.get(memory.index)
    strides.add((index_value.scale if isinstance(index_value, Index) else 1) * memory.scale)
return Pointer(base.root, base.offset + memory.displacement, frozenset(strides), base.origin)
```

Uma carga de 8 bytes através de um ponteiro produz um novo ponteiro cujos nomes raiz do campo de que veio, como `param0->0x18`. Quando esse valor é posteriormente utilizado como base, ou avançado com `leaq`, o campo de onde veio é marcado como um ponteiro comprovado. Essa é a regra que transforma o offset 24 de "8 bytes" em "pointer".

### Quatro tipos de provas de passos

`infer_layout()`Combina os acessos de cada função de testemunha e recolhe o passo de quatro fontes, cada uma com a instrução que o produziu.

| Kind | Where it comes from | Build that shows it |
|---|---|---|
| `scale` | an `Index` with scale above 1 reached a pointer, from `shlq $0x5` or `imulq` | `-O0`, `shlq $0x5, %rcx` at `0x59` |
| `loop-step` | a 64-bit increment of the base or index register inside a loop that also contains the access | `-O1`, `addq $0x20, %rdx` at `0x24` |
| `offset-delta` | same-width accesses through one base register inside one loop, at offsets a constant apart | `-O2`, eight loads 32 apart |
| `call-site` | the offsets at which one frame object is passed to the witness functions | `-O0`, `main` passes `rows`, `rows+0x20`, `rows+0x40` |

Um ciclo é um retrocesso .`jmp`O número de um increment é igual a um increment, ou a um ramo condicional, e um increment conta somente quando o intervalo do loop contém tanto o increment quanto o acesso.`addl $0x1, %eax`que avança .`i`- Não .`-O0`, porque é um adicionado de 32 bits e porque o acesso não passa por `%eax`O passo final é o maior divisor comum de todos os valores encontrados. O tamanho é o passo quando o passo é pelo menos tão grande quanto o fim do último campo.

### O ciclo vectorizado em -O2

- Não .`-O2`Clang vectorizadas `sum_balances`O corpo do circuito de`0x50`- Não .`0xaa`Leia oito elementos por passagem:

```text
      3b: 48 8d 87 e4 00 00 00         	leaq	0xe4(%rdi), %rax
      50: 66 0f 6e 50 80               	movd	-0x80(%rax), %xmm2
      55: 66 0f 6e 98 60 ff ff ff      	movd	-0xa0(%rax), %xmm3
      61: 66 0f 6e 90 40 ff ff ff      	movd	-0xc0(%rax), %xmm2
      69: 66 0f 6e a0 20 ff ff ff      	movd	-0xe0(%rax), %xmm4
      7d: 66 0f 6e 10                  	movd	(%rax), %xmm2
      81: 66 0f 6e 58 e0               	movd	-0x20(%rax), %xmm3
      8a: 66 0f 6e 50 c0               	movd	-0x40(%rax), %xmm2
      8f: 66 0f 6e 60 a0               	movd	-0x60(%rax), %xmm4
      a0: 48 05 00 01 00 00            	addq	$0x100, %rax
      aa: 75 a4                        	jne	0x50 <sum_balances+0x40>
```

`%rax`Começa em`list + 0xe4`Os oito deslocamentos colocam as cargas em compensação .`0x04, 0x24, 0x44, 0x64, 0x84, 0xa4, 0xc4, 0xe4`de`list`, que são`4, 36, 68, 100, 132, 164, 196, 228`O aumento é de`0x100`O que é um pass que registra compensações quando as vê, relata oito campos e um estruto de pelo menos 232 bytes.

`fold_unrolled()`Aplica-se uma regra. Dentro de um loop, tomar os mesmos acessos de largura através de um registo base.`d`Se o passo do loop é `k * d`E há exatamente`k`O circuito foi desenrolado.`k`tempo, e cada acesso é o mesmo elemento de acesso em offset `(offset - lowest) mod d`Aqui .`256 = 8 * 32`com oito deslocamentos, então todas as oito cargas dobram-se no deslocamento 4, e os registos de evidências de passo`offset-delta 32`- Não .`unrolled 32`, e `loop-step 256`O ciclo de restantes escalares em `0xe0`Adiciona`scale 32`de`shlq $0x5, %rdx`E ...`loop-step 32`de`addq $0x20, %rdx`O maior divisor comum dos cinco valores é 32.

A figura tem um botão que desliga a dobra.`-O2`construção mostra sete campos além de byte 32 e sem tamanho. Esse estado é o que um leitor vê que confia no deslocamento sem o loop.

## DWARF 5 A partir dos bytes

O `-g`construção de `account.c`Conta com oito secções de depuração. `.debug_info`é de 493 bytes, `.debug_abbrev`179, `.debug_str`230, `.debug_str_offsets`124, `.debug_addr`112, `.debug_line`312, `.debug_line_str`12 e `.debug_frame`264. A introdução das listas de normas DWARF 5 `.debug_str_offsets`- Não .`.debug_addr`, e `.debug_line_str`Como novo na versão 5. O leitor em `code/main.py`- Precisa dos cinco primeiros.

### O cabeçalho da unidade

A secção 7.5.1.1 da norma dá o título completo da unidade de compilação: `unit_length`- Não .`version`- Não .`unit_type`- Não .`address_size`, e `debug_abbrev_offset`Os primeiros 12 bytes de `.debug_info`são:

```text
e9 01 00 00   unit_length = 0x1e9 = 489
05 00         version = 5
01            unit_type = DW_UT_compile
08            address_size = 8
00 00 00 00   debug_abbrev_offset = 0
```

O `unit_type`O byte é novo na versão 5, e o padrão diz isso na mesma seção. O comprimento conta os bytes depois de si mesmo, então a próxima unidade começa em `4 + 489 = 493`, o fim da secção. `llvm-dwarfdump --debug-info`Imprime os mesmos cinco valores em seu `Compile Unit:`A primeira linha de ensaio analisa essa linha e compara.

### As abreviaturas

A secção 2.1 diz que cada entrada de informação de depuração "consiste de uma etiqueta de identificação e uma série de atributos".`.debug_abbrev`(seção 7.5.3) que nomeia a tag, diz se as crianças seguem e lista cada atributo com sua forma.

```text
[12] DW_TAG_structure_type  DW_CHILDREN_yes
     DW_AT_name              DW_FORM_strx1
     DW_AT_byte_size         DW_FORM_data1
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
[13] DW_TAG_member           DW_CHILDREN_no
     DW_AT_name              DW_FORM_strx1
     DW_AT_type              DW_FORM_ref4
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
     DW_AT_data_member_location  DW_FORM_data1
```

`parse_abbreviations()`lê código ULEB128, tag ULEB128, um byte de crianças, então atributo e forma pares até um `0, 0`A secção 7.5.6 dá as codificações do formulário: `data1`é um byte, `ref4`é um deslocamento de 4 bytes em relação à unidade, `strx1`é um índice de 1 byte na tabela de offsets de cadeia, `sec_offset`E ...`data4`são 4 bytes, `addrx`é um índice ULEB128 na tabela de endereços, `exprloc`é um ULEB128 comprimento e que muitos bytes, e `flag_present`Não tem bytes.

### Descifrar o membro do balanço à mão

A entrada de estruturas para `account`Começa a ser compensado.`0x195`com os bytes `0c 15 20 00 03`O código abreviado é 12, a estrutura.`DW_AT_name`é índice de string `0x15`- Não .`DW_AT_byte_size`É o que é`0x20`= 32, `DW_AT_decl_file`é 0, e `DW_AT_decl_line`é 3, que é a linha de `struct account {`na fonte.

A segunda inscrição do membro começa em `0x1a3`com`0d 10 88 01 00 00 00 05 04`- Não .

1. `0d`é a abreviação 13, um membro.
2. `10`É o que é`DW_AT_name`Como `strx1`: índice de cadeia 16.
3. `88 01 00 00`É o que é`DW_AT_type`Como `ref4`: compensação `0x188`a partir do início da unidade, que é o `DW_TAG_base_type`Entrada com nome `int`- Não .
4. `00`É o que é`DW_AT_decl_file`E ...`05`É o que é`DW_AT_decl_line`: linha 5 de `account.c`- Não .
5. `04`É o que é`DW_AT_data_member_location`: compensação 4.

A secção 5.7.6 diz que uma entrada de membro "pode ter um atributo DW_AT_data_member_location ou um atributo DW_AT_data_bit_offset" e que uma constante inteira "é o deslocamento em bytes do início da entidade contendo". Esse byte é o mesmo número que o deslocamento em `addl 0x4(%rax), %ecx`, e `compare_layouts()`é a função que coloca os dois lado a lado.

### As cordas e endereços passam por duas tabelas

O índice de cadeia 16 não é um desvio para `.debug_str`O leitor toma .`DW_AT_str_offsets_base`da entrada de unidade, que é 8, e lê a entrada de 4 bytes em `8 + 4 * 16`em `.debug_str_offsets`Essa entrada contém o offset de `"balance"`em `.debug_str`- A mesma indirecção aplica-se aos endereços.`sum_balances`começa com os bytes `07 07`A abreviação 7, um subprograma, então `DW_AT_low_pc`Como `addrx`Indice 7. A entrada de 8 bytes em `8 + 8 * 7`em `.debug_addr`É o que é`0x30`, o endereço da função em `.text`As primeiras seis entradas da tabela são os endereços dos seis letras de linha.

Em um objeto realojável nenhuma das tabelas mantém os seus valores finais.`.debug_str_offsets`é zero no arquivo, e `.rela.debug_str_offsets`29 `R_X86_64_32`realocações contra `.debug_str`com o real de compensação no adicionado. `.debug_addr`Tem 13 .`R_X86_64_64`realocações contra `.text`E ...`.rodata.str1.1`- Não .`.debug_info`O sistema de transferência de dados é um sistema de transferência de dados.`DW_AT_str_offsets_base`Como `.debug_str_offsets+0x8`- Não .`DW_AT_stmt_list`, e `DW_AT_addr_base`Como `.debug_addr+0x8`- Não .`ElfObject.relocated()`aplica-se `S + A`Para os tipos de 32 bits e 64 bits antes que o leitor paralisa uma seção. Um símbolo de seção tem valor 0 em um arquivo objeto, então o campo recebe o adendo. `llvm-dwarfdump`O índice de resolução é igual, por isso a sua saída mostra nomes e endereços em cada índice resolvido.

### Tipos, funções e locais

`DwarfInfo.type_name()`segue `DW_AT_type`Referências.`label`pontos de membro em uma `DW_TAG_pointer_type`, que aponta para um `DW_TAG_const_type`, que aponta para o `char`Tipo base, então o nome compõe-se de `const char *`- Não .`type_size()`Retorno `DW_AT_byte_size`para tipos e estruturas de base, 8 para um ponteiro e contar vezes o tamanho do elemento para uma matriz. `type_kind()`reduz a`DW_AT_encoding`de um tipo base para `int`com um sinal, ou `float`, e um tipo de ponteiro para `pointer`, que é o vocabulário que a comparação usa.

`DwarfInfo.functions()`- É o 6 .`DW_TAG_subprogram`- As inscrições.`bump`- É um bom momento .`0x0`- Não .`0x21`, que é `DW_AT_low_pc`- E o que é ?`DW_AT_high_pc`A base do quadro é`DW_OP_reg6 RBP`, e o seu parâmetro `a`tem a expressão de localização `91 78`- Não .`DW_OP_fbreg`com o valor SLEB128 `0x78`, que é -8. Isso é o espaço do quadro `-0x8(%rbp)`onde a listagem foi armazenada `%rdi`na direcção`0x4`As informações de depuração e as instruções descrevem o mesmo espaço de dois lados.

## Comparar as duas configurações

`compare_layouts()`O membro sem campo é o membro que não tem campo.`no-evidence`Um campo de tamanho diferente é`size-mismatch`Um membro de ponteiro cujo campo nunca foi desreferenciado é`pointer-unproven`. Um tipo que discorda, como um float onde as instruções usaram aritmética de números inteiros, é `kind-mismatch`. Os campos inferidos que começam dentro de um membro ou dentro do revestimento são `unexpected`O tamanho compara o passo com o`DW_AT_byte_size`- Não .

Os números para as três construções, de `python3 code/main.py`- Não .

| Build | Accesses through the first parameter | Fields | Stride evidence | Members matched | Size |
|---|---|---|---|---|---|
| `-O0` | 11 | 5 | `scale 32`, `call-site 32`, `call-site 64` | 5 of 5 | 32, match |
| `-O1` | 9 | 5 | `loop-step 32` | 5 of 5 | 32, match |
| `-O2` | 17 | 5 after folding, 12 before | `offset-delta 32`, `unrolled 32`, `loop-step 256`, `scale 32`, `loop-step 32` | 5 of 5 | 32, match |

Os espaços inferidos são bytes de 1 a 3 e 10 a 15 em cada construção, e esses são exatamente os bytes de empolgação do layout DWARF. Cada campo inferido fica em um múltiplo de seu próprio tamanho, o que é o que as regras psABI exigem, e `natural_alignment_ok()`Registo isso.

Adicionar as funções uma a uma e a imagem muda.`bump`sozinho o layout é um campo no offset 4, o tamanho é desconhecido, e o limite inferior é 8. `sum_balances`Adiciona o passo. `tag`Adiciona os offsets 0 e 8. `projected`Adiciona o flutuador em 16.`label_length`Adiciona o punhal em 24 e prova que é um punhal. `main`adiciona os sites de chamadas em `-O0`E não adiciona nada.`-O1`E ...`-O2`A figura passa por esta ordem para cada edição.

Três coisas ficam fora de alcance.`const`Não está nas instruções.`label`é apenas "elementos 1 byte de distância" do `leaq 0x1(%rcx), %rcx`no ciclo de cordas, que é consistente com `char`E com`unsigned char`E ...`_Bool`- Em .`-O1`O sinal do byte no offset 0 é desconhecido, porque `cmpb $0x6c, (%rdi)`Comparar sem alargar.`int8`E aí e`i8`- Não .`-O0`, onde`movsbl`Estes são os fatos lição 35 registos como desconhecidos.

## Objetos C++

`shapes.cpp`define`Shape`com um destruidor virtual, um puro virtual `area()`, e um virtual `name()`, e `Rect`, que deriva de `Shape`e adiciona dois `int`O Itanium C++ ABI governa como o Clang coloca estes em x86-64 Linux.

### Nomes confusos

A secção 5.1.2 do ABI diz que "um nome é alterado por prefixos `_Z`O objeto tem 19 símbolos.`_ZNK4Rect4areaEv`- Não .`_Z`, então`N`para um nome aninhado, `K`para uma função de membro const, `4Rect`E ...`4area`como nomes de fontes de longo prazo, `E`para fechar o nome aninhado, e `v`para uma lista de parâmetros vazia. `llvm-cxxfilt`impressões digitais`Rect::area() const`- Não .`_Z8describeRK5Shapei`É o que é`describe(Shape const&, int)`- Não .`R`é uma referência, `K`é const, `5Shape`é a classe,`i`É o que é`int`Os nomes especiais da secção 5.1.4 são:`_ZTV`para um vttable, `_ZTI`para informações de tipo, e `_ZTS`Para a cadeia de nomes de tipoinfo.`C1`- Não .`C2`- Não .`D0`- Não .`D1`, e `D2`- Então ...`_ZN4RectD0Ev`E ...`_ZN4RectD2Ev`ambas impressas como `Rect::~Rect()`: o destructor de exclusão e o destructor de objeto base partilham um nome de fonte.

`Demangler`em `code/main.py`abrange esse subconjunto mais os códigos de tipo de construção da secção 5.1.5.2 e o `S_`Os resultados do ensaio são comparados com os resultados dos testes de detecção.`llvm-cxxfilt --no-strip-underscore`Output. A bandeira é importante no macOS, onde a ferramenta elimina um sublinho principal por padrão e, em seguida, não reconhece `Z8describe...`- Não .

### O vtable das suas realocações

A seção 2.5.2 da ABI lista os componentes de uma tabela virtual em ordem: offsets de chamada virtual, offsets de base virtual, offset para cima, o ponteiro typeinfo e, em seguida, os ponteiros de função virtual. O ponto de endereço, o valor que o vptr de um objeto possui, é o endereço do primeiro ponteiro de função (seção 2.6.2). `Rect`Não tem bases virtuais, por isso a sua tabela é compensada com top, typeinfo e funções.

O símbolo .`_ZTV4Rect`é 0x30 bytes, seis slots de 8 bytes. No objeto cada byte é zero. O conteúdo está em `.rela.data.rel.ro._ZTV4Rect`- Não .

```text
0000000000000008 R_X86_64_64              _ZTI4Rect
0000000000000010 R_X86_64_64              _ZN4RectD2Ev
0000000000000018 R_X86_64_64              _ZN4RectD0Ev
0000000000000020 R_X86_64_64              _ZNK4Rect4areaEv
0000000000000028 R_X86_64_64              _ZNK4Rect4nameEv
```

A slot 0 mantém o offset até o topo, que é 0 e não precisa de realocação.`+16`A partir daí, slot 0 é o destruidor de objeto completo, slot 1 o destruidor de exclusão, slot 2 `area`, fenda 3 `name`- Não .`read_vtable()`Leia o tamanho do símbolo, as transferências no seu intervalo e o zero no deslocamento 0. `Shape`A mesa tem a mesma forma que o`__cxa_pure_virtual`no slot 2, que é a função de tempo de execução que uma chamada virtual pura atinge.

### RTTI

A secção 2.9.4 descreve `std::type_info`como um vptr seguido por um indicador para o nome do tipo mangled, e lista as classes derivadas. `_ZTI4Rect`tem três realocações: `_ZTVN10__cxxabiv120__si_class_type_infoE+0x10`- Não .`_ZTS4Rect`, e `_ZTI5Shape`O primeiro é o vtable de`__si_class_type_info`, a classe que o ABI utiliza para um tipo com uma única base pública não virtual em compensação zero, e o `+0x10`é o ponto de endereço do vtable.`4Rect`, que é o nome do tipo mangled, e `name()`em um `type_info`O terceiro é a base.`_ZTI5Shape`utilizações `__class_type_info`E não tem ponteiro de base.`read_typeinfo()`Retorna estes três fatos.

### A chamada virtual

`describe`- Não .`-O0`faz uma chamada virtual:

```text
       f: 48 8b 7d f8                  	movq	-0x8(%rbp), %rdi
      13: 48 8b 07                     	movq	(%rdi), %rax
      16: ff 50 10                     	callq	*0x10(%rax)
```

O primeiro .`movq`O segundo lê 8 bytes no offset 0 do objeto, que é o vptr, porque o ABI coloca-o primeiro em uma classe com funções virtuais.`callq`passa por lá .`0x10`Passou o VPT e `0x10 / 8`é o espaço 2.`find_virtual_calls()`corresponde ao padrão e informa os dois candidatos: `Rect::area() const`de`_ZTV4Rect`E ...`__cxa_pure_virtual`de`_ZTV5Shape`Qual deles corre depende do objeto, e é por isso que a chamada é indireta.

A DWARF registra o mesmo espaço.`DW_TAG_subprogram`Inscrições para `area`Em ambas as classes de transporte`DW_AT_vtable_elem_location (DW_OP_constu 0x2)`- Não .`name`Carrega o slot 3, e os destructores carregam o slot 0. `Rect`é um `DW_TAG_structure_type`de 16 bytes com um `DW_TAG_inheritance`Entrada para `Shape`em compensação 0 e membros `w`às 8 e `h`às 12h.`Shape`é 8 bytes com um membro artificial `_vptr$Shape`Duas derivações independentes dão o espaço 2 para `area`: a tabela de realocação e as entradas de depuração.

- Não .`-O1`O objeto não tem nenhum vtável. `main`construções `Rect`Como local, o compilador resolveu `r.name()`E ...`describe(r, 2)`O número de dados que são enviados para a rede de dados é de um número de dados que não são enviados para a rede de dados.`describe`ainda contém `movq (%rdi), %rax`E ...`callq *0x10(%rax)`, porque o seu parâmetro pode ser qualquer`Shape`Um vtable faltante é um fato sobre um arquivo objeto, e o teste `test_the_optimised_object_keeps_the_call_pattern_but_drops_the_vtables`Verifica ambas as metades.

O Microsoft ABI difere em cada um destes detalhes.`?`e codificar a convenção de chamada, então `void test(void)`Compilado como C++ `__cdecl`É o que é`?test@@ZAXXZ`O localizador RTTI fica em`vfptr[-1]`como um `_RTTICompleteObjectLocator`, e os símbolos são`??_7`para um vftable e `??_R4`A Microsoft diz que "não há padrões para nomear C++ entre os fornecedores de compiladores".

## Como as ferramentas apresentam os tipos recuperados

Cada linha abaixo que dá um nome foi produzida nesta máquina e capturada em`code/fixtures/tools/`As filas para as ferramentas que não estão instaladas aqui descrevem a documentação e dizem-no.

| Tool | Version, licence | Where types live | On our fixtures |
|---|---|---|---|
| Ghidra | 12.1.4, 2026-09-21, Apache-2.0 | Data Type Manager with built-in, user-defined, and derived types; `.gdt` archives; types used by a program are copied into it | With DWARF: `/DWARF/account.c/account size=32 align=8` and `a->balance = by + a->balance;`. Without: `*(int *)(param_1 + 4)` with `long param_1`, `tag(char *param_1)`, and `*(char **)(param_1 + 0x18)` |
| IDA Pro | 9.4, 2026-07-13, commercial; IDA Free is non-commercial with a cloud decompiler for x86 only | Local Types window, `.til` type libraries, DWARF and PDB import into a `dwarf` or `pdb` folder | Not installed. Documentation only |
| Binary Ninja | 6.0, 2026-09-03, commercial with a Free edition | Type editing, header import and export, type archives, debug info from DWARF and PDB, type libraries, platform types | Not installed. Documentation only |
| radare2 | 6.2.4, 2026-10-05, LGPLv3 | `ts`, `tsc`, `afvd` | `ts` and `tsc account` printed nothing for the relocatable object with `bin.dbginfo=true`; `pdf` shows `mov dword [rax + 4], ecx` with source line comments from DWARF |
| rizin | 0.9.1, 2026-06-29, LGPL core | `ts`, `tsc`, `afvd` | `tsc account` printed `struct account { char kind; int balance; short code; double rate; const char *label; };` from DWARF; the build without `-g` lists only its bundled header types |
| lldb | lldb-1703.0.236.21 | `image lookup -t` | `byte-size = 32` and the full `compiler_type` text from the ELF object |
| gdb | not installed here | `ptype /o` prints "the offsets and sizes of fields in a struct" with holes marked | Documentation only |
| pyelftools | 0.33, public domain | Python API over `.debug_info` | A 43-line script prints the same five members and `unit version 5` |
| llvm-dwarfdump | Apple LLVM 17.0.0 | `--debug-info`, `--debug-abbrev`, `--debug-str-offsets` | The oracle for every reader test |

A saída de Ghidra sem DWARF mostra as mesmas duas regras em funcionamento.`char *`para o parâmetro de `tag`porque a função compara um byte através dela, e `char **`Para o campo em `0x18`Porque ...`label_length`Desreferencia o valor carregado e compara bytes. São as mesmas duas regras que se aplicam na passagem desta lição: largura da instrução, aponta da desreferência. A documentação do decompilador de Ghidra diz que os varnodos de código p "não necessariamente têm um tipo de dados associado a eles" e que o decompilador "em última análise atribui um tipo de dados formal" por propagação. A opção "Inferir indicadores constantes" estende a mesma propagação para constantes. Ghidra 12.1 adicionou a recuperação de bitfield ao decompilador, o que os dispositivos desta lição não exercem.

A tabela feita à mão é a outra metade da história. Ghidra's Data Type Manager, IDA's Local Types, Binary Ninja's type archives, e rizin's `td`O pass diz o que digitar e quais campos você está adivinhando.

rea 6.5.0 com seu provedor Ghidra retorna o texto do decompiler como um registro. Tudo na linha Ghidra aplica-se a ele, e o registro carrega os nomes de tipos sem a evidência que os produziu.`python3 code/main.py infer`Na mesma lista, dá-lhe essa evidência.

## Pesquisa de interferência de tipo

O passagem aqui é a metade de geração de restrições de um sistema de inferência de tipo, restrito a um estruto alcançado a partir de um parâmetro.

- TIE (Lee, Avgerinos, Brumley, NDSS 2011) enquadrou a reconstrução de tipo como geração de restrições e solução sobre uma IR binária, medindo conservatividade e precisão e comparando com um decompilador comercial em 87 programas de recursos.
- Retypd (Noonan, Loginov, Cok, PLDI 2016) adicionou subtipo, polimorfismo e tipos recorrentes, e relatou reconstrução do punteiro `const`A GrammaTech é uma empresa de software de código aberto.
- OSPREY (Zhang e outros, IEEE S&P 2021) trata cada local de memória como uma variável aleatória e infere os tipos mais prováveis.
- DIRTY (Chen e outros, USENIX Security 2022) e ReSym (Xie e outros, CCS 2024) de saída de decompilador pós-processo com modelos aprendidos, e ReSym relata precisão de 72,9% em layouts estruturas completos.
- RecStruct (Chen e outros, USENIX Security 2026) recupera estragos aninhados sem um decompilador, com execução simbólica insensible ao fluxo e união-encontrar sobre slots de pilha.

A estrutura da pilha é a primeira coisa que a lição não passa.`-O1`- Não .`main`- Não .`rows`Na pilha e no código inscrito diz:`0x24(%rsp)`- Não .`0x40(%rsp)`- Não .`0x48(%rsp)`- Não .`0x30(%rsp)`, e `0x38(%rsp)`Os modulos 32 são 4, 0, 8, 16 e 24: a mesma estrutura, sem parâmetros para semear.

## Construí-lo

Executa a demonstração:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
```

A saída é um relatório JSON com cinco partes. `dwarf`O título da unidade, as estruturas e as funções da`-O0`Objeto.`oracles`mantém o layout de regras psABI, o `ctypes`O layout, o layout DWARF, a execução nativa e um `agree`bandeira.`builds`Contém os acessos, o layout inferido e a comparação para cada um dos três objetos. `cxx`contém os nomes desfigurados, ambos os vtables, ambos os registos de tipoinfo, a chamada virtual e os slots DWARF. `tools`lista as saídas capturadas da ferramenta.

Forma esperada:

```json
{
  "dwarf": {"unit": {"unitLength": 489, "version": 5, "unitType": "DW_UT_compile", "addressSize": 8, "abbrevOffset": 0}, "...": "..."},
  "oracles": {"agree": true, "psabiRules": {"size": 32, "align": 8, "...": "..."}, "...": "..."},
  "builds": {
    "O0": {"layout": {"stride": 32, "size": 32, "gaps": [1, 2, 3, 10, 11, 12, 13, 14, 15], "...": "..."}, "comparison": {"matches": 5, "members": 5, "...": "..."}},
    "O1": {"...": "..."},
    "O2": {"...": "..."}
  },
  "cxx": {"virtualCalls": [{"slot": 2, "candidates": {"Shape": "__cxa_pure_virtual", "Rect": "_ZNK4Rect4areaEv"}, "...": "..."}], "...": "..."}
}
```

Leia `code/main.py`na ordem seguinte:

1. `ElfObject`Leia secções, símbolos e realocações, e `relocated()`aplica-se `S + A`para uma secção de depuração.
2. `parse_abbreviations()`E ...`DwarfInfo._parse_unit()`Leia o cabeçalho, a tabela de abreviações e as entradas, e depois resolva `strx`E ...`addrx`através das duas mesas.
3. `DwarfInfo.struct_layouts()`E ...`functions()`Transformar as entradas em `StructLayout`E ...`FunctionInfo`registos, com `type_name()`- Não .`type_size()`, e `type_kind()`- Não .
4. `parse_listing()`- Não .`parse_memory()`, e `access_width()`Leia o `llvm-objdump`- Não.
5. `trace_function()`é a máquina de estado abstrato, e `fold_unrolled()`E ...`infer_layout()`transformar os acessos num layout.
6. `compare_layouts()`produz as linhas de status, e `sysv_layout()`E ...`ctypes_layout()`São os outros dois oráculos.
7. `Demangler`- Não .`read_vtable()`- Não .`read_typeinfo()`, e `find_virtual_calls()`cobrir o objeto C++.

Existem mais quatro comandos.`python3 code/main.py dwarf FILE.o`Imprime as estruturas e funções de qualquer objeto realocavel DWARF 5. `python3 code/main.py infer LISTING.txt [FILE.o]`O sistema de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados`python3 code/main.py demangle NAME...`E ...`python3 code/main.py vtable FILE.o`cobrir a metade do C++.

## Usá-lo

Em um novo objeto que construíste:

1. Captura .`llvm-objdump -d -r`O passe lê esse texto.
2. Corra .`python3 code/main.py infer`Na listagem. Leia primeiro a linha testemunhas: ela nomeia as funções cujo primeiro parâmetro foi usado como base de memória. Se uma função estiver faltando, seu parâmetro nunca atingiu um operando de memória, ou chegou a um através de um caminho que a passagem não rastreia.
3. Leia cada campo com o seu número de acessos.
4. Leia a prova dos passos.`call-site`ou `scale`A entrada é forte.`loop-step`A entrada sem outro tipo é fraca, porque um ciclo desenrolado informa o passo de vários elementos.`unrolled`Aparece, verifique a dobrar à mão.
5. Se um`-g`construção existe, executar a comparação e ler cada linha que não é `match`- A.`no-evidence`linha nomea um membro não função tocada.`unexpected`Nomes de filas a que a passagem não pôde aceder.
6. Digite o layout no gerenciador de tipos da sua ferramenta como um estruto e registre quais campos, nomes e tipos são adivinhas.

Mantém os três oráculos ao alcance.`ctypes`, e DWARF discordar sobre um layout que você escreveu, você encontrou um estruturas embalado, um campo de bits, ou um alvo com regras diferentes.

## Laboratório Interativo

### Lab A: decodificar a entrada de membro

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types/code
python3 -q
```

- Correr .

```python
from main import *
elf = load_object("account-x86_64-O0-g.o")
dwarf = DwarfInfo(elf)
dwarf.header()
elf.section(".debug_info").data[0x1a3:0x1ac].hex(" ")
dwarf.dies[0x1a3].attributes
dwarf.type_name(dwarf.type_of(dwarf.dies[0x1a3]))
```

Decodificar os nove bytes em papel com a abreviação 13 antes de olhar para o dicionário.`elf.section(".debug_str_offsets").data[8:16].hex()`, e o relocado,`elf.relocated(".debug_str_offsets")[8:16].hex()`, e explicar a diferença.

### Laboratório B: rastrear uma função

```python
listing = load_listing("account-x86_64-O0-g.objdump.txt")
trace = trace_function("label_length", listing["label_length"])
[(hex(a.address), a.root, a.offset, a.width, a.kind) for a in trace.accesses]
trace.pointer_uses
trace_function("sum_balances", listing["sum_balances"]).loops
```

Antes de executar, anote qual acesso prova que o offset 24 é um punteiro.`-O1`listagem e encontrar o `leaq 0x1(%rcx), %rcx`em `trace.increments`- Não .

### Laboratório C: dobrar o ciclo vectorizado

```python
o2 = load_listing("account-x86_64-O2-g.objdump.txt")
trace = trace_function("sum_balances", o2["sum_balances"])
sorted({a.offset for a in trace.accesses})
folded, evidence = fold_unrolled(trace, trace.accesses)
sorted({a.offset for a in folded}), [(e.kind, e.value, e.text) for e in evidence]
```

Então corre .`analyze_build("O2", fold=False)["comparison"]`e contar o `unexpected`As linhas. Mudar a regra de dobra para que ele requer que o passo do loop para ser exatamente`k * d`com`k`pelo menos 2, e confirmar que o `-O1`O loop, com um acesso e o passo 32, é deixado sozinho.

### Laboratório D: o quadro e os nomes

```python
shapes = load_object("shapes-x86_64-O0-g.o")
read_vtable(shapes, "_ZTV4Rect")
read_typeinfo(shapes, "_ZTI4Rect")
demangle("_ZNK4Rect4areaEv"), demangle("_Z8describeRK5Shapei")
find_virtual_calls(load_listing("shapes-x86_64-O0-g.objdump.txt"), [read_vtable(shapes, "_ZTV5Shape"), read_vtable(shapes, "_ZTV4Rect")])
```

Calcule a fenda a partir de `callq *0x10(%rax)`- No papel, depois confirme contra.`DwarfInfo(shapes).struct("Rect").virtual_methods`Então carrega .`shapes-x86_64-O1-g.o`E tentar .`read_vtable`Leia o artigo.`ElfError`e explicar porque o símbolo está ausente.

## Laboratório de Prática

Recuperar o estruto de pilha em `main`- Não .`-O1`- Não .

Requisitos:

- Extensão`trace_function()`Assim, uma região de slot do quadro pode ser uma raiz.`movaps`Lojas que se preenchem`0x0(%rsp)`- Não .`0x5f(%rsp)`de`.data.rel.ro`, que é o inicializer de 96 bytes de `rows`- Não .
- Atribuir os acessos de entrada `0x24(%rsp)`- Não .`0x40(%rsp)`- Não .`0x48(%rsp)`- Não .`0x30(%rsp)`, e `0x38(%rsp)`O que é que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é.
- Derivar o passo 32 do loop em `0x120`- Não .`0x12c`, onde`%r14`Começa às 4 e avança até `0x20`Até que`0x64`, e mostrar que o ciclo ligado `0x64`é três elementos mais o campo de compensação.
- Compare o resultado com o layout do DWARF e chegue a cinco correspondências, e registre quais tipos permanecem não comprovados.
- Adicionar um teste que falha quando a raiz do quadro é atribuída a um parâmetro.

O sucesso significa`python3 code/main.py infer`No dia`-O1`Lista de listagem `main`Como testemunha com uma raiz de quadro, e a comparação mostra cinco correspondências de`main`- Só eu.

## Lição Artifacto

Esta lição inclui `outputs/skill-recovering-data-and-types.md`. Utilize-o para transformar uma listagem e uma configuração de defeito opcional em um layout de estruturas com evidências por campo, um passo com suas fontes, uma comparação com o DWARF e uma lista de que permaneceu desconhecido.

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A verificação deve provar:

- O título da unidade, as 14 abreviaturas e os cinco membros de compensação concordam com `llvm-dwarfdump`
- Os nomes chegam através dos relocados.`.debug_str_offsets`Mesa e unidade `str_offsets_base`E ...`addr_base`são 8
- Seis funções contêm os intervalos, `DW_OP_reg6 RBP`, e `DW_OP_fbreg`localizações que o depósito mostra, e seus endereços baixos iguais a listagem função começa
- um objeto sem `.debug_info`Eleva-se e o decodificador LEB128 é manuseado.`0x78`como -8
- `pyelftools`E ...`lldb`Imprimir o mesmo layout do leitor
- as regras do PSABI, `ctypes`, DWARF, e a corrida nativa dar compensações `0, 4, 8, 16, 24`e tamanho 32, e o estruto reordenado é de 24 bytes
- O parcer de listagem lê 13 instruções em `bump`, apegos .`R_X86_64_PLT32 bump-0x4`- A chamada de`0x194`, e encontra o salto para trás em `0x72`
- Operações de memória, largura, tipos e sinais decodificados do texto AT&T e do mnemônico
- `bump`- Não .`-O0`lê o seu punhal de volta do slot do quadro e faz três acessos no offset 4
- O passo vem de`shlq $0x5`- Não .`-O0`, de`addq $0x20, %rdx`- Não .`-O1`, e de oito cargas dobradas por um passo de 256 em `-O2`
- `label_length`prova o punteiro no offset 24 desferenciando-o
- `main`passa um objeto de quadro em deslocamentos 0, `0x20`, e `0x40`- Não .`-O0`E não chama nada mais do que`printf`- Não .`-O1`
- Cada edificação corresponde a cinco dos cinco membros com tamanho 32 e espaços iguais ao revestimento DWARF
- sem dobrar o `-O2`criar relatórios sete campos passados o byte 32 e sem tamanho
- O demangler reproduz todos os 19 `llvm-cxxfilt`cordas
- Os dois vtables, os dois registos de tipoinfo e a chamada virtual em `0x16`Resolver para o slot 2, e DWARF concorda
- O `-O1`O objeto C++ mantém o padrão de chamada e não tem vtable
- As capturas de Ghidra, rizin e radar2 mostram a estrutura com DWARF e os offsets brutos sem ele
- A figura interativa incorpora os mesmos dados que a análise produz

## Modos de falha de produção

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Unrolled loop | Eight fields 32 bytes apart and a 232-byte struct | Loop step 256 equals 8 times the offset delta 32, so one field at offset 4 |
| Stride read from one increment | `sizeof` 256 from `addq $0x100` | The greatest common divisor of every stride source, with the scalar tail's `addq $0x20` |
| 8-byte field called a pointer | `void *` at offset 24 | A later access uses the loaded value as a base, or the kind stays `int64` |
| Pointer called an integer | `long` at offset 24 | The dereference at `0xfb`, recorded as pointer proof |
| Narrow compare | `char` with a sign | `cmpb` carries no sign; only `movsbl` or `movzbl` does |
| Five functions assumed to share a type | One struct with no evidence of aliasing | Call sites in `main` that pass one frame object, or an explicit analyst assertion |
| Strings read from `.debug_str` by index | Garbage names from a relocatable object | `str_offsets_base` plus the relocated `.debug_str_offsets` entry |
| Addresses read as numbers | `low_pc` of 0 for every function | `addrx` through the relocated `.debug_addr` table |
| DWARF 4 object | A reader that misparses the header | Version check on the second header field; 4 has no `unit_type` byte |
| Missing vtable | "the class has no virtual functions" | The `-O1` object inlined every call; the `-O0` object has the table and its relocations |
| Vtable slot read from the wrong base | Off-by-two slot numbers | The address point is 16 bytes past the symbol, after offset-to-top and typeinfo |
| Mangled name stripped | `Z8describeRK5Shapei` left as is | `--no-strip-underscore` on macOS, or a demangler that checks for `_Z` |
| Struct typed from one tool's guess | `char *param_1` taken as the field type | The width and the dereference, written as evidence, and the name marked as a guess |

## Regra de funcionamento

Recuperar um campo de um acesso e um passo de um loop, e anexar a instrução a cada um. Dobrar os loops desenrollados antes de confiar em um offset passado o passo. Leia DWARF através de suas abreviaturas e suas tabelas realocadas, nunca por índice em uma seção de cadeia. Compare campo por campo e escreva cada membro sem provas, cada ponteiro não comprovado e cada nome como desconhecido. Em um objeto C ++, leia o vtable de suas mudanças e o espaço da chamada, em seguida, use DWARF para confirmar o espaço que você leu.

## Mais leitura

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, section 3.1.2: Data Representation](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), section 5.10: Composite Types](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 1, section 3.7.5: Specifying an Offset](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [DWARF Debugging Information Format Version 5, sections 2.1, 5.7.6, 7.5.1.1, 7.5.3, 7.5.6](https://dwarfstd.org/doc/DWARF5.pdf)
- [Itanium C++ ABI, sections 2.5 (Virtual Table Layout), 2.9 (Run-Time Type Information), 5.1 (External Names)](https://itanium-cxx-abi.github.io/cxx-abi/abi.html)
- [Microsoft Learn: Decorated names](https://learn.microsoft.com/en-us/cpp/build/reference/decorated-names?view=msvc-170)E ...[Name Decoration](https://learn.microsoft.com/en-us/cpp/error-messages/tool-errors/name-decoration?view=msvc-170)
- [llvm-dwarfdump command guide](https://llvm.org/docs/CommandGuide/llvm-dwarfdump.html)E ...[llvm-cxxfilt command guide](https://llvm.org/docs/CommandGuide/llvm-cxxfilt.html)
- [Python ctypes: Structure layout, sizeof, alignment](https://docs.python.org/3/library/ctypes.html)
- [Ghidra Data Type Manager](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Base/src/main/help/help/topics/DataTypeManagerPlugin/data_type_manager_description.htm)- Não .[Decompiler Concepts](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerConcepts.html)- Não .[Decompiler Options](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerOptions.html), e [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.4_build)
- [IDA 9.1 user guide: Types](https://docs.hex-rays.com/9.1/user-guide/types)- Não .[IDA 9.4 release post](https://hex-rays.com/blog/ida-9.4-release-a-new-dyld-shared-cache-swift-analysis-new-teams-add-on-and-more-), e [IDA Free](https://hex-rays.com/ida-free)
- [Binary Ninja user guide: Types](https://docs.binary.ninja/guide/types/)E ...[Binary Ninja 6.0 Krypton](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)E ...[rizin v0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
- [GDB manual: Examining the Symbol Table, ptype /o](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Symbols.html)
- [pyelftools on PyPI](https://pypi.org/project/pyelftools/)
- [Lee, Avgerinos, Brumley, "TIE: Principled Reverse Engineering of Types in Binary Programs" (NDSS 2011)](https://www.ndss-symposium.org/ndss2011/tie-principled-reverse-engineering-of-types-in-binary-programs/)
- [Noonan, Loginov, Cok, "Polymorphic Type Inference for Machine Code" (PLDI 2016)](https://arxiv.org/abs/1603.05495)E ...[the retypd repository](https://github.com/GrammaTech/retypd)
- [Zhang et al., "OSPREY: Recovery of Variable and Data Structure via Probabilistic Analysis for Stripped Binary" (IEEE S&P 2021)](https://ieeexplore.ieee.org/document/9519451/)
- [Chen et al., "Augmenting Decompiler Output with Learned Variable Names and Types" (USENIX Security 2022)](https://www.usenix.org/conference/usenixsecurity22/presentation/chen-qibin)
- [Xie et al., "ReSym: Harnessing LLMs to Recover Variable and Data Structure Symbols from Stripped Binaries" (CCS 2024)](https://dl.acm.org/doi/10.1145/3658644.3670340)
- [Chen et al., "RecStruct" (USENIX Security 2026)](https://www.usenix.org/conference/usenixsecurity26/presentation/chen-yuxin)
