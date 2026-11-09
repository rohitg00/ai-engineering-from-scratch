# Modelos de monitorização na produção  Drift de dados e Drift de conceitos

> Um modelo implantado falha sem uma mensagem de erro. Ele continua a devolver pontuações enquanto o mundo se afasta dos seus dados de treinamento, e apenas o monitoramento mostra a lacuna.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## Objetivos de aprendizagem

- Escolha sinais de monitoramento em quatro camadas: saúde do sistema, entradas, previsões e resultados
- Distinguir a derivação covariada, a derivação anterior e a derivação conceitual pela parte da distribuição conjunta que muda
- Implementar o Índice de Estabilidade da População, a estatística de dois amostras Kolmogorov-Smirnov e o teste de chi-quadrado a partir do zero
- Compare uma janela de referência fixa com janelas de corrente deslizante e explique como o tamanho da janela muda de ruído e atraso
- Desenhar uma política de alerta que limite os falsos alarmes com tamanhos de efeito, uma correção de testes múltiplos e uma regra de persistência
- Decidir qual tipo de deriva necessita de reformulação, qual precisa de novos rótulos e qual não precisa de qualquer acção

## O problema

Um modelo de risco de pagamento é aplicado com 95% de precisão. Dois meses depois, uma campanha de marketing traz usuários de aplicativos com cestas maiores. Quatro meses depois, os fraudadores mudam suas táticas e pagamentos que costumavam ser seguros começam a se transformar em recargos.

O serviço modelo retorna HTTP 200 para cada solicitação durante todo este processo. A latência é normal, e os registros não mostram erros. O primeiro sinal de problemas é um relatório financeiro sobre recargos, semanas após o dano.

O monitoramento de software verifica se um serviço responde. O monitoramento de modelo verifica se as respostas ainda são corretas e se os dados ainda se parecem com os dados que treinaram o modelo. Esta lição constrói as estatísticas, as janelas e a política de alerta para esse segundo trabalho.

## O conceito

### O que monitorar

Os primeiros três dão alertas antecipados, só o quarto mede a correcção e chega atrasado.

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

O monitoramento de entrada é o principal tema desta lição, porque funciona antes da chegada dos rótulos.

### Três tipos de deriva

Escrever a distribuição conjunta de insumos `x`e rótulos `y`De duas formas:

```math
P(x, y) = P(x) \cdot P(y \mid x) = P(y) \cdot P(x \mid y)
```

Cada tipo de deriva altera um fator diferente:

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

Gama et al. chamem uma alteração em `P(y | x)`- Não é o que se passa?`P(x)`Que deixa`P(y | x)`A sua pesquisa também classifica a deriva por como acontece ao longo do tempo: súbita, incremental, gradual ou como um conceito que retorna.

A deriva covariada nem sempre faz mal.`P(y | x)`Bem, fica correto para cada entrada. Pode ainda perder a precisão quando o tráfego se move para regiões com poucos dados de treinamento ou perto do limite de decisão.

### Rótulos atrasados

O resultado chega depois da previsão.

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

Durante o atraso, você tem entradas e previsões, mas não resultados. Monitorar as entradas e previsões, juntar-se aos rótulos quando eles chegam, e calcular métricas de resultado apenas na parte rotulada. A demonstração usa um atraso de rótulo de 500 eventos, então o monitor de resultados sempre olha para 500 eventos no passado.

### Frisas de referência e de corrente

Cada teste de deriva compara duas amostras:

- **Reference window.**Os dados de treinamento, ou um período de produção que verificou à mão, permanecem fixos até que você re-entrenar.
- **Current window.**Os eventos mais recentes, ou os últimos `N`eventos ou os últimos `T`- horas.

Uma janela deslizante avança um passo menor do que o seu tamanho, de modo que janelas consecutivas se sobrepõem. Uma janela deslizante se move pelo seu tamanho completo. O tamanho da janela é um trade-off. Uma janela pequena reage rapidamente, mas marca ruído como deriva. Uma janela grande é estável, mas relata uma mudança tarde.

A estacionalidade quebra janelas ingênuos. O tráfego de segunda-feira difere do tráfego de sábado em muitos produtos. Faça com que a referência cobre um ciclo completo, ou compare cada janela com o mesmo período em um ciclo anterior.

### Índice de Estabilidade Populária

O PSI vem da pontuação de crédito. Corte os valores de referência em canas, geralmente dez canas nos deciles de referência, para que cada canha contenha 10% da referência. Conte a parcela dos valores correntes em cada canha.

