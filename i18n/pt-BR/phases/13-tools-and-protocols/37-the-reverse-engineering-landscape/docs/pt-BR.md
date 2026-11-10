# A paisagem de engenharia inversa: história, famílias de ferramentas e como é construído um decompiler

> Cinco ferramentas lêem o mesmo objeto e dão quatro endereços, três contagens de blocos e duas respostas para um interruptor, e esta lição constrói o arnes que mostra qual é qual.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, Java (one Ghidra script)
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~150 minutes

## Objetivos de aprendizagem

- Coloque as principais ferramentas do campo numa linha de tempo datada de 1973 a 2026 e nomeie a família a que cada uma pertence.
- Nomear os oito estágios de um decompiler e o termo que Ghidra, Binary Ninja, Hex-Rays, radar2, rizin e angr usam para cada etapa.
- Levante uma instrução para ESIL, RzIL, código P e VEX e explique quais deles escrever bandeiras com entusiasmo e quais armazenar um tronco.
- Reduzir os endereços de cinco ferramentas para um `.text`O valor de uma função é igual ou superior a um valor de uma função.
- Construa um arame de comparação que leia as saídas capturadas da ferramenta e relata acordo sobre inicialização de instruções, blocos, bordas e inicialização de funções.
- Nome, a partir de evidências capturadas, onde cada ferramenta inventa código, perde código ou para em um salto indireto.

## O problema

Pede a um agente que resuma o que três ferramentas de engenharia inversa dizem sobre .`grade`em `ledger-x86_64-O1.o`O agente executa cada ferramenta, lê três listas e informa que a função está em `0x08000050`num único instrumento, `0x400010`em outro, e `0x100010`A conclusão é que as ferramentas discordam sobre onde está a função.

As ferramentas concordam. O objeto é realojável e não tem endereço de carga, então cada ferramenta escolhe um. Subtrair o endereço dado por cada ferramenta `.text`E cada resposta é:`0x10`O agente comparou endereços brutos porque nada lhe disse o que significava o endereço em cada ferramenta.

Mais tarde , o mesmo agente diz:`grade`No`-O0`construção e relatos 3, 8, 8 e 9 blocos básicos de quatro ferramentas.`jmp rax`Duas ferramentas lêem a mesa de salto através de suas mudanças. Uma ferramenta divide um bloco no salto para colocar um rótulo. Uma contagem de blocos sem a razão por trás dele é um número sem reivindicação.

Esta lição é o mapa que precisas antes de confiar em qualquer um desses números. Lições 32 a 36 construíram um decodificador, um elevador, um registro de evidências e um reconstruir. A segunda metade da pista coloca-os ao lado das ferramentas que as pessoas usam. Para isso, precisamos da história do campo, das famílias nas quais as ferramentas se enquadram, do pipeline que cada decompilador executa e de um arnes que compara o que as ferramentas dizem sobre objetos que você compilou.

```figure
re-37-field-map
```

## Cinquenta e três anos em passos datados

O campo é mais antigo do que a maioria das suas ferramentas.

### 1973 a 1991: primeiro depuradores, depois desmontagens

As primeiras teses de decomposição são de 1973. Hollander em Stanford e Housel em Purdue escreveram-nas, e ambas são conhecidas hoje através de citações.`adb`O tutorial foi lançado no Bell Labs em 1977, e o depurador foi lançado com o UNIX V7 em 1979.`DEBUG`O software foi lançado em agosto de 1981 no PC-DOS 1.00, com um desmonteador 8086, e o GDB de Richard Stallman entrou em distribuição em 1986.

Os desmontagens de lote vieram em seguida. Sourcer, da V Communications em 1988, executou várias passagens sobre um programa DOS e escreveu uma lista com comentários.`objdump`O IDA foi publicado em 1 de Janeiro de 1991 e foi lançado em 20 de Maio de 1991 como shareware.

### 1991 a 2009: desmontagens interativas e os primeiros desmontagens

Cristina Cifuentes terminou "Técnicas de Compilação Reversa" na QUT em julho de 1994.`dcc`O programa de decompilagem de dados dos computadores de computador, o REC, levou os programas i80286 DOS para o C, e seu artigo de 1995 com Gough estabeleceu as fases que todos os mais tarde decompiladores manteve.

O IDA tornou-se um produto comercial no DataRescue em 1996, ganhou um plugin SDK em 1999, e mudou-se para Hex-Rays, fundada em 2005. O Hex-Rays Decompiler 1.0 foi lançado em 17 de setembro de 2007. No mesmo ano, Mike Van Emmerik apresentou "Asignação única estática para a descompilação", a tese que colocou a SSA no centro do fluxo de dados do decompilador. A "Comparação estrutural de objetos executáveis" de Halvar Flake (2004) iniciou a família diferencial, e BinDiff foi à venda em agosto de 2004.

Radare começou em fevereiro de 2006 como um editor de hex forense com offsets de 64 bits. Radare2, a reescritura modular sob LGPL-3.0, foi lançada pela primeira vez em 7 de março de 2009.

### 2009 a 2019: quadros e representações intermediárias

LLDB foi anunciado como um subprojeto LLVM em 8 de junho de 2010. BAP, a plataforma de análise binária com sua linguagem intermediária BIL, apareceu no CAV 2011.

O artigo Phoenix (Schwartz, Lee, Woo, Brumley, USENIX Security 2013) mostrou uma estruturação semântica-preservadora com 40 `goto`DREAM (Yakdan e outros, NDSS 2015) removido o `goto`Declarações com estruturação independente de padrões. O Vector 35 foi fundado em 14 de janeiro de 2015, e Binary Ninja foi lançado na venda em 23 de julho de 2016 com seu IL de baixo nível e uma API Python. Angr foi lançado publicamente em 2015 e ficou em terceiro lugar no DARPA Cyber Grand Challenge em agosto de 2016. BinDiff tornou-se gratuito em março de 2016. O Cutter 1.0 deu ao radar2 uma interface gráfica Qt em dezembro de 2017. Em 2018, Guilfanov apresentou "Decompiler internals: microcode" no Recon, a primeira descrição pública do Hex-Rays IR.

### 2019-2026: decompiladores abertos e a reviravolta da investigação

Ghidra 9.0 foi lançado pela NSA na Conferência RSA em 5 de março de 2019 sob Apache-2.0, com fonte completa no GitHub um mês depois. No mesmo ano, o angr 8.19.2.4 adicionou um decompilador preliminar. Binary Ninja 2.0 lançou seu decompilador de IL de alto nível em 20 de maio de 2020. Rizin foi anunciado como uma garrafa do radar2 em 8 de dezembro de 2020, e a equipe de Cutter mudou-se para ele. O IDA Freeware 7.6 adicionou um decompilador x64 em nuvem em maio de 2021.

