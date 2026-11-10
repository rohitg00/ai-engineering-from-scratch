# Idiomas de compilador: o que a otimização faz ao seu código e como lê-lo de volta

> Um compilador de otimização substitui as construções de origem por formas de instrução mais baratas. Cada forma tem uma derivação, e esta lição constrói o reconhecedor que executa a derivação para trás e verifica-a contra a fonte.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, AArch64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode), Phase 13 · 38 (calling conventions)
**Time:** ~150 minutes

## Objetivos de aprendizagem

- Derivar o número mágico e deslocar para divisão por qualquer constante com o limite Granlund-Montgomery, e recuperar o divisor das constantes emitidas.
- Nomear as cinco formas em que a LLVM reduz a`switch`e ler a contagem de entradas, a localização da tabela e as entradas do objeto.
- Leia um loop vectorizado como faixas, acumuladores, elementos por iteração, máscara de contagem triplica, redução e restante.
- Reconhecer chamadas de cauda, chamadas de linha, seleções sem ramificação e loops que se tornaram`memset`ou `memcpy`- Não .
- Relatar cada idioma com as suas instruções de prova e a sua forma de fonte decodificada, em x86-64 e em AArch64, em `-O0`através de`-O3`- Não .
- Compare o resultado com o que Ghidra, Angr, radar2, rizin e lldb mostram para os mesmos bytes.

## O problema

Compila-te .`idioms.c`- Não .`-O2`E perguntou a um agente o que?`div7u`O agente leu.`imulq $0x24924925, %rax, %rax`e respondeu que a função multiplica por 613566757, muda e adiciona.`x / 7`- Não .

O mesmo objeto tem um`switch`Com sete casos que não têm salto, um `switch`com cinco casos que é uma mesa de salto, um `switch`com dois casos que é um `sete`e um `cmovne`, e um ciclo para cima .`n`números inteiros que executam oito números inteiros por iteração em dois `xmm`O processo de registo é realizado em um segundo ciclo.`-O0`a mesma fonte produzida `divl`, sete mesas de salto de entrada, e um ciclo escalar.`-O1`O interruptor de sete casos tornou-se uma tabela de valores e o ciclo vetorial ainda não existia.

As formas são idiomas. Um compilador emite cada uma de uma regra que você pode ler em sua fonte, e cada uma pode ser decodificada de volta para a construção de que veio. A decodificação é aritmética, e aritmética pode ser verificada.`0x66666667`Esta lição constrói o reconhecedor para todos eles, executa-o em 18 edições do nosso próprio código, e verifica todos os 373 relatórios contra a fonte C.

```figure
re-39-idioms-by-level
```

## Um idioma é uma forma com uma derivação

Um idioma é uma sequência de instruções emitidas pelo compilador para uma construção de fonte. Três coisas o tornam reconhecível. Ele tem uma forma fixa, os operandos carregam constantes que a derivação prevê, e a forma difere do que um programador escreveria à mão.

O reconhecedor em `code/main.py`Trabalhos sobre o texto de `llvm-objdump -d -r`A função de um objeto é definida como um "oráculo" para limites de instruções.`.rodata`, onde existem tabelas de valores, e o `.rela.rodata`As entradas, onde os alvos da mesa de saltos vivem antes de se ligarem.

Cada detecção é um`Idiom`registro com um `kind`, um decodificado .`source`formulário, lista de`evidence`Direitos, a `detail`Dicionário, e um `verified`A bandeira vem da fonte C.`parse_source()`lê `idioms.c`, encontra cada função, e extrai os divisores depois `/`E ...`%`, os multiplicadores depois `*`, o `switch`Os casos e os seus valores, os`? :`Os operadores, os`for`Loops e calles. Um idioma divisor é verificado quando seu divisor está na lista de divisão da função. Uma tabela de busca é verificada quando suas entradas coincidem com os valores do caso, até um fator constante. Uma chamada de cauda é verificada quando a chamada é chamada na fonte. O relatório demo termina com um `unverified`lista, e a suíte de testes afirma que a lista é vazia para todas as 18 construções.

O reconhecedor executa um pequeno avaliador simbólico sobre os blocos básicos de cada função, em ordem de listagem, com os nomes de parâmetros da fonte nos registros de argumentos das convenções do Sistema V e AAPCS64 da lição 38.`-O0`A cada entrada de blocos os estados dos antecessores são fundidos, e onde eles diferem um nome que um idioma anterior atribuído ganha sobre uma constante.`cmovll %edx, %eax`em `digest`- O que é que ele disse ?`sum % 10 < 5 ? sum % 10 : 5`: o idioma do loop chamado de acumulador `sum`, o idioma divisão nomeou o seu quociente `sum / 10`, e o modulo idiom chamou seu resultado `sum % 10`A fonte diz:`rem > 5 ? 5 : rem`Ambas as expressões dão o menor de `rem`E 5 e concordam em`rem == 5`- Não .

## Divisão por uma constante

Granlund e Montgomery, "Divisão por Inteiros Invariantes utilizando Multiplicação" (PLDI 1994), substituem `n / d`com um multiplicador e um turno.`s`e um multiplicador `m = ceil(2^s / d)`Então ...`floor(n * m / 2^s)`- É igual .`floor(n / d)`Para cada um`n`em intervalo quando o erro `e = m * d - 2^s`É pequeno o suficiente para 32 bits sem assinatura.`n`O limite é `e <= 2^(s - 32)`Para assinatura .`n`com`|n| < 2^31`O limite é `e <= 2^(s - 31)`, e um sinal de fixação adiciona 1 quando `n`é negativo, porque o piso rodea para o lado errado para os coeficientes negativos.

`magic_numbers(d, bits, signed)`em `main.py`Pesquisas `s`A busca reproduz cada constante emitida nas instalações.

### 10 sem assinatura à mão

`2^35 / 10 = 3435973836.8`O teto é...`3435973837 = 0xCCCCCCCD`O erro é:`0xCCCCCCCD * 10 - 2^35 = 2`, e o limite em `s = 35`É o que é`2^3 = 8`- Em .`s = 34`O erro seria 6 contra um limite de 4, então 35 é a menor mudança.`n = 123`- Não .`123 * 3435973837 = 422624781951`, e `422624781951 >> 35 = 12`- Não .

O clang emite exactamente isto para`div10u`- Não .`-O2`em x86-64:

```text
       0: 89 f9                        	movl	%edi, %ecx
       2: b8 cd cc cc cc               	movl	$0xcccccccd, %eax
       7: 48 0f af c1                  	imulq	%rcx, %rax
       b: 48 c1 e8 23                  	shrq	$0x23, %rax
```