```math
\text{PSI} = \sum_{\text{bins}} (\text{current\_share} - \text{reference\_share}) \cdot \ln\left(\frac{\text{current\_share}}{\text{reference\_share}}\right)
```

Um bin com uma parcela de zero faz o log infinito, então clipe cada parcela para um pequeno valor como 0.0001. PSI é simétrico.

Os praticantes lêem a PSI com bandas fixas: abaixo de 0,1 é estável, 0,1 a 0,25 é uma mudança moderada e acima de 0,25 é uma mudança significativa. Trate essas bandas como uma convenção, não um teste. A PSI cresce com o número de canas e diminui com o tamanho da amostra. Na demonstração, janelas de 500 eventos sem pontuação de deriva entre 0,01 e 0,04.

### Estatística de Kolmogorov-Smirnov

A estatística de KS de duas amostras `D`é a maior diferença vertical entre as duas funções de distribuição cumulativa empírica:

```math
D = \max_x \left\lvert F_{\text{reference}}(x) - F_{\text{current}}(x) \right\rvert
```

`D`O valor p é 0 para amostras idênticas e 1 para amostras que não se sobrepõem. Não precisa de contenedores. O valor p é derivado da distribuição de Kolmogorov com o tamanho da amostra efetivo `n * m / (n + m)`- Não .

Com amostras grandes, o valor p vai para zero para uma lacuna que ninguém se importa. Uma mudança de desvios padrão de 0,02 é "significante" com um milhão de eventos por janela.`D`O efeito é um grande número de efeitos, e só se alerta quando ambos os`D`e o valor p passa os seus limiares.

### Teste em quadrado de chi para características categóricas

Para uma característica categórica, como o canal de pagamento, criar uma tabela com duas linhas (referência, corrente) e uma coluna por categoria.

```math
\begin{aligned}
\text{expected}[r][c] &= \text{row\_total}[r] \cdot \text{column\_total}[c] / \text{grand\_total} \\
\text{chi2} &= \sum_{\text{cells}} (\text{observed} - \text{expected})^2 / \text{expected}
\end{aligned}
```

O teste tem`k - 1`Graus de liberdade para`k`categorias. Uma categoria que aparece apenas na janela atual adiciona um termo grande, de modo que o teste reage a novos valores. V de Cramér é o tamanho do efeito. Para uma tabela com duas fileiras, é igual à raiz quadrada de `chi2 / grand_total`- Não .

### Limitações de alarme e falsos alarmes

Cada teste tem uma taxa de falsa alarme .`alpha`O monitoramento faz muitos testes, com 50 características verificadas a cada hora.`alpha = 0.05`As pessoas deixam de ler alertas muito antes disso.

Quatro regras mantêm a taxa de alerta útil:

1. **Correct for multiple tests.**A correcção Bonferroni divide `alpha`A demonstração usa uma família.`alpha`de 0,01 em dois testes, de modo que cada teste utiliza 0,005.
2. **Require an effect size.**Alerta apenas quando o PSI,`D`, ou o V de Cramér também passa um limiar.
3. **Require persistence.**Alerta apenas depois de`k`As janelas de deriva consecutivas.`k = 2`- Não .
4. **Separate warnings from alerts.**Um aviso vai para um painel de instrumentos, um alerta vai para uma pessoa.

A demonstração mostra a regra 2 em funcionamento. Uma janela limpa tem um p-valor chi-quadrado de 0,0009, abaixo do test per-`alpha`O V do Cramér está abaixo de 0,1, por isso a política registra um aviso, não um alerta.

### Trigadores de reestruturação

Existem três factores comuns que desencadeiam a reformulação:

- **Schedule.**Re-entrenar-se todas as semanas ou meses.
- **Drift.**Re-treinar quando a deriva de entrada em características importantes permanece acima do limiar.
- **Performance.**Re-treinar quando uma métrica de resultado cai abaixo do valor de referência menos uma tolerância.

O tipo de deriva decide o que a reformulação pode fazer:

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

Após a reformulação, teste o novo modelo com os dados mais recentes de rotulagem. Envolve-o com as etapas de sombra e canário da lição de concepção do sistema.

```figure
mlprod-drift-psi
```

## Construí-lo

O código está em `code/main.py`utiliza apenas a biblioteca padrão.

### Passo 1: contenedores quantiles e PSI

As bordas do canhão são os deciles de referência.`bisect_right`encontra o canhão de cada valor.