BinDiff 8 foi lançado em código aberto sob Apache-2.0 em 25 de setembro de 2023. SAILR (Basque e outros, USENIX Security 2024) tornou-se o estruturador padrão da angr e argumentou que apenas falso `goto`As instruções devem ser removidas, porque o Linux 6.1 tem 3.754 deles em sua fonte. Binary Ninja 4.0 adicionou uma edição gratuita em fevereiro de 2024, e IDA 9.0 adicionou `idalib`Os trabalhos de decompilador aprendidos vão desde SLaDe (2023) até LLM4Decompile (2024) até DecompileBench (2025) e dois estudos de 2026 sobre legibilidade assistida por agentes e sobre decompiladores que recompilam mais e conservam menos.

As versões executadas nesta aula são as atuais em 14 de outubro de 2026: Ghidra 12.1.4 (21 de setembro de 2026), radare2 6.2.4 (5 de outubro de 2026), rizin 0.9.1 (29 de junho de 2026), e angr 10.0.3 (10 de outubro de 2026). Binary Ninja 6.0 "Krypton" (3 de setembro de 2026) e IDA 9.4 (13 de julho de 2026) são as atuais ferramentas fechadas. Esta aula não as executou.

## As Famílias de Ferramentas

Uma ferramenta pertence a uma família pelo que produz, as famílias se sobrepõem num programa e a sobreposição é onde começa a maior confusão.

### Desmontadores

Um descolagem linear decodifica o primeiro byte de uma seção de código até o último. GNU `objdump -d`E ...`llvm-objdump -d`funciona desta forma, e nenhum deles constrói um gráfico de fluxo de controle.`objdump`Trata símbolos como limites de instruções e varrer entre eles. binutils 2.47 (26 de julho de 2026) é GPL-3.0 ou posterior. LLVM 23.1.3 é Apache-2.0 com a exceção LLVM.`llvm-objdump`como "Apple LLVM versão 17.0.0", e essa é a cópia desta lição capturada.

