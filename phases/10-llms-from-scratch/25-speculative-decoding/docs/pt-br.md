# Decodificacao Eespecificaçãoulativa e EAGLE

> Um LLM de fronteira gerando um token requer um forward pass completo sobre bilhoes de parametros. Esse forward massivamente superprovisionado: na maior parte do tempo um modelo muito menor consegue adivinhar os proximos 3-5 tokens corretamente, e o modelo grande so precisa *verificar* a adivinhacao. Quando a adivinhacao ta certa voce ganhou 5 tokens pelo preco de um. Decodificacao eespecificaçãoulativa (Leviathan et al. 2023) tornou isso exato e EAGLE-3 (2025) empurrou as taxas de aceitacao pra ~4.5 tokens por verificacao -- um speedup de 4-5x com distribuicao de saida equivalente.

**Tipo:** Construir
**Linguagens:** Python (com numpy)
**Pre-requisitos:** Fase 10, Aula 12 (Otimizacao de Inferencia), Fase 10, Aula 04 (Pre-treinamento de Mini-GPT)
**Tempo:** ~75 minutos

## O Problema

O throughput de decode pra um modelo de classe 70B num H100 e tipicamente 40-80 tokens/segundo. Cada token requer um forward pass completo lendo todos os pesos do modelo da HBM. Voce nao pode tornar o modelo menor sem mudar sua saida. Nao pode aumentar batch size alem da memoria. Voce esta preso -- a menos que consiga fazer o modelo produzir mais de um token por forward pass.

A geracao autoregressiva parece inerentemente serial: `x_{t+1} = sample(p(· | x_{1:t}))`. Mas existe uma oportunidade de concorrencia. Se voce tivesse um preditor barato que dissesse "os proximos 4 tokens provavelmente sao [a, b, c, d]" voce poderia verificar todas as 5 posicoes em **um unico forward pass do modelo grande** e aceitar o prefixo mais longo que casa.

Leviathan, Kalai, Matias (2023, "Fast Inference from Transformers via Speculative Decoding") tornaram isso exato via uma regra inteligente de aceitar/rejeitar que preserva a distribuicao de amostragem do modelo alvo. A mesma distribuicao de saida, 2-4x mais rapida.

## O Conceito

### O Setup de Dois Modelos

- **Modelo alvo** `M_p`: o modelo grande, lento, de alta qualidade que voce quer amostras. Distribuicao: `p(x)`.
- **Modelo de rascunho** `M_q`: um modelo menor, mais rapido, de menor qualidade. Distribuicao: `q(x)`. 5-30x menor.

A cada passo:

1. Modelo de rascunho propoe `K` tokens autoregressivamente: `x_1, x_2, ..., x_K ~ q`.
2. Modelo alvo roda UM forward pass sobre todas as `K+1` posicoes em paralelo, produzindo `p(x_k)` pra cada token proposto.
3. Aceitar/rejeitar cada token da esquerda pra direita via a regra de reamostragem por rejeicao modificada abaixo. Aceitar o prefixo mais longo que casa.
4. Se qualquer token for rejeitado, amostrar o substituto da distribuicao corrigida e parar. Caso contrario amostrar um token bonus de `p(· | x_1...x_K)`.

Se o rascunho casa com o alvo perfeitamente, voce ganha K+1 tokens por forward do alvo. Se o rascunho ta errado na posicao 1, voce ganha apenas 1 token.

### A Regra de Exatidao

Decodificacao eespecificaçãoulativa e **provavelmente equivalente em distribuicao a amostrar de p**. A regra de rejeicao:

```
Para cada token rascunhado x_t:
    r ~ Uniform(0, 1)
    se r < p(x_t) / q(x_t):
        aceitar x_t
    senao:
        amostrar substituto do residual: (p - q)+ / ||(p - q)+||_1
        parar
```

onde `(p - q)+` denota a parte positiva da diferenca pontual. Quando rascunho e alvo concordam (`p ≈ q`) aceitacao e proxima de 1. Quando discordam, a distribuicao residual e construida pra que a amostra geral ainda seja exatamente `p`.

**Caso ganancioso.** Pra temperatura=0 so checar `argmax(p) == x_t`. Se sim, aceitar; se nao, produzir `argmax(p)` e parar.

### Speedup Esperado

Se a taxa de aceitacao por token do modelo de rascunho e `alpha`, o numero esperado de tokens produzidos por forward do alvo e:

```
E[tokens] = (1 - alpha^{K+1}) / (1 - alpha)        # K = comprimento do rascunho, alpha em [0, 1]
```

Em `alpha = 0.8, K = 4`: `(1 - 0.8^5)/(1 - 0.8) = 3.36` tokens por forward. Um forward do alvo custa mais ou menos `cost_q * K + cost_p` (K passos de rascunho mais uma verificacao do alvo). Se `cost_p >> cost_q * K` a razao de speedup e `3.36x / 1 = 3.36x` no throughput.

