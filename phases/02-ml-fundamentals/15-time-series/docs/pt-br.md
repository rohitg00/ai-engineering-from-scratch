# Fundamentos de Séries Temporais

> Performance passada prevê resultados futuros -- se você verificar estacionaridade primeiro.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 2, Lições 01-09
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Decompor uma série temporal em tendência, sazonalidade e residual e testar estacionaridade
- Implementar features de lag e estatísticas rolling para converter série temporal em problema de aprendizado supervisionado
- Construir framework de validação walk-forward que previne vazamento de dados futuros
- Explicar por que divisões aleatórias são inválidas para séries temporais

## O Problema

Você tem dados ordenados por tempo. Vendas diárias, temperatura por hora, preços semanais. Você pega seu toolkit padrão de ML: divisão aleatória, validação cruzada. Cada passo está errado.

Séries temporais quebram as suposições do ML padrão. Amostras não são independentes. Divisões aleatórias vazam informação futura.

## O Conceito

### O que Torna Séries Temporais Diferentes

ML padrão assume i.i.d. Séries temporais violam ambas as suposições:
- **Não independentes.** Preço de hoje depende de ontem.
- **Não identicamente distribuídas.** A distribuição muda ao longo do tempo.

### Componentes de uma Série Temporal

- **Tendência:** Direção de longo prazo
- **Sazonalidade:** Padrões repetitivos em intervalos fixos
- **Residual:** O que sobra após remover tendência e sazonalidade

### Estacionaridade

Propriedades estatísticas (média, variância, autocorrelação) não mudam ao longo do tempo.

**Como verificar:** Média e desvio padrão rolling.
**Como corrigir:** Diferenciação. `diff[t] = value[t] - value[t-1]`

### Autocorrelação

Mede o quanto um valor no tempo t se correlaciona com o valor em t-k. ACF mostra para cada lag.

### Features de Lag

Converter série temporal em aprendizado supervisionado:

| lag_2 | lag_1 | target |
|-------|-------|--------|
| 10 | 12 | 14 |
| 12 | 14 | 13 |

### Validação Walk-Forward

Conceito mais importante. Dados de treino sempre precedem dados de teste cronologicamente.

```
Treino: Jan-Mar -> Teste: Abr
Treino: Jan-Abr -> Teste: Mai
```

### ARIMA

- **AR (Autoregressivo):** Prediz de valores passados
- **I (Integrado):** Diferenciação para estacionaridade
- **MA (Média Móvel):** Prediz de erros de forecast passados

## Construa

```python
def make_lag_features(series, n_lags):
    n = len(series)
    X = np.full((n, n_lags), np.nan)
    for lag in range(1, n_lags + 1):
        X[lag:, lag - 1] = series[:-lag]
    valid = ~np.isnan(X).any(axis=1)
    return X[valid], series[valid]

def walk_forward_split(n_samples, n_splits=5, min_train=50):
    step = max(1, (n_samples - min_train) // n_splits)
    for i in range(n_splits):
        train_end = min_train + i * step
        test_end = min(train_end + step, n_samples)
        if train_end >= n_samples:
            break
        yield slice(0, train_end), slice(train_end, test_end)
```

## Entregue

- `outputs/prompt-time-series-advisor.md`
- `code/time_series.py`

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Estacionaridade | "As estatísticas não mudam" | Média, variância e autocorrelação constantes |
| Diferenciação | "Subtrair valores consecutivos" | y[t] - y[t-1] para remover tendências |
| Autocorrelação (ACF) | "Como a série se correlaciona consigo mesma" | Correlação entre série e sua cópia defasada |
| Features de lag | "Valores passados como inputs" | Usar y[t-1], y[t-2],... como features |
| Walk-forward | "Cross-validation respeitando tempo" | Treino sempre antes de teste cronologicamente |
| ARIMA | "O modelo clássico de séries" | Combina valores passados, diferenciação e erros passados |
| Sazonalidade | "Padrões calendário repetitivos" | Ciclos regulares ligados a períodos calendário |

## Leitura Adicional

- [Hyndman, Forecasting: Principles and Practice](https://otexts.com/fpp3/)
- [statsmodels ARIMA docs](https://www.statsmodels.org/stable/generated/statsmodels.tsa.arima.model.ARIMA.html)