Um desmonte interativo executa descida recursiva de entradas conhecidas, adiciona heurísticas para inicialização de funções e mantém um banco de dados.`Disassembler`Além dos analistas de Análise Automática), Ninja Binário (descende recorrente, depois varredura linear sobre regiões desconhecidas), Hopper, radar2 e rizin (`aa`- Não .`aaa`- Não .`af`O sistema de instrução foi usado para medir a precisão de instruções, e o sistema de iniciação foi usado para iniciar funções, com taxas falsas negativas de 20% ou mais.

### Decompiladores

Descompiladores comerciais: o Hex-Rays Decompiler (doze famílias alvo de x86 a RISC-V), HLIL do Binary Ninja com sua versão Pseudo C e visão de pseudo-código de Hopper. Descompiladores abertos: o Ghidra decompilador, um motor C++ sob Apache-2.0 que r2ghidra e rz-ghidra reutilizam como um plugin e que o pypcode reutilizam como um elevador; o angr decompilador em AIL com SAILR estruturando sob BSD-2-Clause; r2dec e jsdec em JavaScript; Boomerang e `dcc`O radar2 também tem um sistema de controlo integrado.`pdc`O comando "Descompiler" não tem um decompiler embuído.`pdc`não existe na rizina 0.9.1, e `pdg`precisa do plugin RZ-Gidra.

### Desembaraçadores

GDB (1986) com o GEF e pwndbg front-end, LLDB (2010), WinDbg com Time Travel Debugging (2017), OllyDbg (congelado em 2014), x64dbg (GPL-3.0, 2014), o Ghidra Debugger com seus conectores Python, o Binary Ninja debugger e os debuggers incorporados de radar2 e rizin.

### Estruturas de análise binária

Angr (VEX IR, execução simbólica, `CFGFast`E ...`CFGEmulated`, decompiler), BAP (BIL, OCaml), Dyninst, Jakstab e ByteWeight são as estruturas que Andriesse nomeou.`import binaryninja`, e a IDA através de `idalib`- Não .

### Formatos e bibliotecas de motores

LIEF 1.0.0 (12 de julho de 2026, Apache-2.0) paralisa ELF, PE, Mach-O, COFF e os formatos Android. CLE, "CLE Loads Everything", é o carregador de angr. Capstone 5.0.9 (28 de maio de 2026, BSD-3-Clause) decodifica; Keystone 0.9.2 (GPL-2.0) conjuntos; Unicorn 2.1.4 (GPL-2.0) emula. radare2 6.2.4 conjuntos Capstone 5, e rizin 0.9.1 fornecedores Capstone, Zydis, e árvore-servidor.

### Ferramentas de diff e visualizadores do lado do compilador

BinDiff 8 (Apache-2.0) com o seu BinExport 12 plugin para IDA Pro, Binary Ninja e Ghidra; Diaphora 3.4.3 (11 de outubro de 2026, AGPL-3.0) como um plugin IDA; `radiff2`E ...`rz-diff`O Compilador Explorer (BSD-2-Clause) mostra a montagem que um compilador emite para um fragmento fonte, que é a direção para a frente de tudo o resto nesta lista.

### Versões, licenças e o que esta lição foi

| Tool | Version read on 2026-10-14 | Licence | Headless entry | Ran here |
|---|---|---|---|---|
| Ghidra | 12.1.4 | Apache-2.0 | `analyzeHeadless`, `pyghidra.start()` | yes, on all four objects |
| radare2 | 6.2.4 | LGPL-3.0 | `r2 -qc '<cmds>' file`, `rabin2` | yes |
| rizin | 0.9.1 | LGPL-3.0 | `rizin -qc '<cmds>' file`, `rz-bin` | yes |
| angr | 10.0.3 | BSD-2-Clause | `angr.Project` in Python | yes |
| llvm-objdump | Apple LLVM 17.0.0 | Apache-2.0 with LLVM exception | `llvm-objdump -d -r` | yes |
| Binary Ninja | 6.0 "Krypton" | commercial; Free edition for non-commercial use | `binaryninja.load()` with a Commercial, Ultimate, or headless licence | no, documentation only |
| IDA Pro | 9.4 | commercial subscription; IDA Free for non-commercial x86 and x86-64 | `idat`, `ida -A -S`, `idalib` | no, documentation only |
| Hopper | 6.6.0 | commercial, perpetual | none documented | no, documentation only |
| Cutter | 2.5.0 | GPL-3.0 | GUI over rizin | no |

A edição gratuita do Binary Ninja decompilou apenas x86, x86-64, ARMv7 e AArch64 e não tem API.`idalib`Cada declaração sobre essas duas ferramentas nesta lição vem de sua documentação e notas de lançamento, e a figura marca-os como não executados.

## O oleoduto de decompilhação, etapa a etapa

Cifuentes nomeou as fases em 1994: análise de sintaxe, análise semântica, geração de código intermediário, geração de gráficos de fluxo de controle, análise de fluxo de dados, análise de fluxo de controle e geração de código. Ela dividiu-os em uma parte frontal dependente da máquina, uma parte central independente da máquina e da língua e uma parte traseira dependente da língua. Todos os decompiladores desde então mantêm essa forma e renomeam as peças. A tabela abaixo apresenta as oito etapas utilizadas nesta lição e o nome dado a cada ferramenta. A figura mostra a mesma tabela com as colunas de ferramentas selecionáveis.

| Stage | Ghidra | Binary Ninja | Hex-Rays / IDA | radare2 | rizin | angr |
|---|---|---|---|---|---|---|
| Loader | `ElfLoader`, `MachoLoader`, `PeLoader`; `.ldefs` picks the language | `BinaryView`, `BinaryViewType` | loader module (`LDSC`) | RBin (`rabin2`) | RzBin (`rz-bin`) | CLE (`cle.Loader`, `main_object`) |
| Disassembly | `Disassembler`; SLEIGH `.slaspec` compiled to `.sla`; analyzers "Disassemble Entry Points", "Function Start Search" | architecture plugin; Recursive Descent, then linear sweep phases | processor module (`ana.cpp`, `emu.cpp`, `out.cpp`); autoanalysis queues; FLIRT | RArch plugin to `RAnalOp`; `aa`, `aaa`, `af` | RzAnalysis plugin; `aa`, `aaa`, `af` | Capstone blocks; `CFGFast` function start search |
| CFG recovery | "Generate Basic Blocks and the CFG"; `BlockGraph`; "Decompiler Switch Analysis" | `Function`, `BasicBlock`; "Control Flow Graph (CFG) Analysis" phase | `mbl_graph_t`, ready at `MMAT_LOCOPT` | `afb`, `agf`, `aab` | `afb`, `agf`, `aab` (Nucleus) | `CFGFast`, `CFGEmulated`; `kb.functions`; IRSB |
| Lifting | "Generate Raw P-code"; Varnodes in `ram`, `register`, `const`, `unique` | Lifted IL, LLIL, Mapped MLIL, MLIL | microcode (`minsn_t`, `mop_t`); `MMAT_GENERATED` | ESIL (`asm.esil`, `ae`) | RzIL (`aoi`, `aez`) | VEX (`pyvex.lift`, IRSB), then AIL |
| SSA | `Heritage`, `ActionHeritage`; `MULTIEQUAL`, `INDIRECT` | LLIL SSA, MLIL SSA, HLIL SSA; `HLIL_VAR_PHI` | no named SSA; use-def data flow in `MMAT_GLBOPT1` to `3` | none; ESIL is built for emulation | none; RzIL is built for emulation | `_stage_transform_to_ssa_level0` and `level1`; `SeqNodeDephication` |
| Data flow and types | `ActionDeadCode`, `ActionInferTypes`, the `Rule` pool; prototype from `.cspec` | MLIL constant propagation, variables and types; `analyzeReturns` | "Transform microcode"; `MMAT_CALLS`, `MMAT_GLBOPT`, `MMAT_LVARS`; TIL | `afv`, `afc`, `aaft`; ESIL emulation | `afv`, `afc`, `aft` | `CallingConventionAnalysis`, `VariableRecoveryFast`, `Typehoon` |
| Structuring | `CollapseStructure`; `BlockIf`, `BlockWhileDo`, `BlockSwitch`, `BlockGoto` | `HLIL_IF`, `HLIL_WHILE`, `HLIL_SWITCH`; AST at `root` | "Generate ctree"; structural analysis; goto regions | `pdc`; `pdd` (r2dec); `pdg` (r2ghidra) | `pdg` (rz-ghidra); jsdec | `RegionIdentifier`; `RecursiveStructurer` with `SAILRStructurer` |
| Emission | "Emit Final C Tokens"; `PrintC`, `ActionNameVars`, `ActionSetCasts` | HLIL rendering; Pseudo C, Pseudo Rust, Pseudo Python | "Beautify ctree; Print ctree"; `cfunc_t` | text of `pdc`, `pdd`, `pdg` | `pdg` text | `CStructuredCodeGenerator`; `codegen.text` |

### Carregador

O carregador analisa o recipiente, mapeia seções e lê símbolos e relocalizações. Em um objeto relocable nada tem um endereço ainda, então o carregador escolhe um.`0x08000000`, que coloca`.text`- Não .`0x08000040`porque a seção começa em arquivo de compensação `0x40`- Câmara de Educação .`.text`- Não .`0x400000`- Ghidra's.`ElfLoader`coloca-o em`0x100000`- Não .`llvm-objdump`Impressões de deslocamento de secção e nenhuma base.

Os carregadores também diferem em relação às realocações. A Ghidra as processa à importação e a CLE as aplica.`bin.relocs.apply=true`O que um carregador faz com as transferências decide o que cada etapa posterior pode ver, e você vai encontrar o efeito na`-O0`Salta a mesa abaixo.

### Desmontagem

A lição 33 construiu ambos os métodos.`llvm-objdump`executa descida recursiva e, em seguida, adiciona uma busca para função começa. A documentação do Binary Ninja nomeia as fases em ordem: Descenso Recursivo, Análise de Alvo de Chamadas, Análise CFG como "desmontagem linear das regiões desconhecidas" e Análise de Chamadas de Cauda. Ghidra executa seus analisadores por prioridade, com "Desmontar Pontos de Entrada" e "Função Começar Pesquisa" cedo. A IDA mantém filas de autoanálise, cada uma com prioridade, e assinaturas FLIRT para código da biblioteca. O Angr's `CFGFast`O documento apresenta quatro fontes de função inicia: símbolos, uma varredura de prólogo, alvos de chamada e uma varredura completa dos restantes bytes.

### Recuperação de CFG

Cada ferramenta corta blocos da maneira que a lição 33 fez, com uma diferença que você vai medir.`call`O IRSB é um bloco de entrada única e saída múltipla e uma chamada é uma saída.`grade_label`- Não .`-O0`, que chama`grade`O relatório de 2 blocos e os outros três relatórios 1.

### Levantamento

O binário Ninja define elevação como "tradução de uma linguagem de nível inferior para uma linguagem intermediária considerada superior". Os IRs diferem no que são para. O código P e o VEX foram construídos para análise e descompilação. O ESIL e o RzIL foram construídos para emulação, e nenhum deles tem um estágio SSA. O microcódulo Hex-Rays começa como código RISC com 72 opcodes e passa por níveis de maturidade a partir de `MMAT_GENERATED`- Não .`MMAT_LVARS`. Binary Ninja eleva para Lifted IL, então dobra as bandeiras em condições em LLIL, e MLIL "traduz registros e acessos de memória em variáveis".

### SSA

A tese de Van Emmerik lista o que a SSA compra um decompilador: propagação de expressões, parâmetro e identificação de retorno sem uma suposição de ABI, análise de preservação, análise de tipo como um problema de fluxo de dados escasso e análise de saltos e chamadas indiretas.`Heritage`e adiciona duas operações que existem apenas no gráfico,`MULTIEQUAL`para o phi e`INDIRECT`O Ninja Binário expõe um formulário de SSA em todos os níveis de IL.`Clinic`O Hex-Rays não nomeia um formulário SSA e utiliza o fluxo de dados de def em seus passes de otimização global.

### Fluxo e tipos de dados

O principal ciclo de simplificação do Ghidra é "Eliminar Código Morto", "Propagar Tipos Locais" e "Reescrever Termo" até que nada mude, com a reescritura feita por um conjunto de `Rule`Hex-Rays transforma o microcódulo, detecta os argumentos de chamada em`MMAT_CALLS`, e atribui variáveis locais em `MMAT_LVARS`. Angr runs `CallingConventionAnalysis`- Não .`VariableRecoveryFast`, e `Typehoon`A lição 41 é sobre esta fase.

### Estruturação

Ghidra's `CollapseStructure`O sistema de correlação de dados com a estrutura de um sistema de correlação de dados é um sistema de correlação de dados com a estrutura de dados.`if`- Não .`while`- Não .`do`, e `switch`O Angr identifica as regiões de entrada única e de saída única e as estruturas com `SAILRStructurer`por defeito, com `PhoenixStructurer`E ...`DreamStructurer`A lição 34 foi escrita por um estruturador à mão.

### Emissão

Ghidra emite tokens C através de `PrintC`com uma impressora Oppen bonita depois `ActionNameVars`E ...`ActionSetCasts`O Hex-Rays enfeita e imprime o ctree. Binary Ninja faz HLIL como Pseudo C, Pseudo Rust ou Pseudo Python.`codegen.text`. Impressões de radar2`pdc`- Não .`pdd`, ou `pdg`- Não .

## Uma instrução em quatro IRs

- Toma .`48 83 ec 10`- Não .`subq $0x10, %rsp`Decodifica-o em papel com as regras da lição 33.

1. `48`é REX com `W = 1`O operando é de 64 bits.
2. `83`é o grupo-1 opcode aritmético com um imediato de 8 bits.
3. `ec`é ModRM `11 101 100`- Não .`mod = 11`é o formulário do registo. `reg = 101`É o que é`/5`, que é `sub`- Não .`r/m = 100`É o que é`%rsp`- Não .
4. `10`É o imediato, 16.

Quatro levantadores receberam os quatro bytes, os aparelhos contêm os comandos exatos e o texto completo.

O ESIL do radar2 6.2.4 é uma cadeia separada por vírgula de 30 tokens:

```text
16,0x8000000000000000,-,!,16,rsp,-=,63,$o,^,of,:=,63,$s,sf,:=,$z,zf,:=,$p,pf,:=,64,$b,cf,:=,4,$b,af,:=
```

É uma máquina de pilhas.`16,rsp,-=`Subtraições em lugar. Cada bandeira é então escrita com um operador interno: `$o`sobreposição, `$s`O sinal,`$z`0`$p`Paridade, `$b`- Empréstimo.

O RzIL da rizina 0. 9. 1 é uma expressão S com 14 `set`efeitos:

```text
(seq (set op1 (var rsp)) (set op2 (bv 64 0x10)) (set sub (- (var op1) (var op2))) (set rsp (var sub))
     (set _result (var sub)) (set pf (! (lsb (let _val (cast 8 false (var _result)) ...))))
     (set zf (is_zero (var _result))) (set sf (msb (var _result))) ... (set cf (|| ...)) (set of (|| ...)) (set af (|| ...)))
```

Cada bandeira é uma expressão booleana sobre bitvectores.`let`- Não .

Código P da especificação SLEIGH `x86:LE:64:default`através do código pyp 4.0.1 é nove operações após o `IMARK`- Não .

```text
CF = RSP < 0x10
OF = sborrow(RSP, 0x10)
RSP = RSP - 0x10
SF = RSP s< 0x0
ZF = RSP == 0x0
unique[58300:8] = RSP & 0xff
unique[58400:1] = popcount(unique[58300:8])
unique[58500:1] = unique[58400:1] & 0x1
PF = unique[58500:1] == 0x0
```

Registrar transferências com temporários no `unique`As bandeiras são calculadas à instrução, ansiosamente, e`CF`E ...`OF`são calculados antes da subtração ser sobreescrevida `RSP`- Não .

O VEX de pyvex 10.0.3 é sete declarações após o `IMark`- Não .

```text
t2 = GET:I64(offset=48)
t0 = Sub64(t2,0x0000000000000010)
PUT(offset=144) = 0x0000000000000008
PUT(offset=152) = t2
PUT(offset=160) = 0x0000000000000010
PUT(offset=168) = 0x0000000000000000
PUT(offset=48) = t0
```

Não aparece bandeira. Os nomes VEX registam-se por sua compensação no estado de convidado, e a compensação 48 é `rsp`O valor de compensação 144 a 168 é `cc_op`- Não .`cc_dep1`- Não .`cc_dep2`, e `cc_ndep`O elevador armazena o código de operação 8, que é a subtração de 64 bits, e os dois operandos.`pcode.writesFlags`É verdade e `vex.computesFlags`O relatório do arnés é falso e o VEX é o mais curto dos quatro.

Os mesmos quatro elevadores .`48 63 c7`- Não .`movslq %edi, %rax`, a primeira instrução de `grade`- Não .`-O1`, dar 5 tokens ESIL (`32,edi,~,rax,=`), 1 RzIL `set`, 1 operação de código P (`RAX = sext(EDI)`O próprio Ghidra lista essa instrução, capturado através da escrita sem cabeça, imprime a mesma operação que `(register, 0x0, 8) INT_SEXT (register, 0x38, 4)`: registro de compensação 0 é `RAX`, compensação`0x38`É o que é`RDI`, e os tamanhos são 8 e 4 bytes.

`83 f9 04`- Não .`cmpl $0x4, %ecx`, do check-in das fronteiras .`grade`, dá 30 tokens ESIL, 13 RzIL `set`Os efeitos, 10 operações de código P e 7 declarações VEX com `cc_op`7, a subtração de 32 bits. Nada escreve.`%ecx`As duas largura de subtração que você encontrará no VEX são 7 para 32 bits e 8 para 64 bits, e o tradutor que você construir carrega essa tabela.

## Quatro bases de endereços para uma função

Antes que o arnes possa comparar qualquer coisa, ele tem que concordar com si mesmo sobre onde uma função está.`grade`em `ledger-x86_64-O1.o`- Não .

| Tool | Address of `.text` | Address of `grade` | Offset |
|---|---|---|---|
| `llvm-objdump` | `0x0` | `0x10` | `0x10 - 0x0 = 0x10` |
| radare2, rizin | `0x08000040` | `0x08000050` | `0x08000050 - 0x08000040 = 0x10` |
| angr | `0x400000` | `0x400010` | `0x400010 - 0x400000 = 0x10` |
| Ghidra | `0x100000` | `0x100010` | `0x100010 - 0x100000 = 0x10` |

A tabela de símbolos diz:`grade`Está em`.text + 0x10`Cada ferramenta concorda quando a base é removida.`iSj`em radare2 e rizin, o `.text`A entrada da secção na captura de angr, a `.text`Bloqueio de memória na captura de Ghidra, e zero para a varredura.`test_every_tool_places_grade_at_offset_0x10_from_its_own_base`corrige esse facto.

## Onde as ferramentas concordam e onde se dividem

O arame está dentro .`code/main.py`Leia as capturas, reduz todos os endereços e compara.

### O caso de acordo: livro-razão em -O1

Quatro funções, 56 instruções na varredura, 54 dentro dos símbolos e 2 no enchimento. Cada ferramenta relata a mesma instrução que começa em cada função: 9, 14, 13 e 18. Os quatro construtores de gráficos relatam 3, 3, 5 e 4 blocos e 2, 3, 5 e 4 bordas, e os conjuntos de bordas são idênticos, pares por pares, em radar2, rizin, angr e Ghidra. Os cinco blocos e cinco bordas de `total`São as que a lição 33 desenhou à mão.

A única diferença é no enchimento.`66 90`Depois`grade`- Não .`90`Depois`total`O que é mais importante é que o sistema de controlo de dados seja decodificado por um "sweep" que não tem razão para parar, e por um "angr", que cria uma "`sub_40003e`E ...`sub_40005f`Radar2, Rizin e Ghidra não reivindicam nenhum deles.

### O caso vectorizado: livro-razão em -O2

`total`O ciclo SSE2 e o ciclo residual escalar da lição 33 são cortados da mesma forma em todos os lugares. angr novamente adiciona duas funções no padding.

### A tabela de salto: grau em -O0

Aqui as ferramentas se dividem, e a divisão é a lição.

| Tool | Blocks | Edges | What the capture says |
|---|---|---|---|
| radare2 | 3 | 2 | the block at `0x62` has no successor; bytes `0x76` to `0x9a` are never reached; 8 instruction starts missing |
| rizin | 8 | 11 | the block at `0x62` carries a `switch_op` with 5 cases and 4 distinct targets |
| angr | 8 | 7 | the case blocks exist, and the transfer at `0x62` goes to an unresolvable target node |
| Ghidra | 9 | 12 | `switchD` label at `0x74` splits the block; four `COMPUTED_JUMP` flows to `0x76`, `0x7f`, `0x88`, `0x91` |

Os quatro decifraram as mesmas 33 instruções quando chegaram a elas.`jmp rax`E deixaram 36 bytes não reclamados, e os nomes do arneses que variam como código perdido. Rizin e Ghidra encontraram os quatro alvos distintos que a lição 33 leu das cinco realocações em `.rela.rodata`. Angr lista os blocos de caso dentro `grade`e ainda não tem vantagem do bloco de salto para eles; sua captura registra a transferência em `0x62`Como o que leva a um nó-alvo insolúvel, e seu decompiler imprimido um computador `goto`O Ghidra tem um bloco e uma borda mais do que a rizina para o mesmo fluxo de controlo porque a sua análise de interruptor colocou um rótulo no `jmp rax`e o modelo de bloco inicia um novo bloco num rótulo.

O gráfico lição-33 tinha 8 blocos e 11 bordas. rizin corresponde exatamente. O ponto é ver que 9 e 11 e 7 e 2 não são quatro medidas de código encontradas. São quatro respostas para o quão longe uma ferramenta seguiu um salto indireto e onde ele escolheu cortar.

### Dados em código: armadilha de varredura

`lookup`é 24 bytes com os 4 bytes da tabela `31 c0 90 48`- Não .`0x10`O arneses lista as suas diferenças da maioria: iniciações extras em`0x10`- Não .`0x12`, e `0x13`, e um começo perdido em `0x14`É o que eu quero .`addq $0x1, %rax`Radar2, Rizin e Ghidra relatam 6 começa, 2 blocos, 1 borda e sai `0x10`- Não .`0x14`Não reclamado. Angr informa os mesmos 2 blocos e 1 borda para `lookup`E depois invente .`sub_400010`na tabela bytes: 2 instruções em um bloco de 4 bytes que termina em `0x14`, onde o segundo bloco de `lookup`começa, então o byte REX em `0x13`A última descoberta do arnes para este objeto é que nenhum criador de gráficos decodifica.`0x10`- Não .`0x14`, então esses bytes estão dentro de uma função e são dados.

### Inventado e esquecido, por ferramenta

Em todos os quatro objetos, o arneses nomeia 9 funções que Angr inventa sem símbolo, cada uma na embalagem ou na mesa de armadilhas.`grade`- Não .`-O0`. Nomea 9 intervalos que o decodificador de varredura linear e nenhum criador de gráficos trata como código: os oito espaços de empolgação mais a tabela de armadilhas.

## Três Decompiladores em nota

Três das ferramentas capturadas emitem texto tipo C para `grade`- Não .`-O1`A fonte é:`switch (score / 10)`com cinco casos, compilados com base numa verificação dos limites e numa tabela de valores de devolução.

Ghidra 12.1.4:

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

Angr 10.0.3:

```c
extern unsigned int g_4000b4[4];

unsigned int grade(int a0)
{
    unsigned int v1;  // ecx
    unsigned int v2;  // eax

    v1 = (unsigned int)((long long)(a0 * 1717986919) >> 0x22) + (unsigned int)(a0 * 1717986919 >> 63) - 6;
    v2 = 0;
    if (v1 <= 4)
        v2 = g_4000b4[v1];
    return v2;
}
```

Radare2 6.2.4, `pdc`- Não .

```c
void sym.grade (int64_t arg1) {
    rax = edi
    rax = rax * 0x66666667
    rcx = rax
    rcx >>= 0x22
    rax >>>= 0x3f
    ecx += eax
    ecx += 0xfffffffa
    eax = 0
    v = ecx - 4
    if (((unsigned) v) <= 0) {
        eax = ecx
        rcx = rip
        eax = dword [rcx + rax*4]
    }
    return
}
```

Leia os três contra o pipeline.`0x66666667`e a mudança de 34 para o regresso`param_1 / 10`Angr levantou os mesmos bytes e deixou a aritmética como`a0 * 1717986919 >> 0x22`. radares2's `pdc`é emulação ESIL mais pseudo sintaxe: nomes de registros, nenhuma variável, nenhum tipo, e os limites de verificação impressos como `<= 0`Ghidra digita a carga da mesa através de uma subtração sem assinatura.`DAT_001000b4`; declarado `g_4000b4[4]`A Ghidra e o Angr não recuperaram a enumeração dos casos, porque em`-O1`Não há interruptor nos bytes.`-O0`, onde existe a mesa de salto, Ghidra impresso `switch(param_1 / 10)`com casos 6 a 10 e um padrão, e angr imprimido um computador `goto`- Não .

O rizin não tem um decompilador próprio, e os registos de captura que`pdc`O HLIL do Ninja Binário e o árvore Hex-Rays são as duas saídas que esta lição não conseguiu capturar.

## Construí-lo

Executa a demonstração:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
```

A saída é um relatório JSON. Abre com as versões de ferramentas gravadas no momento da captura e com as ferramentas presentes na sua máquina, que podem estar ausentes. Então, para cada um dos quatro objetos, ele dá as extensões do símbolo, as lacunas de enchimento, a base de cada ferramenta usada, a função inicia cada ferramenta encontrada ou inventada, e para cada função o acordo de inicialização de instrução, contagem de blocos, contagem de bordas e as bordas de cada ferramenta faltam. Conclui-se com a contabilidade de bytes por ferramenta, as próprias notas das ferramentas, uma lista de resultados em frases simples e a secção IR: a saída do tradutor para as três instruções ao lado das contagens medidas nos elevadores capturados.

Forma esperada:

```json
{
  "captureTools": {"llvm-objdump": "Apple LLVM version 17.0.0", "radare2": "radare2 6.2.4 ...", "rizin": "rizin 0.9.1 ...", "angr": "10.0.3", "ghidra": "12.1.4"},
  "localTools": {"radare2": "absent", "...": "..."},
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "bases": {"llvm-objdump": "0x0", "radare2": "0x8000040", "angr": "0x400000", "ghidra": "0x100000", "...": "..."},
      "functions": {"grade": {"blocks": {"radare2": 3, "rizin": 8, "angr": 8, "ghidra": 9}, "edges": {"radare2": 2, "rizin": 11, "angr": 7, "ghidra": 12}, "...": "..."}},
      "findings": ["radare2 never reaches bytes 0x76-0x9a inside grade that the other graph builders decode", "..."]
    }
  },
  "ir": {"translator": [{"text": "subq $0x10, %rsp", "flags": {"pcodeLike": "eager", "vexLike": "thunk"}, "...": "..."}], "observed": {"...": "..."}}
}
```

Leia `code/main.py`na ordem seguinte:

1. `read_text_symbols()`lê os cabeçalhos da secção e o `STT_FUNC`símbolos de `.text`A mesa de símbolos é a única verdade do arame.`TextSection.gaps()`deriva o enchimento dele.
2. `parse_objdump()`- Não .`parse_r2_family()`- Não .`parse_angr()`, e `parse_ghidra()`Cada um transforma uma captura em um `ToolView`A base, as instruções como compensação para o comprimento, e um `FunctionView`Cada parcer sabe o vocabulário de uma ferramenta e nada mais.
3. `majority()`E ...`ranges()`São os dois auxiliares, para que toda comparação se possa fazer?
4. `function_report()`compara instruções inicia contra a maioria dos construtores de gráficos, depois conta blocos, então define bordas e lista o que cada ferramenta carece.
5. `byte_report()`conta para cada byte como código dentro de um símbolo, empilhadeira, não reclamada, inventada ou perdida, e nomeia os bytes dentro de símbolos que nenhum criador de gráficos decodifica.
6. `findings()`transforma essas frases em frases, e`compare()`Reuni um relatório por objeto.
7. `decode_small()`- Não .`to_pcode_like()`, e `to_vex_like()`São os tradutores: três codificações em forma de registro, um estilo ansioso, um estilo de troca.
8. `observed_ir()`Medem os elevadores capturados e `figure_data()`As informações sobre o processo de desenvolvimento são fornecidas por um grupo de investigadores.

Existem mais três comandos.`python3 code/main.py compare FIXTURE.o`Imprime o relatório de um objeto. `python3 code/main.py ir 4883ec10`Imprime os dois formulários do tradutor para uma instrução. `python3 code/main.py figure-data`Imprime os dados incorporados na figura.

As capturas foram feitas uma vez por `code/fixtures/capture_tools.py`, que registra todos os comandos e versões em `captures.json`Se tiverem as ferramentas, executem o script de captura para atualizar os arquivos e lerem os equipamentos README para o ambiente de que necessita.

## Usá-lo

Use o cinto em um novo objeto nesta ordem.

1. Construir o objeto você mesmo e manter o comando do compilador. Ler a tabela de símbolos antes de abrir qualquer ferramenta, para que você saiba quantas funções existem e onde o revestimento está.
2. Capture cada ferramenta uma vez em modo sem cabeça. Armazenar a saída bruta e o comando exato ao lado do objeto. Uma discordância que você não pode ler novamente não é uma descoberta.
3. Verifique a base. Escolha uma função e confirme que cada ferramenta coloca-o no mesmo deslocamento depois de subtrair sua `.text`Se não tiver, pare e descubra o que a ferramenta carregou.
4. Se os construtores de gráficos discordam aqui, o resto da comparação é sobre decodificação e não sobre análise.
5. Comparar blocos e bordas e ler as notas de cada ferramenta antes de julgar uma contagem.`switch_op`, a `COMPUTED_JUMP`, ou um nó-alvo insolúvel explica a maioria das diferenças.
6. Conta para bytes. Padding que uma ferramenta afirma é uma heurística em trabalho. Bytes símbolo que uma ferramenta deixa é um passe parado. Bytes símbolo que nenhum criador de gráficos afirma são dados.
7. Uma descrição de documentação é útil e é um tipo diferente de evidência de uma captura.

## Laboratório Interativo

### Laboratório A: uma função, quatro bases

- Do`code`diretório, Python aberto:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/code
python3 -q
```

