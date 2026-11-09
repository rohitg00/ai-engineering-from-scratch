# Desenhos limitados para melhorar a si mesmo

> A pesquisa convergiu em quatro primitivas para limitar um ciclo de auto-melhoria. Invariantes formais que devem ser mantidas em todas as edições. Ancoras de alinhamento que não podem ser modificadas. Constrangimentos multi-objetivos em que todas as dimensões (segurança, equidade, robustez) devem ser respeitadas, não apenas o desempenho. Detecção de regressão que suspende o ciclo quando as métricas históricas sugerem perda de capacidade. Nenhum deles é uma prova de segurança  resultados teóricos da informação (complexidade de Kolmogorov, teorema de Lob) ligados ao que qualquer sistema pode provar sobre seus próprios sucessores. São mitigantes que aumentam o custo do fracasso silencioso.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bounded-loop with invariant check)
**Prerequisites:** Phase 15 · 07 (RSI), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## O problema

O simulador de corrida da lição 7 mostrou que pequenas diferenças de taxa se compõem em grandes lacunas. O estudo de caso DGM da lição 4 mostrou que os loops podem ativamente jogar com seus próprios avaliadores. Ambos os resultados apontam para a mesma pergunta de engenharia: quais restrições você pode colocar em um loop de auto-melhoria de modo que as restrições não possam ser silenciosamente enfraquecidas pelo próprio loop?

O resumo do ICLR 2026 RSI Workshop (openreview.net/pdf?id=OsPQ6zTQXV) identifica quatro desses primitivos. A RSP v3.0 (Lessão 19) da Anthropic e a FSF v3 (Lessão 20) da DeepMind ambos os referem em limites de capacidade. Os Meta HyperAgents trabalham e frameworks comunitários como SAHOO (março 2026) implementam subconjuntos em produção.

O enquadramento honesto: são mitigations. resultados teóricos da informação ligados o que qualquer sistema pode provar sobre o seu próprio sucessor, e nenhum projeto atual encerra formalmente o problema. um ciclo bem limitado é mais seguro do que um sem limites, não seguro em termos absolutos.

## O conceito

### Primitivo 1: invariantes formais

Uma invariante é uma propriedade que deve ser mantida antes e depois de cada auto-modificação.

- A distribuição de produção é condicionada a um cabeçalho de constituição fixo (Lessão 17).
- Nenhuma chamada de ferramenta vai para um endpoint não autorizado.
- A memória escreve através de um caminho registado e assinado.
- O hash do módulo do avaliador corresponde à versão aprovada.

As invariantes são verificadas por código externo que o loop não pode editar. Se uma modificação proposta viola uma invariante, ela é rejeitada.

A parte difícil é escolher invariantes que são necessários para a segurança e computaveis em tempo razoável.

### Primitivo 2: âncoras de alinhamento

Uma âncora de alinhamento é uma representação imutável do objetivo central do loop, fixada fora da superfície de edição do loop.

- Um texto constitucional (Lessão 17) que é carregado de um local de leitura apenas em cada invocação.
- Um avaliador num repositório separado com controlo de acesso independente.
- Um manifesto de autorização de ferramenta assinado por um ser humano e reverificado em cada ciclo.

O papel da âncora é evitar a deriva objetiva. O ciclo pode melhorar a forma como persegue o objetivo, mas não pode editar o que é o objetivo.

O modo de falha sutil: um âncora que o loop não pode editar ainda pode ser reinterpretado por um loop que deriva na forma como lê o âncora. A IA constitucional (Lessão 17) é explicitamente baseada em razão para lidar com situações novas; essa camada de raciocínio é onde a deriva de interpretação vive. Ancores são necessários, não suficientes.

### Primitivo 3: restrições multi-objetivas

Um ciclo que otimiza uma única pontuação escalar encontrará atalhos. Um ciclo que deve simultaneamente satisfazer várias restrições duras tem menos atalhos disponíveis. Eixo típicos:

- Performance (indicador de referência de nível de tarefa)
- Segurança (avaliações da equipa vermelha, taxa de recusa em casos de mal conhecidos)
- Equidade (limites de impacto dispares em subgrupos sensíveis)
- Robustez (ensemblos de ensaio OOD, manipulação de entrada adversária)