`0x23`- É 35.`movl %edi, %ecx`O reconhecedor lê o multiplicador do `movl $imm`que alimenta o operand duplo.`imulq`, lê o turno e liga.`divisor_from_magic(0xCCCCCCCD, 35)`Essa função tenta .`2^35 // m = 10`e 11, e aceita 10 porque `magic_numbers(10)`dá o mesmo multiplicador e desloca-se para trás.

No AArch64 a mesma função é `mov w8, #0xcccd; movk w8, #0xcccc, lsl #16; umull x8, w0, w8; lsr x0, x8, #35`A constante chega em duas meias de 16 bits, o multiplicador é `umull`O reconhecedor reúne as metades e relata o mesmo divisor.

### 7 sem assinatura à mão, com a correcção adicional

`2^35 / 7 = 4908534052.57`O teto é...`4908534053 = 0x124924925`O erro é 3 contra um limite de 8, então a mudança é 35, e nenhuma mudança menor funciona. Um multiplicador de 32 bits não pode manter o multiplicador, então o compilador multiplica-se pelo baixo 32 bits`0x24924925`e adiciona o dividendo de volta numa sequência fixa:

```text
      32: 48 69 c0 25 49 92 24         	imulq	$0x24924925, %rax, %rax
      39: 48 c1 e8 20                  	shrq	$0x20, %rax
      3d: 29 c7                        	subl	%eax, %edi
      3f: d1 ef                        	shrl	%edi
      41: 01 f8                        	addl	%edi, %eax
      43: c1 e8 02                     	shrl	$0x2, %eax
```

Leia como `t = (n * 0x24924925) >> 32`, então`q = (((n - t) >> 1) + t) >> 2`O total da mudança é`32 + 1 + 2 = 35`- Com o`n = 100`- Não .`t = 14`- Não .`(100 - 14) >> 1 = 43`- Não .`43 + 14 = 57`- Não .`57 >> 2 = 14`O reconhecedor detecta o`sub`- Não .`shr`- Não .`add`- Não .`shr`Cauda após um turno de 32 bits, acrescenta `2^32`Voltando ao multiplicador, e recupera 7. `evaluate_division()`O teste verifica-o contra esta sequência exata.`n // 7`O formulário AArch64 é `sub w9, w0, w8; add w8, w8, w9, lsr #1; lsr w0, w8, #2`, uma instrução mais curta porque a adição deslocada é uma instrução.

### 3 assinado à mão

`2^32 / 3 = 1431655765.33`, teto`1431655766 = 0x55555556`, erro 2, e o limite assinado em `s = 32`É o que é`2^1 = 2`O limite é de 30 segundos, e o clang usa 32 segundos.`shrq $0x20`- Com o`n = -7`: o produto é `-10021590362`, a mudança aritmética por 32 dá `-3`, o sinal bit é definido, então a fixação adiciona 1 e o resultado é `-2`, que é `-7 / 3`em C. Os aparelhos assinados `div10s`E ...`div3s`Ambos carregam o equipamento como`shrq $0x3f`sobre uma cópia do produto seguida de `addl`- Não .

### O que as constantes não são

O multiplicador sozinho não nomeia divisor.`0x66666667`O mesmo multiplicador com o deslocamento 33 é 5, como mostrou a lição 34.`clangMatchesAlgorithm`As potências de dois nunca usam o multiplicador.`magic_numbers()`recusa-os, porque o compilador emite uma mudança com um preconceito de sinal em vez disso, e `mod8s`A secção seguinte mostra essa forma.

### O idioma pertence ao selector de instruções

- Não .`-O0`- Não .`div10u`É o que é`movl $0xa, %ecx; xorl %edx, %edx; divl %ecx`- Não .`div10s`É o que é`cltd; idivl %ecx`No mesmo objeto,`digest`Divide a soma do seu ciclo por 10 com `imulq $0x66666667`Uma bandeira explica a diferença.`idioms-x86_64-nofastisel-O0.o`Foi construído com `-O0 -mllvm -fast-isel=false`, e nela cada divisão é o multiplicar, incluindo `div10u`com`movl $0xcccccccd, %ecx; imulq %rcx, %rax; shrq $0x23`A divisão de hardware é a escolha do selector de instruções rápidas em `-O0`O multiplicador é a redução do SelectionDAG, que é o que LLVM `UnsignedDivisionByConstantInfo`E ...`SignedDivisionByConstantInfo`O processo de produção`digest`O bloco que mantém a divisão também mantém um`switch`O reconhecedor informa ambos os formulários,`hardware idivl`E ...`magic multiply`, e a figura mostra o misturado `-O0`função.

## Modulo segue o cotiente

`x % d`É o que é`x - (x / d) * d`O compilador calcula o quociente com o idioma acima, multiplica-o de volta e subtrai.`addl %ecx, %ecx; leal (%rcx,%rcx,4), %ecx`, que é `2 * q * 5`No AArch64 é uma instrução.`msub w0, w8, w9, w0`, que calcula .`w0 - w8 * w9`com`w9 = 10`O reconhecedor segue o registro dos coeficientes através de cópias, acompanha o fator acumulado através de `add`- Não .`lea`- Não .`shl`, e `imul`, e aceita um`sub`Quando o fator é igual ao divisor.

Quando o mesmo coeficiente também alimenta outra expressão, ambas as expressões permanecem no relatório.`-O1`O compilador computa `sum / 10`Uma vez por semana .`digest`e usa-o para o `switch`Em x86-64 ele combina o coeficiente duas vezes,`leal (%rax,%rsi), %edi`para o modulo e `addl %esi, %eax`O reconhecedor informa uma divisão e um módulo e marca o quociente como compartilhado.`switch`Indice não legível.

O modulo assinado por um poder de dois tem sua própria forma, porque o quociente nunca é calculado:

```text
      92: 8d 48 07                     	leal	0x7(%rax), %ecx
      95: 85 ff                        	testl	%edi, %edi
      97: 0f 49 cf                     	cmovnsl	%edi, %ecx
      9a: 83 e1 f8                     	andl	$-0x8, %ecx
      9d: 29 c8                        	subl	%ecx, %eax
```

Para um negativo`x`O código se desvia em 7 antes de mascarar, de modo que a truncation gira em direção a zero como C requer. O valor mascarado é `x`Arredondado para um múltiplo de 8, e a subtração deixa `x % 8`O AArch64 faz isso com `negs w8, w0; and w9, w0, #0x7; and w8, w8, #0x7; csneg w0, w9, w8, mi`: mascarar os dois `x`E ...`-x`Ghidra chama a sua regra para isso.`RuleSignMod2nOpt`, com a abreviação "Converter formulários INT_SREM: `(V + (sign >> (64-n)) & (2^n-1)) - (sign >> (64-n)) => V s% 2^n`" .

