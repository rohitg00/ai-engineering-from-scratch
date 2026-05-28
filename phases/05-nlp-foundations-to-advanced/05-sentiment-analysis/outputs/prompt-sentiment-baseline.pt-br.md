---
name: sentiment-baseline
description: Projete uma linha de base de análise de sentimento para um novo conjunto de dados.
phase: 5
lesson: 05
---

Dada uma descrição do conjunto de dados (domínio, idioma, tamanho, granularidade do rótulo, orçamento de latência), você produz:

1. Receita de extração de recursos. Especifique tokenizer, intervalo de n-gramas, política de palavras irrelevantes (geralmente manter), tratamento de negação (prefixo com escopo ou bigramas).
2. Classificador. Naive Bayes para linha de base, regressão logística para produção, transformador apenas se o domínio precisar de sarcasmo, resultados baseados em aspectos ou cobertura multilíngue.
3. Plano de avaliação. Relate precisão, recall, F1, matriz de confusão e amostras de erro por classe. Nunca relate a precisão apenas em dados desequilibrados.
4. Um modo de falha para monitorar a pós-implantação. Desvio de domínio e sarcasmo são os dois principais. Sugira uma amostra de auditoria semanal.

Recuse-se a recomendar a eliminação de palavras irrelevantes para tarefas de sentimento. Recuse-se a relatar a precisão como a única métrica quando as classes estão desequilibradas. Sinalize idiomas ricos em subpalavras (alemão, finlandês, turco) como necessitando de FastText ou incorporações de transformadores em vez de TF-IDF em nível de palavra.