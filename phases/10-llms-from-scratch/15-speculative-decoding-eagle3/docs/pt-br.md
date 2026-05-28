# Decodificacao Eespecificaçãoulativa e EAGLE-3

> A Fase 7, Aula 16 provou a matematica: a rejeicao de Leviathan preserva a distribuicao do verificador exatamente. Esta aula e a visao da stack de treinamento da decodificacao eespecificaçãoulativa de producao em 2026. EAGLE-3 transformou o modelo de rascunho de uma aproximacao barata numa rede minuscula construida pra isso, treinada nos proprios hidden states do verificador, e adicionou um loop de teste durante treinamento que alinha suas distribucoes de treinamento e inferencia. Resultado: 3x a 6.5x de speedup de ponta a ponta, taxas de aceitacao por token acima de 0.9 em chat, sem troca de distribuicao. Toda stack de inferencia de producao em 2026 envia isso por padrao.

**Tipo:** Construir
**Linguagens:** Python (stdlib)
**Pre-requisitos:** Fase 7 · 16 (matematica de decodificacao eespecificaçãoulativa), Fase 10 · 12 (otimizacao de inferencia)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Enunciar o teorema de Leviathan em uma frase e provar que o loop eespecificaçãoulativo produz amostras identicamente distribuidas ao verificador.
- Percorrer a progressao de dois anos desde a decodificacao eespecificaçãoulativa simples (Leviathan 2023) passando por EAGLE, EAGLE-2 e EAGLE-3 e nomear a limitacao exata que cada etapa removeu.
- Calcular o speedup esperado a partir da taxa de aceitacao `alpha` e da razao de custo rascunho-verificador `c`, e escolher o comprimento otimo de rascunho `N` pra cada regime.
- Implementar o loop eespecificaçãoulativo completo do zero: rascunhar, verificar, reamostrar do resido, desfazer o KV cache na rejeicao, emitir o token bonus na aceitacao total.

## O Problema

A decodificacao autoregressiva num modelo 70B roda talvez 35 tokens por segundo num H100. A GPU nao esta nem perto de saturada. A largura de banda de memoria e o teto: cada token carrega 70B de pesos da HBM, faz uma etapa de aritmetica e produz uma unidade float. As unidades de compute ficam ociosas a maior parte do tempo.

A decodificacao eespecificaçãoulativa transforma isso num problema de throughput que voce consegue resolver de verdade. Um rascunho barato propoe `N` tokens em `N` forward passes pequenos. O verificador roda uma vez no prefixo mais todos os `N` rascunhos. Se a distribuicao do verificador na posicao `i` concorda com o rascunho (num sentido estatistico que vamos tornar preciso), aceitamos; se nao, rejeitamos e amostramos uma correcao da distribuicao residual. Um unico forward do modelo grande produz ate `N+1` tokens aceitos ao inves de um.

O teorema que importa e Leviathan, Kalman, Matias (ICML 2023): a distribuicao de saida e identica ao que amostrar direto do verificador produziria. Nao aproximadamente. Identiquement. Essa e a razao inteira pra decodificacao eespecificaçãoulativa ser aceitavel em producao -- e uma otimizacao pura de latencia sem troca de qualidade.

O que a Fase 7, Aula 16 te deu foi a matematica. O que esta aula te da e a stack de treinamento. Um bom rascunho vale 2x mais speedup que um rascunho barato. EAGLE, EAGLE-2 e EAGLE-3 (Li et al., 2024-2025) transformaram "rascunho = versao menor do mesmo modelo" em uma disciplina de engenharia precisa. Servidores de inferencia de producao em 2026 vem com EAGLE-3 por padrao.

## O Conceito

### O invariante: reamostragem por rejeicao de Leviathan

Seja `p(t)` a distribuicao do rascunho pro proximo token dado um prefixo, e `q(t)` a do verificador. Amostre um token de rascunho `d ~ p`. Aceite com probabilidade `min(1, q(d) / p(d))`. Na rejeicao, amostrar da distribuicao residual `(q - p)_+ / ||(q - p)_+||_1`. As amostragens resultantes sao distribuidas de acordo com `q`. Isso e verdade nao importa quao ruim `p` e -- quanto pior, mais voce rejeita, mas a saida continua exata.