- Não .`-O0`O AArch64 escreve modulo como `sdiv w9, w8, w10; mul w9, w9, w10; subs w0, w8, w9`O reconhecedor aceita esse formulário e informa.`hardware sdiv + mul + subs`- Não .

## Cinco maneiras de baixar um interruptor

A LLVM decide a forma de um `switch`Em dois lugares.`SimplifyCFG::simplifySwitchLookup`- É um bom momento .`-O1`e acima e transforma um interruptor cujos casos todos produzem constantes em uma tabela de valores, quando existem pelo menos três casos e o alvo pode construir tabelas de busca.`SingleValueKind`- Não .`LinearMapKind`- Não .`BitMapKind`, e `ArrayKind`- O .`-O0`O oleoduto nunca corre esta passagem.`SwitchLowering::findJumpTables`na selecção de instruções, que cria uma mesa de salto quando o aglomerado tem pelo menos `min-jump-table-entries`4 por padrão e é suficientemente denso: `NumCases * 100 >= Range * MinDensity`com`jump-table-density`10 para funções normais e 40 para funções inferiores `-Os`O que resta torna-se uma busca binária sobre as constantes do caso, com `splitWorkItem`As instalações têm uma função por resultado.

| Function | Source | `-O0` x86-64 | `-O2` x86-64 | `-O2` AArch64 |
|---|---|---|---|---|
| `linear_switch` | cases 0 to 6 return 10 to 70 | jump table, 7 entries | linear map `10*k + 10`, default -1 | `madd` and `csinv` |
| `table_switch` | cases 0 to 6 return 10 to 60 then 71 | jump table, 7 entries | lookup table at `.rodata+0x28` | lookup table at `.rodata+0x0` |
| `call_switch` | cases 0 to 4 call one of five pointers | jump table, 5 entries | jump table, 5 entries | comparison tree, pivot 1 |
| `sparse_switch` | cases 1, 100, 10000, 1000000, 100000000 | compare chain | comparison tree, pivot 9999 | comparison tree, pivot 9999 |
| `two_cases` | cases 3 and 4 return 7 and 9 | compare chain | select chain `k != 3 ? (k == 4)*9 : 7` | two `csel` |

### A tabela de busca, lida a partir do objeto

`table_switch`- Não .`-O2`- Não .

```text
      d0: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      d5: 83 ff 06                     	cmpl	$0x6, %edi
      d8: 77 0c                        	ja	0xe6 <table_switch+0x16>
      da: 89 f8                        	movl	%edi, %eax
      dc: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		00000000000000df:  R_X86_64_PC32	.rodata+0x24
      e3: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      e6: c3                           	retq
```

Verificar os limites .`cmpl $6; ja`significa 7 entradas válidas.`0x24`mais os 4 bytes do campo relativo ao RIP coloca a tabela em `.rodata+0x28`, a lição de regra 33 derivada.`0a 00 00 00 14 00 00 00 ...`, então as entradas são`[10, 20, 30, 40, 50, 60, 71]`O montador chamou esta tabela de`.Lswitch.table.table_switch`No`.s`Arquivo, com comentário `@switch.table.table_switch`No objeto apenas a realocação e os bytes permanecem. Não há salto, então o gráfico de fluxo de controle tem três blocos.

O formulário AArch64 coloca a direcção da tabela junto com `adrp x8`E ...`add x8, x8, #0x0`, cada um carregando a sua própria realocação para `.rodata`, e carregam com `ldr w0, [x8, w0, uxtw #2]`O reconhecedor lê o adendo do `add`Realocação.

### O mapa linear, sem tabela em tudo

`linear_switch`Retorno `10 * (k + 1)`Para`k`em 0 a 6.`simplifySwitchLookup`detecta a relação afina e emite aritmética:

```text
      b0: 83 ff 07                     	cmpl	$0x7, %edi
      b3: 8d 04 bf                     	leal	(%rdi,%rdi,4), %eax
      b6: 8d 4c 00 0a                  	leal	0xa(%rax,%rax), %ecx
      ba: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      bf: 0f 42 c1                     	cmovbl	%ecx, %eax
```

O avaliador diz:`leal (%rdi,%rdi,4)`Como `5*k`- Não .`leal 0xa(%rax,%rax)`Como `10*k + 10`, e o `cmovb`Depois`cmpl $7`Como `k < 7 ? 10*k + 10 : -1`O reconhecedor verifica a fórmula em relação a cada caso de origem e marca o idioma verificado.`madd w8, w0, w8, w9`E ...`csinv w0, w8, wzr, lo`, onde`csinv`com`wzr`rendimentos `-1`no caminho padrão.

### A mesa de salto, lida de mudanças

`call_switch`- Não .`-O2`é a lição de forma 33 recuperada em `grade`- Não .`-O0`- Não .`cmpl $4; ja`, a `leaq`- Não .`.rodata-0x4`, a `movslq`de uma entrada de 4 bytes, `addq`, e `jmpq *%rax`As cinco entradas são realocações em`.rela.rodata`, e `target = addend - 4k`dá`0x10c, 0x107, 0x10e, 0x110, 0x109`, cinco blocos distintos que cada cauda saltar através de um punteiro funcional.`dispatch`O sistema fixa a 16 casos: 16 entradas de realocação em x86-64, e em AArch64 uma tabela comprimida de 16 bytes individuais,`ldrb w11, [x9, x8]`, escalado por 4 com `add x10, x10, x11, lsl #2`, e baseado em um`adr`O reconhecedor decodifica`[0x24, 0x74, 0x54, ...]`da tabela de byte e dos relatórios `compressed: true`- Não .

### O mesmo interruptor em quatro níveis

`digest`mantém um interruptor ligado .`sum / 10`com casos 6 a 10 e valores 1, 2, 4, 8, 8, então multiplica o resultado por 16. Em x86-64 é uma tabela de salto em `-O0`, uma mesa de busca em `-O1`com inscrições `[16, 32, 64, 128, 128]`, e uma mesa de saltos novamente em `-O2`E ...`-O3`cujos quatro blocos de caixa guardam`0x10`- Não .`0x20`- Não .`0x40`- Não .`0x80`- De ...`-O1`A multiplicação por 16 foi aumentada para os casos.`-O0`Os casos armazenam 1, 2, 4 e 8, e a multiplicação permanece após a mudança.`-O1`Tabela de busca o reconhecedor compara as entradas com os valores de origem, encontra uma relação constante e relata `foldedFactor: 16`No AArch64 o`-O2`forma é uma árvore de comparação com um pivot em 8, testes de igualdade para 6, 7 e 8, e um teste de alcance `sub w9, w9, #9; cmp w9, #2; b.hs`O reconhecedor informa que os casos 9 e 10 são tratados em duas instruções.`rangeTests: [[9, 10]]`- Não .

