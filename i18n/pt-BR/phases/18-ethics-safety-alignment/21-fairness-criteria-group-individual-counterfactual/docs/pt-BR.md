# Critérios de equidade  Grupo, Individuais, Contrafactos

> Três famílias estruturam a literatura de justiça. Equidade de grupo: paridade demográfica, probabilidades igualadas, igualdade de precisão de utilização condicional  taxas iguais entre grupos protegidos em média. A justiça individual (Dwork et al. 2012): indivíduos semelhantes recebem decisões semelhantes; condição de Lipschitz no mapa de decisão. A justiça contrafactual (Kusner et al. A decisão é justa para um indivíduo se não for alterada quando atributos sensíveis são alterados de forma contraditória. Resultado teórico 2024 (NeurIPS 2024): existe uma compensação inerente entre CF e precisão; um método modelo-agnóstico converte um preditor óptimo, mas injusto, em um CF com perda de precisão limitada. Contrafactualidades de retrocesso (arXiv:2401.13935, janeiro 2024): novo paradigma que evita exigir intervenções em atributos legalmente protegidos. Reconciliação filosófica (ICLR Blogposts 2024): com gráficos causais, satisfazer certas medidas de equidade de grupo implica equidade contrafactual.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, three-criteria comparison)
**Prerequisites:** Phase 18 · 20 (bias), Phase 02 (classical ML)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Indique os três critérios de justiça de grupo (paridade demográfica, probabilidades igualadas, igualdade de precisão de utilização condicional) e um resultado de impossível.
- Descrever a equidade individual através da formulação de Lipschitz de Dwork et al. 2012.
- Descreva a justiça contrafactual e a sua dependência do gráfico causal.
- Explique as contrafactuais de retrocesso e por que elas evitam o problema da intervenção sobre atributos protegidos.

## O problema

A lição 20 foi sobre a medição de preconceito. A lição 21 é sobre a definição do padrão de justiça que a medição deve servir. As três famílias dão padrões estruturalmente diferentes  um modelo pode ser grupo-justo e individual-injusto, contrafactualmente justo e grupo-injusto. Escolher um padrão é uma decisão política; nenhum padrão é universalmente ótimo.

## O conceito

### Equidade de grupo

- **Demographic parity.**P (Y=1) A (A) = P (Y=1) A (A) = P (Y=1) para todos os grupos. Taxas de aceitação iguais.
- **Equalized odds.**P (Y=1\Y*=y, A=a) = P (Y=1\Y*y=y, A=a) = P (Y=1\Y*y, A=a) = P (Y=1\Y*y, A=a) = P (Y=1\Y) = Y=y, Y=y, A=a) = P (Y=1\Y) = Y=y, Y=y, Y=y, A=a) = P (Y=1\Y) = Y=y, Y=y, Y=y, A=a) = P (Y=1\Y) = Y=y, Y=y=y, Y=y=y, A=a) = P (Y=y) = y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=y=
- **Conditional use accuracy equality.**P (Y*=y) = P (Y*=y) = P (Y*=y) = Y=y, A=a') = Valor preditivo igual entre os grupos.

Impossibilidade (Chouldechova, Kleinberg-Mullainathan-Raghavan 2017): estas três não podem ser satisfeitas simultaneamente sob taxas de base desiguais.

### Equidade individual

Dwork et al. 2012. Um mapa de decisão f é individualmente justo em relação a uma métrica de similaridade específica de tarefa d se f(x) - f(x') <= L * d(x, x') para alguma constante Lipschitz. Indivíduos semelhantes recebem decisões semelhantes.

Requer definir d. Questão política, não estatística.

### A justiça contrafactual

Uma decisão é contrafactualmente justa para o indivíduo se, sob um modelo causal da população, a decisão não é alterada quando os atributos sensíveis do i são alterados contrafactualmente.

Requer um DAG causal. O DAG é uma escolha de modelagem. A justificação contrafactual é apenas tão justificada quanto o DAG.

