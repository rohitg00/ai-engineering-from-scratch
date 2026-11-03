# Descodificação especulativa e EAGLE-3

> Fase 7 · Lição 16 provou a matemática: a regra de rejeição Leviatã preserva a distribuição do verificador exatamente. Esta lição é a visão de formação-pilha da descodificação especulativa de produção de 2026. A EAGLE-3 transformou o modelo de projeto de uma aproximação barata em uma rede pequena construída para fins treinados nos próprios estados ocultos do verificador, depois adicionou um ciclo de teste de treinamento que alinha suas distribuições de trem e inferência. Resultado: 3x a 6,5x end-to-end speedup, taxas aceitas por token acima de 0,9 no chat, sem compensação distributiva. Todas as inferências de produção em 2026 enviam-na por padrão.

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 7 · 16 (speculative decoding math), Phase 10 · 12 (inference optimization)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique o teorema de Leviatã em uma frase e prove que o ciclo especulativo produz amostras distribuídas de forma idêntica para o verificador.
- Caminhe a progressão de dois anos desde a descodificação de especificações de baunilha (Leviathan 2023) até a EAGLE, EAGLE-2 e EAGLE-3 e nomeie a limitação exata de cada passo removido.
- Calcule a velocidade esperada da taxa de aceitação `α`e relação custo entre o projecto e o verificador `c`, e escolher o comprimento óptimo do esboço `N`Para cada regime.
- Implementar o ciclo especulativo completo a partir do zero: desenhar, verificar, rejeitar-mostrar do residual, rolar o cache KV de volta na rejeição, emitir o token de bônus na aceitação completa.

## O problema

A decodificação autoregressiva em um modelo 70B funciona com cerca de 35 tokens por segundo em um H100. A GPU não está nem perto de saturada. A largura de banda de memória é o teto: cada token carrega 70B de pesos do HBM, faz um passo de aritmética e produz um flutuante.

A descodificação especulativa transforma isso num problema de capacidade que você pode realmente resolver.`N`Tokens em `N`O verificador corre uma vez no prefixo mais todos`N`Se a distribuição do verificador na posição `i`A taxa de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de variação de`N+1`aceitou tokens em vez de um.

O teorema que importa é Leviathan, Kalman, Matias (ICML 2023): a distribuição de saída é idêntica à que a amostragem do verificador diretamente teria produzido. Não aproximadamente. Identicamente. Esta é toda a razão pela qual a descodificação especulativa é aceitável na produção.

O que a Fase 7 · Lição 16 lhe deu foi a matemática. O que esta lição lhe dá é a pilha de treinamento. Um bom rascunho vale 2 vezes mais velocidade do que um rascunho barato. EAGLE, EAGLE-2, e EAGLE-3 (Li et al., 20242025) transformaram "draft = versão menor do mesmo modelo" em uma disciplina de engenharia precisa. Servidores de inferência de produção 2026 são padrão para EAGLE-3.

## O conceito

### A invariante: amostragem de rejeição de Leviatã

Deixe-me .`p(t)`ser a distribuição do esboço para o próximo símbolo dado algum prefixo, e `q(t)`- É do verificador.`d ~ p`Aceita com probabilidade .`min(1, q(d) / p(d))`- No caso de rejeição, amostra da distribuição residual `(q - p)_+ / ||(q - p)_+||_1`As amostras resultantes são distribuídas de acordo com `q`Isto é verdade , não importa o quão mau .`p`Quanto pior é, mais frequentemente rejeita, mas a saída permanece exata.

- A pilha .`N`de estas chamadas de volta para volta usando um verificador de passagem de adiante `prefix + d_1 + ... + d_N`O verificador retorna .`q_1, q_2, ..., q_{N+1}`A primeira rejeição na posição de saída.`j`, amostra de `residual(q_j, p_j)`Após a aceitação completa, mostre um token de bônus de`q_{N+1}`- Não .

### O que determina a aceleração

Deixe-me .`α`O valor de receção de cada token elaborado deve ser o valor esperado.`c = cost(draft) / cost(verifier)`O número esperado de tokens aceites por verificador a prazo é:

```math
\mathbb{E}[\text{accepted}] = \frac{1 - \alpha^{N+1}}{1 - \alpha}
```

O tempo total esperado de parede por token aceito é `(N * c + 1) / E[accepted]`Minimizar isso em relação a`N`E você tem o ponto de amor.`α = 0.8, c = 0.05`: óptimo `N`é de cerca de 57, velocidade é de 3,2×.`α = 0.95, c = 0.02`: óptimo `N`É cerca de 8×10, aceleração empurra 5×.

A maior alavanca é`α`- A partir de`α = 0.6`(projeto de vavilha) a `α = 0.9`(AEGLE-3) em fixa `N = 5`leva-o de 2,2 tokens aceitos esperados por verificador para 4.1. quase 2x mais capacidade do mesmo verificador.

### A evolução de dois anos

**Vanilla speculative (Leviathan, 2023).**O modelo de projecto é um LLM de formação independente, de pequena dimensão, da mesma família.`α ≈ 0.6`A velocidade é de 2x, no máximo.