Duas bandeiras movem estes limites.`-fno-jump-tables`- Vira-se .`table_switch`- Não .`call_switch`, e o `digest`A função de sete casos é utilizada para a função de arco de comparação em x86-64, com os pivots 2 e 4.`-mllvm -min-jump-table-entries=4`Folhas`call_switch`A taxa de entrada não era a entrada decisiva para uma interrupção de cinco casos de chamadas indiretas.`idioms-arm64-jt4-O2.o`registos que funcionam.

O CCG aplica ambas as decisões .`tree-switch-conversion.cc`, com as aulas `jump_table_cluster`- Não .`bit_test_cluster`- Não .`switch_decision_tree`, e `switch_conversion`É o meu .`-ftree-switch-conversion`Está em .`-O2`- Não .`-fjump-tables`E ...`-fbit-tests`- Não .`-O1`, e o limite da mesa de salto vem de`case-values-threshold`Não há GCC instalado nesta máquina, então esses nomes vêm da fonte GCC e manual, e o Compiler Explorer é onde você verifica-los.

## Loops: Vectorizados, Desrolhados ou Substituídos

O vectorizador de loop do LLVM está ligado.`-O2`- Não .`-O3`, e `-Os`, e desligado em`-O0`E ...`-O1`, uma regra que data de LLVM 3.4 em Janeiro de 2014. `sum_n`- Não .`-O2`mostra todas as partes da forma:

```text
     1f6: 83 fe 07                     	cmpl	$0x7, %esi
     1f9: 77 09                        	ja	0x204 <sum_n+0x14>
     206: 81 e2 f8 ff ff 7f            	andl	$0x7ffffff8, %edx
     230: f3 0f 6f 14 37               	movdqu	(%rdi,%rsi), %xmm2
     235: 66 0f fe c2                  	paddd	%xmm2, %xmm0
     239: f3 0f 6f 54 37 10            	movdqu	0x10(%rdi,%rsi), %xmm2
     23f: 66 0f fe ca                  	paddd	%xmm2, %xmm1
     243: 48 83 c6 20                  	addq	$0x20, %rsi
     24a: 75 e4                        	jne	0x230 <sum_n+0x40>
     24c: 66 0f fe c8                  	paddd	%xmm0, %xmm1
     250: 66 0f 70 c1 ee               	pshufd	$0xee, %xmm1, %xmm0
     262: 66 0f 7e c8                  	movd	%xmm1, %eax
     270: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
     279: 75 f5                        	jne	0x270 <sum_n+0x80>
```

O guarda .`cmpl $7; ja`Envia o número de viagens abaixo de 8 para o ciclo escalar.`andl $0x7ffffff8`As rotas da viagem contam para um múltiplo de 8. O corpo carrega 32 bytes por iteração em dois `xmm`acumuladores, quatro vias de 32 bits cada, então o fator de vectorização é 4 e o fator de interleave é 2.`paddd`- Dois .`pshufd`- Mais dois .`paddd`, e `movd`Reduzir as oito pistas para um número inteiro.`0x270`O reconhecedor encontra o loop da borda traseira, vê os registros SIMD, lê a contagem de faixa de `paddd`, conta acumuladores distintos, divide o passo `0x20`- 4 e relatórios `4 lanes x 2 accumulators = 8 elements per iteration`A Arch64 faz o mesmo com o arco de segurança.`ldp q2, q3`- Dois .`add v.4s`- Não .`addv s0, v0.4s`, e `fmov w8, s0`- Não .

Uma contagem fixa de viagens remove o ciclo. `sum4`É um .`movdqu`, a redução e `movd`, sem borda traseira.`poly8`Não pode vectorizar, porque cada iteração depende do acumulador anterior, então o compilador desdobra-o oito vezes: oito cargas em compensações 0 a `0x1c`de`%rdi`, cada um seguido por um deslocamento por 5 e uma subtração que calcula `acc * 31`O reconhecedor conta as cargas em compensações consecutivas a partir de uma base e informa `loop unrolled by 8, no back edge`No AArch64 chegam as mesmas cargas que quatro .`ldp`- Em pares.

Desligue o vectorizador com `-fno-vectorize -fno-slp-vectorize`E ...`sum_n`torna-se um ciclo escalar desenrolhado por 8, com oito `addl k(%rdi,%rdx,4), %eax`E ...`addq $8`, mais um ciclo restante.`sum4`O reconhecedor informa`unrolled loop`com`copies: 8`E ...`indexStep: 8`para o primeiro e `copies: 4`- Por um segundo.

Lição 33 encontrou duas bordas traseiras em `total`- Não .`-O2`A lição chama-lhes dois loops: um corpo vetorial e um restante escalar do mesmo loop fonte.`is_loop()`Verifica isso, porque`digest`no AArch64 contém ramos retroceder a um bloco padrão compartilhado que não são loops, e a primeira versão do reconhecedor os contou como loops vetoriais.

### Loops que se tornam chamadas de biblioteca

`LoopIdiomRecognize`transforma um loop que armazena zero em cada byte em uma chamada para `memset`, de`-O1`Para cima.`fill`- Não .`-O2`É o que é`testl %esi, %esi; jle; movl %esi, %edx; xorl %esi, %esi; jmp memset@PLT`A chamada é um salto de cauda com a realocação .`R_X86_64_PLT32 memset-0x4`, e a função é`retq`O reconhecedor informa que o sistema de detecção de dados não está em vias de extinção.`store loop recognized as memset(...)`e verifica-lo contra o ciclo fonte, porque a fonte nunca nomeia `memset`- Não .

`copy16`chamadas`memcpy`com uma constante 16, e o backend x86 expansão em linha como `movups (%rsi), %xmm0; movups %xmm0, (%rdi)`, dentro do seu limite de 8 lojas por`memcpy`- Em .`-O0`A mesma chamada é duas 8 bytes `movq`- Em pares.`-fno-builtin`A chamada continua a ser chamada.`jmp memcpy@PLT`com`movl $0x10, %edx`, e `fill`mantém o seu ciclo, que o vectorizador então transforma em um ciclo de dois 16 bytes `movups`As informações do reconhecedor`vectorized store loop: 2 x 16-byte stores = 32 bytes per iteration`Para essa construção.

## Chamadas que desaparecem ou se tornam saltos

`tail_caller`Retorno `tail_target(x + 1)`- Em .`-O0`É verdade.`addl $0x1, %edi; callq tail_target@PLT; addq $0x10, %rsp; popq %rbp; retq`- Em .`-O2`É verdade.`incl %edi; jmp tail_target@PLT`O quadro do chamador desapareceu e o chamador voltou ao chamador.`b tail_target`com`R_AARCH64_JUMP26`O reconhecedor trata um`jmp`ou `b`A descida recorrente da lição 33 deve tratá-la como uma saída de função, porque o alvo está fora da função.