Empilhe `N` dessas chamadas uma atras da outra usando um forward pass do verificador em `prefix + d_1 + ... + d_N`. O verificador retorna `q_1, q_2, ..., q_{N+1}` simultaneamente. Percorra da esquerda pra direita. Na primeira rejeicao na posicao `j`, amostrar de `residual(q_j, p_j)` e parar. Na aceitacao total, amostrar um token bonus de `q_{N+1}`.

### O que determina o speedup

Seja `alpha` a taxa de aceitacao esperada por token rascunhado. Seja `c = cost(draft) / cost(verifier)` a razao de custo. O numero esperado de tokens aceitos por forward do verificador e:

```
E[accepted] = (1 - alpha^(N+1)) / (1 - alpha)
```

O tempo real total esperado por token aceito e `(N * c + 1) / E[accepted]`. Minimize isso em relacao a `N` e voce tem o ponto ideal. Pra `alpha = 0.8, c = 0.05`: `N` otimo e por volta de 5-7, speedup e 3.2x. Pra `alpha = 0.95, c = 0.02`: `N` otimo e por volta de 8-10, speedup chega a 5x.

A maior alavanca e `alpha`. Ir de `alpha = 0.6` (rascunho simples) pra `alpha = 0.9` (EAGLE-3) com `N = 5` fixo te leva de 2.2 tokens aceitos esperados por forward do verificador pra 4.1. Quase 2x mais throughput do mesmo verificador.

### A progressao de dois anos

**Eespecificaçãoulativa simples (Leviathan, 2023).** Modelo de rascunho e um LLM menor treinado independentemente da mesma familia. Facil de conectar, `alpha` aproximado 0.6, speedup por volta de 2x no maximo.

**EAGLE-1 (Li et al., 2024).** Rascunho e um transformer minusculo -- tipicamente uma ou duas camadas -- que pega o hidden state da ultima camada do verificador como entrada e prediz o proximo token diretamente. Como o rascunho ve a representacao de features do verificador, sua distribuicao e muito mais proxima da do verificador. `alpha` sobe pra 0.7-0.8.

**EAGLE-2 (Li et al., 2024).** Adiciona uma arvore dinamica de rascunho: ao inves de propor uma unica sequencia de `N` tokens, propor uma arvore pequena de candidatos, pontuar cada um com o verificador em um forward pass (tree attention), e seguir o caminho de maior probabilidade. Comprimento do rascunho vira adaptativo por etapa. `alpha` por token do caminho aceito sobe acima de 0.85.

**EAGLE-3 (Li et al., 2025, NeurIPS).** Duas mudancas a mais. Primeiro, dropa a loss de predicao de features completamente -- EAGLE-1/2 treinava o rascunho pra casar com os hidden states do verificador, o que limita quanto dados ajudam. EAGLE-3 treina diretamente em predicao de token. Segundo, teste durante treinamento (TTT): durante o treinamento do rascunho, alimentar as proprias predicoes anteriores do rascunho como entradas por varias etapas, da mesma forma que opera na inferencia. Isso alinha as distribucoes de treinamento e teste e para a acumulacao de erros. Speedup medido: ate 6.5x em chat, melhoria de 38% de throughput em batch 64 no SGLang num H100.

### Rollback do KV cache

A verificacao estende o KV cache do verificador por `N` entradas em uma passada. Se a rejeicao acontece na posicao `j`, os conteudos do cache alem da posicao `j-1` agora estao errados. Duas implementacoes comuns: escrever num buffer temporario e commitar na aceitacao (vLLM, TensorRT-LLM), ou manter um KV cache fisico mais um comprimento logico e truncar na rejeicao. De qualquer forma, o custo do rollback e bytes por camada por head, que e desprezivel comparado ao custo do forward pass.

Pra busca em arvore do EAGLE-2, o verificador roda attention com uma mascara nao-causal que respeita a topologia da arvore. A engenharia e trabalhosa mas o calculo e uma chamada padrao de flash-attention com uma mascara custom.

### Arquiteturas de rascunho em 2026

