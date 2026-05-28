# Designs de Auto-Aprimoramento Limitado

> A pesquisa convergiu em quatro primitivas para limitar um loop de auto-aprimoramento. Invariantes formais que devem valer em cada edição. Âncoras de alinhamento que não podem ser modificadas. Restrições multi-objetivo onde toda dimensão (segurança, justiça, robustez) deve valer, não apenas performance. Detecção de regressão que pausa o loop quando métricas históricas sugerem perda de capacidade. Nenhuma delas é uma prova de segurança — resultados de teoria da informação (complexidade de Kolmogorov, teorema de Löb) limitam o que qualquer sistema pode provar sobre seus próprios sucessores. São mitigações que elevam o custo de falhas silenciosas.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, loop limitado com verificação de invariante)
**Pré-requisitos:** Fase 15 · 07 (RSI), Fase 15 · 04 (DGM)
**Tempo:** ~60 minutos

## O Problema

O simulador de corrida da Aula 7 mostrou que pequenas diferenças de taxa se acumulam em grandes lacunas. O estudo de caso DGM da Aula 4 mostrou que loops podem ludibriar ativamente seus próprios avaliadores. Ambos os resultados apontam para a mesma questão de engenharia: que restrições você pode colocar em um loop de auto-aprimoramento para que não sejam silenciosamente enfraquecidas pelo próprio loop?

O resumo do RSI Workshop do ICLR 2026 (openreview.net/pdf?id=OsPQ6zTQXV) identifica quatro dessas primitivas. RSP v3.0 da Anthropic (Aula 19) e FSF v3 da DeepMind (Aula 20) referenciam ambas os limiares de capacidade. O trabalho HyperAgents da Meta e frameworks comunitários como SAHOO (março de 2026) implementam subconjuntos em produção.

O enquadramento honesto: essas são mitigações. Resultados de teoria da informação limitam o que qualquer sistema pode provar sobre seu próprio sucessor, e nenhum design atual fecha o problema formalmente. Um loop bem delimitado é mais seguro que um não delimitado, não seguro em termos absolutos.

## O Conceito

### Primitiva 1: invariantes formais

Um invariante é uma propriedade que deve valer antes e depois de cada auto-modificação. Exemplos:

- A distribuição de saída é condicionada em um cabeçalho constitucional fixo (Aula 17).
- Nenhuma chamada de ferramenta vai para um endpoint não autorizado.
- Escritas de memória passam por um caminho logado e assinado.
- O hash do módulo do avaliador corresponde à versão aprovada.

Invariantes são verificados por código externo que o loop não pode editar. Se uma modificação proposta violar um invariante, é rejeitada. Isso pega o modo de adulteração de avaliador no estilo DGM (Aula 4).

A parte difícil é escolher invariantes que são necessários para segurança e computáveis em tempo razoável. Sobreeespecificaçãoificar trava progresso; subeespecificaçãoificar deixa o loop passar por cima de propriedades importantes.

### Primitiva 2: âncoras de alinhamento

Uma âncora de alinhamento é uma representação imutável do objetivo central do loop, fixada fora da superfície de edição do loop. Exemplos:

- Um texto constitucional (Aula 17) que é carregado de uma localização somente-leitura em cada invocação.
- Um avaliador em um repositório separado com controle de acesso independente.
- Um manifesto de permissões de ferramenta assinado por um humano e re-verificado a cada ciclo.

O papel da âncora é prevenir deriva de objetivo. O loop pode melhorar como persegue o objetivo, mas não pode editar o que o objetivo é.

O modo de falha sutil: uma âncora que o loop não pode editar pode ser reinterpretada por um loop que deriva em como lê a âncora. Constitutional AI (Aula 17) é explicitamente baseada em raciocínio para lidar com situações novas; essa camada de raciocínio é onde a deriva de interpretação vive. Âncoras são necessárias, não suficientes.

### Primitiva 3: restrições multi-objetivo

Um loop que otimiza um único score escalar vai encontrar atalhos. Um loop que deve simultaneamente satisfazer múltiplas restrições rígidas tem menos atalhos disponíveis. Eixos típicos:

- Performance (benchmark a nível de tarefa)
- Segurança (avaliações red-team, taxa de recusa em conhecido-mau)
- Justiça (limites de impacto dispara em subgrupos sensíveis)
- Robustez (conjuntos de teste OOD, tratamento de entradas adversariais)

Uma modificação é aceita somente se cada restrição valer. O controlador de custo da Aula 13 empilha isso com restrições financeiras. Llama Guard da Aula 18 conecta como eixo de segurança.