`twice_sum`chamadas`leaf_add`- Em .`-O0`A chamada está lá.`callq leaf_add@PLT`- De ...`-O1`O corpo de`leaf_add`- Não .`leal (%rdi,%rsi), %eax`, aparece dentro .`twice_sum`E não há nenhuma chamada.`-O0`Clang marca cada função `optnone`E ...`noinline`O reconhecedor sabe da fonte que o sistema de identificação é um sistema de identificação de dados.`twice_sum`chamadas`leaf_add`, não encontra nenhuma chamada ou salto de cauda para ele, e então procura a forma do corpo da chamada no chamador: a mnemônica e a fonte operando com o destino removido, então `add w8, w1, w0`nos correspondências de chamadas do AArch64 `add w0, w1, w0`Uma coincidência é a prova.

`dispatch`combina ambas as coisas: uma mesa de salto de 16 entradas cuja cada caixa é`movl %esi, %edi; jmp fN@PLT`O reconhecedor informa um interruptor e 16 chamadas de cauda, todas verificadas contra as 16 chamadas na fonte.

## Ramos que se tornaram dados se mudam

`clamp_max`É o que é`movl %esi, %eax; cmpl %esi, %edi; cmovgl %edi, %eax`Os nomes dos avaliadores`%edi`Como `a`E ...`%esi`Como `b`, registra a comparação e lê o`cmovg`Como `a > b ? a : b`, que é o texto de origem. `abs_int`É o que é`movl %edi, %eax; negl %eax; cmovsl %edi, %eax`e diz:`-x < 0 ? x : -x`A AArch64 escreve-o como:`cmp w0, #0; cneg w0, w0, mi`e diz:`x < 0 ? -x : x`- Não .`is_pos`É o que é`xorl %eax, %eax; testl %edi, %edi; setg %al`, que diz:`(x > 0)`- Estes são ...`-fif-conversion`Em palavras do CCG e `cmov`seleção nos LLVM.`X86CmovConversion`O passe pode virar um `cmov`O que é que é o que é o resultado?

- Não .`-O0`Nenhum deles existe.`clamp_max`é um comparador, a `jle`O reconhecedor não informa nada sobre isso.`-O0`E ...`branchless select`de`-O1`, que é um dos fatos que a figura torna visível.

`mul9`É um .`leal (%rdi,%rdi,8), %eax`, e os relatórios do reconhecedor `strength reduction`com`x * 9`, porque a fonte se multiplica por 9.`lea`que escala um índice de tabela não é uma multiplicação.

## Duas características endurecedoras que parecem idiomas

O protector de pilha é uma característica de compilador, e deixa uma forma que um agente de outra forma vai ler como lógica do programa. `canary.c`Compilado com `-fstack-protector-strong`para x86-64 Linux dá:

```text
       7: 64 48 8b 04 25 28 00 00 00   	movq	%fs:0x28, %rax
      10: 48 89 44 24 40               	movq	%rax, 0x40(%rsp)
      26: 64 48 8b 0c 25 28 00 00 00   	movq	%fs:0x28, %rcx
      2f: 48 3b 4c 24 40               	cmpq	0x40(%rsp), %rcx
      34: 75 05                        	jne	0x3b <with_canary+0x3b>
      3b: e8 00 00 00 00               	callq	0x40 <plain_leaf>
		000000000000003c:  R_X86_64_PLT32	__stack_chk_fail-0x4
```

`%fs:0x28`É o que é`stack_guard`em glibc's `tcbhead_t`, em byte offset 40, e LLVM's `getIRStackGuard`O prólogo copia a guarda acima do tampão, o epílogo compara e o caminho de falha chama`__stack_chk_fail`No AArch64 Linux , o guard vem do Global .`__stack_chk_guard`através do GOT com `adrp`E ...`ldr`, e o fracasso é`bl __stack_chk_fail`O reconhecedor informa a fonte de segurança, o slot, a comparação e a chamada de falha.`plain_leaf`, que não tem arame, não tem canário sob`strong`, que protege as funções com matrizes,`alloca`As notas de investigação também registam o formulário MSVC em`/GS`, um biscoito misturado com `%rsp`e verificado por `__security_check_cookie`; não existe nenhum linker MSVC nesta máquina, de modo que essa forma é descrita apenas a partir da saída de montagem do compilador.

`-fcf-protection=full`- Põe`endbr64`, bytes `f3 0f 1e fa`É uma plataforma de aterragem para ramificações indiretas em processadores com controlo de fluxo de aplicação, e executar como um`nop`Os padrões de iniciação de função x86-64 de Ghidra incluem o`endbr64`variantes prefixadas de `push rbp; mov rbp, rsp`O reconhecedor informa-o como:`cet landing pad`, então uma função que começa com quatro bytes incomuns não é confundida com dados.

## O que os decompiladores dobram

Cada decompilador na lição 37 executa algumas dessas derivações como regras de reescritura.`ruleaction.cc`- Não .`RuleDivOpt`é "Converte INT_MULT e mude os formulários para INT_DIV ou INT_SDIV", com os formulários `sub( (zext(V)*c), d) >> e => V / (2^n/(c-1)) where n = d*8 + e`e a variante assinada com `sext`E ...`s>>`- Não .`RuleModOpt`é "Simplificar expressões que otimizam INT_REM e INT_SREM". `RuleDivTermAdd`- encarregue-se da correcção adicional,`RuleSignDiv2`- Vira-se .`(V + -1*(V s>> 31)) s>> 1`em`V s/ 2`, e `RulePositiveDiv`A lição 37 capturou Ghidra 12.1.4 na lição 33's `grade`- Não .`-O1`, e a saída é`uVar2 = param_1 / 10 - 6;`A divisão está dobrada.

A entrada para essas regras é visível sem Java. o pypcode 4.0.1 do venv é elevado com a mesma especificação SLEIGH que Ghidra usa, e `code/fixtures/idioms-x86_64-O2.lifts.json`Detém o código P bruto para `div10s`: 112 entradas para sete instruções, das quais 7 são as instruções`IMARK`marcadores que abrem cada instrução, entre eles `RAX = RAX * unique[95a00:8]`Depois`unique[95a00:8] = sext(0x66666667)`- Não .`RCX = RCX >> unique[d1a00:4]`, e `RAX = RAX s>> unique[c5c00:4]`- O .`shrq`realiza 41 operações e a`sarq`Carrega 40 e a maioria deles calcula as bandeiras.`RuleDivOpt`coincide com o multiplicador e as duas mudanças neste fluxo, e a eliminação de código morto remove as bandeiras que nada lê.