**EAGLE-1 (Li et al., 2024).**Draft é um transformador minúsculo  tipicamente uma ou duas camadas  que toma o estado oculto da última camada do verificador como entrada e prevê o próximo token diretamente.`α`subirá para 0,70,8.

**EAGLE-2 (Li et al., 2024).**Adiciona um árvore de rascunho dinâmico: em vez de propor uma única sequência de `N`Os candidatos podem ser seleccionados para a selecção de um novo projecto, que é um projecto de estudo, que é um projecto de estudo, que é um projecto de estudo, que é um projecto de estudo, que é um projecto de estudo, que é um projecto de estudo, que é um projecto de estudo, que é um projecto de estudo, que é um projecto de estudo, que é um projecto de estudo e que é um projecto de estudo.`α`por token de caminho aceito sobe acima de 0,85.

**EAGLE-3 (Li et al., 2025, NeurIPS).**Mais duas mudanças. Primeiro, desligue a perda de previsão de recursos inteiramente  EAGLE-1/2 treinou o rascunho para combinar os estados ocultos do verificador, o que limita o quanto os dados ajudam. A Eagle-3 treina diretamente em previsão de token. Segundo, teste de tempo de formação (TTT): durante o treinamento de projetos, reproduzir as próprias previsões anteriores do projecto como entradas em várias etapas, da mesma forma que funciona na inferência. Esta coordena a distribuição do trem e do ensaio e impede o acúmulo de erros. A velocidade medida: até 6,5x no chat, melhoria de 38% no batch 64 no SGLang no H100.

### Rolo de volta do cache KV

Verificação estende o cache KV do verificador por `N`Se a rejeição ocorrer na posição`j`, o cache contém o passado posição `j-1`Duas implementações comuns: escrever para um buffer de arranque e comprometer-se na aceitação (vLLM, TensorRT-LLM), ou manter um cache KV físico mais um comprimento lógico e truncate no rejeito.

Para a pesquisa de árvores EAGLE-2, o verificador corre a atenção com uma máscara não causal que respeita a topologia das árvores.

### Projetos de arquiteturas em 2026

| Strategy | Draft type | `α` | Speedup | Training cost |
|----------|-----------|-----|---------|---------------|
| Vanilla | Separate small LLM | 0.55-0.70 | 1.8-2.3× | None (reuse existing small model) |
| Medusa | Extra LM heads on verifier | 0.65-0.75 | 2-3× | ~1B SFT tokens |
| EAGLE-1 | 1-layer transformer on hidden states | 0.70-0.80 | 2.5-3× | ~60B tokens |
| EAGLE-2 | EAGLE-1 + dynamic draft tree | 0.80-0.88 | 3-4× | ~60B tokens |
| EAGLE-3 | Multi-layer feature fusion + TTT | 0.88-0.92 | 3.5-6.5× | ~60-200B tokens |
| Lookahead | No draft (Jacobi iteration) | N/A | 1.3-1.6× | None |

O `α`A coluna é a taxa de aceitação por token ao longo do caminho aceito, em benchmarks de chat, com um esboço treinado em dados de chat correspondentes. É a banda superior. Fase 10 · 25 cita 0,82 para EAGLE-3 de uma configuração diferente, e Fase 17 · 05 planeja implantações de produção com 0,6 a 0,8 no chat geral. Medida `α`em seu próprio tráfego antes de escolher `N`- Não .

Em 2026 produção: vLLM e SGLang padrão para EAGLE-3 quando disponível, EAGLE-2 de outra forma. TensorRT-LLM tem o caminho mais rápido Medusa para os modelos públicos Meta e NVIDIA. llama.cpp navega vanilla draft para implantações de CPU.

```figure
l5-spec-decode-eagle
```

## Construí-lo

Veja .`code/main.py`. Este é o ciclo especulativo completo Leviathan com todas as peças: Draft-of-N, verificador pass paralelo, rejeição por posição, amostragem residual, token de bônus, rollback KV e verificação empírica de que a distribuição de saída corresponde ao amostragem direta de `q`- Não .

### Passo 1: regra da rejeição

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### Passo 2: distribuição residual

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### Passo 3: um passo especulativo completo

O `spec_step`Projetos de funções `N`Tokens de `p`, depois verifica-los todos em um paralelo .`q`A avaliação: para cada token elaborado, aplica a regra da rejeição e na primeira rejeição, mostra a correção do residual.`q_{N+1}`- Não .

### Passo 4: Contabilidade de retrocesso do KV

O simulador rastreia uma lógica .`kv_length`- a aceitação de`k`Projetos, `kv_length += k`- Sobre um rejeição em posição`j`, o cache já está escrito passado `j`, mas o comprimento lógico é definido para `prefix_length + j + 1` um passando o token de correcção.

### Passo 5: o cheque Leviatã

Faça 50.000 passos especulativos, conte a distribuição empírica dos tokens aceitos, compare com 50.000 amostras diretas de`q`A estatística do quadrado de chi deve estar bem abaixo do valor crítico.