| Estrategia | Tipo de rascunho | `alpha` | Speedup | Custo de treinamento |
|-----------|-----------------|---------|---------|---------------------|
| Simples | LLM menor separado | 0.55-0.70 | 1.8-2.3x | Nenhum (reutiliza modelo menor existente) | 
| Medusa | Heads LM extras no verificador | 0.65-0.75 | 2-3x | ~1B tokens SFT |
| EAGLE-1 | Transformer 1-camada em hidden states | 0.70-0.80 | 2.5-3x | ~60B tokens |
| EAGLE-2 | EAGLE-1 + arvore dinamica de rascunho | 0.80-0.88 | 3-4x | ~60B tokens |
| EAGLE-3 | Fusao de features multi-camada + TTT | 0.88-0.92 | 3.5-6.5x | ~60-200B tokens |
| Lookahead | Sem rascunho (iteracao Jacobi) | N/A | 1.3-1.6x | Nenhum |

Em producao em 2026: vLLM e SGLang vem com EAGLE-3 por padrao quando disponivel, EAGLE-2 caso contrario. TensorRT-LLM tem o caminho Medusa mais rapido pra modelos publicos da Meta e NVIDIA. llama.cpp envia rascunho simples pra implantação em CPU.

## Construir

Veja `code/main.py`. Este e o loop eespecificaçãoulativo completo de Leviathan com todas as pecas: rascunho de N, passada paralela do verificador, rejeicao por posicao, amostragem residual, token bonus, rollback do KV e verificacao empirica de que a distribuicao de saida combina com amostragem direta de `q`.

### Passo 1: a regra de rejeicao

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### Passo 2: distribuicao residual

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### Passo 3: um passo eespecificaçãoulativo completo

A funcao `especificação_step` rascunha `N` tokens de `p`, depois verifica todos de uma vez em uma avaliacao paralela de `q`. Para cada token rascunhado aplica a regra de rejeicao, e na primeira rejeicao amostra a correcao do residual. Se tudo aceitar, emite um token bonus de `q_{N+1}`.

### Passo 4: contabilidade do rollback do KV

O simulador rastreia um `kv_length` logico por worker. Na aceitacao de `k` rascunhos, `kv_length += k`. Na rejeicao na posicao `j`, o cache ja foi escrito alem de `j`, mas o comprimento logico e setado pra `prefix_length + j + 1` -- um alem do token de correcao. Leituras subsequentes truncam pro comprimento logico.

### Passo 5: a verificacao de Leviathan

Rode 50.000 passos eespecificaçãoulativos. Conte a distribuicao empirica de tokens aceitos. Compare com 50.000 amostragens diretas de `q`. A estatistica chi-quadrado deve estar bem abaixo do valor critico. O teorema passa na pratica.

### Passo 6: speedup vs. alpha

Varie a qualidade do rascunho perturbando `p` em relacao a `q` em diferentes amplitudes. Meça `alpha`, depois plote tokens esperados por chamada do verificador como funcao de `alpha` e `N`. O codigo imprime uma tabela mostrando como qualidade de rascunho classe EAGLE-3 (`alpha` aproximado 0.9) desbloqueia 4-5 tokens por chamada do verificador.

## Usar

`vllm serve` em nivel de producao com EAGLE-3:

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --especificaçãoulative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_especificaçãoulative_tokens": 5,
    "method": "eagle3"
  }'