A Angr 10.0.3 correu em nosso .`-O2`objeto, e `idioms-x86_64-O2.angr.json`mantém a sua saída de decompilador para 20 funções.`div10u`É o que é`return a0 / 10;`Não dobrar o formulário assinado: `div10s`É o que é`v1 = a0 * 1717986919; return ((long long)(v1) >> 0x22) + (v1 >> 63);`E ...`mod10s`É o que é`a0 - (...) * 2 * 5`- Para o ...`div7u`Imprime .`(a0 / 7 + ((a0 * 6 / 7 & 0xffffffff) >> 1 & 0xffffffff) & 0xffffffff) >> 2`, onde os termos de fixação sobrevivem como aritmética.`mul9`- Não .`a0 * 9`- Não .`linear_switch`- Não .`(a0 < 7 ? a0 * 10 + 10 : 0xffffffff)`- Não .`clamp_max`- Não .`((int)a1 < (int)a0 ? a0 : a1)`- Não .`is_pos`- Não .`a0 > 0`, e `fill`- Não .`return memset(a0, 0, a1);`Imprime .`table_switch`Como carga .`*(int *)(4 * a0 + 4195400)`sem os valores, `sum_n`com`_mm_add_epi32`E ...`_mm_shuffle_epi32`Intrínsecas, e `tail_caller`Como `tail_target(); return;`- Não, não, não.`digest`A mesa de salto torna-se `goto *((void *)(...))`com a aritmética da tabela escrita.

O radar2 6.2.4 e o rizin 0.9.1, construídos a partir da fonte no cache de pesquisa, foram executados no mesmo objeto.`pdc`impressões digitais`div10s`Como `rax = rax * 0x66666667; rcx >>>= 0x3f; rax >>= 0x22; eax += ecx`, pseudocapa de nível de registro sem dobrar, e `table_switch`Como `eax = dword [rcx + rax*4]`com um `RELOC 32 .rodata`Comentário sobre o `lea`. rizin não tem um decompilador embuído; é`aoi`Imprime o RzIL do `imul`Como um produto de 128-bit. lldb-1703.0.236.21 carrega o objeto ELF e os seus `disassemble -n div10s`Imprime as mesmas sete instruções que `llvm-objdump`O Capstone 5.0.7 decodifica os mesmos bytes e relata grupos como `ret`E ...`mode64`A IDA Pro e Binary Ninja não foram executados aqui. Sua documentação descreve os estágios em que tal reescritura acontece, a otimização do microcód e o MLIL para HLIL passa, e esta lição não faz nenhuma afirmação sobre quais idiomas eles dobram.

O Compilador Explorer é a ferramenta para a direção para a frente.`idioms.c`, escolha uma entrada do compilador como "x86-64 clang 18.1.0" ou "ARM64 GCC 14.2.0", e defina as bandeiras. O serviço lista cerca de 1.050 entradas do compilador C e tem uma API: `GET /api/compilers/c`Retorna os identificadores e `POST /api/compiler/<id>/compile`Retorna a montagem como JSON. O artigo ACM Queue de Matt Godbolt de 2019 percorre a divisão, contagem de população, condicional em cadeia e idiomas de soma com esta ferramenta. Use-o para a saída do GCC, que esta máquina não pode produzir, e compare os limiares da tabela de salto do GCC e `-O2`A vectorização é padrão do GCC 12 com a saída de clang nas fixações.

## Construí-lo

Executa a demonstração:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
```

A saída é um relatório JSON. Para cada uma das 18 construções, ele lista todas as funções e suas idiomas, com tipo, forma fonte, endereços de evidência, verificação e os campos de detalhes.`-O2`contra `-O3`A comparação entre as duas arquiteturas e a`unverified`Lista.

Forma esperada:

```json
{
  "builds": {
    "idioms-x86_64-O2": {
      "arch": "x86_64", "level": "O2", "flags": "x86_64",
      "functions": {
        "div7u": [{"kind": "division", "source": "x / 7", "evidence": ["0x30", "0x32", "0x39", "0x3d", "0x3f", "0x41", "0x43"], "verified": true, "form": "magic multiply with add fix-up", "magic": "0x24924925", "effectiveMagic": "0x124924925", "shift": 35, "...": "..."}],
        "table_switch": [{"kind": "switch", "source": "switch (k) as lookup table", "table": ".rodata+0x28", "entries": 7, "values": [10, 20, 30, 40, 50, 60, 71], "...": "..."}],
        "sum_n": [{"kind": "vector loop", "lanes": 4, "accumulators": 2, "elementsPerIteration": 8, "...": "..."}]
      }
    }
  },
  "kindMatrix": {"idioms-x86_64-O2": {"division": 5, "modulo": 3, "switch": 6, "vector loop": 3, "...": "..."}},
  "sameCodeAtO2AndO3": {"x86_64": {"identical": true}, "arm64": {"identical": false, "differences": ["..."]}},
  "unverified": []
}
```

Leia `code/main.py`na ordem seguinte:

1. `parse_listing()`- Não .`llvm-objdump -d -r`O texto em funções, instruções e realocações anexas para ambas as arquiteturas.
2. `ElfFile`lê seções, símbolos e `.rela.*`- a entrada, e`words()`lê as entradas da mesa.
3. `magic_numbers()`- Não .`divisor_from_magic()`, e `evaluate_division()`são a derivação de Granlund-Montgomery para frente, para trás, e como a sequência de instruções.
4. `parse_source()`extrai as construções necessárias à verificação do ficheiro C.
5. `Evaluator`é o passe simbólico bloco a bloco que registra nomes e empilha slots.
6. `find_divisions()`E ...`find_modulos()`combinar o multiplicar, a mudar, a fixar, o multiplicar e o poder de duas formas.
7. `find_switches()`classifica tabelas de salto, tabelas de busca, mapas lineares, cadeias selecionadas, árvores de comparação e cadeias de comparação.
8. `find_vector_loops()`- Não .`find_unrolled_loops()`- Não .`find_tail_calls()`- Não .`find_inlined_calls()`- Não .`find_selects()`- Não .`find_memory_builtins()`- Não .`find_stack_protector()`- Não .`find_cet()`, e `find_strength_reduction()`- Cobrir o resto.
9. `analyze_function()`O resultado é o nome de cada idioma, que é inserido na próxima passagem do avaliador.

Existem mais três comandos.`python3 code/main.py scan FILE.objdump.txt [FUNCTION]`corre o reconhecedor em uma listagem, com o objeto e o arquivo C correspondente encontrados ao lado dele. `python3 code/main.py magic DIVISOR [signed]`Imprime o multiplicador, o deslocamento, o erro e se a identidade mantém os valores de borda. `python3 code/main.py figure-data`Imprime os dados que a figura incorpora.

## Usá-lo

Use o reconhecedor nesta ordem em um novo objeto que construiu.

1. Captura .`llvm-objdump -d -r`O reconhecedor lê a arquitetura do cabeçalho da listagem.
2. Corra .`scan`na lista e ler o `unverified`Cada uma é uma construção que o analisador de origem não viu ou uma forma que o reconhecedor leu mal, e ambos merecem uma olhada nos endereços de evidências.
3. Para cada divisão, leia o`algorithm`Campo. quando`clangMatchesAlgorithm`Quando é falso, o compilador tinha uma razão que você ainda não sabe; escreva as constantes.
4. Para cada interruptor, compare o `lowering`Uma tabela que se torna uma árvore, ou uma árvore que se torna uma tabela, marca um limiar que você pode nomear a partir da fonte LLVM.
5. Para cada ciclo, leia.`elementsPerIteration`E ...`scalarRemainderLoop`, então confirme que os dois arredores de trás lição 33 relatórios são um ciclo fonte.
6. Exerça um decompilador no mesmo objeto, cite o texto ao lado de cada idioma e grava quais dobram.

## Laboratório Interativo

### Lab A: derivar um número mágico, e depois encontrá-lo

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/code
python3 -q
```

