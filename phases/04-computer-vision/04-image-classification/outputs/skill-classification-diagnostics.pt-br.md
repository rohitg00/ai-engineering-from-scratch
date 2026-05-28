---
name: skill-classification-diagnostics
description: Dada uma matriz de confusão e nomes de classes, revele falhas por classe e proponha a correção mais impactante
version: 1.0.0
phase: 4
lesson: 4
tags: [computer-vision, classification, evaluation, debugging]
---

# Diagnóstico de Classificação

Uma lente de leitura para matrizes de confusão. A precisão agregada indica que um classificador funciona. A matriz de confusão diz *o que ela ainda não sabe*.

## Quando usar

- Primeiro observe o desempenho de validação de um classificador treinado.
- Entre treinos para decidir o que mudar a seguir.
- Antes de enviar um modelo: verificar se nenhuma classe crítica está falhando silenciosamente.
- Depurar uma regressão de produção em que a precisão geral caiu um ponto e você precisa saber por quê.

## Entradas

- `cm`: Matriz de confusão CxC (linhas = verdadeiro, cols = previsto).
- `labels`: lista de nomes de classes C, na mesma ordem.
- Opcional `class_priors`: frequência de treinamento por classe (o padrão é a soma das linhas de `cm`).

## Etapas

1. **Calcule métricas por classe.** Trate qualquer divisão por zero como uma métrica indefinida para aquela classe e relate-a como `n/a`; nunca substitua silenciosamente por 0.
   - Precision_i = cm[i,i] / sum(cm[:, i]) (indefinido quando a classe nunca foi prevista)
   - recall_i = cm[i,i] / sum(cm[i, :]) (indefinido quando a classe não tem amostras verdadeiras)
   - f1_i = 2 * p * r / (p + r) (indefinido quando um dos componentes é indefinido)

2. **Classifique até três piores classes** pela F1. Se a matriz de confusão tiver menos de três classes, classifique quantas existirem. Exclua classes com todas as métricas indefinidas.

3. **Encontre a célula superior fora da diagonal por linha** — a classe que mais comumente rouba desta classe. Reporte como `true -> predicted`.

4. **Classifique o modo de falha** para cada pior classe. Use estes limites quantitativos para que o rótulo seja reproduzível:
   - `ambiguity` — confusão bidirecional com outra classe: `cm[i,j] / sum(cm[i, :]) >= 0.15` e `cm[j,i] / sum(cm[j, :]) >= 0.15`.
   - `imbalance` — a classe tem `< 0.5x` a contagem de treinamento de seu principal confundidor.
   - `label_noise` — `|precision_i - recall_i| >= 0.2` e a classe não está nos caminhos de desequilíbrio/ambiguidade.
   - `systematic` — nenhum confundidor excede 0,2 parcela dos erros desta classe; erros espalhados por três ou mais outras classes.

5. **Recomende a próxima ação mais impactante**:
   - `ambiguity` -> coletar ou sintetizar exemplos discriminativos, adicionar aumento direcionado que preserve a característica distintiva.
   - `imbalance` -> sobreamostrar a classe minoritária ou aplicar perda ponderada de classe.
   - `label_noise` -> auditar uma amostra estratificada da turma; corrija rótulos incorretos antes de qualquer outra alteração.
   - `systematic` -> aumente os dados da classe ou ajuste com um peso maior na perda desta classe.

## Relatório

```
[diagnostics]
  aggregate accuracy: X.XX
  macro F1:           X.XX

[top-3 worst classes]
  1. class <name>  F1 = X.XX  prec = X.XX  rec = X.XX
     top confusion: <name> -> <other>  (N cases)
     failure mode:  ambiguity | imbalance | label_noise | systematic
     action:        <one sentence>

  2. ...
  3. ...

[recommendation]
  single biggest lever: <one sentence naming the class and the fix>
```

## Regras

- Retorno no máximo três aulas. Mais esconde o sinal.
- Nomeie o confundidor dominante para cada pior classe; nunca resuma como “confunde com muitos”.
- Fundamente todas as recomendações nas evidências da matriz de confusão. Não há "adicionar mais dados" genérico sem especificar qual classe.
- Quando a precisão e a recuperação discordam em mais de 0,2, sempre sinalize o ruído do rótulo como candidato - as classes reais geralmente têm P e R alinhados após o treinamento.