```python
def quantile_edges(reference: list[float], bins: int = 10) -> list[float]:
    ordered = sorted(reference)
    n = len(ordered)
    edges = [ordered[min(n - 1, (n * i) // bins)] for i in range(1, bins)]
    return sorted(set(edges))


def psi_from_fractions(expected: list[float], actual: list[float], eps: float = 1e-4) -> float:
    total = 0.0
    for e, a in zip(expected, actual):
        e, a = max(e, eps), max(a, eps)
        total += (a - e) * math.log(a / e)
    return total
```

### Passo 2: A estatística KS e o seu valor p

Passe as duas amostras classificadas juntas. Em cada valor distinto, passe por todas as cópias delas em ambas as amostras, e depois compare as duas partes acumulativas.

```python
def ks_statistic(sample_a: list[float], sample_b: list[float]) -> float:
    a, b = sorted(sample_a), sorted(sample_b)
    n, m = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < n and j < m:
        x = min(a[i], b[j])
        while i < n and a[i] <= x:
            i += 1
        while j < m and b[j] <= x:
            j += 1
        d = max(d, abs(i / n - j / m))
    return d
```

O valor p usa a série para a distribuição de Kolmogorov,`2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`, com `lambda = sqrt(n * m / (n + m)) * D`- Não .

### Passo 3: O teste de quadrado de chi

`chi2_sf`calcula a função de sobrevivência de chi-quadrado através da função gama incompleta superior regularizada.`chi_square_test`Construi a tabela de duas fileiras, calcula a estatística e retorna o valor p e o V de Cramér.

```python
def chi_square_test(reference_counts: dict[str, int], current_counts: dict[str, int]) -> ChiSquareResult:
    categories = [c for c in sorted(set(reference_counts) | set(current_counts))
                  if reference_counts.get(c, 0) + current_counts.get(c, 0) > 0]
    rows = [[reference_counts.get(c, 0) for c in categories], [current_counts.get(c, 0) for c in categories]]
    row_totals = [sum(r) for r in rows]
    grand = sum(row_totals)
    if len(categories) < 2 or 0 in row_totals:
        return ChiSquareResult(0.0, 0, 1.0, 0.0)
    statistic = 0.0
    for col, _ in enumerate(categories):
        col_total = rows[0][col] + rows[1][col]
        for r in range(2):
            expected = row_totals[r] * col_total / grand
            statistic += (rows[r][col] - expected) ** 2 / expected
    dof = len(categories) - 1
    return ChiSquareResult(statistic, dof, chi2_sf(statistic, dof), math.sqrt(statistic / grand))
```

### Passo 4: janelas e monitor de deriva

`SlidingWindow`- É o último .`size`eventos em uma`deque`- Não .`DriftMonitor`Computa os contentores de referência e conta uma vez.`check`método retorna o PSI, `D`, e o valor KS p para cada característica numérica, e o resultado chi-quadrado para cada característica categórica.

### Passo 5: Política de alerta

A política transforma cada métrica definida num nível e conta as janelas de deriva consecutivas por sinal:

```python
def level(self, metrics: dict[str, float]) -> str:
    if "psi" in metrics:
        if metrics["psi"] >= self.psi_drift or (metrics["ks"] >= self.ks_drift and metrics["ks_p"] < self.alpha):
            return "drift"
        return "warn" if metrics["psi"] >= self.psi_warn else "ok"
    if metrics["p"] < self.alpha and metrics["v"] >= self.min_cramers_v:
        return "drift"
    return "warn" if metrics["p"] < self.alpha else "ok"
```

`update`Retorno `ALERT`na janela que completa a linha, e `resolved`na primeira janela limpa após um alerta.

### Passo 6: Fluxo com deriva injetada

O stream tem 9000 eventos de pagamento com um `amount`, a `channel`, e uma fraude .`label`É definido por quatro segmentos:

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

O modelo é um limiar de `amount`Os Windows têm 500 eventos e se movem em 250.

```bash
python3 code/main.py
npx tsx code/main.ts
```

```console
  end    PSI   KS D   chi2 p    acc  levels (amount/channel/accuracy)  events
 3000  0.010  0.041  3.0e-01  0.932  ok/ok/ok
 3250  0.152  0.163  7.6e-06  0.924  drift/warn/ok
 3500  0.463  0.298  2.8e-26  0.936  drift/drift/ok                     ALERT amount
 3750  0.609  0.343  3.5e-35  0.942  drift/drift/ok                     ALERT channel
 ...
 5500  0.026  0.044  2.6e-01  0.898  ok/ok/ok                           resolved amount, resolved channel
 ...
 7250  0.040  0.048  7.1e-01  0.848  ok/ok/drift
 7500  0.022  0.039  6.1e-01  0.778  ok/ok/drift                        ALERT accuracy
```

Leia o resultado em três partes:

- **Covariate drift.**A deriva começa no evento 3000, e o `amount`A precisão permanece entre 0,89 e 0,95, porque a regra do rótulo não mudou.
- **Recovery.**As entradas retornam ao normal em 5000 e ambos os alertas resolvem-se em 5500.
- **Concept drift.**A deriva começa em 6500, e os monitores de entrada permanecem silenciosos porque as entradas não mudaram. A precisão cai de 0,946 para entre 0,76 e 0,79.

## Usá-lo

**scipy.** `scipy.stats`A análise de dados é feita por meio de um sistema de dados de dados que permite a aplicação de ambos os testes.

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

Verificámos .`ks_statistic`E ...`chi_square_test`A estatística KS, a estatística chi-quadrado e o valor p-quadrado chi coincidem com a precisão de ponto flutuante.

O código utiliza a distribuição limitante de Kolmogorov.`ks_2samp`O método de análise de amostras é o de uma análise de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras de amostras`chi2_contingency`aplica a correcção de continuidade de Yates por padrão, por isso as estatísticas diferem.

**Monitoring libraries.**Várias bibliotecas de código aberto incluem estes testes com relatórios e painéis de controlo:

- **Evidently**Para uma referência com 1000 linhas ou menos, usa o teste KS para colunas numéricas e o teste chi-quadrado para colunas categorias. Para dados maiores, usa a distância Wasserstein e a divergência Jensen-Shannon com um limiar de 0.1. PSI é um dos outros métodos que você pode selecionar.
- **NannyML**A Estimação de Performance Baseada em Confiança (CBPE) usa as probabilidades previstas do modelo, que devem ser bem calibradas. A documentação NannyML afirma que o CBPE lida com a mudança de covariados, mas não lida com a deriva conceitual.
- **TensorFlow Data Validation**A análise de dados é feita através de uma análise de dados que comparam intervalos consecutivos de dados.

O código do zero mostra o que cada uma dessas ferramentas calcula.

Para os pedidos de Mestrado em Direito Superior, o[LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md)A primeira fase da infraestrutura abrange as ferramentas de rastreamento e avaliação.

## Envia-o

Esta lição produz`outputs/skill-drift-monitoring.md`A habilidade planeja os monitores para um novo modelo e tria um alerta de deriva. Pergunta qual camada foi disparada, qual tipo de deriva se encaixa na evidência e se a ação certa é esperar, recalibrar, coletar rótulos ou retrainar.

## Exercícios

1. Execute o fluxo com janelas de 200 e 2000 eventos, gravar os falsos avisos antes do evento 3000 e o atraso de alerta.
2. Set `n_tests=1`- Não .`patience=1`, e `min_cramers_v=0`Contar as alertas no período limpo de 5000 a 6500.
3. Adicione uma característica cuja média cresce 0,01 por 100 eventos.
4. Implementar a distância Jensen-Shannon nos mesmos canhões decílios.
5. Adicione um monitor para a taxa de previsão positiva do modelo e explique por que ele permanece quieto durante a deriva do conceito.

## Termos-chave

| Term | What people say | What it means |
|------|----------------|----------------------|
| Data drift | "The data changed" | A change in the distribution of inputs, predictions, or labels compared with a reference window |
| Covariate drift | "New kinds of users" | `P(x)` changes while `P(y \| x)` stays the same |
| Prior drift | "More positives than before" | `P(y)` changes while `P(x \| y)` stays the same, also called label shift |
| Concept drift | "The rules of the game changed" | `P(y \| x)` changes, so the same input now has a different correct answer |
| Reference window | "The baseline data" | A fixed sample, often the training data, that every current window is compared with |
| PSI | "The stability score" | A symmetric sum over bins of (current share minus reference share) times the log of their ratio |
| KS statistic | "The KS test" | The largest gap between two empirical cumulative distribution functions |
| Cramér's V | "Effect size for categories" | The chi-square statistic scaled to the range 0 to 1 |
| Label delay | "Ground truth comes later" | The time between a prediction and the arrival of its true outcome |
| Alert fatigue | "Too many pages" | People ignore alerts because most of them were false alarms |

## Mais leitura

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation): deriva real e virtual, padrões de deriva e métodos de adaptação
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): Testes de duas amostras para detecção de deslocamentos
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785): métodos de detecção, compreensão e adaptação à deriva
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/): como o PSI se comporta com o tamanho da amostra e a contagem de contenção
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html): métodos de p-valor exactos e assintóticos para o ensaio KS de duas amostras
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift): seleção padrão de teste por tipo de coluna e tamanho de dados
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html): CBPE e suas suposições