- Correr .

```python
from main import *
magic_numbers(10), magic_numbers(10, signed=True)
magic_numbers(7), magic_numbers(7, signed=True)
divisor_from_magic(0x66666667, 34, signed=True), divisor_from_magic(0x66666667, 33, signed=True)
```

Computação`ceil(2^35 / 10)`Em papel antes da primeira chamada.`unsigned div13(unsigned x) { return x / 13; }`para uma cópia de `idioms.c`, construí-lo em `-O2`Com o comando em `build_fixtures.sh`, e verificar a constante na lista contra `magic_numbers(13)`- Não .

### Laboratório B: a mesa e a árvore

```python
listing = load_listing("idioms-x86_64-O2.objdump.txt")
elf = load_elf("idioms-x86_64-O2.o")
sources = load_source("idioms.c")
[i.to_dict() for i in analyze_function(listing, "table_switch", elf, sources)]
[i.to_dict() for i in analyze_function(listing, "sparse_switch", elf, sources)]
elf.words(".rodata", 0x28, 7)
```

Mudança .`71`De volta para `70`em cópia de `table_switch`, reconstruir em `-O2`, e ver a tabela de busca se tornar um mapa linear. Então alterar um valor de caso para 1000 e ver que permanece um`ArrayKind`- A mesa.

### Laboratório C: o ciclo em três configurações

```python
for name in ("idioms-x86_64-O1", "idioms-x86_64-O2", "idioms-x86_64-novec-O2"):
    print(name, [i.source for i in analyze_function(load_listing(name + ".objdump.txt"), "sum_n", load_elf(name + ".o"), sources)])
```

Desenhar o gráfico de fluxo de controlo de `sum_n`- Não .`-O2`com a mão, marque o guard, a máscara, o corpo vetorial, a redução e o ciclo restante, e compare com o `detail`campos.

### Laboratório D: o coeficiente compartilhado

```python
for name in ("idioms-x86_64-O1", "idioms-arm64-O1"):
    print([(i.kind, i.source, i.detail.get("sharedQuotient")) for i in analyze_function(load_listing(name + ".objdump.txt"), "digest", load_elf(name + ".o"), sources)])
```

Leia o `-O1`lista de `digest`e encontrar as duas instruções que combinam o quociente com o seu sinal de fixação em x86-64.

## Laboratório de Prática

Adicione truques aos aparelhos e estenda o reconhecedor.

Requisitos:

- Escreva .`popcount`- Não .`ctz`, e `rotl`Funções com construções do CCG e uma mudança ou rotação, construí-las em `-O2`com e sem`-mpopcnt -mbmi`, e comprometem os objetos com as suas listas.
- Reconheça o`0x55555555`- Não .`0x33333333`- Não .`0x0f0f0f0f`- Não .`0x01010101`sequência de contagem de população que `TargetLowering::expandCTPOP`emitem e relatam-no como`popcount`com as quatro constantes como prova.
- Reconheça`rep bsfl`como o `tzcnt`- Ou...`bsf`codificação e `roll %cl`Como a rotação, e decodificar ambos para a construção.
- Adicionar os novos tipos para `parse_source()`A verificação, por isso `popcount`O idioma só é verificado quando a fonte chama.`__builtin_popcount`- Não .
- Adicione um teste por idioma que leia as constantes da lista de dispositivos.

O sucesso significa`python3 code/main.py`Relata os três novos tipos com `verified: true`Em ambas as construções, e a suite ainda relata um vazio.`unverified`Lista.

## Lição Artifacto

Esta lição inclui `outputs/skill-compiler-idioms-and-optimization.md`. Utilize-o para transformar uma listagem, um objeto e sua fonte em um relatório de idioma verificado com uma comparação de decompilador.

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A verificação deve provar:

