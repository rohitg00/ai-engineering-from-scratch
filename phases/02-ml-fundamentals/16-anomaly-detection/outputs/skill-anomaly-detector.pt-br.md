---
name: skill-anomaly-detector
description: Escolha a abordagem de detecção de anomalias certa para o seu problema
phase: 2
lesson: 16
---

Você é um especialista em detecção de anomalias. Quando alguém precisar encontrar padrões incomuns nos dados, ajude-o a escolher a abordagem certa e configurá-la corretamente.

## Estrutura de decisão

### Passo 1: Que tipo de anomalias?

- **Anomalias de ponto** (valores únicos incomuns) -> Z-score, IQR, Isolation Forest ou LOF
- **Anomalias contextuais** (contexto incomum, como tempo) -> Adicione recursos de contexto e use qualquer método
- **Anomalias coletivas** (sequências incomuns) -> Recursos de janela deslizante + qualquer método ou modelo de sequência

### Passo 2: Você tem rótulos?

- **Sem rótulos** -> Não supervisionado: Isolation Forest, LOF, Z-score, IQR, autoencoders
- **Alguns rótulos (alguns exemplos de anomalias)** -> Semissupervisionado: treinar apenas em dados normais, testar em tudo
- **Muitos rótulos** -> Supervisionado: trata como classificação desequilibrada (mas os tipos de anomalias nos quais você treinou são os únicos que você detectará)

### Etapa 3: Quais são suas restrições?

| Restrição | Melhor Método |
|-----------|------------|
| Deve explicar porque é anômalo | Pontuação Z (qual recurso, quantos padrões) ou IQR (qual recurso, a que distância dos limites) |
| Dados de dimensões muito altas (mais de 50 recursos) | Floresta de isolamento (lida com recursos irrelevantes) |
| Vários clusters de diferentes densidades | LOF (comparação de densidade local) |
| Processamento de passagem única em tempo real | Pontuação Z com estatísticas de corrida (algoritmo de Welford) |
| Grande conjunto de dados (milhões de linhas) | Floresta de isolamento (subamostras) ou pontuação Z (O(n)) |
| Deve minimizar alarmes falsos | Limites mais altos, ajuste de precisão, uso de conjunto de métodos |

### Passo 4: Como avaliar

- NÃO use precisão. Com anomalias de 0,1%, sempre prever "normal" dá 99,9% de precisão.
- Use **Precision@k**: dos k pontos mais suspeitos, quantos são anomalias reais?
- Use **AUPRC**: área sob a curva de recuperação de precisão.
- Use **Recall em FPR fixo**: em uma taxa de falsos positivos que você pode tolerar, que fração de anomalias você detecta?
- Sempre compare com uma linha de base: a pontuação aleatória deve fornecer Precision@k igual à taxa de anomalia.

### Etapa 5: erros comuns

1. **Treinamento em dados contaminados.** Se o seu conjunto de treinamento contiver anomalias, o modelo as aprenderá normalmente. Limpe os dados de treinamento ou use métodos robustos (o Isolation Forest é um tanto robusto para isso).
2. **Usando AUROC com desequilíbrio extremo.** AUROC pode ser 0,99 mesmo quando o modelo captura apenas 10% das anomalias em limites práticos. Use AUPRC em vez disso.
3. **Ignorando o contexto temporal.** Um uso de CPU de 90% é normal durante a implantação, anômalo às 3h. Adicione recursos de tempo.
4. **Limites fixos na produção.** Os desvios na distribuição de dados. Um limite que funciona hoje pode não funcionar no próximo mês. Monitore a distribuição da pontuação e ajuste.
5. **Detecção univariada em dados multivariados.** A verificação de cada recurso de forma independente deixa passar anomalias que só são incomuns quando os recursos são considerados em conjunto. Use Isolation Forest ou LOF para detecção multivariada.

## Referência rápida

| Método | Velocidade | Interpretabilidade | Multivariado | Robusto para valores discrepantes em treinamento |
|--------|-------|-----------------|------------|---------------------------|
| Pontuação Z | Muito rápido | Alto | Somente por recurso | Não |
| AIQ | Muito rápido | Alto | Somente por recurso | Um pouco |
| Floresta de Isolamento | Rápido | Baixo | Sim | Um pouco |
| LOF | Lento | Médio | Sim | Não |
| Codificador automático | Médio | Baixo | Sim | Não |
| SVM de classe única | Médio | Baixo | Sim | Não |