### Passo 6: aceleração vs. α

Esvaziar a qualidade do esboço perturbando`p`longe de`q`- em diferentes amplitudes.`α`, em seguida , traçar os tokens esperados por chamada de verificador como função de `α`E ...`N`O código imprime uma tabela que mostra a qualidade dos projectos da classe EAGLE-3 (`α ≈ 0.9`) desbloqueia 45 tokens por chamada de verificador.

## Usá-lo

Nível de produção `vllm serve`com EAGLE-3:

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --speculative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_speculative_tokens": 5,
    "method": "eagle3"
  }'
```

SGLang com EAGLE-3 no lote 64 no H100: aproximadamente 1,38x mais capacidade do que a descodificação de baunilha do lote 64, por papel EAGLE-3.

Quando procurar a descodificação especulativa:

- Qualquer carga de trabalho interativa de chat onde a latência p50 importa mais do que o pico de transmissão.
- Geração de código e saída estruturada (JSON, SQL). `α`A distribuição-alvo é altamente previsível.
- A geração de long form (milhares de tokens).

Quando não:

- Modelos muito pequenos (< 3B).
- Pequenas implantações de CPU de lote 1.
- Amostragem criativa de temperaturas muito altas onde `α`- É um colapso.

## Envia-o

Esta lição produz`outputs/skill-eagle3-tuner.md`. Tendo em conta uma carga de trabalho de inferência (modelo, tamanho do lote, latência-alvo, perfil de tarefa), recomenda uma estratégia de descodificação especulativa e parâmetros de sintonização (família de projectos, `N`, profundidade da árvore, comutação de temperatura).

## Exercícios

1. Corra .`code/main.py`Confirmar a estatística de chi-quadrado da verificação de distribuição do Leviathan permanece abaixo do valor crítico de 95% em 50 000 amostras.

2. Esvaziar`N`de 1 a 10 com `α`0 e `c`O tempo de parede real por token.`N`Explica a forma da curva.

3. Modificar o código para simular a busca em árvores EAGLE-2: em cada etapa, o rascunho propõe uma árvore de forma `[2, 2, 2]`O verificador corre uma vez e o caminho aceito com maior probabilidade ganha.`α`Comparar com a descodificação das especificações de cadeia linear em cálculo equivalente.

4. Implementar um simulador de retrocesso de KV em lote para duas sequências simultâneas. A sequência A tem todos os rascunhos aceitos; a sequência B rejeita na posição 2.`kv_length`A informação é actualizada por sequência e não se desperdiça nenhum trabalho.

5. Leia a secção 4 (Test de Tempo de Treinamento) do documento EAGLE-3. Explique em duas frases por que o treinamento de projetos ingênuo sem TTT sofre de viés de exposição e por que alimentar o projeto com suas próprias previsões durante o treinamento o corrige.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Leviathan rule | "min(1, q over p)" | Bernoulli accept/reject with probability `min(1, q(d)/p(d))`, preserves the verifier distribution exactly when you sample from the residual on rejection |
| Residual distribution | "(q minus p) plus, normalized" | `(q - p)_+` clamped at zero and renormalized — the correct distribution to sample from on rejection |
| Acceptance rate α | "how often the draft is right" | Expected per-token Bernoulli-success probability under the rejection rule; governs all speedup math |
| EAGLE-1 | "hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden state (Li et al., 2024) |
| EAGLE-2 | "dynamic draft tree" | EAGLE-1 plus a tree of candidate continuations scored with tree attention in one verifier pass |
| EAGLE-3 | "training-time test" | Drops the feature-prediction loss, trains on direct token prediction with the draft fed its own outputs during training |
| Training-time test (TTT) | "exposure bias fix" | Run the draft autoregressively during training so train and test input distributions match — the direct analog of scheduled sampling |
| KV rollback | "undo rejected drafts" | Bookkeeping that resets the verifier's KV cache to the accepted-prefix length after a rejection |
| Bonus token | "the free one" | When all `N` drafts accept, sample one extra from `q_{N+1}` at no additional verifier cost |
| Tree attention | "verify many candidates at once" | Attention with a non-causal mask that respects the topology of a draft tree; computes `q_i` for every node in the tree in one forward pass |

## Mais leitura

- [Leviathan, Kalman, Matias — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) o documento fundamental e o teorema da equivalência
- [Chen et al. — Accelerating Large Language Model Decoding with Speculative Sampling (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) introdução simultânea independente com uma prova limpa
- [Li et al. — EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) EAGLE-1, projecto de estado oculto
- [Li et al. — EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) Busca dinâmica de árvores
- [Li et al. — EAGLE-3: Scaling up Inference Acceleration via Training-Time Test (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) o padrão de produção de 2026
- [Cai et al. — Medusa: Multiple Decoding Heads (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) abordagem alternativa sem projecto
- [vLLM Speculative Decoding documentation](https://docs.vllm.ai/en/latest/features/spec_decode.html) Referência de produção canónica com todas as estratégias ligadas
