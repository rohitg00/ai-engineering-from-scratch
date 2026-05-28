# Métodos de Amostragem

> Amostragem é como a IA explora o espaço de possibilidades.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 1, Lições 06-07 (Probabilidade, Teorema de Bayes)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Implementar amostragem por CDF inversa, rejeição e importância usando apenas números aleatórios uniformes
- Construir amostragem por temperatura, top-k e top-p (núcleo) para geração de tokens de modelo de linguagem
- Explicar o truque de reparametrização e por que ele permite backpropagation através de amostragem em VAEs
- Executar Metropolis-Hastings MCMC para amostrar de uma distribuição alvo não-normalizada

## O Problema

Um modelo de linguagem termina de processar seu prompt e produz um vetor de 50.000 logits. Um para cada token no vocabulário. Agora ele tem que escolher um. Como?

Se ele sempre escolhe o token de maior probabilidade, toda resposta é idêntica. Determinística. Chata. Se escolhe uniformemente ao acaso, a saída é bobagem. A resposta vive em algum lugar entre esses extremos, e esse lugar é controlado pela amostragem.

Cada sistema de IA generativa é um sistema de amostragem. A estratégia de amostragem determina a qualidade, diversidade e controlabilidade da saída. Esta lição constrói cada método de amostragem principal do zero.

## O Conceito

### Por que Amostragem Importa

Amostragem aparece em quatro papéis fundamentais:
- **Geração:** Modelos de linguagem, modelos de difusão e GANs produzem saída por amostragem
- **Treino:** SGD amostra mini-batches. Dropout amostra neurônios
- **Estimação:** Monte Carlo aproxima integrais sem solução fechada
- **Exploração:** MCMC explora distribuições posteriores

### Amostragem Uniforme Aleatória

Todo método de amostragem começa aqui. Um gerador uniforme produz valores em [0, 1).

### Método CDF Inversa (Transformada Inversa)

Se U ~ Uniform(0, 1), então X = F_inverso(U) segue a distribuição alvo.

**Exemplo exponencial:**
```
CDF: F(x) = 1 - exp(-lambda * x)
Solução: x = -ln(u) / lambda
```

### Amostragem por Rejeição

Quando você não pode inverter a CDF mas pode avaliar a PDF alvo até uma constante.

```
Aceitar x se u < p(x) / (M * q(x))
Taxa de aceitação = 1/M
```

### Amostragem por Importância

Estime uma expectativa sob p(x) usando amostras de q(x) ponderando por p(x)/q(x). Fundamental para PPO em RL.

### Estimação Monte Carlo

Aproxime integrais como médias de amostras. Erro O(1/sqrt(N)) independente da dimensão.

### MCMC: Metropolis-Hastings

Construa uma cadeia de Markov cuja distribuição estacionária é p(x). Depois de passos suficientes, amostras da cadeia são amostras de p(x).

### Amostragem Gibbs

Caso eespecificaçãoial do MCMC para distribuições multivariadas. Atualiza uma variável por vez de sua distribuição condicional.

### Amostragem por Temperatura (Usada em LLMs)

Divide logits por T antes do softmax. T<1 agudiza (mais confiante), T>1 aplaina (mais diverso).

### Amostragem Top-k

Mantém apenas os k tokens de maior probabilidade e reamostra.

### Amostragem Top-p (Núcleo)

Mantém o menor conjunto de tokens cuja probabilidade acumulada excede p. Adaptativo.

### Truque de Reparametrização (Usado em VAEs)

Separe a aleatoriedade dos parâmetros: z = mu + sigma * epsilon onde epsilon ~ N(0,1). Torna a amostragem diferenciável.

### Gumbel-Softmax

Aproximação diferenciável para amostragem categórica usando ruído Gumbel + softmax com temperatura.

### Amostragem Estratificada

Divida o espaço de amostras em estratos e amostra de cada um. Sempre menor ou igual variância que Monte Carlo ingênuo.

### Conexão com Modelos de Difusão

O processo de difusão direto adiciona ruído Gaussiano. O processo reverso aprende a denoiser. Cada passo de denoising é uma operação de amostragem condicional.

## Construa

Implementações completas estão em `code/sampling.py`.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Amostragem | "Tirar valores aleatórios" | Gerar valores de acordo com uma distribuição de probabilidade |
| CDF inversa | "Transformação de probabilidade" | F_inverso(U) converte amostra uniforme em amostra de qualquer distribuição |
| Rejeição | "Propor e aceitar/rejeitar" | Gerar de proposta simples, aceitar com probabilidade proporcional à razão alvo/proposta |
| Importância | "Reponderar amostras" | Estimar expectativas usando amostras de outra distribuição ponderadas |
| Monte Carlo | "Média de amostras aleatórias" | Aproximar integrais como médias |
| MCMC | "Caminhada aleatória que converge" | Construir cadeia de Markov cuja distribuição estacionária é o alvo |
| Temperatura | "Botão de confiança" | Divide logits por T antes do softmax |
| Top-k | "Manter os k melhores" | Zerar todos exceto os k tokens de maior probabilidade |
| Top-p | "Manter os prováveis" | Manter menor conjunto com probabilidade acumulada >= p |
| Reparametrização | "Mover aleatoriedade para fora" | z = mu + sigma * epsilon. Torna amostragem diferenciável |

## Leitura Adicional

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010)
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)
