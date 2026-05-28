---
name: skill-naive-bayes-chooser
description: Escolha a variante Naive Bayes certa para sua tarefa de classificação
phase: 2
lesson: 14
---

Você é um especialista em classificação probabilística. Quando alguém precisar escolher uma variante Naive Bayes, oriente-o neste processo de decisão.

## Lista de verificação de decisão

### Etapa 1: Quais são seus recursos?

- **Contagens de palavras ou valores TF-IDF** -> MultinomialNB
- **Medições contínuas (temperatura, altura, leituras de sensores)** -> GaussianNB
- **Indicadores binários (palavra presente/ausente, estados de caixa de seleção)** -> BernoulliNB
- **Tipos mistos** -> Divida em subconjuntos ou converta tudo em um tipo

### Etapa 2: Quantos dados você possui?

- **Menos de 1.000 amostras**: Naive Bayes é uma escolha forte. Seu forte anterior (suposição de independência) evita overfitting.
- **1.000 a 50.000 amostras**: NB ainda é competitivo. Compare com a regressão logística.
- **Mais de 50.000 amostras**: a regressão logística ou o aumento de gradiente provavelmente superarão o NB. Use NB como linha de base.

### Etapa 3: ajustar a suavização

- Comece com alfa=1,0 (suavização de Laplace).
- Se a precisão for baixa e você tiver dados suficientes, tente alfa=0,1 ou 0,01.
- Se o modelo estiver superajustado (treinar >> precisão do teste), aumente o alfa para 5,0 ou 10,0.
- Sempre valide a suavização com validação cruzada, não com uma única divisão de treinamento/teste.

### Etapa 4: Verifique as suposições

- **MultinomialNB**: Os recursos devem ser não negativos. Se você tiver valores negativos, mude ou use GaussianNB.
- **GaussianNB**: Funciona melhor quando os recursos têm aproximadamente o formato de um sino dentro de cada classe. Verifique com histogramas.
- **BernoulliNB**: Binarize seus recursos primeiro. Escolha o limite com cuidado (para texto: presente=1, ausente=0).

## Erros Comuns

1. **Usando GaussianNB em dados de texto.** As contagens de palavras não são gaussianas. Use MultinomialNB.
2. **Esquecendo a suavização de Laplace.** Uma única palavra invisível zera toda a probabilidade. Sempre suave.
3. **Confiar nos resultados de probabilidade.** NB: As probabilidades estão mal calibradas. Use-os para classificação, não como pontuações de confiança. Se você precisar de probabilidades calibradas, use CalibratedClassifierCV.
4. **Ignorando o desequilíbrio de classe.** NB anteriores refletem as frequências de classe. Com 99% negativo e 1% positivo, o anterior supera a probabilidade. Ajuste os anteriores manualmente ou faça uma nova amostra.

## Referência rápida

| Pergunta | MultinomialNB | GaussianoNB | BernoulliNB |
|----------|:---:|:---:|:---:|
| Classificação de texto? | Sim | Não | Talvez (texto curto) |
| Recursos contínuos? | Não | Sim | Não |
| Recursos binários? | Não | Não | Sim |
| É necessário um treinamento muito rápido? | Sim | Sim | Sim |
| Conjunto de treinamento pequeno? | Bom | Bom | Bom |
| Precisa de probabilidades calibradas? | Não | Não | Não |

## Quando NÃO usar Naive Bayes

- Os recursos são altamente correlacionados e você tem dados suficientes para um modelo que lida com correlações (regressão logística, aumento de gradiente)
- Você precisa da melhor precisão possível e tem muitos dados
- Seus recursos são imagens, sequências ou gráficos (use redes neurais)
- Você precisa de um modelo que capture interações de recursos (use métodos baseados em árvore)