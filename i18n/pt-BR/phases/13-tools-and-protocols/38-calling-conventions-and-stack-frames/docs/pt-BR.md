# Convenções de chamada e quadros de pilha: Sistema V, Windows x64 e AArch64

> Uma desmontagem mostra quais registros uma função lê. Somente o ABI diz o que esses registros significam, e o ABI é escolhido pelo cabeçalho do objeto, então esta lição lê o cabeçalho primeiro e depois verifica cada registro contra a regra que o colocou lá.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 and AArch64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow)
**Time:** ~140 minutes

## Objetivos de aprendizagem

- Escolha a convenção de chamada do cabeçalho do objeto: ELF x86-64 é o System V psABI, COFF AMD64 é Microsoft x64, ELF AArch64 é AAPCS64, Mach-O arm64 é a variante da Apple.
- Decodificar o prólogo de uma função byte por byte para cada ABI e colocar todos os registros salvos, o endereço de devolução e o indicador de quadro em sua compensação com o indicador de pilha de entrada.
- Inferir os registros de parâmetros de uma função dos registros que ela lê antes de escrever, e os espaços de argumentos de pilha das cargas acima do ponteiro de pilha de entrada.
- Diga as sequências de registro independentes do Sistema V a partir dos slots posicionais da Microsoft x64, e tanto dos contadores NGRN e NSRN da AAPCS64.
- Verifique todas as inferências contra a assinatura da fonte, a regra na especificação e os próprios dados do compilador em`.pdata`- Não .`.xdata`, e `.eh_frame`- Não .
- Comparar como Ghidra, IDA, Binary Ninja, radar2, rizin e angr nome e recuperar os mesmos fatos, e registrar onde sua saída discorda com a fonte.

## O problema

Compila-te .`convention.c`para Linux x86-64 em `-O2`E pediu ao radar2 6.2.4 os argumentos de `eight_args`Respondeu com sete:`rdi`- Não .`rsi`- Não .`rdx`- Não .`r8`- Não .`r9`- Não .`rsp+0x8`, e `rsp+0x10`A fonte C tem oito parâmetros.`%rcx`Exactamente uma vez, em `leaq (%rdx,%rcx), %rax`, e a recuperação variável da ferramenta não contava um registo que só aparece dentro de um endereço.

Então você abriu a versão do Windows do mesmo arquivo em rizin 0.9.1.`amd64`e encontrou`r8`- Não .`rcx`- Não .`rdx`O objeto é COFF, então a convenção é Microsoft x64, o quarto argumento do registro é `r9`As duas ferramentas não têm registros diferentes na mesma fonte.

Uma lista é uma sequência de instruções. Uma convenção de chamada é um contrato que vive fora da listagem: que registros carregam argumentos, que o solicitante deve conservar, onde o endereço de devolução e os argumentos de pilha estão sentados e o que o solicitante deve deixar acima do ponteiro de pilha. Quatro documentos definem os contratos que importam aqui. O sistema V AMD64 psABI (versão 1.0, edição datada de 12 de março de 2025) secções 3.2.1 a 3.2.3. A convenção de ligação Microsoft x64, uso de pilhas e páginas de prólogo e epilogo (datas de página de 2018-12-17 a 2025-03-19). O arm AAPCS64 liberta 2025Q4 (23 de janeiro de 2026) secções 6.1 a 6.9. Notas da plataforma arm64 da Apple. Esta lição lê essas regras, aplica-as a um arquivo C compilado de três maneiras, e constrói o analisador que transforma uma lista em uma lista verificada de locais de parâmetros, registros salvos e offsets de quadros.

```figure
re-38-three-frames
```

## Um cabeçalho escolhe o livro de regras

`convention.c`tem doze funções: `leaf_add`- Não .`eight_args`- Não .`mixed`- Não .`by_value`- Não .`big_ret`- Não .`sum_varargs`- Não .`keeps`, e cinco chamadores de `extern`As estruturas usam`long long`, porque`long`É 4 bytes no alvo MSVC e 8 bytes nos outros, e uma estrutura que muda de tamanho mudanças convencional.`-target x86_64-unknown-linux-gnu`- Não .`x86_64-pc-windows-msvc`, e `aarch64-unknown-linux-gnu`- Não .`-O0`E ...`-O2`, e `arm64-apple-macos`- Não .`-O2`Não há cabeçalhos Linux ou Windows instalados, então o arquivo declara o que precisa e inclui apenas o próprio clang `stdarg.h`E ...`stddef.h`- Não .

`describe_object()`em `code/main.py`lê o número mágico de 4 bytes e um campo de máquina e nomeia o contrato:

| Header | Field | Value | Rulebook |
|---|---|---|---|
| `7f 45 4c 46` ELF | `e_machine` at offset 0x12 | 62 | System V AMD64 psABI |
| `64 86` COFF | `Machine` at offset 0 | 0x8664 | Microsoft x64 |
| `7f 45 4c 46` ELF | `e_machine` | 183 | AAPCS64 |
| `cf fa ed fe` Mach-O 64 | `cputype` at offset 4 | 0x0100000c | AAPCS64 with Apple differences |

Os três contratos discordam em quase todas as linhas da tabela que segue.

| Rule | System V psABI | Microsoft x64 | AAPCS64 |
|---|---|---|---|
| Integer arguments | `%rdi %rsi %rdx %rcx %r8 %r9`, next free register | `RCX RDX R8 R9`, by position | `x0` to `x7`, by NGRN |
| Floating-point arguments | `%xmm0` to `%xmm7`, next free register | `XMM0` to `XMM3`, by position | `v0` to `v7`, by NSRN |
| Integer result | `%rax`, then `%rdx` | `RAX` | `x0`, then `x1` |
| Floating-point result | `%xmm0`, then `%xmm1` | `XMM0` | `v0` |
| Result too large for registers | address passed in `%rdi` "as if it were the first argument", returned in `%rax` | pointer in `RCX`, arguments shifted right, returned in `RAX` | address in `x8`, `x0` to `x7` untouched |
| Callee-saved | `%rbp %rbx %r12` to `%r15` | `RBX RBP RDI RSI RSP R12` to `R15`, `XMM6` to `XMM15` | `r19` to `r29`, `SP`, low 64 bits of `v8` to `v15` |
| First stack argument on entry | `8(%rsp)` | `40(%rsp)`, above a 32-byte shadow store | `0(sp)` |
| Below the stack pointer | 128-byte red zone | "considered volatile" | no red zone (Apple: 128 bytes) |
| Alignment at the call | `(%rsp + 8)` multiple of 16 on entry | 16-byte aligned outside prolog and epilog | `SP mod 16 = 0` |
| Variadic marker | `%al` holds an upper bound on vector registers used | floats duplicated in the integer register | none in registers; Apple uses 8-byte stack slots |

## Sistema V: duas sequências de registos independentes e uma zona vermelha