- Correr .

```python
from main import *
views = load_views("ledger-x86_64-O1.o")
{tool: hex(view.base) for tool, view in views.items()}
{tool: hex(view.functions["grade"].start + view.base) for tool, view in views.items()}
```

Escreva os quatro endereços brutos antes de executar a segunda linha e verifique-os contra a mesa nesta lição.`grade`com`grade_label`e calcular a mão onde fica em Ghidra.

### Lab B: a mesa de salto de quatro lados

```python
report = compare("ledger-x86_64-O0.o")
report["functions"]["grade"]["blocks"]
report["functions"]["grade"]["edgesMissingPerTool"]["radare2"]
report["notes"]["rizin"]
report["notes"]["ghidra"]
report["bytes"]["radare2"]["misses"]
```

Contar as bordas do radar 2 faltam e combinar cada uma com uma linha do `-O0`Depois, leia a nota Ghidra e encontre o`switchD`E a etiqueta na captura da Ghidra.

### Laboratório C: bandeiras ansiosas contra um tronco

```python
translate("48 83 ec 10")["pcodeLike"]
translate("48 83 ec 10")["vexLike"]
translate("83 f9 04")["vexLike"]
{row["name"]: (row["pcode"]["ops"], row["vex"]["statements"]) for row in observed_ir()["instructions"]}
```

