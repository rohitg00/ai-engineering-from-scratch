# Processos Estocásticos

> Aleatoriedade com estrutura. A matemática por trás de caminhadas aleatórias, cadeias de Markov e modelos de difusão.

**Tipo:** Aprendizado
**Idioma:** Python
**Pré-requisitos:** Fase 1, Lições 06-07 (probabilidade, Bayes)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Simular caminhadas aleatórias 1D e 2D e verificar o escalonamento sqrt(n) do deslocamento
- Construir um simulador de cadeia de Markov e computar sua distribuição estacionária via autodecomposição
- Implementar Metropolis-Hastings MCMC e dinâmica de Langevin para amostrar de distribuições alvo
- Conectar o processo de difusão direto ao movimento Browniano e explicar como o processo reverso gera dados

## O Probleva

Muitos sistemas de IA envolvem aleatoriedade que evolui ao longo do tempo. Não aleatoriedade estática -- aleatoriedade estruturada e sequencial onde cada passo depende do anterior.

Modelos de linguagem geram tokens um por vez. Cada token depende do contexto anterior. Isso é um processo estocástico.

Modelos de difusão adicionam ruído a uma imagem passo a passo até virar puro estático. Depois revertem o processo, denoising passo a passo até uma nova imagem surgir.

## O Conceito

### Caminhadas Aleatórias

Comece na posição 0. A cada passo, jogue uma moeda. Cara: direita (+1). Coroa: esquerda (-1).

Após n passos, a distância esperada da origem cresce como sqrt(n). Isso é contraintuitivo -- a caminhada é justa, mas ao longo do tempo wander cada vez mais longe.

```
Passo 100: distância esperada da origem ~ 10 (sqrt(100))
Passo 10000: distância esperada da origem ~ 100 (sqrt(10000))
```

**Conexão com movimento Browniano.** O limite contínuo da caminhada aleatória é B(t) ~ N(0, t).

### Cadeias de Markov

Transições entre estados com probabilidades fixas. Propriedade chave: próximo estado depende apenas do estado atual.

```
P[X_{t+1} = j | X_t = i, X_{t-1} = ...] = P[X_{t+1} = j | X_t = i]
```

**Distribuição estacionária:** pi * P = pi. Encontre via método de potência ou autovetor esquerdo de P com autovalor 1.

**Condições de convergência:** Irreductível + aperiódica.

**Tempo de mistura:** quantos passos até a cadeia ficar "perto" da distribuição estacionária. Gap eespecificaçãotral controla.

### Dinâmica de Langevin

Gradiente descente encontra mínimo de função. Langevin encontra distribuição proporcional a exp(-U(x)/T).

```
x_{t+1} = x_t - dt * grad(U(x_t)) + sqrt(2*T*dt) * z_t
```

Duas forças: gradiente (direcionado) + ruído (exploração).

### Metropolis-Hastings

Construa cadeia de Markov cuja distribuição estacionária é p(x). Razão de aceitação garante equilíbrio detalhado.

### Conexão com Modelos de Linguagem

Geração de tokens é aproximadamente um processo markoviano. Temperatura controla a agudez. Top-k e top-p modificam probabilidades de transição.

### Conexão com Modelos de Difusão

Processo direto: Markov chain que mistura dados com ruído.
Processo reverso: Markov chain aprendida que denoisa.

## Construa

```python
def random_walk_1d(n_steps, seed=None):
    rng = np.random.RandomState(seed)
    steps = rng.choice([-1, 1], size=n_steps)
    return np.concatenate([[0], np.cumsum(steps)])

class MarkovChain:
    def __init__(self, transition_matrix):
        self.P = np.array(transition_matrix, dtype=float)

    def stationary_distribution(self):
        eigenvalues, eigenvectors = np.linalg.eig(self.P.T)
        idx = np.argmin(np.abs(eigenvalues - 1.0))
        stationary = np.real(eigenvectors[:, idx])
        return np.abs(stationary / stationary.sum())
```

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Caminhada aleatória | "Movimento de moeda" | Posição muda por incrementos aleatórios |
| Propriedade Markov | "Sem memória" | Futuro depende só do presente |
| Matriz de transição | "Tabela de probabilidades" | P[i][j] = probabilidade de ir de i para j |
| Distribuição estacionária | "Média de longo prazo" | pi onde pi*P = pi |
| Movimento Browniano | "Agitação aleatória" | Limite contínuo da caminhada aleatória |
| Dinâmica de Langevin | "Gradiente descente com ruído" | Combina gradiente determinístico com perturbação aleatória |
| MCMC | "Caminhando em direção ao alvo" | Construir cadeia de Markov cuja distribuição estacionária é o alvo |
| Temperatura | "Botão de aleatoriedade" | Tradeoff entre exploração e exploitação |
| Difusão | "Ruído entra, ruído sai" | Direto: adicionar ruído. Reverso: remover |

## Leitura Adicional

- **Ho, Jain, Abbeel (2020)** -- Denoising Diffusion Probabilistic Models
- **Song & Ermon (2019)** -- Generative Modeling by Estimating Gradients
- **Norris (1997)** -- Markov Chains