```

SGLang com EAGLE-3 em batch 64 num H100: aproximadamente 1.38x mais throughput que decodificacao simples em batch 64, de acordo com o paper EAGLE-3.

Quando usar decodificacao eespecificaçãoulativa:

- Qualquer carga de chat interativo onde latencia p50 importa mais que throughput pico.
- Geracao de codigo e saidas estruturadas (JSON, SQL). `alpha` e acima de 0.9 porque a distribuicao alvo e altamente previsivel.
- Geracao de texto longo (milhares de tokens). O speedup amortizado continua pagando.

Quando nao usar:

- Modelos muito pequenos (< 3B). O rascunho nao e tao mais barato que o verificador.
- Deploy em CPU batch-1 minusculo. O overhead de memoria do modelo de rascunho pode nao valer.
- Amostragem criativa em temperatura onde `alpha` despenca.

## Entregar

Esta aula produz `outputs/skill-eagle3-tuner.md`. Dada uma carga de inferencia (modelo, batch size, latencia alvo, perfil de tarefa), recomenda uma estrategia de decodificacao eespecificaçãoulativa e parametros de ajuste (familia do rascunho, `N`, profundidade da arvore, troca consciente de temperatura).

## Exercicios

1. Rode `code/main.py`. Confirme que a estatistica chi-quadrado na verificacao da distribuicao de Leviathan fica abaixo do valor critico de 95% em 50.000 amostras.

2. Varie `N` de 1 a 10 com `alpha` fixo em 0.9 e `c` fixo em 0.04. Plote tokens esperados por chamada do verificador e tempo real por token. Encontre o `N` que minimiza o tempo real. Explique a forma da curva.

3. Modifique o codigo pra simular busca em arvore EAGLE-2: a cada etapa, o rascunho propoe uma arvore de formato `[2, 2, 2]` (oito caminhos candidatos). O verificador roda uma vez e o caminho aceito de maior probabilidade vence. Calcule `alpha` por folha e tokens totais por chamada do verificador. Compare com decodificacao eespecificaçãoulativa em cadeia linear no mesmo compute.

4. Implemente um simulador de rollback KV em batch pra duas sequencias concorrentes. Sequencia A tem todos os rascunhos aceitos; sequencia B rejeita na posicao 2. Mostre que o `kv_length` correto e atualizado por sequencia e que nenhum trabalho e desperdicado.

5. Leia a Secao 4 do paper EAGLE-3 (Training-Time Test). Explique em duas frases por que o treinamento de rascunho ingenuo sem TTT sofre de vies de exposicao, e por que alimentar o rascunho com suas proprias predicoes durante treinamento corrige isso. Conecte isso a literatura de scheduled sampling em seq2seq.

## Termos Principais

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Regra de Leviathan | "min(1, q sobre p)" | Bernoulli aceitar/rejeitar com probabilidade `min(1, q(d)/p(d))`, preserva a distribuicao do verificador exatamente quando voce amostra do residual na rejeicao |
| Distribuicao residual | "(q menos p) mais, normalizado" | `(q - p)_+` truncado em zero e renormalizado -- a distribuicao correta pra amostrar na rejeicao |
| Taxa de aceitacao alpha | "quao seguido o rascunho ta certo" | Probabilidade esperada de sucesso de Bernoulli por token sob a regra de rejeicao; governa toda a matematica de speedup |
| EAGLE-1 | "rascunho de hidden state" | Rascunho transformer minusculo condicionado no hidden state da ultima camada do verificador (Li et al., 2024) |
| EAGLE-2 | "arvore dinamica de rascunho" | EAGLE-1 mais uma arvore de continuacoes candidatas pontuadas com tree attention em uma passada do verificador |
| EAGLE-3 | "teste durante treinamento" | Dropa a loss de predicao de features, treina em predicao direta de token com o rascunho recebendo seus proprios outputs durante treinamento |
| Teste durante treinamento (TTT) | "correcao de vies de exposicao" | Rodar o rascunho autoregressivamente durante treinamento pra que as distribuicoes de entrada de treino e teste combinem -- analogo direto do scheduled sampling |
| Rollback do KV | "desfazer rascunho rejeitado" | Contabilidade que reseta o cache KV do verificador pro comprimento do prefixo aceito apos uma rejeicao |
| Token bonus | "o gratis" | Quando todos os `N` rascunhos aceitam, amostrar um extra de `q_{N+1}` sem custo adicional de verificador |
| Tree attention | "verificar varios candidatos de uma vez" | Attention com mascara nao-causal que respeita a topologia de uma arvore de rascunho; calcula `q_i` pra cada no na arvore em um forward pass |

## Leitura Complementar

- [Leviathan, Kalman, Matias -- Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) -- o paper fundamental e teorema de equivalencia
- [Chen et al. -- Accelerating Large Language Model Decoding with Speculative Sampling (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) -- introducao independente concorrente com prova limpa
- [Li et al. -- EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) -- EAGLE-1, rascunho condicionado em hidden state
- [Li et al. -- EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) -- busca em arvore dinamica
- [Li et al. -- EAGLE-3: Scaling up Inference Acceleration via Training-Time Test (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) -- o padrao de producao em 2026
- [Cai et al. -- Medusa: Multiple Decoding Heads (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) -- abordagem alternativa sem rascunho
- [Documentacao de Decodificacao Eespecificaçãoulativa do vLLM](https://docs.vllm.ai/en/latest/features/especificação_decode.html) -- referencia de producao canonica com todas as estrategias conectadas