Encontrar o`cc_op`constante em ambas as saídas e explicar por que um é 8 e o outro 7. Então tente`translate("48 01 c8")`e ler o `TranslateError`- Não .

### Laboratório D: a armadilha sob cinco ferramentas

```python
report = compare("sweep-trap.o")
report["functions"]["lookup"]["instructionStarts"]
report["bytes"]["dataInsideSymbols"]
report["functionStarts"]["angr"]
```

Descifrar os bytes `31 c0 90 48 83 c0 01`No papel como uma varredura, depois como uma descida, depois do`jmp`Combine as duas listas com o extra e começa a falta dos relatórios de arneses.

## Laboratório de Prática

Adicione uma quinta captura e estenda o arame.

Requisitos:

- Escolha uma ferramenta que esta lição não capturou e que você pode executar em sua máquina: GNU `objdump`, LIEF com Capstone, uma sessão Binary Ninja Free exportada à mão, ou Ghidra com um conjunto de analisadores diferente. Capture sua saída em todos os quatro objetos com o comando exato e versão em `captures.json`- Não .
- Escreva um parser que transforma a captura em um `ToolView`com a base da ferramenta, instruções, funções, blocos onde a ferramenta tem-los, e bordas onde ela os tem.
- Adicionar a ferramenta para `TOOLS`e, se ele constrói um gráfico, para `DESCENT_TOOLS`Exerce a demonstração e leia o que mudou nos conjuntos majoritários.
- Escreva um teste que afirme que o bloco da ferramenta conta `ledger-x86_64-O1.o`E um teste que afirma o que faz com a mesa da armadilha.
- Escreva um parágrafo para a lição que diz, em palavras próprias da ferramenta, o que ela chama de carregador, desmontador e CFG.

