# Critérios de Justiça — Grupo, Individual, Contrafactual

> Três famílias estruturam a literatura de justiça. Justiça de grupo: paridade demográfica, odds equalizadas, igualdade de uso condicional — taxas iguais entre grupos protegidos em média. Justiça individual (Dwork et al. 2012): indivíduos similares recebem decisões similares; condição de Lipschitz no mapa de decisão. Justiça contrafactual (Kusner et al. 2017): uma decisão é justa para um indivíduo se permanece inalterada quando atributos sensíveis são contrafactualmente alterados. Resultado teórico 2024 (NeurIPS 2024): existe um trade-off inerente entre CF e acurácia; um método agnóstico a modelos converte um preditor ótimo mas injusto em um CF com perda de acurácia delimitada. Contrafactuais retroativos (arXiv:2401.13935, janeiro 2024): novo paradigma que evita a necessidade de intervenções em atributos protegidos legalmente. Reconciliação filosófica (ICLR Blogposts 2024): com grafos causais, satisfazer certas medidas de justiça de grupo implica justiça contrafactual.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, comparação de três critérios)
**Pré-requisitos:** Fase 18 · 20 (viés), Fase 02 (ML clássico)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Enunciar os três critérios de justiça de grupo (paridade demográfica, odds equalizadas, igualdade de uso condicional) e um resultado de impossibilidade.
- Descrever a justiça individual via a formulação de Lipschitz de Dwork et al. 2012.
- Descrever a justiça contrafactual e sua dependência de grafo causal.
- Explicar contrafactuais retroativos e por que eles contornam o problema da intervenção em atributo protegido.

## O Problema

A Lição 20 foi sobre medir viés. A Lição 21 é sobre definir o padrão de justiça que a medida deve servir. As três famílias dão padrões estruturalmente diferentes — um modelo pode ser justo de grupo e injusto individual, justo contrafactual e injusto de grupo. Escolher um padrão é decisão de política; nenhum padrão é universalmente ótimo.

## O Conceito

### Justiça de grupo

- **Paridade demográfica.** P(Y=1 | A=a) = P(Y=1 | A=a') para todos os grupos. Taxas de aceitação iguais.
- **Odds equalizadas.** P(Y=1 | Y*=y, A=a) = P(Y=1 | Y*=y, A=a'). TPR e FPR iguais entre grupos.
- **Igualdade de uso condicional.** P(Y*=y | Y=y, A=a) = P(Y*=y | Y=y, A=a'). Valor preditivo igual entre grupos.

Impossibilidade (Chouldechova, Kleinberg-Mullainathan-Raghavan 2017): os três não podem ser satisfeitos simultaneamente com taxas base desiguais.

### Justiça individual

Dwork et al. 2012. Um mapa de decisão f é individualmente justo com respeito a uma métrica de similaridade específica da tarefa d se |f(x) - f(x')| <= L * d(x, x') para alguma constante de Lipschitz L. Indivíduos similares recebem decisões similares.

Requer definir d. Questão de política, não estatística.

### Justiça contrafactual

Kusner et al. 2017. Uma decisão é contrafactualmente justa para o indivíduo i se, sob um modelo causal da população, a decisão permanece inalterada quando os atributos sensíveis de i são contrafactualmente alterados.

Requer um DAG causal. O DAG é uma escolha de modelagem. Justiça contrafactual é tão justificável quanto o DAG.

### O trade-off CF vs acurácia

NeurIPS 2024 teórico: existe um trade-off inerente entre justiça contrafactual e acurácia preditiva. Um método agnóstico a modelos pode converter um preditor ótimo mas injusto em um CF, com custo de acurácia delimitado. O custo de acurácia depende da magnitude do coeficiente do atributo sensível no preditor injusto ótimo.

### Contrafactuais retroativos

arXiv:2401.13935 (janeiro 2024). Contrafactuais tradicionais requerem intervenções no atributo sensível — "mudaria a decisão se essa pessoa fosse de outro gênero." Juridicamente, isso é problemático: atributos protegidos não podem ser alvo de intervenção em classificação.

Contrafactuais retroativos invertem a direção: em vez de intervir no atributo, perguntam que combinação das features reais do indivíduo produziria o resultado contrafactual. Isso contorna a objeção jurídica.

### Reconciliação filosófica

ICLR Blogposts 2024. Com um grafo causal em mãos, satisfazer certas medidas de justiça de grupo implica justiça contrafactual. As três famílias não são ortogonais; são facetas diferentes da mesma estrutura causal subjacente.

Isso não resolve os teoremas de impossibilidade (taxas base desiguais ainda impedem justiça de grupo simultânea). Mas mostra que a aparente oposição entre "grupo" e "individual / contrafactual" é parcialmente um artefato de não ser explícito sobre o modelo causal.

### Onde isso se encaixa na Fase 18

A Lição 20 é sobre medição de viés. A Lição 21 é sobre definição de justiça. A Lição 22 é sobre privacidade (privacidade diferencial). A Lição 23 é sobre marcação d'água. Essas são as lições adjacentes à alocação complementando as lições adjacentes à engano 7-11.

## Use

`code/main.py` constrói um dataset de classificação binária fictício com um atributo sensível e taxas base desiguais. Calcule paridade demográfica, odds equalizadas e igualdade de uso condicional em um classificador simples. Observe as três métricas discordando. Aplique um re-pesamento para paridade demográfica e observe seu custo nas outras duas.

## Entregue

Esta lição produz `outputs/skill-fairness-criterion.md`. Dada uma alegação de justiça ou política, identifica qual critério está sendo alegado, se o modelo pode satisfazer os critérios restantes sob as taxas base desiguais alegadas, e de qual DAG causal a alegação depende.

## Exercícios

1. Execute `code/main.py`. Relate as três métricas de grupo nos dados padrão. Aplique o re-pesamento direcionado a paridade demográfica e relate novamente.

2. Implemente a métrica de justiça individual de Dwork et al. 2012 usando L2 em features não-sensíveis. Relate quantos pares violam Lipschitz com constante L=1.

3. Leia Kusner et al. 2017. Construa um DAG causal simples de duas features para pontuação de currículos e identifique a condição de justiça contrafactual que ele implica.

4. O paper de 2024 sobre contrafactuais retroativos evita intervenção em atributos protegidos. Descreva um cenário onde isso importa para conformidade legal.

5. A reconciliação de ICLR 2024 argumenta que justiça de grupo e contrafactual são facetas da mesma estrutura. Escolha dois dos três critérios em `code/main.py` e declare a suposição causal que os tornaria equivalentes.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|---------------------------|
| Paridade demográfica | "taxas iguais" | P(Y=1 | A=a) igual entre grupos |
| Odds equalizadas | "TPR/FPR igual" | Taxas de verdadeiro positivo e falso positivo iguais entre grupos |
| Igualdade de uso condicional | "PPV/NPV igual" | Valores preditivos iguais entre grupos |
| Justiça individual | "condição de Lipschitz" | Indivíduos similares recebem decisões similares |
| Justiça contrafactual | "invariância à alteração causal" | Decisão inalterada sob alteração contrafactual de atributo |
| Contrafactual retroativo | "explicar via reais" | Contrafactual raciocinado backward do resultado, não forward do atributo |
| Teorema de impossibilidade | "os três conflitam" | Chouldechova / KMR 2017: critérios de grupo mutuamente exclusivos sob taxas base desiguais |

## Leitura Complementar

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) — justiça individual
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) — justiça contrafactual
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) — impossibilidade
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) — novo paradigma para intervenções em atributo protegido
