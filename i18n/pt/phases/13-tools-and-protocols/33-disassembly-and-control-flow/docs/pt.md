# Desmontagem e fluxo de controle: de bytes a um gráfico que você pode verificar

> Uma lista de desmontagem é uma afirmação sobre quais bytes são instruções, e esta lição constrói o decodificador e o gráfico que verificam a afirmação.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch)
**Time:** ~150 minutes

## Objetivos de aprendizagem

- Decodificar o subconjunto de instruções x86-64 nos ficheiros do livro de conta das regras do volume 2 do SDM Intel, capítulo 2.
- Prova o decodificador contra `llvm-objdump -d`Em todas as instruções de cada edifício.
- Faça uma varredura linear e uma descida recursiva sobre os mesmos bytes e explique onde cada um está errado.
- Cortar instruções em blocos básicos e construir um gráfico de fluxo de controle com bordas digitalizadas.
- Compute dominadores imediatos com o algoritmo iterativo de Cooper, Harvey e Kennedy, e encontre loops de bordas traseiras.
- Recuperar os alvos de um salto indireto das entradas de realocação que apontam para a sua mesa.

## O problema

Compila-te .`ledger.c`- Não .`-O0`E perguntou a um agente o que?`grade`O agente ligou para um desmonteador, leu a listagem e respondeu que a função termina em`jmpq *%rax`Depois escreveu pseudocódio com um único`return 0`- Não .

Abres o mesmo objeto em`llvm-objdump -d`E vemos quatro blocos depois do salto que armazenam 4, 3, 2 e 1. A listagem tinha-os desde o início. Nada na listagem diz como a execução chega a eles, então a ferramenta tratou-os como código morto.

Uma lista responde apenas a uma pergunta: qual bytes forma qual instrução. Não diz quais instruções são executadas, em que ordem ou de onde. Para responder a elas você precisa de mais três estruturas: os bytes que o fluxo de controle pode alcançar, os blocos básicos e as bordas entre eles.

A rea 6.5.0 não possui desmontagem própria. Para análise profunda, o README pede que traga Ghidra, Hopper ou IDA. Para inspeção offline, rea também pode chamar um GNU objdump ou um Rizin que você instalar. O gráfico de chamadas para em alvos não resolvidos: "Callers/callees contêm apenas funções resolvidas.... O fluxo informático sem alvo permanece desconhecido". Esta lição constrói a parte que produz esses fatos, para que você possa julgá-los quando uma ferramenta os relata.

```figure
re-33-sweep-vs-descent
```

## O formato de instrução tem uma regra por campo

Intel SDM Volume 2, Figura 2-1 dá a ordem de byte de cada instrução. Primeiro vêm prefixos opcionais, depois um a três bytes opcode, depois um byte ModRM opcional e um byte SIB opcional. Segue-se um deslocamento de 0, 1, 2 ou 4 bytes, em seguida, um imediato de 0, 1, 2 ou 4 bytes. A instrução inteira é de 15 bytes, no máximo (SDM 2.3.11). AMD APM Volume 3, Capítulo 1, Secções 1.1 a 1.7 descrevem o mesmo formato em menos páginas e são uma boa verificação cruzada.

Cada campo decide o que significa o próximo campo. Um decodificador é, portanto, uma cadeia de pequenas decisões, e cada decisão tem uma frase no manual por trás dela.

### Os prefixos são divididos em quatro grupos

