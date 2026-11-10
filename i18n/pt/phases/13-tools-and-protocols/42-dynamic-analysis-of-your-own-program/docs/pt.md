# Análise Dinâmica do Seu Proprio Programa: Desembaraçadores, Traços e Confirmação de Reclamações Estáticas

> Uma observação sobre uma série de construções é um ponto de ruptura. Esta lição constrói o arsenal que transforma essas observações em veredictos confirmados, refutados e não observados sobre as alegações das lições estáticas feitas.

**Type:** Build
**Languages:** Python, TypeScript, C, arm64 assembly, lldb command language
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~130 minutes

## Objetivos de aprendizagem

- Explique o que um depurador precisa do sistema operacional no Linux (`ptrace`O sistema operacional MacOS (Mach task ports e exceptions ports) e por que uma caixa de areia não pode lançar um debugee.
- Defina os pontos de interrupção do software por nome e por endereço, define um ponto de vigilância de hardware e leia os limites que o processador impõe a ambos.
- Drive lldb em modo batch a partir do Python com um gancho stop que registra registros, memória e quadros variáveis em cada parada, e paralisar a transcrição de volta em uma linha do tempo.
- Verifique as reivindicações estáticas das lições 32, 33, 34 e 41 contra essa linha de tempo: registros de argumentos, offsets de campo estrutural, que bordas um ramo condicional levou, e quais chamadas ocorreram.
- E executar o mesmo plano contra um`-O2`Construir, ler pontos de ruptura que resolvam e nunca atingem, e dizer o que faz e não prova.
- Salva e carregue um arquivo do núcleo, e nome o que um núcleo de estilo pila deixa fora.
- Mapear os conjuntos de comando gdb e lldb, e colocar `strace`- Não .`ltrace`- Não .`bpftrace`- Não .`dtrace`, e `rr`sobre o sistema operacional adequado, com as suas versões e licenças.
- Explique os fatos de assinatura de código do macOS que permitem que o lldb desface um binário que você construiu, e as duas condições sob as quais ele se recusa.

## O problema

Lição 41 .`struct account`da DWARF e disse `balance`O que é que se passa com o fluxo de controle?`classify`E disse que o primeiro ramo vai para o`return -1`A lição 32 diz que os dois primeiros argumentos chegam a`x0`E ...`x1`Todas essas frases foram derivadas de bytes.

Um agente lê o mesmo programa e relata "principais chamadas".`bump`- Não .`classify`, e `sum_balances`A tabela de símbolos lista os três, para que a frase pareça segura.`-O2`O processo imprime suas quatro linhas e saídas.`hit count = 0`- Não .

O agente não estava errado sobre a fonte, estava errado sobre a construção sobre a qual foi perguntado.`sum_balances(rows, 3)`A única maneira de saber que para este binário nesta máquina é executá-lo sob um depurador e olhar.

Esta lição constrói um arame que faz a procura.`account.c`O sistema de classificação de dados é um sistema de classificação de dados que permite a análise de dados, a análise de dados e a avaliação de dados.`confirmed`significa uma parada que mostra a veracidade da alegação para esta corrida. `refuted`significa que uma parada mostrou ser falsa.`not-observed`A lição 35 armazena cada veredicto como um`observed`registro com autoridade `controlled-replay`- Não .

```figure
re-42-run-timeline
```

## Um depurador é três serviços de sistema e uma tabela

Um depurador faz quatro coisas a um processo do qual não possui o código. Ele interrompe o processo, lê e escreve seus registros, lê e escreve sua memória e recebe informações sobre quando o processo se interrompe novamente. O kernel fornece cada um destes como um serviço, e os serviços diferem por sistema operacional.

No Linux o serviço é `ptrace(2)`A página do manual diz que "fornece um meio pelo qual um processo (o rastreador) pode observar e controlar a execução de outro processo". `PTRACE_TRACEME`Deixa uma criança anunciar que o pai vai rastreá-la.`PTRACE_ATTACH`O processo não está relacionado.`PTRACE_PEEKDATA`"Uma palavra no endereço do endereço na memória do rastreador",`PTRACE_GETREGS`lê os registos e `PTRACE_SINGLESTEP`Os limites do módulo Yama estão anexados: `/proc/sys/kernel/yama/ptrace_scope`Em caso de inadimplência, 1 significa que "o processo-alvo deve ser descendente do chamador", 2 significa que só um administrador pode anexar e 3 significa que ninguém pode.

Em macOS `ptrace`É uma interface menor.`PT_TRACE_ME`- Não .`PT_ATTACHEXC`- Não .`PT_STEP`- Não .`PT_CONTINUE`, e `PT_KILL`, e diz isso com `PT_ATTACHEXC`"Os sinais da criança vão para o pai como exceções Mach".`ptrace`Não, não.`debugserver`chamadas`task_for_pid()`para obter um porto de tarefa Mach para o processo, então `task_set_exception_ports()`Para que os pontos de ruptura cheguem como mensagens de exceção.`taskgated`Decide quem pode ligar .`task_for_pid`- Não .

O custo desse projeto pode ser visto em uma transcrição que esta lição mantém. A concha da sessão corre sob uma caixa de areia da cintura de segurança. O mesmo plano que produz onze paradas fora da caixa de areia produz isto dentro dela:

```text
(lldb) run
error: process exited with status -1 (attach failed ((os/kern) invalid address))
```

O processo foi criado e não pôde ser adotado. O erro é sobre os direitos do depurador, e não diz nada sobre o programa.

O depurador lembra-se de que byte de instrução substituído em que endereço, para que possa colocar o original de volta quando você continuar, e conta hits por localização. `breakpoint list`Imprime essa mesa e o arame lê-a no final de cada corrida.

## Pontos de ruptura: Um byte ou uma palavra substituída

Um ponto de ruptura de software é uma instrução que o processador pega, escrita sobre os primeiros bytes da instrução que você quer parar.`INT3`, código op `CC`, um byte de comprimento, que o manual da Intel descreve como "intendido para chamar o manipulador de exceção de defeito".`BRK #imm16`, uma instrução de quatro bytes cuja exceção "registra a exceção em ESR_ELx, usando o valor CE 0x3C".`BRK`A instrução em si, por isso, a parada informa o endereço da instrução substituída e não a seguinte.

O lldb define os pontos de intervalo por nome, por arquivo e linha ou por endereço.

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O0`bump + 12 at account.c:13:19, address = 0x00000001000004bc
```

`bump + 12`É a quarta instrução.`sub sp, sp, #0x10`- Não .`str x0, [sp, #0x8]`, e `str w1, [sp, #0x4]`, a configuração do quadro que a tabela de linha DWARF atribui à linha de abertura da função.`x0`E ...`x1`Ainda mantêm os argumentos, porque o prólogo apenas os copiou.

Por endereço, o Ildb precisa saber a que módulo pertence o endereço.`breakpoint set -a 0x100000504`antes do processo existir é um endereço de carga sem secção atrás dele, e em um primeiro teste ele permaneceu `unresolved`Durante toda a corrida com `hit count = 0`A forma que o arnes usa é o nome do módulo:

```text
(lldb) breakpoint set -a 0x100000504 -s account-O0
Breakpoint 4: address = 0x0000000100000504
```

Com o`-s`O número é um endereço de arquivo dentro `account-O0`, Lldb adiciona o diapositivo de carga, e depois da corrida, o local é lido `resolved, hit count = 2`A lista de lição 33 dá endereços de arquivo, por isso este é o formulário que conecta uma lista estática a uma parada dinâmica.

### Descifrar o ramo à mão

O primeiro ramo condicional em `classify`- Não .`-O0`É a palavra .`36f800a8`- Não .`0x1000004f0`, que `llvm-objdump`impressões como `tbz w8, #0x1f, 0x100000504`- Descifrá-lo do código Arm A64 de `TBZ`- Não .

1. O bit 31 é `b5`, o bit alto do número de bits. É 0.
2. Os bits 30 a 25 são `011011`Bit 24 é 0, que seleciona `TBZ`E não .`TBNZ`- Não .
3. Os bits 23 a 19 são `b40`, os cinco bits mais baixos do número de bits: `11111`= 31. Com `b5`= 0 o bit testado é 31, o bit de sinal de um valor de 32 bits.
4. Os bits 18 a 5 são `imm14`- Não .`00000000000101`= 5. O deslocamento de ramificação é `imm14 * 4`- 20 -`0x14`, o alvo é`0x1000004f0 + 0x14 = 0x100000504`- Não .
5. Os bits 4 a 0 são `Rt`- Não .`01000`= 8, então o registo é `w8`- Não .

`w8`Foi carregada uma instrução antes por `ldr w8, [x8, #0x4]`, que é `a->balance`em compensação 4. `TBZ`O ramo é tomado quando o bit de sinal está limpo, que é `balance >= 0`A fonte escreveu:`if (a->balance < 0) return -1;`, então o compilador invertou a condição: a borda tomada salta o `return -1`Bloco, e a queda através de`0x1000004f4`A afirmação estática que o arnes carrega é, portanto, uma afirmação de borda com um prédicado:`a->balance >= 0`O elevador do segundo ramo funciona da mesma forma.`subs w8, w8, #0xc8`Computação`balance - 200`E ...`b.le 0x100000524`é tomada quando é no máximo zero, que é `balance <= 200`- Não .

## Os pontos de vigia são hardware e poucos

Um ponto de observação para o processo quando a memória em um endereço é acessada. Não pode ser uma instrução substituída, porque qualquer instrução em qualquer lugar pode fazer o acesso. Os processadores, portanto, carregam um pequeno conjunto de comparadores de endereços. Em x86-64 são os registros de depuração:`DR0`através de`DR3`Detêm "os endereços de até 4 pontos de intervalo", e `DR7`A versão de um braço de comando com um braço de comando de comando de comando pode ser usada para executar, escrever ou ler-escrever e definir a sua extensão (1, 2, 4 ou 8 bytes).`DBGWVR<n>_EL1`, que "conta o endereço virtual dos dados utilizados para a correspondência dos pontos de observação", e `DBGWCR<n>_EL1`O manual do Arm diz que "uma implementação pode incluir entre 2 e 64 pontos de vigilância".

O Ildb informa o número que lhe foi dado:

```text
(lldb) watchpoint set variable a->balance
Watchpoint created: Watchpoint 1: addr = 0x16fdfe00c size = 4 state = enabled type = m
(lldb) watchpoint list
Number of supported hardware watchpoints: 4
```

Quatro nesta máquina.`0x16fdfe00c`É o que é`x0 + 4`: o indicador estrutural na`bump`stop mais o deslocamento DWARF de `balance`- Não .`size = 4`É o `int`- Não .`type = m`Quando os slots ficam esgotados, o Lldb recusa o próximo ponto de observação, e uma região que não está alinhada ou não tem um poder de dois pode tomar dois slots, o número de pontos de observação que pode ser definido pode ser menor que quatro.

Os pontos de vigilância de dados relatam após o acesso. O manual da Intel diz que "uma instrução que escreve memória sobreescreve os dados originais antes que a exceção debug gerada por um ponto de interrupção de dados seja gerada", e o lldb mantém o valor antigo em seu próprio cache para imprimir ambos:

```text
Watchpoint 1 hit:
old value: 250
new value: 255
* thread #1, queue = 'com.apple.main-thread', stop reason = watchpoint 1
    frame #0: 0x00000001000004d0 account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:14:12
```

A parada está em`0x1000004d0`, a instrução após `str w8, [x9, #0x4]`- Não .`0x1000004cc`Uma curiosa que vale a pena saber antes de analisar a saída.`watchpoint set`, impressões digitais .`Watchpoint 1 hit:`com um valor antigo vazio e `new value: 250`É a leitura inicial, e o arame ignora um golpe sem um valor antigo.

## Passo, paragem de ganchos e modo batch

A gramática de comando do Ildb é `<noun> <verb> [-options] [arguments]`Os verbos de passagem são`thread step-in`(`s`), `thread step-over`(`n`), `thread step-inst`(`si`), `thread step-inst-over`(`ni`), e `thread step-out`(`finish` ).`thread until 12`corre para uma linha.`thread return <expr>`O arnes não dá passos, para em endereços planejados e deixa um gancho de parada fazer a leitura:

```text
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
```

`-o`Pode ser repetido, e os comandos executam-se em ordem em cada parada.`register read`nome dos dois registros de argumentos e do contador de programas. `memory read -s4 -fx -c24 $x0`Impressão de 24 palavras de quatro bytes em hex do endereço em `x0`, que é 96 bytes, três `struct account`- As filas.`frame variable -P 1`Imprime os argumentos e locais e expande os ponteiros a um nível, então `a`mostra os seus cinco campos.

Modo de lote é `lldb -b`O manual diz:`--batch`executa os comandos de `-s`- Não .`-S`- Não .`-o`, e `-O`e depois desiste, e que se um comando parar "devido a um sinal ou acidente, o depurador voltará ao prompt interativo". O arnes escreve o plano para um arquivo e passa-o com `-s`Uma questão de ordem:`settings set interpreter.stop-command-source-on-error false`Sem ele, o primeiro.`continue`Após o processo ter terminado, termina todo o arquivo, e `breakpoint list`Com ele, impressões de imagem.`error: Process must be launched.`E continua.

Dois fatos sobre a forma de saída determinam como funciona o parser. Primeiro, a saída do gancho é impressa à medida que o gancho funciona, e o `Process N stopped`Bloco com o seu `frame #0`O parser, portanto, coleta registros, memória e linhas variáveis em um pedaço pendente e anexa o pedaço ao próximo `frame #0`Uma peça cujo contador de programa está no`dyld`- Não .`_dyld_start`é a parada de entrada antes do programa ser executado, e não `frame #0`Em segundo lugar, um ponto de ruptura com o`--auto-continue`O sistema de controlo de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados de dados`continue`Em vez disso, comandam.

## O plano vem da lista

`Plan.commands()`cria o arquivo de comando a partir do `llvm-objdump -d`O texto do binário será executado.`account-O0`- Não .

```text
breakpoint set -n bump
breakpoint set -n classify
breakpoint set -n sum_balances
breakpoint set -a 0x100000504 -s account-O0
breakpoint set -a 0x1000004f4 -s account-O0
breakpoint set -a 0x100000524 -s account-O0
breakpoint set -a 0x100000514 -s account-O0
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
run
watchpoint set variable a->balance
watchpoint list
continue
...
breakpoint list
watchpoint list -v
```

Os três pontos de intervalo de nome são as entradas da função. Os quatro pontos de intervalo de endereço são o alvo e a queda de cada ramo condicional que `Listing.conditional_branches()`encontra em `classify`- Não .`tbz`- Não .`0x1000004f0`E ...`b.le`- Não .`0x100000510`O ponto de vigilância é fixado na primeira parada, o que o plano espera ser.`bump`- 16 .`continue`O orçamento não é conhecimento sobre o programa, é um teto.

As reivindicações são construídas a partir dos mesmos insumos por `claims_for()`- Não .

| Id | Kind | Claim | Source |
|---|---|---|---|
| `arg-registers` | argument-register | at every entry the first arguments arrive in `x0` and `x1` | lesson 32 and AAPCS64 |
| `field-offsets` | field-offset | `struct account` is 32 bytes with `kind` at 0, `balance` at 4, `code` at 8, `rate` at 16, `label` at 24 | lesson 41 and the DWARF dump |
| `branch-1` | branch-taken | `tbz` at `0x1000004f0` goes to `0x100000504` when `a->balance >= 0`, otherwise to `0x1000004f4` | lesson 33 edges and the lesson 34 lift |
| `branch-2` | branch-taken | `b.le` at `0x100000510` goes to `0x100000524` when `a->balance <= 200`, otherwise to `0x100000514` | lesson 33 edges and the lesson 34 lift |
| `calls` | call-edge | `main` calls `bump` once, `classify` three times, `sum_balances` once | source text and `nm` |
| `store-once` | store | `bump` writes `a->balance` once and the new value is the old value plus `by` | lesson 34 pseudocode |
| `stride` | struct-stride | `list[i].balance` sits at `list + 32*i + 4` | lesson 41 and the psABI aggregate rule |
| `output` | behaviour | the program prints `class 0 1 -1` and `sum 315` | source arithmetic |

Os ofensos de campo vêm de`struct_layout()`, que diz:`DW_TAG_structure_type`com`DW_AT_byte_size (0x20)`E os cinco.`DW_TAG_member`- Notas com os seus`DW_AT_data_member_location`O plano nunca escreve o número 4.

## A corrida em -0: onze paradas

A primeira parada é a`bump`O gancho imprimiu isto antes do bloco de parada:

```text
      x0 = 0x000000016fdfe008
      x1 = 0x0000000000000005
      pc = 0x00000001000004bc  account-O0`bump + 12 at account.c:13:19
0x16fdfe008: 0x00000073 0x000000fa 0x00000009 0x00000000
0x16fdfe018: 0x00000000 0x3ff40000 0x00000719 0x00000001
0x16fdfe028: 0x0000006c 0xffffffd8 0x00000003 0x00000000
0x16fdfe038: 0x00000000 0x40000000 0x00000721 0x00000001
(account *) a = 0x000000016fdfe008 {
  kind = 's'
  balance = 250
  code = 9
  rate = 1.25
  label = 0x0000000100000719 "savings"
}
(int) by = 5
```

Leia as oito palavras da primeira linha contra os offsets DWARF.`0x73`, que é `'s'`, o `kind`O "word" no offset 4 é `0xfa`= 250, `balance`A palavra 2 no offset 8 é `0x9`- Não .`code`, a `short`O Word 3 no offset 12 é o padding antes do 8-byte alinhado `double`As palavras 4 e 5 no offset 16 são`0x3ff4000000000000`As palavras 6 e 7 no offset 24 são `0x100000719`, o `label`Indicador para `__TEXT`As próximas oito palavras começam com`0x6c`- Não .`'l'`E ...`0xffffffd8`= -40: a terceira fila, `loan`- Cada número concorda com`frame variable`- Então ...`_check_layout()`registos`field-offsets`Como `confirmed`Neste ponto, e faz isso novamente em cada uma das onze paradas onde`x0`- Tem um ponteiro estrutural.

`x0`- É igual .`a`E ...`x1`- É igual .`by`- Então ...`arg-registers`O arneses só compara os argumentos declarados.`classify`Paradas .`x1`Ainda lê .`0x5`, um resíduo de `bump`, e `classify`O registro em que não há argumento é ruído, e a alegação da lição 32 não diz nada sobre isso.

A segunda parada é o ponto de observação, valor antigo 250, novo 255, `by`= 5. Um golpe em toda a corrida, então `store-once`Depois, há três ativas de`classify`, cada um com a sua parada de entrada e uma ou duas paradas de borda:

| Stop | Address | Stop reason | What it tests |
|---|---|---|---|
| 2 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 100, `x0` = `a` |
| 3 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 100 >= 0, `branch-1` confirmed |
| 4 | `0x100000524` | breakpoint 6.1 | `b.le` taken, 100 <= 200, `branch-2` confirmed |
| 5 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 255 |
| 6 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 255 >= 0 |
| 7 | `0x100000514` | breakpoint 7.1 | `b.le` fell through, 255 > 200 |
| 8 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = -40 |
| 9 | `0x1000004f4` | breakpoint 5.1 | `tbz` fell through, -40 < 0 |
| 10 | `0x100000544` | breakpoint 3.1 | `sum_balances` entry, `x1` = 3 |

`_check_branches()`Grupar as paradas em ativações, ler o saldo na entrada, e para cada parada de borda calcula o sucessor o predicado levantado prevê.`branch-1`Confirmada três vezes.`branch-2`O ponto de observação viu o valor escrito. A corrida é um programa e a evidência conecta.

Na parada 10 o gancho leu 24 palavras de`list`- Não .`_check_stride()`Ele toma palavra 1, palavra 9 e palavra 17, que são ofertas 4, 36, e 68: 100, 255, e -40.`classify`O resultado é o resultado da análise de dados, que foi feita no mesmo endereço, somando-os em 315, e comparando a soma com o `sum 315`linha o programa impresso. Então o processo sai com status 0 e `breakpoint list`mostra contagens de 1, 3, 1 para os nomes e 2, 1, 1, 1 para as quatro bordas.`confirmed`, com 25 registos atrás deles, 23 deles ligados a uma parada e dois à corrida final.

## A corrida em -O2: Zero Paros

A mesma fonte em `-O2`É um programa diferente.`llvm-objdump -d`de`main`Tem quatro .`bl`instruções, todas para `printf`Em vez das chamadas que tem .`mov w8, #-0x1`- Não .`mov w8, #0x1`, um zero através de `xzr`, e `mov w8, #0x13b`O compilador calculou todos os resultados no tempo de compilação.`nm`listas de produtos`_bump`- Não .`_classify`, e `_sum_balances`, porque são funções externas e as cópias fora de linha devem existir para que outros objetos sejam chamados.`DW_TAG_subprogram`entradas para todas as quatro funções e zero `DW_TAG_inlined_subroutine`Entradas, por isso, mesmo as informações de depuração não registam o inlining.

O plano para esta construção tem três pontos de ruptura de nome e nenhum ponto de ruptura de borda. `classify`- Não .`-O2`é seis instruções,`ldr`- Não .`cmp`- Não .`cset`- Não .`cmp`- Não .`csinv`- Não .`ret`A borda reivindica a partir do`-O0`listagem não têm endereço neste binário, e o arnes não os transporta. Uma reivindicação sobre uma borda pertence ao edifício cuja listagem tem a borda.

A corrida:

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O2`bump at account.c:13:16, address = 0x0000000100000460
(lldb) run
sizeof 32 align 8
offsets 0 4 8 16 24
class 0 1 -1
sum 315
Process 48444 exited with status = 0 (0x00000000)
(lldb) watchpoint set variable a->balance
error: Command requires a process which is currently stopped.
(lldb) breakpoint list
1: name = 'bump', locations = 1, resolved = 1, hit count = 0
```

Cada ponto de ruptura resolvido.`BRK`A contagem de mortos é zero porque nenhuma instrução chegou ao endereço.

| Claim | Verdict | Record |
|---|---|---|
| `calls` | refuted | after a full run with exit status 0, entry stops bump 0, classify 0, sum_balances 0 |
| `output` | confirmed | the four lines and exit status 0 |
| `arg-registers` | not-observed | no stop tested it, hit counts all 0 |
| `field-offsets` | not-observed | no stop tested it |
| `store-once` | not-observed | no stop in bump, so the watchpoint was never set |
| `stride` | not-observed | no stop in sum_balances |

Seja exato sobre o que diz a refusão.`main`chama as três funções neste programa. Para esta construção e esta corrida não, e o arnes verificou que a corrida terminou, porque uma contagem de acidentes de zero antes da saída significaria apenas que a corrida não tinha atingido a chamada ainda. A alegação não diz que as funções são código morto, e a execução não diz que nem: são exportadas e outro objeto pode chamá-las. As outras quatro alegações não são nem confirmadas nem refutadas. O estruto ainda tem`balance`na compensação 4 nesta construção, e o `-O2`A DWARF diz que sim, mas não há nenhuma parada nesta corrida de leitura da memória para mostrar. `not-observed`mantém essa distinção, e a lição 35 mantém o desconhecido aberto até que uma corrida o observe.

## O valor do valor de um produto

Um arquivo central é a memória do processo e registros escritos no disco, para que o depurador possa ler um programa parado depois que o programa desapareceu.`core(5)`Diz: "Um pequeno número de sinais que causam uma terminação anormal de um processo também fazem com que um registro do estado do processo seja escrito no disco",`/cores/core.pid`"contanto que o processo encerrado tivesse autorização de escrita no diretório, e o diretório existia".`sysctl`Relatórios `kern.coredump: 1`E ...`kern.corefile: /cores/core.%P`- Não .`/cores`Existe com modo `drwxrwxr-t root admin`, e a concha`ulimit -c`Não há núcleo de núcleo escrito até que você aumentar o limite com `ulimit -c unlimited`, ou em todo o sistema com `launchctl limit core unlimited`- Não .

A Ildb escreve um núcleo sob demanda sem acidente.`bump`ponto de ruptura:

```text
(lldb) process save-core --style stack account-O0-stack.core
Saving 49152 bytes of data for memory region at 0x16fdf4000

Modified-memory or stack-memory only corefile created.  This corefile may 
not show library/framework/app binaries on a different system, or when 
those binaries have been updated/modified. Copies are not included
in this corefile.  Use --style full to include all process memory.
```

O arquivo era de 53.248 bytes.

```text
(lldb) target create "./account-O0" --core "account-O0-stack.core"
(lldb) bt
* thread #1, stop reason = ESR_EC_BRK_AARCH64 (fault address: 0x0)
  * frame #0: 0x00000001000004bc account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:13:19
    frame #1: 0x0000000100000640 account-O0`main at account.c:40:5
    frame #2: 0x000000019a949d54 dyld`start + 7184
(lldb) frame variable *a
(account) *a = (kind = 's', balance = 250, code = 9, rate = 1.25, label = "")
(lldb) frame variable a->label
(const char *) a->label = 0x0000000100000719 ""
```

A traça e os campos inteiros estão intactos, porque vivem na pilha que o núcleo salvou.`label`Impressões como uma corda vazia com o punteiro intacto.`0x100000719`é correto; os bytes que aponta são os literais `"savings"`No`__TEXT`O ponto é uma observação. a cadeia não está disponível, e o lldb não a inventou. `--style full`Inclui toda a memória de processo, e um núcleo completo deste programa de 34 KB na máquina de pesquisa foi de 2,1 GB, porque o processo mapeia o cache compartilhado.`ESR_EC_BRK_AARCH64`: o núcleo registrou o `BRK`excepção que o ponto de ruptura levantou.

No Linux o kernel escreve o núcleo de acordo com `/proc/sys/kernel/core_pattern`, um modelo com `%p`para o PID, `%e`para o nome do comando, `%s`para o sinal, e `%t`O que é que é o tempo?`|`Os sistemas de distribuição usam esse tubo para`systemd-coredump`, e `coredumpctl list`- Não .`info`- Não .`dump`, e `debug`Retomar o que armazenou.`gdb prog core`E ...`lldb -c core prog`Ambos abrem o resultado.

## GDB e LLDB lado a lado

Os dois debuggers fazem o mesmo trabalho com palavras diferentes. `COMMAND_MAP`no arnes contém 35 fileiras, impressas por `python3 code/main.py commands`- As que esta aula usa:

| Task | gdb | lldb | lldb alias |
|---|---|---|---|
| break at a function | `break bump` | `breakpoint set -n bump` | `b bump` |
| break at an address in one module | `break *0x1000004f0` | `breakpoint set -a 0x1000004f0 -s account-O0` | |
| run commands at every stop | `define hook-stop` ... `end` | `target stop-hook add -o '...'` | |
| list breakpoints with hit counts | `info breakpoints` | `breakpoint list` | `br l` |
| watch a variable for writes | `watch a->balance` | `watchpoint set variable a->balance` | `wa s v a->balance` |
| list watchpoints | `info watchpoints` | `watchpoint list -v` | `wa l -v` |
| read one register | `p $x0` | `register read x0` | |
| read memory as words | `x/8xw 0x16fdfe008` | `memory read -s4 -fx -c8 0x16fdfe008` | `x -s4 -fx -c8 0x16fdfe008` |
| show arguments | `info args` | `frame variable --no-locals` | |
| step one instruction | `stepi` | `thread step-inst` | `si` |
| run until the function returns | `finish` | `thread step-out` | `finish` |
| write a core file | `gcore core` | `process save-core --style stack core` | |
| open a core file | `gdb account-O0 core` | `lldb -c core account-O0` | |

O Ildb's `p`é um alias de `dwim-print`, que imprime uma variável simples através do `frame variable`caminho e cai de volta para `expression`Para qualquer outra coisa.`v`É o que é`frame variable`- Prefiro .`frame variable`num arnes: lê localizações DWARF e nunca executa código no depurador.

Versões e licenças em 2026-10-14. lldb carrega o número de versão LLVM, e a versão atual de llvm.org é LLVM 23.1.3 de 2026-10-06, sob a Licença Apache 2.0 com exceções LLVM. Homebrew envia-o como a fórmula separada `lldb`As ferramentas da linha de comando desta máquina nave .`lldb-1703.0.236.21`O GDB 18.1 foi lançado em 2026-09-25 sob GPL-3.0 ou posterior.`.gdb_index`, AArch64 `FPMR`, e Python `gdb.Corefile`GDB não tem suporte nativo para processos de silício da Apple até 18.1: uma série de 15 patches "Suporte inicial AArch64-Darwin" foi postada em outubro de 2025, e em fevereiro de 2026 um administrador estabeleceu a rota para aterragá-lo através da atribuição de direitos autorais e os patches BFD primeiro.`gdb`A fórmula tem garrafas arm64 e é construída com um falso `--target=x86_64-apple-darwin20`, e o pedido de puxão que os adicionou diz "não é possível depurar binários aarch64-darwin através de GDB". Qualquer depurador não-Apple no macOS também precisa de um certificado auto-assinado e o `com.apple.security.cs.debugger`Direito ou`task_for_pid`falha com "(os/kern) falha (0x5)". o lugar do gdb neste curso é o Linux, onde o Debian estável navega gdb 16.3 para arm64, e onde `rr`- As vidas.

## Traçamento: O que o programa pediu ao núcleo

Um depurador mostra o estado do programa em parada. Um rastreador mostra os efeitos do programa no sistema sem detê-lo por muito tempo. As ferramentas são por sistema operacional.

| Tool | OS | Version | Licence | What it records |
|---|---|---|---|---|
| `strace` | Linux | 7.2, 2026-08-18 | LGPL-2.1-or-later | system calls with arguments and return values |
| `ltrace` | Linux | 0.7.3 last tarball, git snapshots in Debian | GPL-2.0 | dynamic library calls |
| `bpftrace` | Linux | v0.27.0, 2026-09-10 | Apache-2.0 | kernel and user probes through eBPF |
| `dtrace` and `dtruss` | macOS | `Sun D 1.19` in macOS 26.2 | CDDL, from Sun's OpenSolaris | D probes; `dtruss` prints system calls |

`dtruss`Diz no manual que "Como este usa DTrace, apenas os usuários com privilégios de raiz podem executar este comando".`dtrace(1)`acrescenta que "Com configurações padrão de Proteção de Integridade do Sistema, os programas D não são permitidos para acessar os valores de endereços do kernel ou o conteúdo da memória do kernel" e que ações destrutivas não são permitidas sob o SIP. `sudo dtruss ./account-O0`A traça responde a uma pergunta diferente da do arnes: "este arneso corre sem raiz, e a lição registra que não verificado.`write`para cada um `printf`"linha" é uma pergunta de rastreamento, "fazer?`x1`5 em `bump`" é uma pergunta debugger.

## Regista e reproduz

`rr`Regista uma corrida uma vez e reproduz-a deterministicamente sob gdb, com execução inversa: definir um ponto de observação sobre o valor que você se importa e `reverse-cont`corre para trás para a escrita. O projeto descreve-se como "Você grava uma falha uma vez, e depois depura a gravação, deterministicamente, tantas vezes quanto quiser". A versão atual é 5.9.0 de 2025-02-13, sob a licença MIT com um bloco BSD-2-Clause. É apenas Linux. Ele precisa de contadores de desempenho de hardware para contar ramos, então ele funciona no Intel Nehalem e mais tarde, certos núcleos AMD Zen e "certa microarquitetura AArch64 (por exemplo. ARM Neoverse N1 ou a Apple Silicon M-série) " sob Linux. Dentro de uma máquina virtual os contadores devem ser virtualizados, e o wiki do projeto diz "Nenhuma outra virtualização no Mac também faz", então Docker e Colima nesta máquina não podem executá-lo. O Pernosco é o serviço comercial baseado em gravações.

A GDB tem um gravador de software próprio. `record full`registos "um registro da execução do processo" com um limite padrão de 200.000 instruções, e `record btrace`O sistema operacional de correção de dados não é disponível em Lldb. Nesta máquina macOS, a transcrição guardada do arnes é o registro: o mesmo plano no mesmo binário produz as mesmas paradas na mesma ordem, e o dispositivo testa essa ordem.

## O que prova uma corrida

Uma execução prova uma entrada em uma construção. O padrão C define comportamento não definido como "comportamento, em caso de utilização de uma construção de programa não portátil ou errada ou de dados errados, para os quais este documento não impõe requisitos", por isso um programa que supera um assinado `int`podem legitimamente imprimir resultados diferentes em `-O0`E ...`-O2`Lição 36 encontrou isto com o`percent_change`UBSan transforma a pergunta em uma parada:`-fsanitize=signed-integer-overflow -fsanitize-trap=undefined`faz o desbordamento "executar uma instrução de armadilha", que aterra no Ildb como uma parada com uma razão.

O código otimizado também move o que você quer assistir. O manual do GDB diz que "o otimizador reorganizou seu código; o depurador mostra-lhe o que realmente está lá" e que uma variável otimizada para fora da existência é uma "GDB nunca vê".`<optimized out>`, e a sua fonte separa isso de `<unavailable>`Otimizado para "não existe realmente no programa", indisponível "existe no programa (a nível da máquina), mas o GDB não tem meios para chegar a ele".`<variable not available>`Quando o contador de programa está fora de todos os intervalos da lista de localização DWARF da variável. Um ponto de observação em um local que vive em um registro nunca dispara, porque um registro não é memória.`-O2`O caso extremo é que toda a função foi dobrada e o silêncio de um ponto de observação que nunca foi definido não prova nada.

O arnes escreve três tipos de registro e nunca um quarto.`confirmed`Uma parada que o testou e discordou é`refuted`Uma afirmação que não pode ser testada é`not-observed`O livro de contabilidade da lição 35 aceita os dois primeiros como`observed`registos com autoridade `controlled-replay`, e mantém o terceiro como um desconhecido aberto.

## Debugando apenas suas próprias edificações no macOS

No silício da Apple, os sinais de ligação são para ti.`ld(1)`Diz-me`-adhoc_codesign`"A configuração padrão para os binários Apple Silicon é a de ser codificado ad-hoc". `codesign -dvvv account-O0`nas impressões das instalações:

```text
Format=Mach-O thin (arm64)
CodeDirectory v=20400 size=387 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
Signature=adhoc
TeamIdentifier=not set
```

`0x20002`É o que é`CS_ADHOC`(`0x2`) mais `CS_LINKER_SIGNED`(`0x20000`), "Automaticamente assinado pelo linker" no cabeçalho de assinatura de código da Apple. `codesign -d --entitlements -`imprime nada após o nome executável: o binário não tem direitos. Lldb lançou-o, tocou em cada ponto de ruptura, configurou um ponto de vigilância de hardware e escreveu um núcleo, com `DevToolsSecurity -status`A comunicação "Modo de desenvolvimento está atualmente desativado" e a Proteção da Integridade do Sistema habilitada.

Dois direitos controlam quem pode debug o quê, e eles sentam-se em lados opostos. `com.apple.security.cs.debugger`é para o depurador: "Um valor booleano que indica se o aplicativo é um depurador e pode ser ligado a outros processos ou obter portas de tarefas".`debugserver`O artigo 2.o, n.o 1, alínea a), do Regulamento (CE) n.o 525/2008 é aplicável.`codesign -d --entitlements -`nas listas de cópias das ferramentas de linha de comando `com.apple.private.cs.debugger`- Não .`com.apple.private.set-exception-port`- Não .`com.apple.private.thread-set-state`, e `com.apple.private.logging.diagnostic`- Não .`com.apple.security.get-task-allow`O Xcode injeta-o em edificações de defeito, o desativa da exportação, e a notarização rejeita um binário que ainda o tem. Os engenheiros da Apple declaram a regra para a recusa: o porto de tarefa é negado quando o alvo tem o tempo de execução endurecido habilitado e não tem `get-task-allow`- Uma planície .`clang`Se assinares um contrato com o`codesign --options runtime`, reassiná-lo com `codesign -s - -f --entitlements get-task-allow.plist`antes de depurar.

Três fatos mais fecham a seção. Primeiro, você pode ver a diálogo "Developer Tools Access precisa assumir o controle de outro processo para continuar o depuração" pela primeira vez em uma sessão de login; `sudo DevToolsSecurity -enable`remove a senha extra para os membros do `admin`ou `_developer`grupos. Em segundo lugar, você não desativar SIP para depurar o seu próprio código. Apple diz "Você não precisa desativar SIP para executar e depurar aplicativos de Xcode", e o único componente SIP que toca depurar é o `csrutil enable --without debug`O sistema de segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança da segurança`task_for_pid`inteiramente, e o dispositivo `sandbox-O0.lldb.txt`Uma corrida que não pode começar é um fato ambiental, e o arame relata-o como tal.

Tudo nesta lição se aplica aos programas que você compilar. Os mesmos comandos só se anexariam a outro processo se o seu proprietário optar por participar, e nada aqui ensina como alterar isso.

## Construí-lo

Executa a demonstração:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
npx tsx code/main.ts
```

A saída é um relatório JSON sobre as transcrições salvas. Para cada construção, ele lista os pontos de interrupção com sua resolução e contagem de acidentes, a contagem de pontos de vigilância de hardware, cada parada com seus registros e argumentos, o estado de saída, a saída do programa, os erros imprimidos, e as alegações com seus veredictos e os registros de evidências por trás deles. Ele adiciona o core round trip, os resultados da API Python, a falha da caixa de areia e quais ferramentas externas estão ausentes nesta máquina.

Forma esperada:

```json
{
  "program": "account.c",
  "variants": {
    "O0": {
      "binary": "account-O0",
      "breakpoints": {"1": {"spec": "name=bump", "address": "0x1000004bc", "resolved": true, "hits": 1}, "...": "..."},
      "hardwareWatchpoints": 4,
      "watchpoints": {"1": {"address": "0x16fdfe00c", "size": 4, "type": "m", "hits": [[250, 255]], "hitCount": 1}},
      "stops": [{"index": 0, "pc": "0x1000004bc", "function": "bump", "kind": "entry", "registers": {"x0": "0x16fdfe008", "x1": "0x5"}, "...": "..."}],
      "exitStatus": 0,
      "claims": [{"id": "arg-registers", "verdict": "confirmed", "confirmed": 5, "refuted": 0, "not-observed": 0, "...": "..."}],
      "evidence": [{"claim": "arg-registers", "verdict": "confirmed", "stop": 0, "observation": "bump: x0 = 0x16fdfe008 and a = 0x000000016fdfe008, x1 = 0x5 and by = 5"}]
    },
    "O2": {"stops": [], "claims": [{"id": "calls", "verdict": "refuted", "...": "..."}], "...": "..."}
  },
  "core": {"savedAt": {"function": "bump", "pc": "0x1000004bc"}, "labelString": "", "...": "..."},
  "types": {"python": "3.9.6", "size": 32, "...": "..."},
  "sandbox": {"stops": 0, "errors": ["process exited with status -1 (attach failed ((os/kern) invalid address))"]},
  "absentTools": ["bpftrace", "gdb", "llvm-objdump", "ltrace", "rr", "strace"]
}
```

Leia `code/main.py`na ordem seguinte:

1. `Listing`Parsa o `llvm-objdump -d`O texto em funções e instruções, e `Function.conditional_branches()`encontra os ramos com os seus alvos e as suas falhas.
2. `struct_layout()`lê a estrutura e as entradas de membros do `llvm-dwarfdump`- Não.
3. `lift_condition()`transforma um ramo condicional em um prédico, a lição 34 passo para `tbz`- Não .`cbz`, e os formulários de comparação e ramificação.
4. `Plan.commands()`escreve o arquivo de comando Lldb da listagem, e `Plan.lldb_command()`é a invocação de lote.
5. `parse_transcript()`anda a saída em ordem e constrói `Stop`registos com registos, memória, variáveis e valores de pontos de observação, mais a tabela de pontos de intervalo e o estado de saída.
6. `claims_for()`Estabelece as oito alegações e `evaluate()`As notas para eles parar por parar com o `_check_*`funções.
7. `rollup()`reduz os registos a um veredicto por reivindicação, tendo o refutado a ter precedência sobre o confirmado.
8. `capture()`E ...`capture_extras()`Produzido os aparelhos, e `live()`Repete todo o ciclo numa nova construção quando `clang`E ...`lldb`- Não.

Existem mais quatro comandos.`python3 code/main.py plan O0`Imprime o arquivo de comando para uma construção. `python3 code/main.py commands`Imprime a tabela de GDB e LDB. `python3 code/main.py tools`Relatórios sobre as ferramentas externas `PATH`- Não .`python3 code/main.py live O0`compilações `account.c`dentro de um diretório temporário, planos de sua nova listagem, executa lldb, e classifica as reivindicações contra essa execução.

## Usá-lo

Use o arame num programa próprio nesta ordem.

1. Construí-lo com `-g`E o nível de otimização que você vai enviar.`llvm-objdump -d`- Mandem-me uma mensagem.
2. Escreva as reivindicações antes de executar. Cada uma dá nome a uma função, um registro ou um endereço ou um offset, um valor ou uma borda esperados, e a lição ou documento de que veio. Uma reivindicação que você escreve depois de ver a parada descreve a parada e não testa nada.
3. Gerenar o plano da lista e lê-lo. Cada endereço nela deve rastrear uma linha na lista. Se um ponto de ruptura não tem tal linha, remova-o.
4. Execute uma vez no modo batch e mantenha a transcrição com a linha de comando e a versão de depuração no cabeçalho. A transcrição é a evidência. Os veredictos são derivados dela, e qualquer um pode retrai-los.
5. - Leia todas as notas.`not-observed`Os motivos dizem-lhe quais as alegações precisam de outra entrada, outra construção ou outro ponto de ruptura.
6. Execute a construção otimizada com as mesmas reivindicações. Espera pontos de ruptura resolvidos com zero hits onde o compilador foi alinhado, e mantenha essas reivindicações abertas.
7. Fornecer os registos confirmados e refutados no livro de leitura da lição 35 como `observed`, autoridade `controlled-replay`Deixem os não observados como desconhecidos com os pontos de ruptura ligados.

## Laboratório Interativo

### Laboratório A: ler uma parada à mão

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program/code
python3 -q
```

- Correr .

```python
from main import *
t = load_transcript("session-O0.lldb.txt")
s = t.stops[0]
hex(s.pc), s.function, s.reason, s.registers
[hex(w) for w in s.memory[:8]]
s.struct_pointer().fields
```

Antes da segunda linha, escreva qual palavra você espera ter 250 e quais duas palavras têm 1,25.`struct.unpack("<d", struct.pack("<II", s.memory[4], s.memory[5]))`E comparar. Então olha.`t.stops[1].watch_hit`E ...`t.stops[1].pc`, e encontrar esse endereço em `account-O0.objdump.txt`É a instrução após a loja.

### Laboratório B: o ramo e o seu sucessor

```python
plan = make_plan("O0")
plan.branches()
classify = plan.listing.function("classify")
[lift_condition(classify, b, "a->balance")[0] for b in plan.branches()]
[(hex(s.pc), s.struct_pointer().field_int("balance")) for s in t.stops_in("classify")]
```

Compare cada parada de borda com a sua parada de entrada e decida, antes de olhar para a evidência, qual sucessor o predicado prevê.`[e.to_dict() for e in evaluate(plan, t, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim.startswith("branch")]`e comparar.

### Lab C: a corrida que nunca parou

```python
o2 = load_transcript("session-O2.lldb.txt")
len(o2.stops), o2.exit_status, o2.hits()
o2.errors[:3]
make_plan("O2").branches()
rollup(evaluate(make_plan("O2"), o2, struct_layout(open("fixtures/account-O2.dwarfdump.txt").read(), "account")))
```

Explique cada um `not-observed`Em suas próprias palavras, então abram.`account-O2.objdump.txt`e encontrar as quatro constantes em `main`E depois conta.`DW_TAG_inlined_subroutine`em `account-O2.dwarfdump.txt`com`count_tags()`- Não .

### Laboratório D: quebrar as provas

```python
text = open("fixtures/session-O0.lldb.txt").read().replace("x1 = 0x0000000000000005", "x1 = 0x0000000000000006", 1)
broken = parse_transcript(text)
[e.to_dict() for e in evaluate(plan, broken, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim == "arg-registers"][:2]
```

Um registo editado torna o primeiro .`arg-registers`registos para `refuted`E o rolup com ele, enquanto as outras quatro entradas permanecem.`confirmed`Então , apague o `old value: 250`linha antes da parada do ponto de observação e observação `store-once`Caem para`not-observed`Um aluno que não pode falhar não é um aluno.

Se o Ildb conseguir iniciar um processo na sua concha, termine com `python3 main.py live O0`E ...`python3 main.py live O2`Os endereços da pilha serão diferentes dos dos equipamentos.

## Laboratório de Prática

Estender o arame com uma reivindicação sobre o ciclo em `sum_balances`- Não .

Requisitos:

- Encontre o limite de volta do circuito de `sum_balances`No`-O0`listagem com `conditional_branches()`e adicionar um ponto de ruptura no cabeçalho do loop.
- Adicionar uma reivindicação que o cabeçalho executa `count + 1`- Por vezes .`count`= 3, que é a lição 33 de lado de trás mais o teste de saída.
- Estender o gancho de parada ou o plano para que o gancho leia o espaço de pilha do contador de loop em cada parada de cabeçalho, e escrever um `_check_loop()`que registra a sequência de valores de contra.
- Recapturar a transcrição com `python3 main.py capture O0`O teste do plano falhará até que o arquivo de comando comprometido coincida com o novo plano, que é o ponto do teste.
- Adicionar um teste que edite um valor de contra na transcrição e afirma as viradas da reivindicação `refuted`- Não .

O sucesso significa que o relatório mostra os pontos de parada do cabeçalho em ordem com os seus valores de contra-`-O2`A corrida mantém a nova reivindicação .`not-observed`com a razão de o circuito ter sido vectorizado ou dobrado.

## Lição Artifacto

Esta lição inclui `outputs/skill-dynamic-analysis-of-your-own-program.md`. Use-o para transformar um programa que você construiu, sua listagem e uma lista de reivindicações estáticas em uma transcrição de depurador salva e um veredicto por reivindicação, com a parada que produziu cada veredicto e a razão de cada reivindicação que permaneceu não observada.

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A suite funciona sem o Ildb.`code/fixtures/`A verificação deve provar:

- O analisador de lista encontra as quatro funções com as suas faixas e os dois ramos condicionais de `classify`- Não .`-O0`com alvo e queda
- O elevador de `tbz w8, #0x1f`É o que é`a->balance >= 0`e o elevador de `subs`- E mais .`b.le`É o que é`a->balance <= 200`
- `main`- Não .`-O0`chamadas`bump`- Não .`classify`três vezes, e `sum_balances`, e `main`- Não .`-O2`Só chamadas .`printf`
- x86-64 `j<cc>`As mnemônicas são condicionais e `jmp`E ...`callq`Não são
- O depósito DWARF produz um estruto de 32 bits com membros em 0, 4, 8, 16 e 24
- O `-O2`O DWARF tem quatro subprogramas e zero entradas de subroutine de linha, e `nm`Ainda lista as três funções
- O plano é igual ao arquivo de comando comprometido para ambas as confecções, e o cabeçalho da transcrição registra o comando Lldb que o executou
- O `-O0`Transcript tem onze paradas nas funções esperadas, estado de saída 0, e as quatro linhas de saída
- O motor de saída do gancho é ligado à parada que o segue, com `x1`= 5, memória a partir de `x0`, e a linha de rótulo
- A tabela de pontos de ruptura apresenta resolução e contagem de acidentes 1, 3, 1, 2, 1, 1, 1
- O ponto de observação é de 4 bytes de tipo modificar em `x0 + 4`, atingido uma vez com o valor antigo 250 e o novo valor 255, e quatro slots de hardware são relatados
- O `-O2`A transcrição tem zero paradas, três pontos de interrupção resolvidos com zero hits, nenhum ponto de observação e um erro por não usado `continue`
- O lançamento em caixa de areia falha antes de qualquer parada com o erro de ligação
- O centro da viagem de ida e volta mantém o rastro de volta e `balance`= 250 e perde a corda atrás `label`
- A API Python lê os cinco campos, o tamanho 32, e a função varia sem um processo
- Uma transcrição escrita à mão x86-64 analisa com `rdi`- Não .`rsi`, e `rip`
- Cada reivindicação é confirmada em `-O0`com registos 5, 11, 3, 2, 1, 1, 1, 1
- a prova do ramo indica o valor, a condição e a borda
- A prova de campo-offset decodifica as palavras através do layout DWARF
- A prova de depósito e de passo contém o valor antigo e o novo e os saldos de três linhas
- O `-O2`A execução refutou as bordas de chamada e deixou as outras alegações não observadas
- um valor do registro editado é refutado, um hit do ponto de observação excluído não é observado e o refutado ganha a reestruturação
- O mapa de comando tem formulários gdb e lldb para cada linha, e a tabela de hardware nomeia quatro registros de defeitos x86
- A demonstração lista as ferramentas ausentes em vez de falhar, e o modo ao vivo relata a ferramenta ausente pelo nome
- Os dados de figura vêm de ambas as sessões e o módulo do site incorpora os mesmos dados

## Modos de falha de produção

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Resolved breakpoint with zero hits | "the function runs" or "the function is dead" | a full run with exit status, hit counts, and the verdict `refuted` for the call edge only |
| Register read at the wrong stop | "`x1` = 5 inside `classify`" | compare only declared arguments at the entry stop |
| Struct read without offsets | a column of hex words | every word mapped to a `DW_AT_data_member_location` and compared with `frame variable` |
| Branch graded from the mnemonic | "`tbz` means taken when negative" | the lifted predicate from the encoding and the stop at the successor |
| Watchpoint on a register-resident local | "no write happened" | the watchpoint was set on an address and was hit, or the record is `not-observed` |
| Auto-continue breakpoints | a clean transcript with no stops | plain breakpoints, a stop hook, and a continue budget |
| Address breakpoint without a module | `unresolved, hit count = 0` | `-s MODULE` so the listing address resolves to a load address |
| First command error ends the batch | no `breakpoint list` at the end | `interpreter.stop-command-source-on-error false` |
| Stack-style core read as full memory | `label = ""` reported as the program's value | the core style, the pointer, and the segment it points into |
| Sandboxed shell | "lldb is broken" | `attach failed ((os/kern) invalid address)` recorded as an environment fact |
| Hardened target without `get-task-allow` | "macOS forbids debugging" | the two conditions from Apple's rule, and a re-sign of your own binary |
| Transcript discarded after grading | verdicts with no source | the transcript file, its command line, and the debugger version |

## Regra de funcionamento

Planeje as paradas da lista, execute uma vez no modo batch, mantenha a transcrição e classifique cada reivindicação estática em cada parada que possa testá-la. Escreva confirmada ou refutada apenas a partir de uma parada, escreva não observada com os números de acidentes e a razão, e nunca deixe um ponto de ruptura resolvido ficar em uma corrida. Debug apenas as construções que você fez.

## Mais leitura

- [LLDB Tutorial: command grammar, breakpoints, watchpoints, stop hooks](https://lldb.llvm.org/use/tutorial.html)
- [lldb(1) manual page: --batch, --one-line, --source, --core](https://lldb.llvm.org/man/lldb.html)
- [GDB to LLDB Command Map](https://lldb.llvm.org/use/map.html)
- [LLDB Python Reference: SBTarget, SBFrame, SBValue, and the embedded interpreter](https://lldb.llvm.org/use/python-reference.html)
- [LLDB Caveats: the Python build lldb links against](https://lldb.llvm.org/resources/caveats.html)
- [LLVM 23.1.3 release](https://github.com/llvm/llvm-project/releases/tag/llvmorg-23.1.3)
- [GDB 18.1 release announcement, 2026-09-25](https://sourceware.org/pipermail/gdb-announce/2026/000150.html)
- [GDB manual: Process Record and Replay](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Process-Record-and-Replay.html)
- [GDB manual: Debugging Optimized Code](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Optimized-Code.html)
- [GDB wiki: Permissions on Darwin, code signing a debugger](https://sourceware.org/gdb/wiki/PermissionsDarwin)
- [gdb-patches: Initial AArch64-Darwin support series, October 2025](https://sourceware.org/pipermail/gdb-patches/2025-October/222196.html)
- [Homebrew gdb formula pull request adding arm64 bottles](https://github.com/Homebrew/homebrew-core/pull/209753)
- [ptrace(2), Linux manual page](https://man7.org/linux/man-pages/man2/ptrace.2.html)
- [lldb debugserver MachTask.mm: task_for_pid and task_set_exception_ports](https://github.com/llvm/llvm-project/blob/main/lldb/tools/debugserver/source/MacOSX/MachTask.mm)
- [Intel SDM Volume 2: INT n, INTO, INT3, INT1](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Intel SDM Volume 3: debug registers DR0 to DR7 (Debug, Branch Profile, TSC, and Resource Monitoring Features)](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm A64 ISA: BRK, Breakpoint instruction](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/BRK--Breakpoint-instruction-)
- [Arm A64 ISA: TBZ, Test bit and branch if zero](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/TBZ--Test-bit-and-branch-if-zero-)
- [Arm Architecture Reference Manual, D2.9 Watchpoint exceptions](https://developer.arm.com/documentation/ddi0487/latest/)
- [Apple ld(1): -adhoc_codesign](https://keith.github.io/xcode-man-pages/ld.1.html)
- [Apple ld64 LinkEdit.hpp: CS_LINKER_SIGNED](https://github.com/apple-oss-distributions/ld64/blob/59a99ab60399c5e6c49e6945a9e1049c42b71135/src/ld/LinkEdit.hpp)
- [Apple: Debugging Tool Entitlement, com.apple.security.cs.debugger](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.debugger)
- [Apple: Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)
- [Apple: Resolving common notarization issues, the get-task-allow entitlement](https://developer.apple.com/documentation/security/resolving-common-notarization-issues)
- [Apple: Disabling and Enabling System Integrity Protection](https://developer.apple.com/documentation/security/disabling-and-enabling-system-integrity-protection)
- [Apple Developer Forums: debugserver may not get the taskport of a hardened process](https://developer.apple.com/forums/thread/127544)
- [Apple DevToolsSecurity(8)](https://keith.github.io/xcode-man-pages/DevToolsSecurity.8.html)
- [Apple core(5)](https://keith.github.io/xcode-man-pages/core.5.html)
- [Apple Technical Note TN2124: Mac OS X Debugging Magic, core dumps](https://developer.apple.com/library/archive/technotes/tn2124/_index.html)
- [lldb `process save-core` help text](https://github.com/llvm/llvm-project/pull/143126)
- [core(5), Linux manual page](https://man7.org/linux/man-pages/man5/core.5.html)
- [coredumpctl(1)](https://man7.org/linux/man-pages/man1/coredumpctl.1.html)
- [Apple dtrace(1)](https://keith.github.io/xcode-man-pages/dtrace.1.html)
- [Apple dtruss(1m)](https://keith.github.io/xcode-man-pages/dtruss.1m.html)
- [strace releases](https://github.com/strace/strace/releases)
- [ltrace](https://ltrace.org/)
- [bpftrace CHANGELOG](https://github.com/bpftrace/bpftrace/blob/master/CHANGELOG.md)
- [rr project](https://rr-project.org/)
- [rr 5.9.0 release](https://github.com/rr-debugger/rr/releases/tag/5.9.0)
- [rr wiki: Building And Installing, hardware and VM requirements](https://github.com/rr-debugger/rr/wiki/Building-And-Installing)
- [Clang UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)
- [ISO/IEC 9899:2024 working draft N3220, clause 3.5 undefined behavior](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf)
- [DWARF Debugging Information Format Version 5](https://dwarfstd.org/doc/DWARF5.pdf)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64)](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI)
