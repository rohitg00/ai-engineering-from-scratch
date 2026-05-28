# Detecção de Anomalias

> Normal é fácil de definir. Anormal é o que não se encaixa.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 2, Lições 01-09
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Implementar detecção de anomalias por Z-score, IQR e Isolation Forest do zero
- Distinguir entre anomalias pontuais, contextuais e coletivas
- Explicar por que detecção de anomalias é modelar dados normais, não classificar anomalias
- Comparar detecção não-supervisionada com classificação supervisionada

## O Problema

Um cartão de crédito é usado em NY às 14h, depois em Tóquio às 14h05. Um sensor de fábrica lê 150 graus quando o normal é 80-120. O desafio: você raramente tem exemplos rotulados de anomalias.

Detecção de anomalias inverte o problema: aprenda o que é normal. Qualquer desvio do normal é suspeito.

## O Conceito

### Tipos de Anomalias

- **Pontuais:** Um único ponto incomum (temperatura de 500 graus)
- **Contextuais:** Incomum dado o contexto (90 graus em janeiro)
- **Coletivas:** Sequência incomum como grupo (50 logins falhados seguidos)

### Método Z-Score

```
z_score = (x - media) / desvio_padrao
anomalia se |z_score| > limite
```

Limite padrão: 3.0.

### Método IQR

Use o intervalo interquartil para detectar outliers sem assumir normalidade.

### Isolation Forest

Floresta de isolamento: anomalias são mais fáceis de isolar porque são diferentes. Cada árvore tenta isolar pontos aleatoriamente. Anomalias ficam isoladas em menos passos.

## Construa

Implementações completas em `code/anomaly_detection.py`.

## Entregue

- `outputs/skill-anomaly-detector.md`

## Termos-Chave

| Termo | Significado |
|-------|-------------|
| Anomalia pontual | Ponto individual incomum |
| Anomalia contextual | Incomum dado o contexto |
| Anomalia coletiva | Sequência incomum como grupo |
| Z-score | Número de desvios padrão da média |
| IQR | Intervalo interquartil para detecção sem normalidade |
| Isolation Forest | Isola pontos aleatoriamente; anomalias são isoladas rápido |

## Leitura Adicional

- [Isolation Forest (Liu et al., 2008)](https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/icdm08b.pdf)
- [scikit-learn Outlier Detection](https://scikit-learn.org/stable/modules/outlier_detection.html)