O MDS 2.1.1 lista os prefixos antigos.`F0`bloqueio e os prefixos de repetição `F2`E ...`F3`O grupo 2 detém as seis prioridades do segmento (`2E`É o que é`%cs`O Grupo 3 é o Grupo 3 e o Grupo 3 é o Grupo 3 e o Grupo 3 são os grupos que se encontram em diferentes regiões.`66`O grupo 4 é o grupo 4 que é o grupo 4 que é o grupo 4`67`, o tamanho do endereço.

O manual diz que um prefixo de cada grupo pode ser usado.`ledger-x86_64-O0.o`em compensação`0xf2`lê `66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00`, cinco cópias de `66`Em fila.`llvm-objdump`Imprime-o como `nopw %cs:(%rax,%rax)`O decodificador recolhe todos os bytes préfixados que vê e pergunta mais tarde quais são importantes.

`66`Para instruções SSE é um prefixo obrigatório que seleciona o código op, por isso `66 0f ef c0`É o que é`pxor %xmm0, %xmm0`E não um 16 bits nada.`F3 0f 6f`É o que é`movdqu`O decodificador primeiro procura o par de prefixo obrigatório e segundo byte opcode. Só quando esse par não tem entrada faz`66`É uma operação de 16 bits.

### REX adiciona quatro bits e deve estar ao lado do código op

O MDS 2.2.1 define o REX como um byte de `40`- Não .`4F`com a forma`0100WRXB`- Não .`W`seleciona um operando de 64 bits. `R`Extende o campo de reglamentação do ModRM. `X`amplia o campo do índice SIB. `B`Extenda o campo ModRM r/m, o campo base SIB ou o registo no byte do código op (tabela 2-4). O REX deve aparecer antes do código op ou dos bytes de fuga, e um REX seguido por um prefixo antigo é ignorado.

- Não .`48 89 e5`O byte `48`é REX com `W`O código op `89`É o que é`MOV r/m, r`, e ModRM `e5`selecções `%rsp`em`%rbp`Remover o REX e os mesmos bytes são`movl %esp, %ebp`- Não .

O REX também muda os nomes dos registros de byte.`%spl`- Não .`%bpl`- Não .`%sil`, e `%dil`Em vez de`%ah`- Não .`%ch`- Não .`%dh`, e `%bh`O decodificador guarda duas mesas por isso.

### Os códigos de opticação vivem em dois mapas

Um código op de um byte é o caso comum. `0F`Escapou para o mapa de dois bytes, e `0F 38`ou `0F 3A`Os dados de opcodes são utilizados em um campo de reg de ModRM como três bits de opcodes adicionais, escritos em`/digit`No manual.`83 /7`É o que é`cmp`com um instantâneo de 8 bits, `83 /5`É o que é`sub`, e `FF /4`é o indireto`jmp`- Não .

O decodificador em `code/main.py`O programa de cálculo da base de dados é o seguinte:`mov`- Não .`lea`- Não .`movslq`- Não .`movzbl`- Não .`imul`, os turnos,`test`, e `idiv`Continua com`push`- Não .`pop`- Não .`call`- Não .`ret`, os 16 saltos condicionais, o multi-byte `nop`, e cinco códigos opticos SSE2.`DecodeError`Um decodificador que adivinha é pior do que um que pára.

### ModRM e SIB selecionam os operandos

O MDS 2.1.3 divide o MDRM em `mod`(bits 7:6), `reg`(5:3), e `r/m`(2:0). `mod = 11`significa que r/m é um registo. `mod = 00`- Não .`01`, e `10`Memória média sem deslocamento, deslocamento de 8 bits ou deslocamento de 32 bits. `r/m = 100`significa que segue um byte SIB.`scale`(7:6), `index`(5:3), e `base`(2:0), e um índice de `100`significa que não existe registro de índices.

Duas linhas especiais no quadro 2-2 são de matéria em modo de 64 bits. `mod = 00`com`r/m = 101`Não é .`(%rbp)`. É um deslocamento de 32 bits em relação à instrução seguinte (SDM 2.2.1.6). `mod = 00`com uma base SIB de `101`é um deslocamento de 32 bits sem registo de base.

- Toma .`8d 44 08 fa`de`grade`- Não .`-O0`O código op.`8D`É o que é`lea`ModRM `44`É o que é`01 000 100`: um deslocamento de 8 bits, reg `%eax`, e um SIB segue.`08`É o que é`00 001 000`: escala 1, índice `%rcx`, base `%rax`O byte de deslocamento`fa`O texto da AT&T é `leal -0x6(%rax,%rcx), %eax`, que calcula .`score / 10 - 6`, o índice de interruptor.

### O deslocamento é onde o editor de links escreve

`48 8d 0d 00 00 00 00`É o que é`leaq (%rip), %rcx`Os quatro bytes zero são o campo de deslocamento de um operando relativo ao RIP. num objeto realojável são os detentores de lugar.`.rela.text`em compensação`0x69`Diz:`R_X86_64_PC32.rodata-0x4`. O psABI (tabela 4.9) define `R_X86_64_PC32`Como `S + A - P`: o endereço do símbolo mais o adendo menos o endereço do campo.

O processador adiciona o campo ao endereço da próxima instrução, então o alvo final é `S + A + (end - P)`Por isso .`lea`O campo é os últimos quatro bytes, então `end - P`É 4 e o alvo é `.rodata + (-4) + 4 =.rodata + 0x0`O adendo de -4 compensa esses quatro bytes com antecedência.`.rodata+0x10`No dia`-O1` `lea`- Meio`.rodata+0x14`- Não .

O decodificador registra o deslocamento do campo de deslocamento dentro de cada instrução. `resolve_reference()`O que se vê na tabela de realocação e os relatórios onde o operando aponta após a ligação.`leaq (%rip), %rcx`"na mesa em`.rodata+0x0`" .

### Os instantâneos são de 32 bits no máximo, com uma exceção

O SDM 2.2.1.5 diz que os instantâneos permanecem no máximo 32 bits no modo 64 bits e são extensos por sinal.`MOV r64, imm64`(`B8+r`com`REX.W`), que a sintaxe AT&T chama de `movabsq`O decodificador lê instantâneos de 8 bits como assinados para aritmética (`83 c1 fa`É o que é`addl $-0x6, %ecx`) e sem assinatura para os contagens de turnos e os selectores de mistura (`pshufd $0xee`O que é que se divide ?`llvm-objdump`- Impressões.

Próximo a ramos,`push`, e `pop`padrão para um operando de 64 bits e ignorar `66`(MDS 2.2.1.7) É por isso que o decodificador os designa `pushq`- Não .`popq`- Não .`callq`, e `retq`sem ler um prefixo de tamanho operand.

## Decodificar uma instrução à mão

Antes de confiar no código, decodifica.`48 69 c0 67 66 66 66`de`grade`- No papel.

1. `48`Está dentro .`40`- Não .`4F`, então é REX com `W = 1`O tamanho da opera é de 64 bits.
2. `69`É o que é`IMUL r, r/m, imm32`- Não .
3. `c0`é ModRM `11 000 000`: formulário de registo, reg `%rax`, r/m `%rax`- Não .
4. Os próximos quatro bytes são o imediato, pequeno-endian: `0x66666667`- Não .
5. Ordem AT&T é imediata, fonte, destino: `imulq $0x66666667, %rax, %rax`- Não .

São sete bytes, e `llvm-objdump`Imprime o mesmo texto. A constante é a recíproca que permite que clang divide por 10 com um multiplicador e o `sarq $0x22`O que segue, que muda por 34. Você vai encontrar esse par novamente na lição 34, onde o elevador torna-lo em`score / 10`- Não .

O decodificador faz estes cinco passos em `Decoder.decode()`- Não .`_State.modrm()`, e `_State.finish()`. Leia-os nessa ordem e combina cada ramo com a secção SDM nomeada na sua cadeia de documentos.

## Esvaziamento linear

Schwarz, Debray e Andrews descrevem a varredura linear na Seção 3.1 de "Descontro de Código Executivo Revisado" (WCRE 2002). Comece no primeiro byte da seção de código, decodifique uma instrução, continue no byte depois dela e pare no final. `objdump`funciona desta forma, e também funciona.`llvm-objdump`- Não .

```python
def linear_sweep(code: bytes, start: int = 0, end: int | None = None) -> SweepResult:
    position = start
    while position < end:
        try:
            instruction = decode(code[:end], position)
        except DecodeError:
            undecodable.append((position, code[position]))
            position += 1
            continue
        instructions.append(instruction)
        position = instruction.end
```

O método tem um modo de falha, e a figura 1 do papel mostra isso. Os bytes que são dados são decodificados como instruções, e o decodificador perde os limites reais de instruções por um tempo. No x86, o decodificador geralmente re-sincroniza-se dentro de alguns bytes, o que torna o erro difícil de ver. A detecção só acontece em um código opálico inválido, e a conclusão do artigo é que esses algoritmos "falham silenciosamente".

O varredor também é o oráculo para esta lição.`llvm-objdump -d`em todas as instruções de cada ficha, e`llvm-objdump`O texto capturado vive em`code/fixtures/*.objdump.txt`. O teste analisa cada linha em endereços, bytes e texto, deixa os comentários depois `#`Os quatro objetos contêm 86, 56, 84 e 11 instruções, 237 no total, e o decodificador corresponde a todos eles.

## Descenso recorrente

A secção 3.2 do mesmo documento chama o segundo método de atravessamento recorrente. Comece em um ponto de entrada conhecido e decode até uma transferência de controle. Para um salto direto, continue no alvo. Para um ramo condicional, continue no alvo e na próxima instrução, e para uma chamada, continue depois dele, porque o callue retorna. Para um retorno, pare. Mantenha um conjunto de endereços visitados para que a caminhada termine.

```python
if instruction.flow == "branch":
    worklist.append(instruction.target)
    address = instruction.end
elif instruction.flow == "indirect-jump":
    table = resolver(instruction, instructions) if resolver else None
    if table is None:
        unresolved.append(instruction)
        break
```

O modo de falha é o oposto. Um salto indireto não tem alvo em seus bytes. O passeio termina lá, e cada bloco alcançável apenas através do salto permanece desconhecido.`main.py`registra esse caso como um conflito e interrompe esse caminho, para que a sobreposição seja visível em vez de silenciosamente decodificada duas vezes.

Andriesse e outros mediram nove desmontagens em 981 binários gerados pelo compilador (USENIX Security 2016). Dados inline e código sobrepostos eram mais raros na saída real do compilador do que a literatura supunha, e o primitivo duro foi a recuperação de limites de função.`grade`É comum.

## Um armazém onde a varredura é errada e a descida é certa

`code/fixtures/sweep-trap.s`é 24 bytes de conjunto escrito à mão com uma tabela de quatro bytes dentro do corpo da função.`movzbl (%rcx,%rax), %eax`e salta sobre ela.

```asm
lookup:
        movslq  %edi, %rax
        leaq    .Ltable(%rip), %rcx
        movzbl  (%rcx,%rax), %eax
        jmp     .Ldone
.Ltable:
        .byte   0x31, 0xc0, 0x90, 0x48
.Ldone:
        addl    $1, %eax
        retq
```

Construí-lo com `clang -target x86_64-unknown-linux-gnu -c sweep-trap.s`Os quatro bytes da tabela foram escolhidos para que eles decodificem como instruções plausíveis.`31 c0`É o que é`xorl %eax, %eax`- Não .`90`É o que é`nop`- Não .`48`é um prefixo REX, então o varredura junta-o com os três bytes do real `addl $1, %eax`e impressões digitais `addq $0x1, %rax`Os capturados .`llvm-objdump`A saída mostra exatamente que:

```text
       e: eb 04                        	jmp	0x14 <lookup+0x14>
      10: 31 c0                        	xorl	%eax, %eax
      12: 90                           	nop
      13: 48 83 c0 01                  	addq	$0x1, %rax
      17: c3                           	retq
```

Nada nesta lista parece quebrado.`retq`A listagem ainda está errada em três aspectos.`0xe`Objetivos`0x14`, e nenhuma instrução na lista começa em `0x14`A instrução que funciona em`0x14`é um 32-bit `addl`, e a lista mostra um 64 bits `addq`Os quatro bytes da tabela aparecem como código.

Descenso recorrente do `lookup`O símbolo decodifica seis instruções, segue o salto para `0x14`, e relatórios `addl $0x1, %eax`Não reivindica nenhum dos quatro bytes da mesa e nenhum dos oito bytes de enchimento antes .`plus_one`- Não .`trap_report()`em `main.py`Imprime a comparação:

```json
"linearSweep": {
  "instructions": 9,
  "atJumpTarget": {"starts": "0x13", "text": "addq\t$0x1, %rax", "startsAtTarget": false},
  "claimedDataBytes": 4,
  "claimedPaddingBytes": 8
},
"recursiveDescent": {
  "instructions": 6,
  "atJumpTarget": "addl\t$0x1, %eax",
  "claimedDataBytes": 0,
  "claimedPaddingBytes": 0
}
```

O teste .`test_sweep_and_objdump_share_the_same_mistake`afirma que `llvm-objdump`Imprimir`addq $0x1, %rax`- Não .`0x13`O oráculo é um varredor linear e herda o seu ponto cego.

## Blocos básicos

Allen definiu o bloco básico em "Análise de Fluxo de Controle" (1970). É uma sequência de instruções que é inserida apenas em sua primeira instrução e deixada apenas em sua última. Yakdan e outros o reformula para decompilhação na Seção II.A.2 de "No More Gotos" (NDSS 2015), com o nó de cabeçalho como a entrada de função.

A construção é uma varredura de duas passagens sobre as instruções decodificadas, ordenadas por endereço. A primeira passagem coleta líderes. Um líder é a entrada, um ramo ou alvo de salto, um alvo de mesa ou a instrução após qualquer transferência de controle. A segunda passagem inicia um novo bloco em cada líder e em cada vazio na sequência de endereços.

```python
for instruction in self.instructions:
    if instruction.address in leaders or current is None or current.end != instruction.address:
        current = Block(instruction.address, [])
        self.blocks[instruction.address] = current
    current.instructions.append(instruction)
```

As bordas seguem a partir da última instrução de cada bloco. Um retorno não tem sucessor. Um salto tem um, etiquetado `jump`Um ramo condicional tem dois, etiquetado.`taken`E ...`fallthrough`Uma instrução simples no final de um bloco passa para o bloco seguinte, o que acontece quando a instrução seguinte é um alvo de ramo.`table`, ou nenhum, e o bloco é gravado em `unresolved`- Não .

Dois fatos mais saem do mesmo scan. Um bloco que a entrada não pode alcançar é inacessível, e o varredura sobre.`grade`- Não .`-O0`Um bloco cujo endereço de partida cai dentro de uma instrução da listagem de outro método é o caso de sobreposição da armadilha.

## O gráfico de fluxo de controlo do total

`total`- Não .`-O1`é 31 bytes e 13 instruções:

```text
      40: 85 f6                        	testl	%esi, %esi
      42: 7e 18                        	jle	0x5c <total+0x1c>
      44: 89 f1                        	movl	%esi, %ecx
      46: 31 d2                        	xorl	%edx, %edx
      48: 31 c0                        	xorl	%eax, %eax
      4a: 66 0f 1f 44 00 00            	nopw	(%rax,%rax)
      50: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
      53: 48 ff c2                     	incq	%rdx
      56: 48 39 d1                     	cmpq	%rdx, %rcx
      59: 75 f5                        	jne	0x50 <total+0x10>
      5b: c3                           	retq
      5c: 31 c0                        	xorl	%eax, %eax
      5e: c3                           	retq
```

Os líderes são`0x40`(entrada), `0x44`(após o `jle`), `0x50`(Objetivo do `jne`), `0x5b`(após o `jne`), e `0x5c`(Objetivo do `jle`Cinco blocos, cinco bordas:

| From | To | Kind | Why |
|---|---|---|---|
| `0x40` | `0x44` | fallthrough | `jle` not taken, count is positive |
| `0x40` | `0x5c` | taken | count is zero or negative, return 0 |
| `0x44` | `0x50` | fallthrough | the `nopw` is alignment inside the block, execution passes through it |
| `0x50` | `0x50` | taken | `jne 0x50`, the loop |
| `0x50` | `0x5b` | fallthrough | loop exit, return the sum |

O 6 bytes `nopw`- Não .`0x4a`é um enchimento para que o ciclo se encaixa em`0x50`Está num limite de 16 bytes. É acessível, por isso pertence ao bloco`0x44`O 1 byte .`nop`- Não .`0x5f`Depois da última .`retq`O varredão sobre a função faz um sexto bloco para ele, e`unreachable()`- E o lista.

- Não .`-O2`A mesma função é de 140 bytes com dois circuitos.`0x80`Adiciona oito valores por passagem com `paddd`, e o restante escalar corre em`0xc0`O CFG tem duas bordas traseiras.`0x80 -> 0x80`E ...`0xc0 -> 0xc0`, e a sala de testes verifica ambas.

## Dominatores com o algoritmo iterativo

Um bloco .`d`Domina um bloco .`b`Quando cada caminho da entrada para o`b`passa por lá .`d`O dominador imediato de`b`é o dominador de `b`É o mais próximo de `b`A noção remonta a Prosser (1959) e Allen (1970), e é a estrutura que a lição 34 precisa colocar.`if`E ...`while`- Não, não.

Cooper, Harvey e Kennedy escreveram "Um Algorithm de Dominação Simples e Rápidos" (2001). Eles argumentam que a formulação de fluxo de dados, executada em pós-ordem inversa com uma representação compacta, vence Lengauer-Tarjan (1979) em gráficos sob cerca de mil nós. O artigo deles diz que o seu propósito é "não apresentar um novo algoritmo". Mostra que os algoritmos simples podem ganhar na prática e são boas ferramentas de ensino. Uma função CFG quase nunca tem mil nós.

```python
def intersect(first: int, second: int) -> int:
    while first != second:
        while number[first] > number[second]:
            first = idom[first]
        while number[second] > number[first]:
            second = idom[second]
    return first

changed = True
while changed:
    changed = False
    for start in order[1:]:
        processed = [p for p in self.predecessors(start) if p in idom]
        candidate = processed[0]
        for other in processed[1:]:
            candidate = intersect(other, candidate)
        if idom.get(start) != candidate:
            idom[start] = candidate
            changed = True
```

`number`Detém a posição de pós-ordem inversa de cada bloco, com a entrada em 0. `intersect`O papel escreve a comparação com números de pós-ordem e `<`Este código usa números de pós-ordem inverso, por isso a comparação é `>`Tudo o resto segue o pseudônimo do jornal.

Para o`total`- Não .`-O1`O resultado é `idom(0x44) = 0x40`- Não .`idom(0x50) = 0x44`- Não .`idom(0x5b) = 0x50`, e `idom(0x5c) = 0x40`- A borda .`0x50 -> 0x50`é uma borda traseira porque o seu alvo domina a sua fonte, e uma borda traseira marca um ciclo (Allen 1970). `back_edges()`O teste.`test_dominators_on_a_hand_built_diamond_with_a_loop`executa o mesmo código em uma sequência de 16 bytes com um ponto de junção, então `intersect`vê dois predecessores.

## A Tabela de Salto em grau -O0

- Não .`-O0`Clang compila o `switch`em `grade`para o termo "jump table" independente da posição:

```text
      5d: 83 e8 04                     	subl	$0x4, %eax
      60: 77 38                        	ja	0x9a <grade+0x6a>
      62: 48 8b 45 f0                  	movq	-0x10(%rbp), %rax
      66: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000069:  R_X86_64_PC32	.rodata-0x4
      6d: 48 63 04 81                  	movslq	(%rcx,%rax,4), %rax
      71: 48 01 c8                     	addq	%rcx, %rax
      74: ff e0                        	jmpq	*%rax
```

Leia-o como quatro fatos.`subl $0x4`seguida por `ja`é uma verificação de limites: índices acima de 4 vão para o caso padrão em `0x9a`A tabela tem cinco entradas.`leaq`com a sua realocação coloca a tabela de endereço em `%rcx`, e a secção anterior mostrou que o endereço é `.rodata+0x0`- O .`movslq`carrega uma entrada assinada de 32 bits escalada por 4. O `addq`Adiciona a base da tabela, de modo que cada entrada é a distância da tabela ao seu bloco de caixa.

No arquivo objeto cada byte da tabela é zero.`.rela.rodata`- Não .

```text
RELOCATION RECORDS FOR [.rodata]:
OFFSET           TYPE                     VALUE
0000000000000000 R_X86_64_PC32            .text+0x91
0000000000000004 R_X86_64_PC32            .text+0x8c
0000000000000008 R_X86_64_PC32            .text+0x87
000000000000000c R_X86_64_PC32            .text+0x82
0000000000000010 R_X86_64_PC32            .text+0x86
```

Aplicar`S + A - P`Para entrada `k`em compensação`4k`O valor armazenado é `.text + A - (.rodata + 4k)`, e o código adiciona `.rodata + 0`O alvo é o`.text + A - 4k`A entrada 0 é `0x91 - 0 = 0x91`, entrada 1 é `0x8c - 4 = 0x88`, e a entrada 2 é `0x87 - 8 = 0x7f`As entradas 3 e 4 são:`0x82 - 12 = 0x76`E ...`0x86 - 16 = 0x76`- Casos 6, 7, 8, 9 e 10 do`score / 10`Vai para os blocos que armazenam 1, 2, 3, 4 e 4. Isso corresponde à linha de origem C para linha, incluindo a caixa compartilhada para 9 e 10.

`recover_table()`Faz esta aritmética.`jump_table_resolver()`coincide com o idioma para trás do `jmpq`- Encontrou o .`addq`que fez o registo, o `movslq`que o carregou, o `leaq`que fez a base, e o limite `ja`. A descida em seguida empurra os quatro objetivos distintos e continua. Um executável vinculado tem valores finais na tabela e não há realocações. A mesma função lê as entradas assinadas de 32 bits e adiciona o endereço da tabela, e `evidence`registos de que caminho foram produzidos os alvos.

Os números para `grade`- Não .`-O0`, de`python3 code/main.py cfg code/fixtures/ledger-x86_64-O0.o grade`- Não .

| Method | Instructions | Blocks | Edges | Bytes | What is wrong |
|---|---|---|---|---|---|
| linear sweep | 34 | 9 | 7 | 118 code + 10 padding | 5 unreachable blocks, no edge into the four case blocks, padding decoded as `nopw` |
| recursive descent | 25 | 3 | 2 | 82 code | 36 code bytes never reached, `jmpq *%rax` at `0x74` unresolved |
| descent with the table | 33 | 8 | 11 | 118 code | nothing |

Com a mesa, a árvore dominadora está completa.`idom`de cada bloco de caso é `0x62`, o bloco com o salto.`idom`de`0xa1`É a entrada `0x30`, porque o caminho padrão de `0x9a`alcança`0xa1`Sem passar .`0x62`- Não .

## O que o Optimizador fez para classificar em -O1

Vais ver .`grade`O que é que é um interruptor que se compõe para uma tabela de salto.`-O1`E ...`-O2`Não há salto indireto .`grade`Não:

```text
      2c: 83 f9 04                     	cmpl	$0x4, %ecx
      2f: 77 0c                        	ja	0x3d <grade+0x2d>
      31: 89 c8                        	movl	%ecx, %eax
      33: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000036:  R_X86_64_PC32	.rodata+0x10
      3a: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      3d: c3                           	retq
```

O adicionamento de realocação`0x10`Mais o habitual 4 coloca a mesa em `.rodata+0x14`A carga é simples .`movl`, e os bytes que há .`01 00 00 00 02 00 00 00 03 00 00 00 04 00 00 00 04 00 00 00`O compilador substituiu os cinco blocos de caixa com uma tabela dos cinco valores de retorno. Há uma realocação, uma tabela e um controle de limites. O fluxo de controle é de três blocos e três bordas com um ramo condicional. `find_value_tables()`Relata-o como um `value-table`com inscrições `[1, 2, 3, 4, 4]`E ...`evidence: "bytes"`- Não .

`grade_label`- Não .`-O2`O Conselho Europeu de Ministros da Agricultura e do Meio Ambiente`labels`array de cinco puntuais de cadeia tornou-se uma tabela de cinco 32 bits de compensação em `.rodata+0x0`Cada entrada contém um`R_X86_64_PC32`A função adiciona o endereço da tabela à entrada que carrega. `recover_table()`lê essas cinco transferências e retornos de compensação `0, 2, 4, 6, 8`em`.rodata.str1.1`, que se mantêm .`F`- Não .`D`- Não .`C`- Não .`B`, e `A`A mesma aritmética que recupera uma tabela de salto recupera uma tabela de dados relativos, porque ambas são `S + A - P`Em um desvio conhecido.

A lição das duas construções é nomear o que os bytes mostram. Uma tabela de salto muda o gráfico de fluxo de controle. Uma tabela de valores muda uma carga. Chamando ambos "o interruptor" oculta a diferença que a lição 34 tem que reconstruir.

## O que a Rea e a Ghidra te dão aqui

rea 6.5.0 com o provedor Ghidra 12.1.4 retorna o texto de listagem de uma função de `procedure_assembly`Como uma única corda.`inspect_native_instruction`Retorna os bytes, comprimento, texto de decodificação, tokens de operação, referências digitalizadas e fluxo de uma instrução, com o retorno classificado a partir de p-code. `xrefs`Retorna os endereços de fonte únicos classificados de Ghidra `ReferenceManager.getReferencesTo`- Não .`analyze_function`Carrega o CFG e `body`da função. `procedure_info`dá ao organismo como intervalos inclusivos e adverte que "Gaps e caudas compartilhadas não devem ser tratadas como bytes de propriedade".

Cada um desses fatos é a descendência recursiva de Ghidra mais os seus analisadores, serializados.`instruction_flow_evidence`- Não .`function_references`, e `jump_table_evidence`O resultado, portanto, nomeia as regras que o produziram. O que ele não pode fazer é mostrar o seu trabalho. Quando Ghidra não encontra a tabela, o fluxo é "desconhecido", e os blocos de caso faltam aos chamadores, chamados e CFG.

Agora tens o trabalho.`python3 code/main.py cfg`Quando você está de acordo com o que o provedor retorna, você tem duas derivadas independentes. quando eles diferem, você tem um endereço específico para olhar, que é o que a lição 35 registra como um desconhecido.

Uma nota sobre o decodificador como um programa. Capstone 6.0.0-Alpha10 (2026-07-21) fixa fora dos limites lê e escreve sob CVE-2026-55893 e CVE-2026-55894, e 5.0.9 (2026-05-28) backported CVE fixes. Um decodificador lê bytes que não escreveu. O limite de 15 bytes, o controle de truncation em `_Cursor.byte()`, e a recusa em adivinhar um código op desconhecido proteger .`main.py`de entrada para a qual não foi construída.

## Construí-lo

Executa a demonstração:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
npx tsx code/main.ts
```

A saída é um relatório JSON. Para cada objeto fixo ele dá o acordo de oráculo. Para cada função ele dá instrução, bloco e contagem de borda sob os três métodos. Também lista blocos inacessíveis, saltos indiretos não resolvidos, bordas traseiras, dominadores imediatos e quaisquer tabelas. Ele termina com a comparação de armadilha.

Forma esperada:

```json
{
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "oracle": "86/86 instructions agree with llvm-objdump",
      "functions": {
        "grade": {
          "range": "0x30-0xa6",
          "paddingBytes": 10,
          "linearSweep": {"instructions": 34, "blocks": 9, "edges": 7, "unreachableBlocks": ["0x76", "0x7f", "0x88", "0x91", "0xa6"], "...": "..."},
          "recursiveDescent": {"instructions": 25, "blocks": 3, "edges": 2, "unresolvedIndirectJumps": ["0x74"], "...": "..."},
          "recursiveDescentWithTables": {"instructions": 33, "blocks": 8, "edges": 11, "...": "..."},
          "tables": [{"kind": "jump-table", "table": ".rodata+0x0", "count": 5, "entries": ["0x91", "0x88", "0x7f", "0x76", "0x76"], "evidence": "relocation", "...": "..."}]
        }
      }
    }
  },
  "sweepTrap": {"...": "..."}
}
```

Leia `code/main.py`na ordem seguinte:

1. `ElfObject`lê títulos de secções, símbolos e `.rela.*`- a entrada, e`symbolize()`Nomear um endereço para o caminho.`llvm-objdump`- Não, não.
2. `Decoder.decode()`Leia prefixos e REX, em seguida, envia no mapa de código optico de um ou dois bytes.
3. `_State.modrm()`Leia ModRM, SIB e o deslocamento e registra o deslocamento de campo.
4. `resolve_reference()`aplica-se `S + A - P`para a realocação num local de deslocamento ou em um campo imediato.
5. `linear_sweep()`E ...`recursive_descent()`são os dois métodos, cada um com a sua falha registada.
6. `recover_table()`E ...`jump_table_resolver()`ler uma tabela através das suas transferências ou bytes.
7. `ControlFlowGraph`Construi líderes, blocos e bordas de tipografia, e `dominators()`é o algoritmo iterativo.
8. `analyze_function()`executa todos os métodos em uma função e `compare_with_oracle()`Verifica o decodificador.

Existem mais dois comandos.`python3 code/main.py disasm FILE.o`Imprime uma lista com o alvo de realocação após cada instrução que o tenha. `python3 code/main.py cfg FILE.o FUNCTION`Imprime a análise de uma função.

## Usá-lo

Use os três métodos nesta ordem em um novo objeto.

1. Primeiro, faça a comparação do oráculo.`llvm-objdump`uma instrução simples tem um bug, e cada estrutura posterior herda-o.
2. Execute a descida recursiva de cada símbolo da função e leia `unresolved`Cada entrada é um salto ou chamada indireta cujos alvos não têm.
3. Para cada salto não resolvido, procure o idioma da mesa e a mudança que aponta para ele. Se o idioma não coincide, leia os bytes antes do salto e anote o que vê. Essa nota é a primeira desconhecida na lição 35.
4. Compare o barramento e o descida byte por byte. Bytes que apenas os barramento reivindica são padding ou dados. Bytes que nem reivindica são inacessíveis ou pertencem a uma função que você não encontrou.
5. Construir o CFG a partir da descida com tabelas recuperadas e ler as bordas traseiras. Cada um é um ciclo que a lição 34 vai se transformar em `while`ou `for`- Não .

Mantenha os arquivos de texto do oráculo com os objetos. Quando você se mover para uma nova versão de compilador, recapturá-los, porque uma listagem alterada é um ajuste alterado.

## Laboratório Interativo

### Lab A: decodificar em papel, depois verificar

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow/code
python3 -q
```

- Correr .

```python
from main import *
decode(bytes.fromhex("48 8d 0d 00 00 00 00"), 0).text
decode(bytes.fromhex("8d 44 08 fa"), 0).text
decode(bytes.fromhex("66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00"), 0).length
```

Escreva o que espera antes de cada chamada.`48`A partir do primeiro e ver o tamanho da opera.`decode(bytes.fromhex("0f 0a"), 0)`e ler o `DecodeError`- Não .

### Laboratório B: a realocação em um leão

```python
elf = load_fixture("ledger-x86_64-O0.o")
code = elf.section(".text").data
lea = decode(code, 0x66)
lea.displacement_offset
resolve_reference(elf, lea)
```

A referência diz:`.rodata+0x0`- Mudança de endereço para `0x116`em `grade_label`e ler a referência em `.data`Então decodifica o `callq`- Não .`0x10e`O campo imediato transporta`R_X86_64_PLT32 grade-0x4`, e o alvo resolvido é `0x30`, que é `grade`- Não .

### Laboratório C: observe os dois métodos discordarem

```python
trap = load_fixture("sweep-trap.o")
text = trap.section(".text").data
[i.text for i in linear_sweep(text, 0, 0x20).instructions]
[i.text for i in recursive_descent(text, [0], 0x20).sorted_instructions()]
```

Conte as instruções em cada lista e encontre a que começa com `0x13`Então , mude o último byte da tabela em `sweep-trap.s`de`0x48`- Não .`0xe8`O baralho agora engole o`addl`e o `retq`em um `callq`A função parece não ter retorno.

### Laboratório D: dominadores à mão

```python
analysis = analyze_function(load_fixture("ledger-x86_64-O1.o"), "total")
analysis.cfg.edges
analysis.cfg.reverse_postorder()
analysis.cfg.dominators()
analysis.cfg.back_edges()
```

Desenhe os cinco blocos em papel e calcule os dominadores antes de olhar para o resultado.`grade`- Não .`-O0`e explicar porquê.`idom(0xa1)`É o que é`0x30`E não .`0x62`- Não .

## Laboratório de Prática

Adicionar um local de chamada indireta às instalações e ampliar a análise.

Requisitos:

- Escreva uma função C que chama através de um punteiro de função escolhido de uma pequena matriz.`-O0`E ...`-O1`e comprometem os objetos com os seus`llvm-objdump`- Não.
- Faça com que o decodificador concorde com o oráculo em ambos os objetos. Adicione opcodes apenas quando uma instrução no dispositivo precisa deles.
- Extensão`recursive_descent()`Então uma chamada indireta registra o local da chamada em `calls`com`None`como alvo e continua atrás dele.
- Escreva um resolvedor que leia a matriz de puntuação de função através de suas mudanças e relata os possíveis calles.
- Adicionar o conjunto de chamadas ao relatório de função como `indirectCalls`com o tipo de evidência para cada alvo.
- Escreva um teste que falha quando o resolvedor retorna um alvo que não é um símbolo de função.

O sucesso significa`python3 code/main.py cfg`Nomeia todas as possíveis chamadas com a mudança que prova isso, e a comparação do oráculo ainda passa por todos os objetos.

## Laboratório de graduação

Cinco perguntas sobre os dispositivos desta lição.`code/lab_answers.json`Escrever números como números ou como cadeias hexáceas como `"0x40"`, e listas como listas JSON.

1. `t1`: instruções que decodificam a descida recorrente em grau -O1.
2. `t2`: blocos básicos no total em -O1.
3. `t3`: endereço do cabeçalho do loop no total em -O1, como hex.
4. `t4`: em sweep-trap.o, o endereço onde começa a instrução linear de varredura que abrange 0x14, como hex.
5. `t5`: entradas na tabela de salto de grau em -O0.

Verifique as suas respostas:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/lab.py
npx tsx code/lab.ts
```

O verificador calcula cada valor esperado a partir de `code/main.py`- O que é que é?`PASS`- Não .`FAIL`ou `TODO`Para cada tarefa e uma pontuação, e sai de 0 apenas quando os cinco passarem. `python3 code/lab.py my-answers.json`Verifica outro ficheiro.`code/tests/test_lab.py`prova que o verificador aceita as respostas certas e rejeita as erradas.

### Veja como corre.

O [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?program=trap&sweep=linear)A máquina executa esta lição como seu decodificador de blocos e blocos.`sweep-trap.o`com varredura linear: a cama mostra os quatro bytes de dados decodificados como código, e um pin marca o alvo de salto em `0x14`dentro do`addq`- Não .`0x13`- Desliga o decodificador para descida recorrente para ver o salto saltar os dados.

## Lição Artifacto

Esta lição inclui `outputs/skill-disassembly-and-control-flow.md`. Utilize-o para transformar um objeto e um nome de função em uma listagem verificada, blocos, bordas digitalizadas, dominadores e todas as transferências não resolvidas. Requer uma comparação oracular, ambos os métodos de desmontagem, contabilidade de byte, evidências de realocação para cada tabela recuperada e uma declaração do que permaneceu desconhecido.

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
npx tsx code/main.ts
python3 code/tests/test_main.py
```

A verificação deve provar:

- O decodificador concorda com `llvm-objdump -d`sobre todas as 237 instruções dos quatro objetos fixos
- REX.W seleciona operandos de 64 bits e REX.R e REX.B ampliam os campos do registo
- ModRM e SIB renderizam a operação de memória AT&T, incluindo escala, índice e deslocamento assinado
- Uma deslocação relativa ao RIP é registada com o seu campo compensado dentro da instrução
- repetidos prefixos legacy e um segmento decodificar como o oráculo
- um obrigatório`66`O prefixo seleciona o código optico SSE e deixa os registros de 32 bits
- Os imediatos de 8 bits são extendidos por sinal para aritmética e não assinados para contagem de turnos
- uma instrução superior a 15 bytes, uma instrução truncada e um aumento desconhecido de código op `DecodeError`
- `R_X86_64_PC32`em um `lea`Resoluções para a mesa e `R_X86_64_PLT32`em um `call`resolve para a callee
- O baralho decodifica a tabela de armadilhas como código e não tem instruções no alvo de salto
- A descida nunca reivindica a mesa ou o engarrafamento e lê `addl $0x1, %eax`no alvo
- `llvm-objdump`comete o mesmo erro que o varrer na armadilha
- Uma entrada dentro de uma instrução é registrada como um conflito.
- Um salto indirecto não resolvido impede a descida e é listado
- `total`- Não .`-O1`tem cinco blocos, cinco bordas tipografadas, uma lateral, e os dominadores imediatos esperados
- Um diamante feito à mão com um loop dá aos dominadores o algoritmo define
- `total`- Não .`-O2`tem dois circuitos
- `grade`- Não .`-O0`dá uma mesa de salto de cinco entradas de `.rela.rodata`com objectivos `0x91, 0x88, 0x7f, 0x76, 0x76`
- Sem a mesa .`grade`- Não .`-O0`Tem três blocos e um salto não resolvido
- `grade`- Não .`-O1`E ...`-O2`é uma tabela de valores `[1, 2, 3, 4, 4]`sem salto indirecto
- `grade_label`- Não .`-O2`lê uma tabela de cordas relativa através de cinco realocações
- A figura interativa incorpora os mesmos dados que a análise produz

## Modos de falha de produção

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Data inside `.text` | A plausible listing with every byte decoded | The descent claims no data byte and the jump target starts an instruction |
| Padding after the last return | A `nopw` instruction at the end of the function | The bytes are unreachable from the entry |
| Indirect jump through a table | "jmp rax" and four dead blocks | Table address from the `lea` relocation, entry count from the bounds check, targets from `.rela.rodata` |
| Switch turned into a value table | "a jump table with a relocation" | A `movl` load from `.rodata+0x14`, three blocks, no indirect transfer |
| Call with a zero displacement | `callq 0x113`, the next instruction | `R_X86_64_PLT32 grade-0x4` resolves to `0x30` |
| Decoder guesses an unknown opcode | A mnemonic that looks right | `DecodeError` with the address, and the sweep records the byte |
| Instruction longer than 15 bytes | A very long "instruction" | The cursor raises before reading byte 16 |
| Branch into the middle of an instruction | Two overlapping listings | A conflict record with both addresses |
| Loop reported as straight-line code | No `while` in the pseudocode | A back edge whose target dominates its source |
| Oracle captured from a different compiler | Tests pass on stale text | The fixture README names the exact compiler and command |

## Regra de funcionamento

Decodificar contra um oráculo, controlar o fluxo de entrada de entrada conhecida e explicar cada byte como reivindicado, enchimento, dados ou inacessível. Recuperar cada alvo indireto de uma realocação ou uma tabela que você pode apontar. Registrar o resto como desconhecido, com o endereço.

## Mais leitura

- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, Chapter 2: Instruction Format](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [AMD64 Architecture Programmer's Manual Volume 3, Chapter 1: Instruction Encoding](https://docs.amd.com/v/u/en-US/24594_3.38_APM_Vol3_PUB)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Table 4.9: Relocation Types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Schwarz, Debray, Andrews, "Disassembly of Executable Code Revisited" (WCRE 2002)](https://www2.cs.arizona.edu/~debray/Publications/disasm.pdf)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Allen, "Control Flow Analysis" (1970)](https://doi.org/10.1145/800028.808479)
- [Cooper, Harvey, Kennedy, "A Simple, Fast Dominance Algorithm" (2001)](https://www.cs.tufts.edu/~nr/cs257/archive/keith-cooper/dom14.pdf)
- [Lengauer, Tarjan, "A fast algorithm for finding dominators in a flowgraph" (1979)](https://doi.org/10.1145/357062.357071)
- [Capstone 6.0.0-Alpha10 release notes](https://github.com/capstone-engine/capstone/releases/tag/6.0.0-Alpha10)
- rea 6.5.0 fonte em tag `3b79af2`que esta lição descreve: `README.md`- Não .`docs/ghidra-provider.md`- Não .`docs/ghidra-dos.md`- Não .`docs/reverse-engineering-tools.md`- Não .`bridge/ghidra/ReaGhidraBridge.java`- Não .`src/contracts/officialToolContracts.ts`- Não .`src/ghidra/GhidraAnalysisProfile.ts`- Não .