psABI 3.2.3 classifica cada oitobytes de cada argumento como INTEGER, SSE ou MEMORY e, em seguida, atribui registros de duas listas que não interagem. "INTEGER" toma "o próximo registro disponível da sequência %rdi, %rsi, %rdx, %rcx, %r8 e %r9". SSE toma `%xmm0`- Não .`%xmm7`"Se não há registros disponíveis para qualquer oitobytes de um argumento, todo o argumento é passado na pilha", e argumentos de memória "são empurrados na pilha em ordem inversa (direita-a- esquerda).

`eight_args(a, b, c, d, e, f, g, h)`- Não .`-O2`é de 27 bytes:

```text
      10: 48 01 fe                     	addq	%rdi, %rsi
      13: 48 8d 04 0a                  	leaq	(%rdx,%rcx), %rax
      17: 48 01 f0                     	addq	%rsi, %rax
      1a: 4c 01 c0                     	addq	%r8, %rax
      1d: 4c 01 c8                     	addq	%r9, %rax
      20: 48 03 44 24 08               	addq	0x8(%rsp), %rax
      25: 48 03 44 24 10               	addq	0x10(%rsp), %rax
      2a: c3                           	retq
```

Seis caixas, depois duas cargas.`8(%rsp)`E ...`16(%rsp)`. A figura 3.3 do psABI coloca "argumento de memória 8byte 0" em `16(%rbp)`Quando ?`%rbp`é a base do quadro, que é `8(%rsp)`na entrada antes de qualquer empurrão. `g`É às 8, `h`Aos 16 anos.

`mixed(int i, double d, long long l, float f)`- O que é que se passa?`%edi`E ...`%rsi`O duplo e o flutuante tomam`%xmm0`E ...`%xmm1`O primeiro e o segundo registo da SSE.`cvtsi2sd %edi, %xmm2`, e `%xmm2`É um registro de arranhões que a função escreve antes de ler.`cvtsi2sd`O radar2 fez exatamente isso e informou`mixed`Como `(double arg1, double arg2, double arg3)`em `xmm0`- Não .`xmm1`- Não .`xmm2`- Não .

`by_value(struct pair p)`passa um estruto de 16 bytes como dois 8 bytes inteiros em `%rdi`E ...`%rsi`, e retorna-o da mesma forma: `leaq 0x1(%rdi), %rax; leaq -0x1(%rsi), %rdx; retq`- Não .`big_ret(long long seed)`Retorna 32 bytes, que é MEMORIA de classe, e o psABI diz "o chamador fornece espaço para o valor de devolução e passa o endereço deste armazenamento em %rdi como se fosse o primeiro argumento". `seed`- Vai para o`%rsi`, e a função começa com `movq %rdi, %rax`porque "No retorno, o %rax contém o endereço que foi transmitido pelo chamador em %rdi".

A zona vermelha é a outra assinatura do Sistema V. psABI 3.2.2: "A área de 128 bytes além da localização indicada por %rsp é considerada reservada e não pode ser modificada por gestores de sinal ou interrupção".`-O0`- Não .`eight_args`É o que é`pushq %rbp; movq %rsp, %rbp`E depois seis lojas para `-0x8(%rbp)`através de`-0x30(%rbp)`sem nenhum`subq`As lojas estão a 48 bytes abaixo do ponteiro.`-O2`construção de `sum_varargs`atribui 88 bytes com `subq $0x58, %rsp`e depois escreve o registro área de salva em `-0x58(%rsp)`- Até o .`-0x80(%rsp)`128 bytes abaixo do ponteiro de pilha, toda a zona vermelha.`-mno-red-zone`E ...`leaf_add`ganha um `pushq %rax`e um `addq $0x8, %rsp`Para manter os seus 8 bytes de habitantes locais acima do ponteiro de pilha.

As chamadas variádicas adicionam um registro. "%al é usado como argumento oculto para especificar o número de registros vetoriais usados", um limite superior de 0 a 8. `call_varargs`- E o que é que ele diz?`xorl %eax, %eax`- Não .`-O2`E ...`movb $0x0, %al`- Não .`-O0`- Não .`sum_varargs`lê-o primeiro: `testb %al, %al; je`Salta oito .`movaps %xmmN`Salva quando não foi utilizado registro de vetores.

## Microsoft x64: Posições, uma loja de sombras e sem zona vermelha

As regras da Microsoft são positionais. "Os argumentos inteiros são passados nos registros RCX, RDX, R8 e R9. Os argumentos de pontos flutuantes são passados em XMM0L, XMM1L, XMM2L e XMM3L. " e "Qualquer argumento de ponto flutuante e de dupla precisão nos primeiros quatro parâmetros são passados em XMM0 - XMM3, dependendo da posição". O mesmo `mixed`Chega como `%ecx`- Não .`%xmm1`- Não .`%r8`- Não .`%xmm3`: slot 0 é um int, então `RCX`O slot 1 é um duplo, por isso`XMM1`O slot 3 é flutuante, por isso...`XMM3`- Não .`XMM0`E ...`XMM2`Não se deixe nada.

O chamador também deve deixar espaço. "O chamador deve sempre alocar espaço suficiente para armazenar quatro parâmetros de registro, mesmo que o chamador não tome tantos parâmetros". As páginas chamam-lhe a loja de sombra ou os endereços de casa, e os quatro espaços são "efetivamente propriedade da função chamada". Na entrada `0(%rsp)`é o endereço de devolução, `8(%rsp)`- Não .`39(%rsp)`São as quatro casas, e o primeiro argumento de pilha é em`40(%rsp)`- Não .`eight_args`- Não .`-O2`lê `0x28(%rsp)`- Não .`0x30(%rsp)`- Não .`0x38(%rsp)`- Não .`0x40(%rsp)`40, 48, 56, 64.

O lado de chamada mostra a aritmética.`call8`- Não .`-O2`É o que é`subq $0x48, %rsp`E depois lojas de 5, 6, 7, 8 em `0x20(%rsp)`- Não .`0x38(%rsp)`Antes de`movl $1, %ecx`72 bytes é 32 para a loja de sombra, 32 para quatro argumentos de pilha, e 8 para que o endereço de retorno seja em um limite de 16 bytes. `call_varargs`só registra argumentos e ainda atribui `subq $0x28, %rsp`: 32 para a loja de sombras e 8 para alinhamento. `keeps`empurra três registros não voláteis (24 bytes) e depois `subq $0x20, %rsp`, então que`ext`encontra o seu armazenamento de sombras de 32 bytes abaixo do endereço de retorno.

Estruturas seguem sua própria regra. "Qualquer argumento que não se encaixa em 8 bytes, ou não é 1, 2, 4 ou 8 bytes, deve ser aprovado por referência". e "argumentos de 16 bytes são aprovados por referência". `by_value`recebe um indicador para uma cópia em `%rdx`, após um indicador de resultados oculto em `%rcx`O número de pontos de referência é o seguinte: "o chamador deve atribuir memória para o valor de devolução e passar um punteiro para ele como o primeiro argumento.`call_pair`construi a cópia em `0x20(%rsp)`com`movaps`, passagens `leaq 0x20(%rsp), %rdx`, passa o buffer de resultados com `leaq 0x38(%rsp), %rcx`, e lê .`.b`de volta de`0x40(%rsp)`- Não .

