# Previsão de multi-tokens (MTP)

> Cada LLM autoregressivo do GPT-2 para o Llama 3 entra em uma perda por posição: prevê o próximo token. DeepSeek-V3 adicionou uma segunda perda por posição: prevê o token depois disso. Os parâmetros extras 14B (em um modelo 671B) foram destilados de volta para o modelo principal através do fluxo de gradiente, e as cabeças MTP treinadas foram reutilizados na inferência como desenhadores de decodificação especulativa com aceitação de 80%+. A geração de 1,8x veio de graça. Esta lição constrói o módulo MTP sequencial do relatório técnico do DeepSeek, calcula a perda e o layout de parâmetros de cabeçalho compartilhado, e explica por que o MTP mantém a cadeia causal enquanto o MTP paralelo original do Gloeckle et al. o quebrou.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 04 (pre-training a mini GPT), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Estabelecer o objetivo de treinamento MTP e derivar a perda conjunta em profundidades de previsão.
- Explique a diferença entre os cabeças MTP paralelas de Gloeckle et al. (2024) e os módulos MTP sequenciais de DeepSeek-V3 e por que o projeto sequencial preserva a cadeia causal.
- Calcular o parâmetro e a carga de memória da adição de módulos MTP a uma corrida pré-treinamento.
- Implementar um módulo MTP a partir do zero: a incorporação compartilhada, o bloco de transformador por profundidade, a projeção e a cabeça de saída compartilhada.

## O problema

A previsão do próximo token é o objetivo padrão de formação LLM. Cada estado oculto é supervisionado para prever exatamente uma coisa: o token imediatamente seguinte. É um sinal surpreendentemente fraco. A maioria das informações em uma sequência se estende além de uma estrutura simbólica, coerência, factualidade, fluxo aritmético. O modelo tem que aprender esses acumular muitos sinais de um token em trilhões de tokens.

O MTP pergunta: e se cada estado oculto fosse supervisionado para prever múltiplos tokens futuros ao mesmo tempo? Gloeckle et al. (Meta, 2024) mostrou que isso ajuda. A sua implementação colocou várias cabeças de saída independentes no topo da coluna vertebral, cada uma predizendo um offset diferente. Paralelas, simples, mas as cabeças viram o mesmo estado oculto sem qualquer refinamento hierárquico e as previsões não se acorrentaram causalmente, por isso não poderiam ser usadas para descodificação especulativa.

DeepSeek-V3 (dezembro de 2024) redesenhou MTP como módulos sequenciais que mantêm a cadeia causal em cada profundidade de previsão.`t+1`de`h_i^(0)`, então prevê .`t+2`de um novo estado escondido .`h_i^(1)`que combinados `h_i^(0)`com o `E(t+1)`A profundidade é o seu próprio pequeno bloco transformador. A cabeça de entrada compartilhada e a cabeça de saída compartilhada mantêm o parâmetro sobre a cabeça modesta. Na escala do DeepSeek-V3, 14B parâmetros extras em módulos MTP em cima dos pesos do modelo principal 671B. Esse 2% comprou sinais de treinamento mais densos E um rascunho de descodificação especulativa pronto em inferência.

Esta lição constrói um único módulo MTP e a perda de profundidade D a partir do zero.

## O conceito

### A receita de MTP sequencial

DeepSeek-V3 adiciona `D`Modulos MTP em cima do modelo principal.`t_{i+1}`Cada módulo .`k`(para `k = 1..D`) prevê o token `k`Passo mais longe,`t_{i+k+1}`, dado um prefixo através da posição `i`- Não .

Modulo `k`Consiste em:

- Um bloco de transformador .`T_k`com a sua própria atenção e MLP.
- Uma matriz de projecção `M_k`que combina o estado oculto anterior com a incorporação do próximo token de verdade fundamental.
- A integração compartilhada `E`(o mesmo que o modelo principal).
- O cabeçalho de saída compartilhado `Out`(o mesmo que o modelo principal).

No treino, para um prefixo através de posição `i`, o estado oculto por profundidade é:

```math
\begin{aligned}
h_i^{(0)} &= \text{main model backbone at position } i \\
h_i^{(k)} &= T_k\Big( M_k \cdot \mathop{\mathrm{concat}}\big(\mathop{\mathrm{RMSNorm}}(h_i^{(k-1)}), \mathop{\mathrm{RMSNorm}}(E(t_{i+k}))\big) \Big) \quad \text{for } k \ge 1
\end{aligned}
```

A previsão por profundidade é:

```math
\text{logits}_{i+k+1} = \mathop{\mathrm{Out}}(h_i^{(k)}) \quad \text{for } k = 1, \ldots, D
```

A perda por profundidade é a entropia cruzada contra a verdade fundamental .`t_{i+k+1}`- Não .

```math
L_k = \mathop{\mathrm{CE}}(\text{logits}_{i+k+1}, t_{i+k+1})
```

A perda articular através de profundidades:

```math
L_{\text{MTP}} = \frac{\lambda}{D} \sum_{k=1}^{D} L_k
```

`lambda`O DeepSeek-V3 utiliza 0,3 para o primeiro 10% do treino e 0,1 depois.`L_main + L_MTP`- Não .

### Por que sequenciais, não paralelos?

O MTP paralelo original do Gloeckle tinha cabeças de saída D, cada uma aplicada diretamente a `h_i^(0)`Cada cabeça prevê .`t_{i+k}`O que treina bem, mas as previsões não estão condicionadas umas às outras.`head_1`- A saída para ajudar .`head_2`- As cabeças disparam em paralelo.

O projeto sequencial do DeepSeek-V3 construi.`h_i^(k)`de`h_i^(k-1)`+ a incorporação real do next-token `E(t_{i+k})`O que preserva a cadeia causal: prever .`t_{i+k+1}`, o módulo em profundidade `k`Vejo o que estava a acontecer .`t_{i+k}`. Isto é estruturalmente idêntico ao modo como um decodificador autoregressivo consome a sua própria saída, o que torna os módulos MTP directamente utilizáveis como desenhadores de decodificação especulativa.

Na inferência: alimentação`h_i^(k-1)`e os desenhados `t_{i+k}`em módulo `k`, obter uma previsão para`t_{i+k+1}`Repito. É exatamente um esboço do estilo EAGLE, usando o módulo MTP treinado como o esboço da rede. DeepSeek-V3 relata aceitação de 80% + no primeiro módulo MTP e ~ 1,8x de velocidade.

### Contabilidade de parâmetros

Para um modelo com escondidas`h`e vocabulário `V`- Não .