O unico parametro real e `alpha`, que depende inteiramente do alinhamento rascunho-alvo. Um bom rascunho e tudo.

### Treinando o Rascunho: Destilacao

Um modelo aleatorio menor faz um rascunho ruim. A receita padrao e destilar do alvo:

1. Escolher uma arquitetura menor (~1B pra um alvo 70B, ~500M pra um alvo 7B).
2. Rodar o modelo alvo em um grande corpus de texto; armazenar suas distribuicoes de proximo token.
3. Treinar o rascunho com divergencia KL contra a distribuicao do alvo (nao contra tokens ground-truth).

O resultado: `alpha` tipicamente 0.6-0.8 em codigo, 0.7-0.85 em chat de linguagem natural. Speedups de 2-3x em producao.

### EAGLE: Arvore de Rascunho + Reutilizacao de Features

Li, Wei, Zhang, Zhang (2024, "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty") observaram duas ineficiencias na decodificacao eespecificaçãoulativa padrao:

1. O rascunho faz K passos seriais, cada um full-stack. Mas o rascunho poderia reutilizar as features (hidden states) do alvo da verificacao mais recente -- o alvo ja computou representacoes ricas que o rascunho esta re-derivando do zero.
2. O rascunho produz uma cadeia linear. Se o rascunho pudesse produzir uma *arvore* de candidatos (cada no multiplas suposicoes), o forward pass unico do alvo poderia verificar multiplos caminhos candidatos em paralelo via uma mascara de tree attention, e escolher o ramo aceito mais longo.

Mudancas do EAGLE-1:
- Entrada do rascunho = hidden state final do alvo na posicao t, nao tokens brutos.
- Arquitetura do rascunho = 1 camada decoder transformer (nao um modelo menor separado).
- Saida = arvore de K = 4-8 candidatos por profundez, profundez 4-6.

EAGLE-2 (2024) adiciona topologia de arvore dinamica: a arvore cresce onde o rascunho ta incerto e fica estreita onde ta confiante. Sobe `alpha_effective` sem aumentar custo de verificacao.

EAGLE-3 (Li et al. 2025, "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test") remove a dependencia fixa de features da camada superior e treina o rascunho com uma nova loss de "teste-em-tempo-de-treinamento" -- o rascunho e treinado em saidas que combinam com a distribuicao em tempo de teste do alvo ao inves da distribuicao de treinamento com teacher forcing. Taxa de aceitacao sobe de 0.75 (EAGLE-2) pra 0.82 (EAGLE-3) e media de tokens/verificacao de 3.0 pra 4.5.

### Verificacao por Tree Attention

Quando o rascunho produz uma arvore, o modelo alvo verifica em um unico forward pass usando uma **mascara de tree attention** -- uma mascara causal que codifica a topologia da arvore ao inves de uma linha pura. Cada token atende apenas seus ancestrais na arvore. O passo de verificacao ainda e um forward, um matmul; a mascara topologica custa apenas poucas entradas KV extras.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

Se `a, b` sao candidatos competindo pelo primeiro token e `c, d, e, f` sao candidatos pro segundo token, todas as seis posicoes sao verificadas em um forward pass. A saida e o prefixo mais longo ao longo de qualquer caminho aceito.

### Quando Ganha, Quando Nao

**Ganha:**
- Chat/completude com texto previsivel (codigo, ingles comum, saida estruturada). `alpha` e alto.
- Cenarios com compute de GPU ocioso durante decode (fase limitada por memoria). Arvore de rascunho usa os FLOPs disponiveis.

**Perde / sem ganho:**
- Saidas altamente estocasticas (escrita criativa em alta temperatura). `alpha` cai em direcao a `1/|vocab|`.
- Servindo em batch com altissima concorrencia -- batching ja preenche os FLOPs, pouco espaco pra verificacao em arvore.
- Modelos alvo muito pequenos onde o rascunho nao e muito menor.

Lojas de producao tipicamente reportam 2-3x de speedup em tempo real em chat, 3-5x em geracao de codigo e perto de zero em escrita criativa.

## Construir

`code/main.py`:

- Uma referencia `especificaçãoulative_decode(target, draft, prompt, K, temperature)` que implementa a regra exata de rejeicao e verifica que preserva a distribuicao do alvo (KL empirico < 0.01 vs amostragem simples do alvo).
- Um rascunhador estilo EAGLE em arvore que constroi uma arvore de profundez-K com ramificacao top-p.
- Um construtor de mascara de tree attention que produz o padrao causal certo pra um verificador.
- Um harness de taxa de aceitacao que roda os dois em um LM minusculo (destilar um GPT-2-small de um alvo GPT-2-medium).