### Primitiva 4: detecção de regressão

As pontuações de cada ciclo são comparadas contra distribuições históricas. Uma queda além da tolerância configurada pausa o loop. Isso pega perda silenciosa de capacidade que de outra forma seria absorvida na média corrente quando o loop "melhorou para além dela."

Implementação prática: armazenar as pontuações por tarefa dos últimos N ciclos. Cada ciclo novo calcula um delta por tarefa. Se qualquer delta cair abaixo de um limite, o ciclo é rejeitado e um humano revisa.

### Limites de teoria da informação

Complexidade de Kolmogorov e teorema de Löb estabelecem limites superiores no que um sistema pode provar sobre si mesmo. A Godel Machine formal de Schmidhuber (Aula 4) mirava o mais alto desses limites; ninguém completou uma prova não-trivial. O resultado de Löb diz: se um sistema acreditá provavelmente "farei X se provar que deveria fazer X," ele fará X sem provar que deveria, uma falha de auto-referência bem conhecida.

A implicação para nossas primitivas: elas não podem fechar o problema de segurança. Tornam falhas silenciosas mais caras. Um loop malicioso ou derivado que silenciosamente pularia uma verificação faltante agora precisa ativamente subverter uma explícita, o que é uma assinatura mais detectável.

### Um exemplo trabalhado

Suponha que um agente proponha uma edição. A stack de verificação:

1. Verificações de invariantes: hashes de módulo, manifesto de permissões de ferramenta, cabeçalho constitucional.
2. Verificação de âncora: declaração de objetivo corresponde à versão aprovada (byte a byte ou semanticamente).
3. Avaliação multi-objetivo: eixos de performance, segurança, justiça, robustez.
4. Detecção de regressão: nenhum eixo cai mais que a tolerância.

Os quatro devem passar para a edição ser aceita. Qualquer falha individual pausa o loop.

## Use

`code/main.py` roda um loop de auto-aprimoramento limitado no brinquedo DGM da Aula 4, mas com as quatro primitivas sobrepostas. Cada primitiva pode ser habilitada ou desabilitada individualmente. A demonstração é que cada primitiva pega uma classe eespecificaçãoífica de falha, e que remover qualquer uma delas deixa essa classe passar.

## Entregue

`outputs/skill-bounded-loop-review.md` audita um loop limitado proposto e pontua quais das quatro primitivas ele realmente implementa versus afirma implementar.

## Exercícios

1. Rode `code/main.py` com todas as primitivas habilitadas. Confirme que o loop ainda melhora na métrica principal sem deixar o hack vencer.

2. Desabilite a detecção de regressão. Construa uma entrada onde isso leva a perda silenciosa de capacidade ser aceita.

3. Desabilite a restrição multi-objetivo. Mostre o loop convergindo no eixo de performance enquanto um eixo de segurança cai.

4. Projete uma âncora de alinhamento para um agente de codificação. Que texto, armazenado onde, verificado como?

5. Leia o resumo do RSI Workshop do ICLR 2026. Escolha uma das quatro primitivas e proponha uma melhoria concreta sobre o estado da arte atual.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Invariante | "Propriedade sempre-verdadeira" | Uma propriedade verificada por código externo antes e depois de cada edição |
| Âncora de alinhamento | "Objetivo fixado" | Representação imutável do objetivo central fora da superfície de edição do loop |
| Restrição multi-objetivo | "Todos os eixos devem valer" | Performance, segurança, justiça, robustez — todos obrigatórios |
| Detecção de regressão | "Pausa na queda" | Pausar o loop quando deltas de métricas históricas sugerem perda de capacidade |
| Limite de Kolmogorov | "Limite de teoria da informação" | Limita o que um sistema pode provar sobre seu próprio sucessor |
| Teorema de Löb | "Armadilha de auto-referência" | Sistema pode agir com "deveria" sem provar que deveria |
| Stack de verificação | "Verificação em camadas" | Múltiplas primitivas combinadas; qualquer falha rejeita a edição |
| Melhoria limitada | "Mitigação, não prova" | Eleva custo de falha silenciosa; não fecha o problema de segurança |

## Leituras Adicionais

- [ICLR 2026 RSI Workshop summary (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV) — a convergência de quatro primitivas.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — limiares de capacidade multi-objetivo.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — monitoramento de alinhamento enganoso como primitiva invariante.
- [Schmidhuber (2003). Godel Machines](https://people.idsia.ch/~juergen/goedelmachine.html) — o ancestral formal destas primitivas.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — a âncora de alinhamento baseada em raciocínio.