### O acordo de compensação entre CF e precisão

NeurIPS 2024 teórico: há um trade-off inerente entre a justiça contrafactual e a precisão preditiva. Um método modelo-agnóstico pode converter um preditor ótimo, mas injusto, em um CF, a um custo de precisão limitado. O custo de precisão depende da magnitude do coeficiente de atributo sensível no preditor injusto ótimo.

### Contradições de retrocesso

ArXiv:2401.13935 (janeiro 2024). Contratações tradicionais exigem intervenções no atributo sensível  "a decisão mudaria se essa pessoa tivesse sido de gênero diferente".

Os contrafactos de retrocesso viram a direção: em vez de intervir no atributo, pergunte qual combinação das características reais do indivíduo teria produzido o resultado contrafactual.

### Reconciliação filosófica

ICLR Blogposts 2024. Com um gráfico causal em mãos, satisfazer certas medidas de justiça de grupo implica justiça contrafactual. As três famílias não são ortogonais; são facetas diferentes da mesma estrutura causal subjacente.

Isto não resolve os teoremas da impossibilidade (tasas de base desiguais ainda impedem a justiça simultânea de grupo), mas mostra que a aparente oposição entre "grupo" e "indivíduo / contrafactual" é parcialmente um artefato de não ser explícito sobre o modelo causal.

### Onde isto encaixa na Fase 18

A lição 20 é a medição de preconceito. A lição 21 é a definição de equidade. A lição 22 é privacidade (privacia diferencial). A lição 23 é marcação de água. Estas são as lições adjacentes à alocação complementando as lições 7-11 adjacentes ao engano.

```figure
an-fairness-trilemma
```

## Usá-lo

`code/main.py`Classificação binária de brinquedos com um atributo sensível e taxas de base desiguais. Compute paridade demográfica, chances igualadas e igualdade de precisão de uso condicional em um classificador simples. Observe as três métricas discordantes. Aplique uma re-ponderação para paridade demográfica e observe seu custo nos outros dois.

## Envia-o

Esta lição produz`outputs/skill-fairness-criterion.md`- Tendo em conta uma alegação ou política de equidade, identifica qual é o critério a ser reivindicado, se o modelo pode satisfazer os restantes critérios sob as taxas de base desiguais reivindicadas e de que DAG causal depende a alegação.

## Exercícios

1. Corra .`code/main.py`- Relacionar as três métricas do grupo nos dados padrão.

2. Implementar a métrica de justiça individual de Dwork et al. 2012 usando L2 em características não sensíveis.

3. Leia Kusner et al. 2017. Construa um simples DAG causal de duas características para pontuação de resumo e identifique a condição de justiça contrafactual que implica.

4. O documento de contrafactos de retrocesso de 2024 evita a intervenção em atributos protegidos.

5. A reconciliação ICLR 2024 argumenta que a equidade de grupo e contrafactual são facetas da mesma estrutura.`code/main.py`E indicar a suposição causal que os faria equivalentes.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Demographic parity | "equal rates" | P(Y=1 | A=a) equal across groups |
| Equalized odds | "equal TPR/FPR" | Equal true-positive and false-positive rates across groups |
| Conditional use accuracy | "equal PPV/NPV" | Equal predictive values across groups |
| Individual fairness | "Lipschitz condition" | Similar individuals get similar decisions |
| Counterfactual fairness | "causal alteration invariance" | Decision unchanged under counterfactual attribute alteration |
| Backtracking counterfactual | "explain via actuals" | Counterfactual reasoned backward from outcome, not forward from attribute |
| Impossibility theorem | "the three conflict" | Chouldechova / KMR 2017: group criteria mutually exclusive under unequal base rates |

## Mais leitura

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) Equidade individual
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) equidade contrafactual
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) Impossibilidade
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) novo paradigma para as intervenções de atributo protegido