Não há zona vermelha. "Toda a memória além do endereço atual do RSP é considerada volátil: O sistema operacional, ou um depurador, pode sobreescrever essa memória durante uma sessão de depuração do usuário, ou um processador de interrupção. "`-O0` `leaf_add`Precisa de 8 bytes de pessoas locais e os consegue com `pushq %rax`na entrada e `popq %rcx`Antes de`retq`, duas instruções de um byte em vez de um `subq`e um `addq`A página de uso de pilha define a folha que pode fazer isso: "Uma função de folha é aquela que não requer uma entrada de tabela de funções. Não pode fazer alterações a quaisquer registros não voláteis, incluindo RSP".

"Para as funções vararg ou não prototípicas, os valores de ponto flutuante devem ser duplicados no registro de finalidade geral correspondente". `sum_varargs`- Não .`-O2`Lojas`%rdx`- Não .`%r8`- Não .`%r9`- Não .`0x18(%rsp)`- Não .`0x20(%rsp)`- Não .`0x28(%rsp)`Depois de um .`pushq %rax`, que é o de entrada de compensações 16, 24, 32: as casas dos parâmetros do segundo, terceiro e quarto registo.`va_list`É o que é`leaq 0x18(%rsp), %rax`, a casa de `%rdx`, o primeiro argumento não identificado.

## AAPCS64, e o que a Apple muda

A AAPCS64 6.8.2 percorre uma lista de regras com dois contadores. C.9: um argumento integral "é copiado para os bits menos significativos em x[NGRN]" e incrementos NGRN. C.1 faz o mesmo para argumentos de pontos flutuantes com NSRN. C.12: um composto de no máximo `8 - NGRN`O C.13 define "O NGRN é definido em 8" uma vez que um argumento entra na pilha, de modo que nada retorna aos registros posteriormente. `eight_args`utilizações `x0`- Não .`x7`E nunca toca a pilha.`mixed`É o que é`w0`- Não .`d0`- Não .`x1`- Não .`s1`- Não .`by_value`É o que é`x0`E ...`x1`Entrou e saiu.

6.9 diz que um resultado que seria passado em registros "é devolvido nos mesmos registros", caso contrário "O endereço do bloco de memória deve ser passado como um argumento adicional para a função em x8". `big_ret`escreve`str x0, [x8]`- Não .`stur q0, [x8, #0x8]`- Não .`str x9, [x8, #0x18]`E nunca escreve.`x0`- Não .`call_big`conjuntos `mov x8, sp`, e `seed`- Não .`x0`, porque 6.9 acrescenta "não há necessidade de o callee preservar o valor armazenado em x8" e `x8`Não é um dos registos de discussões.

6.4.5.2: numa interface pública "SP mod 16 = 0". A pilha é totalmente descendente e "Nenhum fio é permitido acessar (para leitura ou escrita) a região inativa" abaixo dela, de modo que o Linux `-O0` `leaf_add`emite`sub sp, sp, #0x10`Para 8 bytes de habitantes locais onde o Sistema V utilizou a zona vermelha.

6.4.6 define o registro do quadro: "um registro do quadro de dois valores de 64 bits na pilha ... O menor termo duplo dirigido deve apontar para o registro anterior do quadro e o termo duplo mais elevado deve conter o valor passado no LR na entrada na função corrente". e "A localização do registro do quadro dentro de um quadro da pilha não é especificada".`keeps`- Não .`-O2`no Linux coloca o registro no fundo com `stp x29, x30, [sp, #-0x30]!; mov x29, sp`A mesma função em`-O0`coloca-o no topo com `sub sp, sp, #0x20; stp x29, x30, [sp, #0x10]; add x29, sp, #0x10`- Não .

As notas arm64 da Apple mantêm os registros e o alinhamento e mudam o quadro, a zona vermelha e as chamadas variadas. "O registro do ponteiro de quadro (x29) deve sempre dirigir-se a um registro de quadro válido. Algumas funções, como funções de folha ou chamadas de cauda, podem optar por não criar uma entrada nesta lista".`keeps`Salva`x22, x21, x20, x19`Primeiro e coloca o recorde no topo: `stp x29, x30, [sp, #0x20]; add x29, sp, #0x20`"A zona vermelha ARM64 consiste dos 128 bytes imediatamente abaixo do ponteiro de pilha", e ainda emite clang `sub sp, sp, #0x10`para o `-O0`O tipo va_list é um alias para char*. `call_varargs`nas lojas da Apple, 10, 20, 30 a `[sp]`- Não .`[sp, #8]`- Não .`[sp, #0x10]`E passa apenas .`w0`O Linux build passa .`w1`- Não .`w2`- Não .`w3`e chamadas de colar com `b extva`A maçã .`sum_varargs`lê `add x8, sp, #0x10`, o indicador de pilha do chamador, como é o seu `va_list`O Linux `sum_varargs`Salva`x1`- Não .`x7`E ...`q0`- Não .`q7`em um quadro de 224 bytes e inicializa os campos de estrutura `__gr_offs`-56 e `__vr_offs`-128 com um `mov x8, #-0x38; movk x8, #0xff80, lsl #32`- Não .

Os símbolos também diferem. Mach-O prefixa cada símbolo C com `_`, então a lista mostra`_keeps`e a primeira função aparece sob o rótulo privado `ltmp0`O analisador renomeia os rótulos através da tabela de símbolos.

## Decodificar um prólogo à mão, três vezes

`keeps(int n)`chamadas`ext(i)`em um ciclo e mantém `n`- Não .`i`, e `acc`Todas as ABIs devem guardar registros.`-O2`Construir para cada alvo.

Sistema V, 4 bytes:

1. `55`É o que é`push r64`com o registo nos três bits inferiores: `50 + 5`- Não .`%rbp`- Profundidade 8,`%rbp`Salvo no deslocamento de entrada -8.
2. `41 56`- Não .`41`é REX com `B`conjunto, `56`É o que é`50 + 6`O REX.B é alargado de 6 a 14:`pushq %r14`- Em -16.
3. `53`É o que é`50 + 3`- Não .`pushq %rbx`- Em -24.

