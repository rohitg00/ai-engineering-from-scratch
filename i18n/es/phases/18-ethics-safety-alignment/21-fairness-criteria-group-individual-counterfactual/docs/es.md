# Criterios de equidad  Grupo, individuo, contrafacto

> Tres familias estructuran la literatura de la justicia. Equidad de grupo: paridad demográfica, probabilidades igualadas, igualdad de precisión de uso condicional  tasas iguales entre los grupos protegidos en promedio. La equidad individual (Dwork et al. 2012): personas similares reciben decisiones similares; condición de Lipschitz en el mapa de decisiones. La equidad contrafactual (Kusner et al. 2017): una decisión es justa para un individuo si no se cambia cuando los atributos sensibles se alteran de manera contrafactual. Resultado teórico 2024 (NeurIPS 2024): existe un trade-off inherente entre CF y precisión; un método modelo-agnóstico convierte un predictor óptimo pero injusto en un predictor CF con pérdida limitada de precisión. Contrafactualidades de retroceso (arXiv:2401.13935, enero 2024): un nuevo paradigma que evita requerir intervenciones sobre atributos legalmente protegidos. Conciliación filosófica (ICLR Blogposts 2024): con gráficos causales, satisfacer ciertas medidas de equidad de grupo implica equidad contrafactual.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, three-criteria comparison)
**Prerequisites:** Phase 18 · 20 (bias), Phase 02 (classical ML)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- En el artículo 1, apartado 1, del Reglamento (UE) n.o 1095/2013 se establece que los Estados miembros deben adoptar medidas de seguridad y seguridad en el caso de los grupos de trabajo.
- Describa la equidad individual a través de la fórmula de Dwork et al. 2012 Lipschitz.
- Describa la equidad contrafactual y su dependencia del gráfico causal.
- Explica las contrafactualidades de retroceso y por qué evitan el problema de la intervención en el atributo protegido.

## El problema

La lección 20 se trataba de medir el sesgo. La lección 21 se trata de definir el estándar de equidad que la medición debe servir. Las tres familias dan estándares estructuralmente diferentes  un modelo puede ser justo en grupo y injusto en individuo, justo en contrafacto y injusto en grupo. Elegir un estándar es una decisión política; ningún estándar es universalmente óptimo.

## El concepto

### Equidad en grupo

- **Demographic parity.**P\Y=1\A=a=P\Y=1\A=a') para todos los grupos. tasas de aceptación iguales.
- **Equalized odds.**P  Y = 1  Y * y = a) = P  Y = 1  Y * y = a)  = a)  = igual TPR y FPR en todos los grupos.
- **Conditional use accuracy equality.**P * Y = y , Y = y, A = a) = P * Y * y , Y = y, A = a') Valor predictivo igual entre los grupos.

Impossibilidad (Chouldechova, Kleinberg-Mullainathan-Raghavan 2017): estos tres no pueden satisfacerse simultáneamente bajo tasas de base desiguales.

### La equidad individual

Dwork et al. 2012. Un mapa de decisión f es individualmente justo con respecto a una métrica de similitud específica de la tarea d si f(x) - f(x') <= L * d(x, x') para alguna constante Lipschitz.

Requiere definir d. Cuestión política, no estadística.

### La equidad contrafactual

Una decisión es contrafactualmente justa para el individuo i si, bajo un modelo causal de la población, la decisión no cambia cuando los atributos sensibles i son alterados contrafactualmente.

Requiere un DAG causal. El DAG es una elección de modelado. La equidad contrafactual es tan justificada como el DAG.

### El cambio entre CF y precisión

NeurIPS 2024 teórico: existe un compromiso inherente entre la equidad contrafactual y la precisión predictiva. Un método modelo-agnóstico puede convertir un predictor óptimo pero injusto en un predictor CF, a un costo de precisión limitado. El costo de precisión depende de la magnitud del coeficiente de atributos sensibles en el predictor injusto óptimo.

### Contrarreloj de retroceso

ArXiv:2401.13935 (enero 2024). Las contrafacturas tradicionales requieren intervenciones en el atributo sensible  "la decisión cambiaría si esta persona hubiera sido de un género diferente".

Las contrafactualidades de retroceso cambian de dirección: en lugar de intervenir en el atributo, pregunte qué combinación de las características reales del individuo habría producido el resultado contrafactual.

### Reconciliación filosófica

ICLR Blogposts 2024. Con un gráfico causal en la mano, satisfacer ciertas medidas de equidad de grupo implica equidad contrafactual. Las tres familias no son ortogonales; son diferentes facetas de la misma estructura causal subyacente.

Esto no resuelve los teoremas de imposibilidad (tasas de base desiguales aún impiden la equidad simultánea de grupo). Pero muestra que la aparente oposición entre "grupos" y "individuales / contrafactos" es parcialmente un artefacto de no ser explícito sobre el modelo causal.

### Donde esto encaja en la Fase 18

La lección 20 es la medición de sesgos. La lección 21 es la definición de equidad. La lección 22 es privacidad (privalidad diferencial). La lección 23 es marcado de agua. Estas son las lecciones adyacentes a la asignación que complementan las lecciones 7-11 adyacentes al engaño.

```figure
an-fairness-trilemma
```

## Usalo

`code/main.py`construye un conjunto de datos de clasificación binaria de juguete con un atributo sensible y tasas de base desiguales. Computa la paridad demográfica, las probabilidades igualadas y la igualdad de precisión de uso condicional en un clasificador simple. Observa las tres métricas que no coinciden. Aplique una nueva ponderación para la paridad demográfica y observa su costo en los otros dos.

## Envío

Esta lección produce`outputs/skill-fairness-criterion.md`. Dado un reclamo o una política de equidad, se identifica el criterio que se está reclamando, si el modelo puede satisfacer los criterios restantes en virtud de las tasas de base desiguales reclamadas y de qué DAG causal depende el reclamo.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`.Informe las tres métricas de grupo en los datos predeterminados.Aplicar la reponderación y reinforme dirigida a la paridad demográfica.

2. Implemente la métrica de equidad individual de Dwork et al. 2012 utilizando L2 en características no sensibles.

3. Lea Kusner et al. 2017. Construye un simple DAG causal de dos características para la puntuación de resumen e identifique la condición de equidad contrafactual que implica.

4. El documento de contrafactos de retroceso de 2024 evita la intervención en los atributos protegidos.

5. La reconciliación del ICLR 2024 argumenta que la equidad de grupo y contrafactual son facetas de la misma estructura.`code/main.py`y indicar la suposición causal que los haga equivalentes.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Demographic parity | "equal rates" | P(Y=1 | A=a) equal across groups |
| Equalized odds | "equal TPR/FPR" | Equal true-positive and false-positive rates across groups |
| Conditional use accuracy | "equal PPV/NPV" | Equal predictive values across groups |
| Individual fairness | "Lipschitz condition" | Similar individuals get similar decisions |
| Counterfactual fairness | "causal alteration invariance" | Decision unchanged under counterfactual attribute alteration |
| Backtracking counterfactual | "explain via actuals" | Counterfactual reasoned backward from outcome, not forward from attribute |
| Impossibility theorem | "the three conflict" | Chouldechova / KMR 2017: group criteria mutually exclusive under unequal base rates |

## Leer más

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) equidad individual
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) equidad contrafactual
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) Imposible
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) Nuevo paradigma para las intervenciones de atributos protegidos