- O parcer de listagem lê 25 funções do `-O2`Objeto, mantém os bytes e anexa `R_X86_64_PC32 .rodata+0x24`- O que é ?`leaq`em `table_switch`
- O leitor ELF retorna `[10, 20, 30, 40, 50, 60, 71]`de`.rodata+0x28`e dez realocações em `.rela.rodata`
- `magic_numbers`Retorno `0xcccccccd`com turno 35, `0x66666667`com 34, `0x124924925`com 35 e o formulário adicionado, `0x55555556`com 32, e `0xaaaaaaab`com 33
- a identidade mantém os valores de borda de 32 bits para cada divisor de 2 a 64 que não seja um poder de dois, assinado e não assinado
- `divisor_from_magic`recupera 10, 5, 7 e 3 de seus pares e rejeita um par errado
- O computo da sequência de fixação adicional `n // 7`- Exactamente.
- As quatro divisões x86-64 relatam o multiplicador direito, o deslocamento, o divisor e a forma, e as quatro divisões AArch64 decodificam `mov`E ...`movk`
- `-O0`utilizações `divl`E ...`idivl`- Não .`-O0 -fast-isel=false`utiliza o multiplicador, e `digest`- Não .`-O0`mistura os dois
- O modulo é reconhecido como multiplo-back,`msub`, poder de dois, `sdiv`- E mais .`mul`- E mais .`subs`, e hardware `idivl`
- Um coeficiente compartilhado mantém a divisão e o modulo em `-O1`
- As cinco descidas são classificadas em `-O2`Em ambas as arquiteturas, com a fórmula, os valores, os objetivos, os pivots e a expressão selecionada
- `-O0`Os switches são tabelas de salto em x86-64 e comparar cadeias em AArch64
- O `digest`O switch é uma mesa de salto, depois uma mesa de busca com foldado fator 16, depois uma mesa de salto com quatro alvos distintos em x86-64, e uma árvore de comparação com o teste de intervalo 9 a 10 no AArch64
- `-fno-jump-tables`produz árvores de comparação, e o caso 16.`dispatch`lê os seus objetivos a partir de realocações em x86-64 e de uma tabela de byte comprimida em AArch64
- O ciclo vetorial relata 4 faixas, 2 acumuladores, 8 elementos por iteração, a máscara, a guarda, a redução e o ciclo restante
- Os circuitos de viagem fixa são totalmente vectorizados ou totalmente desenrolados, e `-fno-vectorize`Desdobrar por 8
- `-O1`não tem vectorização, `-O2`E ...`-O3`são idênticos em x86-64, e em AArch64 diferem apenas em `call_switch`, onde`-O3`Tem 17 instruções e `-O2`tem 18
- `-fno-builtin`transforma o loop de loja em um loop de loja vectorizado e mantém `memcpy`Uma chamada
- - O que é que é?`memset`Substituição, a cópia de 16 bytes em linha, e o `-O0`são reconhecidas cópias de dois movimentos
- A callee em linha é encontrada em `-O1`por forma de corpo
- seleciona decodificar para `a > b ? a : b`- Não .`-x < 0 ? x : -x`- Não .`(x > 0)`, e `sum % 10 < 5 ? sum % 10 : 5`
- os relatórios do protector de pilha `%fs:0x28`, a ranura, e `__stack_chk_fail`, e `endbr64`é relatado em todas as funções da construção CET
- O parcer de fonte lê os parâmetros do punhal de função, os casos de interruptor, as chamadas e os nomes do acumulador
- Cada idioma em cada construção é verificado e as matrizes de tipo correspondem
- A figura interativa incorpora os mesmos dados que a análise produz

## Modos de falha de produção

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Multiply by a large odd constant | "multiplies by 1717986919" | The constant is `ceil(2^s / d)` for one `d`, the error satisfies the bound, and the shift is the smallest valid one |
| Add fix-up after a 32-bit shift | Five arithmetic instructions | The multiplier is 33 bits wide and the tail is the add form of the same method |
| Same multiplier, different shift | The same divisor | The shift selects the divisor: 34 is 10, 33 is 5 |
| Power-of-two signed modulo | "adds 7, masks, subtracts" | The bias rounds toward zero and the result is `x % 8` |
| Indexed load from `.rodata` | "a jump table" | A lookup table of values, with entries read from the bytes at addend plus 4 |
| Affine arithmetic and a `cmov` | "computes 10k + 10" | A switch lowered as a linear map, verified against every source case |
| Compare chain with ordered splits | "a sequence of ifs" | A binary search over the case constants with the pivots named |
| Backward branch to a default block | "a loop" | The target leaves the region with an unconditional jump; it is a shared tail |
| Two back edges in one function | "two loops" | One source loop: the vector body and its scalar remainder |
| `jmp memset@PLT` with no `ret` | "the function has no return" | A tail call that returns through the callee, replacing a store loop |
| Callee missing from the call graph | "never called" | Inlined: the callee's body shape appears in the caller |
| `%fs:0x28` load and compare | "reads thread-local data" | The stack protector canary, with the fail path to `__stack_chk_fail` |
| Four odd bytes at function start | "data before the function" | `endbr64`, the CET landing pad |
| Decompiler shows raw arithmetic | "the tool is wrong" | The tool did not apply a fold; the derivation gives the source form and the quoted output records the gap |

## Regra de funcionamento

Compare a forma, execute a derivação para trás e escreva as constantes que a comprovam. Relate cada idioma com seus endereços de evidência e sua forma de fonte decodificada, verifique cada uma contra a fonte que você compilar, e cite o que cada decompiler imprimiu para os mesmos bytes.

## Mais leitura

- [Granlund, Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994)](https://gmplib.org/~tege/divcnst-pldi94.pdf)
- [Warren, Hacker's Delight, 2nd edition, Chapter 10: Integer Division By Constants](https://www.informit.com/store/hackers-delight-9780321842688)
- [Lemire, Kaser, Kurz, "Faster Remainder by Direct Computation" (2019)](https://arxiv.org/abs/1902.01961)
- [libdivide, header-only division by runtime constants](https://github.com/ridiculousfish/libdivide)
- [LLVM `DivisionByConstantInfo.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Support/DivisionByConstantInfo.cpp)
- [LLVM `SwitchLoweringUtils.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/SwitchLoweringUtils.cpp)E ...[`TargetLoweringBase.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/TargetLoweringBase.cpp)
- [LLVM `SimplifyCFG.cpp`, `simplifySwitchLookup`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Utils/SimplifyCFG.cpp)
- [LLVM Auto-Vectorization documentation](https://llvm.org/docs/Vectorizers.html)E ...[LLVM 3.4 release notes](https://releases.llvm.org/3.4/docs/ReleaseNotes.html)
- [LLVM `LoopIdiomRecognize.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Scalar/LoopIdiomRecognize.cpp)
- [LLVM `X86CmovConversion.cpp`](https://github.com/llvm/llvm-project/blob/release/20.x/llvm/lib/Target/X86/X86CmovConversion.cpp)
- [LLVM `StackProtector.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/StackProtector.cpp)E ...[`X86ISelLoweringCall.cpp`, `getIRStackGuard`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Target/X86/X86ISelLoweringCall.cpp)
- [glibc `sysdeps/x86_64/nptl/tls.h`, `tcbhead_t`](https://sourceware.org/git/?p=glibc.git;a=blob;f=sysdeps/x86_64/nptl/tls.h)
- [GCC `tree-switch-conversion.cc`](https://github.com/gcc-mirror/gcc/blob/master/gcc/tree-switch-conversion.cc)- Não .[GCC Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html), e [GCC 12 release notes](https://gcc.gnu.org/gcc-12/changes.html)
- [Ghidra decompiler `ruleaction.cc`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/decompile/cpp/ruleaction.cc)
- [angr decompiler documentation](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 book: decompilers](https://book.rada.re/arch/decompile.html)
- [Compiler Explorer API](https://github.com/compiler-explorer/compiler-explorer/blob/main/docs/API.md)
- [Godbolt, "Optimizations in C++ Compilers: A practical journey", ACM Queue 17(5), 2019](https://queue.acm.org/detail.cfm?id=3372264)
- [Microsoft, `/GS` (Buffer Security Check)](https://learn.microsoft.com/en-us/cpp/build/reference/gs-buffer-security-check)