Três empurram são 24 bytes. O endereço de retorno adiciona 8, e 32 é um múltiplo de 16, então o `callq ext`dentro do circuito está alinhado sem um `subq`Não há .`movq %rsp, %rbp`O corpo usa um sistema de comando de arquivos.`%rbp`como o registro de chamadas salvas que mantém `acc`(`xorl %ebp, %ebp`- Não .`addl %eax, %ebp`O epílogo é o espelho:`5b 41 5e 5d c3`- Não .

Microsoft x64, 7 bytes:

1. `56`É o que é`pushq %rsi`-8 .`57`É o que é`pushq %rdi`- Em -16.`53`É o que é`pushq %rbx`Em -24, os três são não voláteis aqui, e`RDI`E ...`RSI`foram registos de argumentos do Sistema V.
2. `48 83 ec 20`: REX.W, código op `83 /5`com um 8 bits imediato, ModRM `ec`É o que é`11 101 100`- Não .`subq $0x20, %rsp`- Profundidade 56.

56 mais o endereço de devolução é 64, alinhado. Os 32 bytes são o armazenamento de sombras que`ext`A página do epílogo permite apenas "um adicionar RSP, constante ou lea RSP, constante [FPReg], seguido por uma série de pops de registro de 8 bytes ou mais e um retorno ou um jmp", e os bytes são `48 83 c4 20 5b 5f 5e c3`- Não .

AArch64, 16 bytes em quatro palavras, pequeno-endian:

1. `a9bd7bfd`É o que é`stp`com pré-indice. Bits 31:30 `10`selecionar registros de 64 bits, bits 25:23 `011`Selecione pré-index, bit 22 é 0 para armazenar. imm7 em bits 21:15 é `1111010`Rt2 em 14:10 é 30, Rn em 9:5 é 31 (`sp`), Rt em 4:0 é 29. `stp x29, x30, [sp, #-0x30]!`: o ponteiro de pilha cai 48, `x29`Vai para -48 e `x30`-40 para -40.
2. `f9000bf5`É o que é`str`com um offset de 12 bits sem assinatura escalado por 8: imm12 em 21:10 é 2, Rn é `sp`, Rt é 21.`str x21, [sp, #0x10]`- O deslocamento de entrada é -32.
3. `910003fd`É o que é`add`imediato: imm12 é 0, Rn é `sp`, Rd é 29.`mov x29, sp`O indicador de quadro aponta no recorde em -48.
4. `a9024ff4`É o que é`stp`com um offset assinado: imm7 é 4, escalado para 32. Rt2 é 19, Rt é 20. `stp x20, x19, [sp, #0x20]`- Não .`x20`- Em -16,`x19`-8 em -8.

O quadro é de 48 bytes: `x29`em 0, `x30`às 8h.`x21`Em 16, 8 bytes de enchimento em 24, `x20`- Em 32,`x19`A palavra mais baixa do registro aponta para o registro anterior e a palavra seguinte detém LR, como requer o 6.4.6. `cmp w0, #0x1`O cronógrafo o moveu para o prólogo e o analisador tolera uma comparação ou uma instrução aritmética entre as operações de pilha.

## O compilador escreveu os mesmos fatos duas vezes

Um prólogo analisa uma derivação. O compilador emite uma segunda para o desvinculador, e os dois devem concordar.

No Windows a segunda derivação é `.pdata`E ...`.xdata`Construir o .`-O2`objeto sem `-fno-asynchronous-unwind-tables`E ...`llvm-objdump -h`- Espetáculos`.xdata`de 0x34 bytes e `.pdata`de 0x48 bytes. 0x48 é 72, seis `RUNTIME_FUNCTION`entradas de 12 bytes com três `IMAGE_REL_AMD64_ADDR32NB`As seis são as mais importantes.`sum_varargs`- Não .`keeps`- Não .`call8`- Não .`call_varargs`- Não .`call_pair`, e `call_big`. As outras seis funções são folhas, e a página de manipulação de exceções diz "Se a pesquisa não encontrar uma entrada de tabela de funções, o código é assumido como parte de uma função de folha, e RSP dirigiu diretamente o punhal de retorno".

O `.xdata`bytes para `keeps`são`01 07 04 00 07 32 03 30 02 70 01 60`- Não .`UNWIND_INFO`Começa com Versão em 3 bits e Flags em 5 bits: versão 1, sem bandeiras. SizeOfProlog é 7, CountOfCodes é 4, FrameRegister e FrameOffset são 0. Cada `UNWIND_CODE`é um offset no prólogo e um byte de código op e informação. `07 32`: no offset 7, op 2 é `UWOP_ALLOC_SMALL`, informação 3 significa `3 * 8 + 8 = 32`- Baixos.`03 30`: op 0 é `UWOP_PUSH_NONVOL`, Registo 3 é `rbx`- Não .`02 70`- Não .`rdi`- Não .`01 60`- Não .`rsi`Os códigos são armazenados em ordem inversa de execução, e eles têm o mesmo nome de três empurramentos e a mesma alocação de 32 bytes que os bytes `56 57 53 48 83 ec 20`- O .`sum_varargs`Entrada é `01 01 01 00 01 02 00 00`: um prólogo de 1 byte com um código, `UWOP_ALLOC_SMALL`É assim que o desvinculador vê.`pushq %rax`: uma dotação, porque `%rax`É volátil e nada está a ser salvo.

No Linux a segunda derivação é `.eh_frame`, que é definido no PSABI 4.2.4 e codifica a secção 6.4 do DWARF 5. `llvm-dwarfdump --eh-frame`no objeto relocavel imprime um FDE por função e resolve o `R_X86_64_PC32`As mudanças de local, para que as faixas sejam utilizáveis.`keeps`- Não .

```text
  DW_CFA_def_cfa_offset: +16
  DW_CFA_def_cfa_offset: +24
  DW_CFA_def_cfa_offset: +32
  DW_CFA_offset: RBX -32
  DW_CFA_offset: R14 -24
  DW_CFA_offset: RBP -16
```

O CFA é o indicador de pilha antes da chamada, 8 acima do indicador de pilha de entrada, por isso `RBP -16`é compensação de entrada -8, `R14 -24`é -16, `RBX -32`é -24, e o offset CFA mais profundo de 32 é o quadro de 24 bytes mais o endereço de retorno.`keeps`Diz:`DW_CFA_def_cfa: W29 +48`com`W29 -48`- Não .`W30 -40`- Não .`W21 -32`- Não .`W20 -16`- Não .`W19 -8`. Ali, o CFA é o próprio ponteiro da pilha de entrada, por isso, os offsets são os offsets de quadro sem conversão, e o CFA é definido a partir de `x29`enquanto o quadro está ao vivo.`eh_frame_cross_check()`Esta comparação é feita para os 12 FDE de ambos os objetos.`call8`no Sistema V empurra dois argumentos saindo no meio do corpo, então o seu offset CFA mais profundo é 32 enquanto o seu quadro de prólogo é 8, e o teste compara o punhal mais profundo da pilha que o corpo atinge, 24, mais 8.

## Como chamam as ferramentas isto

Cada ferramenta neste campo tem uma estrutura de dados para a convenção de chamada e um pass que atribui um a uma função. Os nomes diferem e as lacunas diferem. As ferramentas fechadas são descritas a partir de sua documentação; as abertas foram executadas nas instalações e sua saída é capturada ao lado dos objetos.

**Ghidra 12.1.4 (Apache-2.0).**As regras estão presentes nos ficheiros de especificações do compilador.`.cspec`, ao lado da linguagem SLEIGH. `x86-64-gcc.cspec`declara um `<default_proto>`nomeado`__stdcall`, "Derivado do Suplemento de Processador de Arquitetura AMD64 de Interface Binária de Aplicações do Sistema V Abril 2016", com `<pentry>`listas para `XMM0_Qa`- Não .`XMM7_Qa`E ...`RDI, RSI, RDX, RCX, R8, R9`, uma entrada em pilha no offset 8, a `join_dual_class`Regra para tipos até 16 bytes, saídas `XMM0_Qa, XMM1_Qa, RAX, RDX`, e `hidden_return`Para o resto.`x86-64-win.cspec`declarações`__fastcall`com quatro `<group>`elementos que se emparelham `XMM0_Qa`com`RCX`- Não .`XMM1_Qa`com`RDX`, e assim por diante, que é a regra posicional, uma entrada de pilha no offset 40, `convert_to_ptr`para as estribas de 3, 5, 6 ou 7 bytes com a observação "apenas as estribas de tamanho 8,16,32,64 bits podem ser embaladas para registo", `unaffected`listagem `RBX RBP RDI RSI RSP R12`- Não .`R15`E ...`XMM6`- Não .`XMM15`, e um `localrange`da pilha 8 a 39, que é a loja de sombras. `AARCH64.cspec`declarações`__cdecl`cuja primeira entrada é `x8`com`storage="hiddenret"`, então`q0`- Não .`q7`E ...`x0`- Não .`x7`- Não .`convert_to_ptr`para estruturas de 17 bytes ou mais, e `killedbycall`incluindo `x8`com o comentário "registro de localização de resultados indiretos, que não é refletido na lista de pentry". A etapa final do decompilador é chamada de "Estabelecer o Protótipo da Função"; os analisadores são "Call Convention ID" e "Decompiler Parameter ID"; a opção do programa "Prototipo de Avaliação" escolhe o modelo padrão.

**IDA Pro and IDA Free (Hex-Rays, commercial; current release 9.4, build 9.4.260714).**O tipo de função é uma declaração C definida através do SetType, e "a IDA usará as informações do tipo para comentar a desmontagem com as informações sobre os argumentos de função".`int __usercall func@<ebx>(int x, int y@<esi>)`coloca o resultado em `EBX`E ...`y`em `ESI`, e `@<^12.4>`nomear um local de pilha por compensação e tamanho. `__userpurge`É o mesmo com a limpeza da pilha de callee.`__spoils`para o conjunto de colchões, `__hidden`- Não .`__return_ptr`, e `__struct_ptr`Para os argumentos implícitos, esta lição é recuperada manualmente.`__usercall`O IDA Free suporta apenas x86 e x86-64.

**Binary Ninja 6.0 "Krypton" (Vector 35, commercial, with a Free edition that decompiles x86, x86_64, ARMv7, and AArch64).**A.`Platform`"conta todas as informações relacionadas com o ambiente de execução do binário, principalmente as convenções de chamada usadas, o sistema operacional e a arquitetura", e a lista inclui `linux-x86_64`- Não .`windows-x86_64`- Não .`linux-aarch64`, e `mac-aarch64`, cada um com um `default_calling_convention`- A.`CallingConvention`- Não .`int_arg_regs`- Não .`float_arg_regs`- Não .`callee_saved_regs`- Não .`caller_saved_regs`- Não .`int_return_reg`- Não .`high_int_return_reg`- Não .`float_return_reg`, e duas bandeiras que codificam as diferenças desta lição diretamente:`arg_regs_share_index`"Quando True, o argumento Nth consome a ranura Nth das listas de registros inteiros e flutuantes, independentemente do seu tipo", e `stack_reserved_for_arg_regs`, "o espaço sombra/casa usado pela convenção de chamadas do Windows x64". `eligible_for_heuristics`- Não .`required_arg_regs`, e `required_clobbered_regs`Os tipos de plataforma são os cabeçalhos C sob `types/platform/`, um por nome de plataforma.

**radare2 6.2.4 (LGPL-3.0, run here).** `afcl`lista as convenções que o plugin de arquitetura conhece: `amd64 amd64syscall dlang golang golang_abi0 ms p9 reg swift`para x86-64 e `arm64 dlang golang p9 reg swift`para o AArch64. `afc`Relata a convenção da função corrente, `afcr`impressões digitais`cc.amd64.arg0: rdi`através de`arg5: r9`E ...`ret0: rax`, e os perfis são arquivos SDB chamados`cc-ARCH-BITS.sdb`. Radar2 escolhido .`amd64`para o objeto ELF e `ms`para o objeto COFF, que é a divisão correta. `afv`Lista de argumentos e variáveis, e `afs`Imprime uma assinatura.`-O2`Objeto`afv`Encontrou sete argumentos para o`eight_args`E caiu .`rcx`No objeto do Windows que encontrou .`rcx, rdx, r8`E quatro slots de pilha e caiu .`r9`Ambos os registos desaparecidos aparecem apenas dentro de um`lea`- Em .`mixed`- O relatório`double arg1 @ xmm0, arg2 @ xmm1, arg3 @ xmm2`No Linux e sem argumentos em tudo no Windows.`x0`- Não .`x7`Para`eight_args`, e para`big_ret`Ele listou .`x0`E ...`double arg2 @ d1`onde a função diz `x8`e carrega uma constante em `q1`- Todos .`afs`A assinatura começa com `void`, porque o tipo de devolução não é inferido.`-O0`, onde cada argumento é armazenado no quadro,`afv`Encontrou os oito argumentos de `eight_args`com`rbp+0x10`E ...`rbp+0x18`Para o par de pilhas.

**rizin 0.9.1 (LGPL-3.0, run here) and Cutter 2.5.0.** `afcl`listas `amd64 amd64syscall ms reg swift`- Não .`afc`- Voltou .`amd64`para o objeto COFF, o perfil da Microsoft existe e não foi selecionado no formato. `afi`Listado sete argumentos para `eight_args`Em Linux, novamente sem`rcx`, e em Windows `r8, rcx, rdx`com três slots de pilha, sem `r9`E sem o espaço em `0x40`- Não .`afv`Não existe; o comando de listagem é `afvl`O Cutter é a parte frontal gráfica sobre o Rizin.

**angr 10.0.3 (BSD-2, run here).** `CFGFast`seguida por `CompleteCallingConventions(recover_variables=True)`conjuntos `function.calling_convention`- Não .`SimCCSystemVAMD64`- Não .`SimCCMicrosoftAMD64`, ou `SimCCAArch64`, em formato binário, e `function.prototype`A Comissão, por sua vez, não pode deixar de apresentar um relatório sobre a`eight_args`Em todos os três alvos, o punhal oculto de`big_ret`em x86-64 como `(BOT*, long long) -> BOT*`, a estrutura de referência do Windows `by_value`Como `(BOT*, BOT*) -> BOT*`, e o Sistema V variável `sum_varargs`Como `(long long, ...)`As suas lacunas são diferentes das dos radares:`mixed`Voltei como`(long long, long long, double, float)`No sistema V e no AArch64, os registros certos são registados na ordem errada, porque a lista inteira é impressa antes da lista flutuante; o AArch64 `big_ret`Voltei como`(long long) -> double`, então o`x8`O convenção foi omitida e as lojas vetoriais foram levadas a cabo como resultado; e o AArch64 `sum_varargs`Voltou com 16 parâmetros, toda a área de reserva do registo.

**Others.**Hopper 6.6.0 é um desmonteador e descompiler comercial para macOS e Linux; seu manuseio de convenções não foi executado ou documentado para esta lição.`frame info`E ...`register read`O Compilador Explorer mostra as três listas lado a lado da fonte, o que é a maneira mais rápida de confirmar uma regra antes de procurar em bytes.

| Concept | Ghidra | IDA | Binary Ninja | radare2 / rizin | angr | this lesson |
|---|---|---|---|---|---|---|
| The convention object | `prototype` in a `.cspec` | calling convention keyword in the function type | `CallingConvention` on a `Platform` | `afc` name, `cc-ARCH-BITS.sdb` | `SimCC` subclass | `expected_locations(abi, name)` |
| Default per target | `<default_proto>` per cspec | compiler setting | `Platform.default_calling_convention` | `afc=`, `anal.cc` | by format | `describe_object()` |
| Argument registers | `<pentry>` list, `<group>` for positional | `@<reg>` in `__usercall` | `int_arg_regs`, `float_arg_regs`, `arg_regs_share_index` | `cc.NAME.argN` | `ARG_REGS`, `FP_ARG_REGS` | `INT_ARG_REGS`, `FLOAT_ARG_REGS` |
| Shadow store | `localrange` stack 8 to 39 | implicit | `stack_reserved_for_arg_regs` | `cc.ms.argn=stack` | `STACKARG_SP_DIFF` | `STACK_ARG_BASE[WIN64] = 40` |
| Hidden result pointer | `hidden_return`, `storage="hiddenret"` | `__return_ptr`, `__hidden` | return type too large for `int_return_reg` | not modelled | `BOT*` first argument | `HIDDEN_RETURN_REG` |
| Callee-saved | `<unaffected>` | `__spoils` lists the opposite | `callee_saved_regs` | profile | `CALLEE_CLEANUP` and arch | `CALLEE_SAVED` |
| Assigning one to a function | "Call Convention ID" analyzer, "Establish Function's Prototype" | user or type library | heuristic detection with `required_arg_regs` | `afc`, `afva`, `aaft` | `CallingConventionAnalysis` | read-before-write plus the rulebook |

## Construí-lo

Executa a demonstração:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
```

A saída é um relatório JSON. Para cada um dos sete objetos, ele nomeia o formato, a máquina e o ABI, e para cada uma das doze funções ele dá os bytes do prólogo, os registros salvos com compensações de entrada, o tamanho do quadro, o indicador do quadro, os registros de parâmetros, os compensações de argumentos da pilha, os derrames, o registro de retorno ou indicador oculto, as profundidades de chamada e os registros e lojas de saída dos chamadores. Cada função termina com as suas verificações: a regra, o valor esperado da assinatura, o valor observado dos bytes e se eles concordam. O relatório termina com as duas verificações cruzadas e as capturas da ferramenta. Nas 84 análises de funções, 489 verificações foram efectuadas e todas as 489 concordaram.

Forma esperada:

```json
{
  "objects": {
    "convention-x86_64-windows-O2": {
      "format": "COFF", "machine": "AMD64", "abi": "Microsoft x64", "checks": "73/73 agree",
      "functions": {
        "keeps": {
          "prologue": ["56  pushq %rsi", "57  pushq %rdi", "53  pushq %rbx", "48 83 ec 20  subq $0x20, %rsp"],
          "frameBytes": 56,
          "savedRegisters": [{"register": "rsi", "entryOffset": -8}, {"register": "rdi", "entryOffset": -16}, {"register": "rbx", "entryOffset": -24}],
          "parameterRegisters": ["rcx"],
          "returnRegisters": ["rax"],
          "calls": [{"callee": "ext", "depth": 56}],
          "checks": [{"rule": "Microsoft x64: the caller must always allocate ...", "expected": "at least 32 bytes ...", "observed": [56], "agree": true}, "..."]
        }
      }
    }
  },
  "sehCrossCheck": ["..."],
  "ehFrameCrossCheck": {"...": "..."}
}
```

Leia `code/main.py`na ordem seguinte:

1. `describe_object()`Leia o cabeçalho ELF, COFF ou Mach-O e a tabela de símbolos e retorna o ABI e a lista de funções.
2. `parse_listing()`Divide o `llvm-objdump -d -r`O texto em funções, mantém o objetivo de realocação de cada chamada e salto, e tira os comentários com o marcador da sintaxe correta: `#`para a AT&T, `//`E ...`;`para o AArch64, onde `#`- Introduz uma imediata.
3. `effect_x86()`E ...`effect_arm()`transformar uma instrução em leituras, endereços lê, escreve, cargas, lojas e um delta de ponteiro de pilha. O último operando AT&T é o destino; o primeiro operando AArch64 é o destino exceto em lojas, comparações e ramos. `lea`O destino de `mov`- Não .`cvtsi2sd`- Não .`setcc`, e o idioma zero .`xor r, r`Uma chamada escreve todo o conjunto volátil.`sp`antes do acesso e de uma carga pós-indexada a mover depois.
4. `analyze_function()`Caminha o corpo uma vez até a primeira.`ret`O que significa que o ponto de entrada é inferior ao valor de entrada, por isso, uma operação de memória`disp(%rsp)`está no deslocamento de entrada `disp - depth`E ...`disp(%rbp)`Está em`frame_pointer + disp`. Regista registros de classe de argumentos que são lidos antes de serem escritos, carrega no ou acima do primeiro argumento de pilha de compensação do ABI, armazena registros de argumentos no quadro, acessos abaixo do ponteiro de pilha atual e a profundidade em cada chamada.
5. `_return_registers()`O sistema de dados é um sistema de dados que permite a leitura de dados e de dados, mas não o permite.`rax`Vivo em`big_ret`em Microsoft x64, onde `movq %rcx, %rax`É seguido por lojas através de`(%rax)`- Não .
6. `expected_locations()`aplica os três livros de regras a uma assinatura C: as duas listas do Sistema V com classes de oito bytes, os espaços posicionais da Microsoft com estruturas de referência secundária e o contador AAPCS64 com `x8`para resultados superiores a 16 bytes.
7. `run_checks()`Comparar os dois e adicionar as regras do quadro: registos escritos em rede devem ser salvos, `(rsp + 8) % 16 == 0`ou `sp % 16 == 0`em cada chamada, 32 bytes de sombra em cada chamada da Microsoft, nenhum acesso abaixo do ponteiro de pilha sob a Microsoft e AAPCS64 e no máximo 128 bytes sob o Sistema V, e um epílogo que reflete o prólogo com o ponteiro de pilha de volta ao seu valor de entrada.
8. `seh_cross_check()`E ...`eh_frame_cross_check()`ler os dados de desvio dos objetos construídos sem `-fno-asynchronous-unwind-tables`e compará-lo com o Prologue Parse.

Existem mais três comandos.`python3 code/main.py analyze convention-x86_64-windows-O2 keeps`Imprime uma função. `python3 code/main.py object FILE`Imprime o veredicto do cabeçalho.`python3 code/main.py seh`Imprime o decodificado `UNWIND_INFO`de cada função que tem um.

## Usá-lo

Use o analisador nesta ordem em um novo objeto que construiu.

1. Corra .`python3 code/main.py object FILE.o`Se o cabeçalho e o comando de construção discordarem, pare, um deles está errado.
2. Captura .`llvm-objdump -d -r FILE.o`Leia os bytes do prólogo e os registros salvos antes de qualquer outra coisa, e compare o tamanho do quadro com os empurrões e os `sub`- Não .
3. Leia os registros de parâmetros e as compensações de pilha em relação à sua assinatura fonte. Um registro que a assinatura não explica é um ponteiro oculto, um marcador variádico ou um registro de arranque que o analisador confundiu com um argumento. O último caso é um erro na tabela de efeitos. Corrigir com uma regra geral para essa instrução.
4. Cada um dá nome à regra em que se baseia, então a primeira coisa a verificar é a regra, depois os bytes, depois o analisador.
5. Quando o objeto tiver dados de desvio, execute a verificação cruzada. Duas derivações que concordam são a prova mais forte que esta lição produz.
6. Quando outra ferramenta é instalada, capture sua saída com o comando exato e compare. Onde concorda você tem três derivadas. Onde é diferente você tem um registro específico e uma instrução específica para olhar, e isso é uma descoberta para a lição 35.

## Laboratório Interativo

### Lab A: uma instrução, três efeitos

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/code
python3 -q
```

- Correr .

```python
from main import *
effect(Instruction(0, "48 8d 04 0a", "leaq", "(%rdx,%rcx), %rax"), SYSV)
effect(Instruction(0, "f2 0f 2a d7", "cvtsi2sd", "%edi, %xmm2"), SYSV)
effect(Instruction(0, "a9bd7bfd", "stp", "x29, x30, [sp, #-0x30]!"), AAPCS64)
```

Escreva as leituras, o endereço, as leituras e o delta de pilha que espera antes de cada chamada.`[sp, #-0x30]!`- Não .`[sp], #0x30`com`ldp`E vê o delta a mover-se de`sp_delta`- Não .`post_sp_delta`- Não .

### Laboratório B: o quadro das unidades

```python
info, listing = load_fixture("convention-aarch64-linux-O2")
keeps = analyze_function("keeps", listing["keeps"], info.abi)
keeps.saved
keeps.frame_pointer
[c.to_dict() for c in frame_cells(keeps)]
```

Compare as compensações com a decodificação manual acima.`convention-arm64-macos-O2`e executar as mesmas três linhas; o registro se move para -16 e quatro registros sentados abaixo dele.`convention-x86_64-linux-O2-fp`e ler .`saved`Para`keeps`O marcador de quadro está de volta, e também é um `pushq %rax`cujo único trabalho é fazer`(rsp + 8)`Um múltiplo de 16 na chamada.

### Laboratório C: leitura antes de escrita em mistura

```python
info, listing = load_fixture("convention-x86_64-linux-O2")
mixed = analyze_function("mixed", listing["mixed"], info.abi)
mixed.param_registers
mixed.return_registers
expected_locations(SYSV, "mixed")["parameters"]
expected_locations(WIN64, "mixed")["parameters"]
```

A lista do Sistema V é `rdi, xmm0, rsi, xmm1`e a lista da Microsoft é `rcx, xmm1, r8, xmm3`Agora carregue o objeto do Windows e execute as três primeiras linhas novamente. Então abra a captura de radar2 para o objeto do Linux e encontre`[afv mixed]`Encontre a instrução que explica a terceira.

### Laboratório D: segunda opinião do desvinculador

```python
for row in seh_cross_check():
    print(row["function"], row["sizeOfProlog"], row["unwindPushes"], row["unwindAllocBytes"], row["agree"])
for row in eh_frame_cross_check("convention-x86_64-linux-O2-eh"):
    print(row["function"], row["cfiSaved"], row["cfiMaxOffset"], row["deepestStack"], row["agree"])
```

Encontrar o`pushq %rax`de`sum_varargs`A partir da data de publicação do relatório, o código de desvio deve ser utilizado para determinar o valor da atribuição.`call8`No`.eh_frame`A mesa e explicar o 32.

## Laboratório de Prática

Adicione um quarto alvo e um quarto livro de regras.

Requisitos:

- Compile `convention.c`com`-target x86_64-apple-macos -O2`E capturar a sua listagem.`describe_object()`Para ler o Mach-O `cputype`0x01000007 e mapeá-lo para o sistema V psABI, que a Apple segue em x86-64, com o `_`Prefixo do símbolo.
- Verifique se cada função concorda com os controles do Sistema V. Regista a única diferença que você encontra nos prólogos: Darwin mantém o marcador de quadro em todos os níveis de otimização.
- Adicionar um`-fstack-protector-strong`Expanda a digitalização do prólogo para que o canário seja carregado de `%fs:0x28`E a loja abaixo dos moradores locais são registrados como um `canary`célula, e a comparação anterior `ret`como o cheque que guarda o epílogo.
- Adicione um teste que falhe quando uma loja de canários é considerada um argumento derramado.
- Escreva o quadro de `with_canary`-Code de estilo à mão antes de executar o analisador, e mantenha o desenho ao lado do teste.

O sucesso significa`python3 code/main.py`O sistema de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de registos de

## Lição Artifacto

Esta lição inclui `outputs/skill-calling-conventions-and-stack-frames.md`. Use-o para transformar um objeto que você construiu, sua listagem e as assinaturas C em locais de parâmetros, um layout de quadro, um registro de devolução e uma verificação de cada inferência contra a regra em que se baseia e contra os dados de desenrolar do compilador.`cvtsi2sd`ou `xor r, r`O que é que se passa com o destino?

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A verificação deve provar:

- Os cabeçalhos ELF, COFF e Mach-O dos sete objetos denominados System V, Microsoft x64, AAPCS64 e Apple arm64
- Cada símbolo do objeto da tabela lista as mesmas doze funções, com o Mach-O `_`Prefixo e o `ltmp0`etiqueta resolvida
- O parcer de listagem mantém `ext`como o alvo da chamada e mantém o AArch64 imediato, como `#-0x30`Intactos
- `leaq (%rdx,%rcx), %rax`lê dois registos de endereços e não carrega nada; `xorl %eax, %eax`E ...`cvtsi2sd`são apenas escritos; um pré-indexado `stp`movimentos`sp`antes da loja e depois de indexado `ldp`após a carga
- `keeps`- Não .`-O2`É o que é`55 41 56 53`no sistema V com um quadro de 24 bytes e sem indicador de quadro, `56 57 53 48 83 ec 20`Em Microsoft x64 com um quadro de 56 bytes, e `a9bd7bfd`Primeiro no AArch64 com o recorde de -48
- A Apple build coloca o recorde em -16 acima de quatro registros salvos
- Cada função tem um marcador de quadro em `-O0`No Linux e nenhum no `-O2`, e `-fno-omit-frame-pointer`traz-o de volta com um empurrão de alinhamento
- O `-O0`O folha utiliza 8 bytes de zona vermelha no sistema V, `pushq %rax`sob Microsoft x64, e `sub sp, sp, #0x10`nos termos da AAPCS64; `-mno-red-zone`Elimina o uso da zona vermelha
- Cada epílogo espelha o seu prólogo e o ponteiro está de volta na entrada
- `eight_args`Leia seis registros e slots 8 e 16, quatro registros e slots 40 a 64, ou `x0`- Não .`x7`, em ambos os níveis de otimização
- `mixed`É o que é`rdi, xmm0, rsi, xmm1`no âmbito do sistema V e `rcx, xmm1, r8, xmm3`sob Microsoft x64, com `xmm0`como resultado de ambos
- O estruto de 16 bytes viaja em dois registros sob o sistema V e AAPCS64 e por referência atrás de um ponteiro oculto sob o Microsoft x64
- O estruto de 32 bits retorna através de `rdi`- Não .`rcx`, ou `x8`
- A variada callee diz:`%al`, casas `rdx, r8, r9`Em 16, 24, 32, salva.`x1`- Não .`x7`E ...`q0`- Não .`q7`, ou lê o indicador de pilha do chamador na Apple
- Os chamadores definem os registos esperados, guardam 7 e 8 em 0 e 8 ou 5 a 8 em 32 a 56, zero `%al`para a chamada variada, e passar o resultado de buffer endereço em `rdi`- Não .`rcx`, ou `x8`
- Todos os 489 cheques concordam com as suas regras
- O seis .`UNWIND_INFO`As entradas correspondem ao prólogo parse e as folhas não têm nenhuma
- Os 24 FDE correspondem aos offsets do registro guardado e ao indicador de pilha mais profundo
- A ferramenta capta os radares de registro2 `amd64`E ...`ms`- O Rizin.`amd64`sobre o objeto COFF, o desaparecido `rcx`, os três duplos, e os protótipos de Angr
- Os dados de figura incorporados no módulo de site são iguais à saída do analisador

## Modos de falha de produção

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| COFF object read as System V | `rdi` and `rsi` as arguments that the function never reads | The header says 0x8664; the convention is Microsoft x64 |
| Register read only inside a `lea` | Seven arguments for an eight-argument function | Base and index registers are reads |
| `cvtsi2sd` destination counted as a read | A third double argument in `xmm2` | The first write to `xmm2` is a write; `mixed` has two SSE arguments |
| Positional slots read as sequences | `xmm0` named as the double argument on Windows | Slot 1 is `XMM1`, slot 3 is `XMM3` |
| `push rbp` taken as a frame pointer | A frame pointer in an `-O2` function that uses `rbp` as an accumulator | Only `mov %rsp, %rbp` after the push creates one |
| Red zone measured from the entry stack pointer | 216 bytes "below the stack pointer" | 128 bytes below the current stack pointer after an 88-byte `sub` |
| Shadow store treated as locals | Stack arguments at 8 to 32 | Microsoft stack arguments start at 40 |
| `lea` treated as a load | A stack argument at `0x60(%rsp)` in a variadic callee | `lea` computes `overflow_arg_area`; it loads nothing |
| Hidden pointer read as a normal argument | `big_ret(void *, long long)` | The pointer is stored through and copied to `rax`, `rax`, or stays in `x8` |
| Deepest CFA compared with the prologue frame | A mismatch on a caller that pushes outgoing arguments | Compare with the deepest stack pointer the body reaches |
| Convention asserted from the ISA | `amd64` for a COFF object | The format picks the rulebook, then the ISA picks the registers |
| Prototype trusted from one tool | Three doubles, or sixteen variadic parameters | The source signature or a second derivation must agree |

## Regra de funcionamento

Leia o cabeçalho antes da primeira instrução e nomeie o livro de regras. Coloque cada registro salvado e cada argumento em um desvio do ponteiro de entrada, e verifique-o contra a regra que o colocou lá e contra os dados de desvio que o compilador escreveu para o mesmo quadro. Trate o protótipo de uma ferramenta como uma reivindicação até que os bytes ou a fonte confirmem isso.

## Mais leitura

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Version 1.0 (sections 3.2.1 to 3.2.3, 4.2.4)](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Microsoft x64 calling convention](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention)
- [Microsoft x64 stack usage](https://learn.microsoft.com/en-us/cpp/build/stack-usage)
- [Microsoft x64 prolog and epilog](https://learn.microsoft.com/en-us/cpp/build/prolog-and-epilog)
- [Microsoft x64 exception handling: RUNTIME_FUNCTION, UNWIND_INFO, UNWIND_CODE](https://learn.microsoft.com/en-us/cpp/build/exception-handling-x64)
- [Arm Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), release 2025Q4](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Apple: Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [DWARF Debugging Information Format Version 5, section 6.4 Call Frame Information](https://dwarfstd.org/doc/DWARF5.pdf)
- [Clang driver frame-pointer defaults, `useFramePointerForTargetByDefault` in `CommonArgs.cpp`](https://github.com/llvm/llvm-project/blob/main/clang/lib/Driver/ToolChains/CommonArgs.cpp)
- [Clang command line reference: `-fomit-frame-pointer`, `-momit-leaf-frame-pointer`](https://clang.llvm.org/docs/ClangCommandLineReference.html)
- [Fedora 38 change: frame pointers by default](https://fedoraproject.org/wiki/Changes/fno-omit-frame-pointer)
- [Ubuntu 24.04: performance engineering with frame pointers by default](https://ubuntu.com/blog/ubuntu-performance-engineering-with-frame-pointers-by-default)
- [Ghidra compiler specification: `x86-64-gcc.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-gcc.cspec)
- [Ghidra compiler specification: `x86-64-win.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-win.cspec)
- [Ghidra compiler specification: `AARCH64.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/languages/AARCH64.cspec)
- [Hex-Rays: SetType and the `__usercall` convention](https://docs.hex-rays.com/ida-actions/settype)
- [Hex-Rays: Decompile as call](https://docs.hex-rays.com/ida-actions/hx_userdefinedcall)
- [Binary Ninja API 6.0: `callingconvention` module](https://api.binary.ninja/binaryninja.callingconvention-module.html)
- [Binary Ninja API 6.0: `platform` module](https://api.binary.ninja/binaryninja.platform-module.html)
- [Binary Ninja user documentation: platform types](https://docs.binary.ninja/guide/types/platformtypes.html)
- [The Official Radare2 Book: calling conventions](https://book.rada.re/analysis/calling_conventions.html)
- [The Official Radare2 Book: code analysis](https://book.rada.re/analysis/code_analysis.html)
- [angr documentation: decompiler analysis passes, including calling convention recovery](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)
- [rizin 0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