Uma modificação só é aceita se todas as restrições são válidas. O governador de custos da lição 13 coloca isso com restrições financeiras.

### Primitivo 4: detecção de regressão

As pontuações de cada ciclo são comparadas com distribuições históricas. Uma queda além da tolerância configurada pausa o loop. Isso capta a perda silenciosa de capacidade que, de outra forma, seria absorvida na média em execução à medida que o loop "melhorou" além dele.

Uma implementação prática: armazenar os resultados por tarefa dos últimos ciclos N. Cada novo ciclo calcula um delta por tarefa. Se algum delta cair abaixo de um limiar, o ciclo é rejeitado e uma revisão humana.

### Limites teóricos da informação

A complexidade de Kolmogorov e o teorema de Lob estabelecem limites superiores sobre o que um sistema pode provar sobre si mesmo. A Máquina Godel formal de Schmidhuber (Lessão 4) visava o limite mais alto; ninguém completou uma prova não trivial. O resultado de Lob diz: se um sistema acredita provavelmente "Eu farei X se eu provar que devo fazer X", ele fará X sem provar que deveria, um bem conhecido fracasso de auto-referência.

A implicação para os nossos primitivos: eles não conseguem fechar o problema de segurança. Eles tornam a falha silenciosa mais cara. Um ciclo malicioso ou desviado que silenciosamente contornaria um cheque faltante agora deve minar ativamente um cheque explícito, que é uma assinatura mais detectável.

### Um exemplo prático

Suponha que um agente proponha uma edição.

1. Verificações invariáveis: hashes de módulos, manifesto de autorização de ferramentas, cabeçalho constitucional.
2. Verificação de âncora: a declaração objetiva corresponde à versão aprovada (em termos de bytes ou semânticos).
3. Avaliação multiobjetiva: desempenho, segurança, equidade, robustez.
4. Detecção da regressão: nenhum eixo cai mais do que a tolerância.

Todos os quatro devem passar para a edição aterrar.

```figure
bounded-gates
```

## Usá-lo

`code/main.py`O primeiro passo é a utilização de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de auto-melhoria de um sistema de um sistema de auto-melhoria de um sistema de um sistema de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória de memória

## Envia-o

`outputs/skill-bounded-loop-review.md`O sistema de avaliação de dados é um sistema de avaliação de dados que permite a análise de dados.

## Exercícios

1. Corra .`code/main.py`Confirme que o ciclo ainda melhora na métrica primária sem deixar o hack ganhar.

2. Desativar a detecção de regressão. Construa uma entrada onde isso conduza à perda silenciosa de capacidade sendo aceita.

3. Desativar a restrição multi-objetiva. Mostre o loop convergindo no eixo de desempenho enquanto um eixo de segurança cai.

4. Desenhar uma âncora de alinhamento para um agente de codificação.

5. Leia o resumo do ICLR 2026 RSI Workshop, escolha um dos quatro primitivos e propõe uma melhoria concreta do estado atual da arte.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Invariant | "Always-true property" | A property checked by external code before and after every edit |
| Alignment anchor | "Pinned objective" | Immutable core-goal representation outside the loop's edit surface |
| Multi-objective constraint | "All axes must hold" | Performance, safety, fairness, robustness — all required |
| Regression detection | "Pause on drop" | Pause the loop when historical metric deltas suggest capability loss |
| Kolmogorov bound | "Information-theoretic limit" | Limits what a system can prove about its own successor |
| Lob's theorem | "Self-reference trap" | System can act on "I should" without proving it should |
| Gate stack | "Layered check" | Multiple primitives combined; any failure rejects the edit |
| Bounded improvement | "Mitigation, not proof" | Raises silent-failure cost; does not close the safety problem |

## Mais leitura

- [ICLR 2026 RSI Workshop summary (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV) a convergência primitiva de quatro.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) limiares de capacidade multi-objetiva.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) Monitoramento de alinhamento enganoso como primitivo invariante.
- [Schmidhuber (2003). Godel Machines](https://people.idsia.ch/~juergen/goedelmachine.html) o ancestral formal-prove de estes primitivos.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) o âncora de alinhamento baseado em razão.