O sucesso significa`python3 code/main.py`Relatório da nova ferramenta em `captureTools`, cada função em `ledger-x86_64-O1.o`- Não .`allDescentToolsAgree`A Comissão propõe que a Comissão adopte um novo regulamento que estabelece as regras de concorrência.`sweep-trap.o`Diga o que a nova ferramenta fez com bytes `0x10`- Não .`0x14`- Não .

## Lição Artifacto

Esta lição inclui `outputs/skill-the-reverse-engineering-landscape.md`Use-o para executar várias ferramentas em um objeto que você construiu, reduzir seus endereços para uma base e relatar, por função, onde eles concordam sobre inicialização de instruções, blocos e bordas, e que bytes cada ferramenta inventa ou omite.

## Verifique

Execute a demonstração e a suíte determinista:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

A verificação deve provar:

- O leitor ELF encontra quatro símbolos de função em `ledger-x86_64-O1.o`com tamanhos 16, 46, 31 e 63, e duas lacunas de enchimento
- As capturas de varredura contêm instruções 86, 56, 84 e 11 para os quatro objetos
- Radare2 e rizin relatam as mesmas instruções, blocos e bordas em `ledger-x86_64-O1.o`, e só o radar2 tem`pdc`texto
- Marcas de angr`sub_40003e`E ...`sub_40005f`como funções sem símbolo
- Os blocos de Ghidra para `total`são os cinco blocos da lição 33 e seus fluxos de chamada não são bordas de gráfico
- Todos os instrumentos são colocados.`grade`em compensação`0x10`após a remoção da base
- Cada ferramenta concorda em cada instrução de início em cada função de `ledger-x86_64-O1.o`
- Os quatro construtores de gráficos relatam blocos 3, 3, 5, 4 e 2, 3, 5, 4 bordas ali, com conjuntos de bordas idênticos
- `total`- Não .`-O2`Tem 10 blocos e 13 bordas em cada constructor de gráficos
- `grade`- Não .`-O0`tem 3, 8, 8 e 9 blocos e 2, 11, 7 e 12 bordas em radar2, rizin, angr e Ghidra, com as razões nas notas de cada ferramenta
- `grade_label`- Não .`-O0`é um bloco em todos os lugares, exceto angr, que termina um bloco na chamada
- Angr inventa uma função por abertura de engarrafamento mais uma na mesa de armadilhas, e nenhuma outra ferramenta inventa ou perde uma função
- Os ganhos da varredura começam .`0x10`- Não .`0x12`- Não .`0x13`E perde .`0x14`Na armadilha, e nenhum criador de gráficos decodifica.`0x10`- Não .`0x14`
- Os resultados indicam o intervalo perdido em radar2 e todas as funções inventadas em angr
- O manifesto registra uma versão e um comando para todos os 21 arquivos de captura
- 3 ferramentas de decomposição `grade`, e só Ghidra dobrar a linguagem divisão
- O tradutor escreve CF, OF, SF, ZF, PF com entusiasmo num estilo e num `cc_op`O outro não escreve nenhum registro.`cmp`, e sem bandeira para `movslq`
- O tradutor recusa formulários de memória, outros opcodes, bits REX extras e comprimentos errados
- O tradutor `cc_op`Os números 8 e 7 são iguais aos do VEX capturado
- Os elevadores capturados apresentam 9, 1, 10 operações de código P e 7, 4, 7 declarações VEX para as três instruções
- A linha de tempo vai de 1973 a 2026 em ordem, o pipeline tem oito etapas e seis ferramentas com um termo em cada célula, e as duas ferramentas fechadas são marcadas como não executadas
- A figura interativa incorpora os mesmos dados que o arame produz

