---
name: lm-baseline
description: Construa uma linha de base reproduzível do modelo de linguagem n-gram antes de treinar um LM neural.
phase: 5
lesson: 16
---

Dado um corpus e uso alvo (previsão da próxima palavra, nova pontuação, linha de base de perplexidade), resultado:

1. Ordem de N gramas. Trigrama para inglês geral, 4 gramas se o corpus for grande, 5 gramas para recuperação de fala.
2. Suavização. Kneser-Ney modificado é o padrão; Laplace apenas para ensino.
3. Biblioteca. `kenlm` para produção, `nltk.lm` para ensino, faça o seu próprio apenas para aprender matemática.
4. Avaliação. Perplexidade persistente com tokenização consistente entre conjuntos de treinamento e teste.

Recuse-se a relatar a perplexidade calculada com tokenização diferente entre os sistemas que estão sendo comparados – os números da perplexidade são comparáveis ​​apenas sob tokenização idêntica. Sinalizar taxa OOV no conjunto de teste; KN lida mal com OOV, a menos que você reserve um token `<UNK>` especial durante o treinamento.