- Modelo principal: bilhões de parâmetros, mais um cabeçalho de saída de tamanho `V * h`- Não .
- Cabeça de saída compartilhada: reutilizar a cabeça do modelo principal.
- Embedagem compartilhada: reutilizar a embebedagem do modelo principal.
- Modulo por MTP:
  - Projecção `M_k`- Não .`(2h) * h = 2h^2`- Não .
  - Bloco de transformador `T_k`: atenção (`4h^2`para MHA) mais MLP (normalmente `8h^2`para SwiGLU com uma proporção de 8/ 3.`12h^2`Por quarteirão.

Total extra por módulo: `~14h^2`Para o DeepSeek-V3.`h = 7168`, D = 1 módulo: `~14 * 7168^2 = ~720M`O DeepSeek-V3 relata 14B  a diferença é que a maioria das camadas de especialistas são MoE no módulo MTP também.

### O pagamento de descodificação especulativa

Durante o pré-treino, os módulos MTP retardar o treinamento em cerca de 10% (mais computação avançada, perda extra).

1. Denser sinal de treinamento. Cada estado oculto vê metas de supervisão D + 1. Efeito medido em MMLU, GSM8K, MATH, HumanEval: melhorias consistentes de poucos pontos percentuais nas ablações do DeepSeek-V3.

2. O módulo MTP já é treinado para prever os próximos tokens. Reutilizado como uma rede de projetos, ele oferece taxas de aceitação de 80%+. N = 3 ou N = 5 especificação de decodificação dá 1,8 × de throughput. O custo de tempo de treinamento de 10% paga pela primeira vez que você executar inferência.

### Relação com a AGLE

A Eagle treina um modelo de projeto pequeno SEPARATELmente após o pré-treino.

| Dimension | EAGLE-3 | MTP (DeepSeek-V3) |
|-----------|---------|------------------|
| When trained | Post-pre-training | During pre-training |
| Backward-compatible with existing weights | Yes | No (need to re-train) |
| Draft params | 1-2 transformer layers | 1 transformer block + projection |
| Acceptance rate | 0.88-0.92 | 0.80+ at depth 1 |
| Benefit beyond speedup | Speculative decoding only | Denser training signal + speedup |

```figure
multi-token-predict
```

## Construí-lo

`code/main.py`Construi um único módulo MTP de ponta a ponta: inserção compartilhada, projeção, bloco transformador, cabeçalho de saída compartilhado.

### Passo 1: Tabela de inserção compartilhada

Um único .`vocab_size x hidden`A tabela é usada pelo modelo principal E por todos os módulos MTP em todas as profundidades.

### Passo 2: combinação por profundidade

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

O DeepSeek-V3 real concatenou os dois vetores RMSNormed para `[2h]`e projectos com um `h x 2h`O brinquedo usa adição de vetores para a brevidade do STDlib.

### Passo 3: o bloco do transformador na profundidade k

Auto-atenção mais MLP. No brinquedo, um bloco de atenção linear de uma camada e um MLP SwiGLU mantêm a estrutura visível sem nómpia.

### Passo 4: cabeçalho de saída compartilhado

Reutilizar a projeção de saída do modelo principal.

### Passo 5: perda por profundidade

Entropia cruzada de softmax (logits) contra o token de verdade base em compensação`k+1`- Agregam-se através das profundidades com o`lambda / D`Fator de escala.

### Passo 6: Contabilidade de parâmetros

Imprima a contagem total de parâmetros, a contagem compartilhada (embedded, head) e a contagem extra por módulo. Mostre a relação entre MTP extra e tamanho do modelo principal.

## Usá-lo

O MTP é integrado na série DeepSeek-V3 (dezembro de 2024) e DeepSeek-R1.

- A própria pilha de serviço da DeepSeek consome módulos MTP como descifradores especulativos fora da caixa.
- A vLLM e a SGLang têm caminhos de integração para DeepSeek-V3 MTP a partir de abril de 2026.
- O tutorial ROCm SGLang da AMD mostra uma configuração específica de decodificação especulativa MTP com aceleração medida 1,8x no checkpoint V3.

Quando utilizar o MTP numa nova corrida pré-treinamento:

- Controlas o conjunto completo de treinamento e queres bancar um sinal de treinamento mais denso.
- Sabe que vai servir o modelo em escala e quer descodificação especulativa de graça.
- O seu tamanho escondido é pelo menos 4096.

Quando não:

- Apontação de um modelo denso pré-treinado existente.
- Modelos de pesquisa onde se quer uma linha de base limpa para comparar.

## Envia-o

Esta lição produz`outputs/skill-mtp-planner.md`. Tendo em conta uma especificação pré-formação ( tamanho do modelo, dados, computação), ele retorna um plano para a integração do MTP: número de profundidades D, `lambda`programação, memória de carga, e o tempo de inferência de descodificação especulativa.

## Exercícios

1. Corra .`code/main.py`. Mostre que a perda por profundidade diminui monotonicamente à medida que o sinal sintético se fortalece. Modifique o sintético para usar um padrão fixo e verifique a convergência das perdas de profundidade-1 e profundidade-2.

2. Compute o custo de parâmetro para um modelo 70B denso (escondido 8192, 80 camadas) com módulo D = 1 MTP. Compare com o custo de parâmetro 14B relatado pelo DeepSeek-V3. Explique por que o número do DeepSeek é maior: o bloco de transformador MTP herda a mesma estrutura MoE, inflacionando a contagem de parâmetros por módulo.

3. Implementar D=2 no brinquedo: adicionar um segundo módulo MTP que leva $h^{(1)}$e prevê .`t_{i+3}`Verifique a perda conjunta e a contabilidade dos parâmetros coincide com as equações 19-21 do papel do DeepSeek.

4. Mudar o brinquedo para MTP paralelo (estilo de Gloeckle): adicionar cabeças de saída D em cima do estado oculto principal, cada uma prevendo um offset diferente. Medir como as perdas por profundidade comparam com a versão sequencial no mesmo sinal sintético. A versão sequencial deve produzir menor perda de profundidade k para k > 1 porque condiciona as previsões intermediárias.

5. Utilize o módulo MTP formado como um esboço de estilo EAGLE: convoque o módulo k para propor `t_{i+k+1}`Se você atingir 50% + no brinquedo, você reproduz a propriedade empírica MTP-as-draft.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MTP module | "Extra loss block" | A small transformer block plus projection that predicts a token `k` positions ahead of the main model |
| Prediction depth | "Which offset" | The integer `k` such that module `k` predicts `t_{i+k+1}` from prefix through position `i` (the main model is depth 0 and predicts `t_{i+1}`) |
| Parallel MTP | "Gloeckle-style" | D independent heads on the same backbone hidden state, no conditional chain |
| Sequential MTP | "DeepSeek-V3 style" | Each module conditions on the previous depth's hidden state plus the next token's embedding; preserves causal chain |
| Shared output head | "Reuse the main head" | The MTP modules call the main model's LM head, not a separate output projection |
| Shared embedding | "Reuse the main table" | Same vocabulary embedding table is used everywhere; no duplicate parameters |
| Projection matrix $M_k$ | "Combine hidden + next-token" | An `h x 2h` linear layer that folds the previous hidden state and the target-token embedding into the next depth's input |
| Joint loss $L_{\text{MTP}}$ | "Averaged extra losses" | Arithmetic mean of per-depth cross-entropy losses, scaled by `lambda` |
| Acceptance rate at depth 1 | "How often MTP draft is right" | The rate at which the D=1 MTP module's top-1 prediction equals the main model's top-1 prediction; 80%+ on DeepSeek-V3 |
| Lambda weighting | "Extra-loss importance" | Per-depth scaling factor; 0.3 at start of training, 0.1 later on DeepSeek-V3 |

## Mais leitura

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) a descrição completa do MTP sequencial (secção 2.2), incluindo as equações de perda conjunta e a aceleração de 1,8× na inferência
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) a linha de base paralela de MTP
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) 685B total (671B principal + 14B MTP), notas de implantação
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) o quadro de decodificação especulativa MTP se encaixa em
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) A arquitetura de projecto de 2025 da EAGLE, a contraparte MTP, compete com a