## Modos de falha de produção

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Raw addresses from different tools | "the tools disagree about where grade is" | one offset after each base is removed, checked on one function |
| Block count as a measure of code found | "Ghidra found the most code" | the same instruction starts, with the extra block explained by a label |
| One tool as the oracle | "objdump shows the table bytes are instructions" | the sweep is a linear sweep; three graph builders leave the bytes unclaimed |
| Padding functions counted as discoveries | "angr found seven more functions" | every one sits in a padding gap or on data, and none has a symbol |
| A stopped walk reported as dead code | "the four case blocks are unreachable" | 36 bytes missed by one tool and reached by three |
| Edge counts compared without the notes | "rizin and Ghidra disagree on grade" | the same four computed targets, one extra split at a label |
| A decompiler's arithmetic read as the program | "the function multiplies by 1717986919" | the idiom from lesson 34, folded by one tool and left by another |
| A closed tool described as if run | "Binary Ninja reports five blocks" | the figure and the table mark it as documentation only |
| Captures without commands | "we ran radare2" | the manifest with version, command, and date for every file |
| An IR with no flags read as a lossy lift | "VEX dropped the flags" | the thunk in `cc_op`, `cc_dep1`, `cc_dep2`, evaluated at the branch |

## Regra de funcionamento

Capture cada ferramenta uma vez com seu comando e versão, reduzir cada endereço a uma base, e comparar instruções começa antes de blocos e blocos antes de bordas. Conta para cada byte como reivindicado, padding, dados, ou perdido. Leia a própria nota de uma ferramenta antes de julgar sua contagem, e diga quais ferramentas você só lê sobre.