```python
def especificaçãoulative_step(p_target, q_draft, K, temperature=1.0):
    """Uma rodada de decodificacao eespecificaçãoulativa. Retorna lista de tokens aceitos."""
    # 1. Rascunhar K tokens
    draft_tokens = []
    q_probs = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_probs.append(probs[t])
        state = draft_step(state, t)

    # 2. Alvo calcula p em cada posicao rascunhada + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Aceitar/rejeitar da esquerda pra direita
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_probs[k]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_probs[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. Todos os K aceitos -> amostrar token bonus do alvo
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## Usar

- **vLLM** e **SGLang** enviam decodificacao eespecificaçãoulativa de primeira classe. Flags: `--especificaçãoulative_model`, `--num_especificaçãoulative_tokens`. Suporte EAGLE-2/3 via flag `--especificação_decoding_algorithm eagle`.
- **NVIDIA TensorRT-LLM** suporta Medusa e arvores EAGLE nativamente.
- **Modelos de rascunho de referencia**: `Qwen/Qwen3-0.6B-especificação` (rascunhos pra Qwen3-32B), `meta-llama/Llama-3.2-1B-Instruct-especificação` (rascunhos pra 70B).
- **Heads Medusa** (Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"): ao inves de um modelo de rascunho, adicionar K heads de predicao paralelos ao proprio modelo alvo. Mais simples de deploy, aceitacao ligeiramente menor que EAGLE.

## Entregar

Esta aula produz `outputs/skill-especificaçãoulative-tuning.md` -- uma skill que profileia a carga de trabalho de um modelo alvo e escolhe: modelo de rascunho, K (comprimento do rascunho), largura da arvore, temperatura e quando voltar pra decodificacao simples.

## Exercicios

1. Implementar a regra exata de rejeicao e verificar empiricamente. Rodar 10K amostras via `especificaçãoulative_decode` e via amostragem simples do alvo; calcular distancia TV entre as duas distribuicoes de saida. Deve ser < 0.01.

2. Calcular a formula de speedup. Dados `alpha` e `K` fixos, plotar tokens esperados por forward do alvo. Encontrar o K otimo pra alpha ∈ {0.5, 0.7, 0.9}.

3. Treinar um rascunho minusculo. Pegar um GPT-2 alvo de 124M e destilar um rascunho GPT-2 de 30M em 100M tokens com loss KL. Medir `alpha` em texto de retencao. Esperado: 0.6-0.7.

4. Implementar arvore de rascunho estilo EAGLE. Ao inves de uma cadeia, o rascunho produz top-3 ramos em cada profundez. Construir a mascara de tree attention. Verificar que o alvo aceita o ramo correto mais longo.

5. Medir modos de falha. Rodar decodificacao eespecificaçãoulativa em temperatura=1.5 (alta estocasticidade). Mostrar que alpha despenca e o algoritmo e mais lento que decodificacao simples por causa do overhead do rascunho.

## Termos Principais

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Modelo alvo | "O modelo grande" | O modelo lento, de alta qualidade que voce quer amostras (distribuicao p) |
| Modelo de rascunho | "O eespecificaçãoulador" | O preditor menor, mais rapido (distribuicao q); 5-30x menor |
| K / comprimento do rascunho | "Olhar adiante" | Numero de tokens eespecificaçãoulados por passo de verificacao |
| alpha / taxa de aceitacao | "Taxa de acerto" | Probabilidade por token de que a proposta do rascunho e aceita |
| Regra exata de rejeicao | "O teste de aceitar" | r < p/q comparacao que preserva a distribuicao do alvo |
| Distribuicao residual | "p-q corrigido" | (p - q)+ / ||(p - q)+||_1, a distribuicao pra amostrar na rejeicao |
| Arvore de rascunho | "Eespecificaçãoulacao ramificada" | Rascunho produz uma arvore de candidatos, verificada em uma passada com mascara de atencao estruturada em arvore |
| Mascara de tree attention | "Mascara topologica" | Mascara causal codificando a topologia da arvore pra que cada no atenda apenas seus ancestrais |
| Heads Medusa | "Heads paralelos" | K heads extras de predicao no proprio modelo alvo; sem modelo de rascunho separado |
| Reutilizacao de features EAGLE | "Rascunho de hidden state" | Entrada do rascunho e o ultimo hidden state do alvo, nao tokens brutos, encolhendo o rascunho |
| Loss de teste-em-treinamento | "Treinamento EAGLE-3" | Treinar rascunho em saidas que combinam com a distribuicao de teste do alvo, nao teacher forcing |

## Leitura Complementar

- [Leviathan, Kalai, Matias, 2023 -- "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) -- a regra exata de rejeicao e a analise teorica de speedup
- [Chen, Borgeaud, Irving et al., 2023 -- "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) -- paper concorrente de amostragem eespecificaçãoulativa no DeepMind
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 -- "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) -- alternativa de heads paralelos a um modelo de rascunho
- [Li, Wei, Zhang, Zhang, 2024 -- "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) -- reutilizacao de features e arvore de rascunho
- [Li et al., 2024 -- "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) -- topologia de arvore dinamica
- [Li et al., 2025 -- "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) -- correspondencia treinamento-teste
- [Fu, Haotian, Peng et al., 2024 -- "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) -- decodificacao Jacobi/lookahead, alternativa sem eespecificaçãoulador