## Mais leitura

- [Cifuentes, "Reverse Compilation Techniques", PhD thesis, QUT (1994)](https://eprints.qut.edu.au/36820/)
- [Cifuentes and Gough, "Decompilation of Binary Programs", Software: Practice and Experience (1995)](https://doi.org/10.1002/spe.4380250706)
- [Van Emmerik, "Static Single Assignment for Decompilation", PhD thesis, University of Queensland (2007)](https://espace.library.uq.edu.au/view/UQ:158682)
- [Schwartz, Lee, Woo, Brumley, "Native x86 Decompilation Using Semantics-Preserving Structural Analysis and Iterative Control-Flow Structuring" (USENIX Security 2013)](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Yakdan et al., "No More Gotos" (NDSS 2015)](https://www.ndss-symposium.org/ndss2015/ndss-2015-programme/no-more-gotos-decompilation-using-pattern-independent-control-flow-structuring-and-semantics/)
- [Basque et al., "Ahoy SAILR! There is No Need to DREAM of C" (USENIX Security 2024)](https://www.usenix.org/conference/usenixsecurity24/presentation/basque)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Flake, "Structural Comparison of Executable Objects" (DIMVA 2004)](https://dl.gi.de/items/7f573931-cb51-49ef-a12c-0452a9fb0ea4)
- [Maranzano and Bourne, "A Tutorial Introduction to ADB", Bell Labs (1977)](http://squoze.net/UNIX/v7/files/doc/18_adb.pdf)
- [Stallman, KTH lecture on GDB entering distribution (30 October 1986)](https://www.gnu.org/philosophy/stallman-kth.html)
- [Hex-Rays, "IDA: celebrating 30 years of binary analysis innovation"](https://hex-rays.com/blog/ida-celebrating-30-years-of-binary-analysis-innovation)
- [Guilfanov, "Decompiler internals: microcode", Recon Brussels 2018 (slides)](https://www.recon.cx/2018/brussels/resources/slides/RECON-BRX-2018-Decompiler-internals-microcode.pdf)
- [Hex-Rays, microcode view and maturity levels](https://docs.hex-rays.com/core/decompiler/how-tos/microcode-view)
- [Hex-Rays, IDA 9.4 release notes](https://docs.hex-rays.com/release-notes/9_4)
- [Hex-Rays, IDA Free](https://hex-rays.com/ida-free)
- [Ghidra releases (12.1.4)](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Ghidra P-code reference](https://github.com/NationalSecurityAgency/ghidra/blob/master/GhidraDocs/languages/html/pcoderef.html)
- [Ghidra decompiler source, main work flow and Action classes](https://github.com/NationalSecurityAgency/ghidra/tree/master/Ghidra/Features/Decompiler/src/decompile/cpp)
- [Ghidra analyzeHeadless README](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/RuntimeScripts/support/analyzeHeadlessREADME.md)
- [Binary Ninja, BNIL overview](https://docs.binary.ninja/dev/bnil-overview.html)
- [Binary Ninja, "Architecture Agnostic Function Detection in Binaries" (2017)](https://binary.ninja/2017/11/06/architecture-agnostic-function-detection-in-binaries.html)
- [Binary Ninja, batch processing and headless licences](https://docs.binary.ninja/dev/batch.html)
- [Binary Ninja 6.0 "Krypton" release post](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [Binary Ninja Free](https://binary.ninja/free/)
- [radare2 book, ESIL](https://book.rada.re/emulation/esil.html)
- [radare2 book, decompilers](https://book.rada.re/arch/decompile.html)
- [radare2 releases (6.2.4)](https://github.com/radareorg/radare2/releases)
- [rizin, RzIL design notes](https://github.com/rizinorg/rizin/blob/dev/doc/rzil.md)
- [rizin releases (0.9.1)](https://github.com/rizinorg/rizin/releases)
- [Announcing Rizin (8 December 2020)](https://rizin.re/posts/announcing-rizin/)
- [Cutter releases (2.5.0)](https://github.com/rizinorg/cutter/releases)
- [angr documentation, CFG recovery](https://docs.angr.io/en/latest/analyses/cfg.html)
- [angr documentation, the decompiler and its analysis passes](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [angr documentation, intermediate representation (VEX)](https://docs.angr.io/en/latest/advanced-topics/ir.html)
- [angr on PyPI (10.0.3)](https://pypi.org/project/angr/)
- [pypcode on PyPI](https://pypi.org/project/pypcode/)
- [llvm-objdump command guide](https://llvm.org/docs/CommandGuide/llvm-objdump.html)
- [GNU objdump manual](https://sourceware.org/binutils/docs/binutils/objdump.html)
- [LIEF documentation](https://lief.re/doc/stable/index.html)
- [Capstone releases](https://github.com/capstone-engine/capstone/releases)
- [BinDiff releases (v8, open source)](https://github.com/google/bindiff/releases/tag/v8)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [Hopper Disassembler downloads](https://www.hopperapp.com/download.html)
- [Compiler Explorer](https://github.com/compiler-explorer/compiler-explorer)
- [LLDB announced as an LLVM subproject (2010)](https://blog.llvm.org/2010/06/new-lldb-debugger.html)
- [Boomerang decompiler](https://boomerang.sourceforge.net/)
- [Tan et al., "LLM4Decompile" (EMNLP 2024)](https://aclanthology.org/2024.emnlp-main.203/)
- [Gao et al., "DecompileBench" (Findings of ACL 2025)](https://aclanthology.org/2025.findings-acl.1194/)
- [Liu, Raff, Micinski, "When LLM Decompilers Recompile More and Preserve Less" (2026)](https://arxiv.org/abs/2609.05370)
