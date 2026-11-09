# Atenção Diferencial (V2)

> A atenção Softmax espalha uma pequena quantidade de probabilidade sobre cada token não correspondente. Mais de 100 mil tokens que somam o ruído e afogam o sinal. O Transformador Diferencial (Ye et al., ICLR 2025) corrige-o computação de atenção como a diferença de dois softmaxes, subtraindo o piso de ruído compartilhado. DIFF V2 (Microsoft, janeiro 2026) é a reescritura de produção: correspondência de latência de decodificação com o Transformer de linha de base, sem kernels personalizados, compatível com FlashAttention. Esta lição é de V1 a V2 de ponta a ponta, com uma implementação de brinquedo de trabalho da operação de diferença que você pode executar em stdlib Python.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 02 (self-attention), Phase 7 · 15 (attention variants), Phase 10 · 14 (architecture walkthrough)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Explique precisamente por que a atenção softmax tem um nível de ruído e por que cresce com o comprimento do contexto.
- Derivar a fórmula de atenção diferencial e explicar por que a subtração cancela o componente de ruído compartilhado enquanto preserva o sinal.
- Caminhe a diferença entre V1 e V2: o que se tornou mais rápido, o que se tornou mais simples, o que se tornou mais estável e por que cada mudança era necessária para o treinamento pré-produção.
- Implementar atenção diferencial a partir do zero no Python puro e verificar empiricamente a propriedade de cancelamento de ruído em uma consulta sintética de sinal-mais-ruído.

## O problema

A atenção softmax padrão tem uma propriedade matemática que se transforma em uma dor de cabeça operacional em escala.`q`, os pesos de atenção são`softmax(qK^T / sqrt(d))`Softmax nunca pode produzir zeros exatos: cada token não correspondente obtém alguma massa positiva. Essa massa residual é ruído, e ele se escala com o comprimento do contexto. Em 128k tokens, mesmo que cada token não correspondente obtenha apenas 0,0001% da probabilidade, 127.999 deles combinados contribuem cerca de 13% do total. O modelo tem que aprender a percorrer um piso ruído que cresce com o contexto.

Empiricamente, isso aparece como interferência da cabeça de atenção: citações alucinadas em RAG de longo contexto, falhas perdidas no meio em tarefas de recuperação de tokens de 100k e degradação sutil da precisão em referências de agulha em manada de feno acima de 32k. O papel do Transformador Diferencial (arXiv:2410.05258, ICLR 2025) mediu a lacuna: os Transformadores DIFF atingiram menor perplexidade, maior precisão de contexto longo e menos alucinações do que as linhas de base do mesmo tamanho.

O DIFF V1 tinha três problemas que o mantiveram fora de canalizações de pré-treinamento fronteiriço. Seu cache de valor teve que ser carregado duas vezes por passo de decodificação, ele precisava de kernels CUDA personalizados que quebraram a compatibilidade FlashAttention, e seu RMSNorm por cabeça desestabilizou o treinamento de longo prazo em escala de 70B-plus. DIFF V2 (blog unilm da Microsoft, 20 de janeiro de 2026) resolveu os três. Esta lição percorre ambas as versões, constrói o operador de diferença e compara a cancelamento de ruído em uma consulta de brinquedo.

## O conceito

### O piso de ruído do softmax

Para uma consulta .`q`e chaves `K = [k_1, ..., k_N]`, pesos de atenção são:

```math
w_i = \frac{\exp(q \cdot k_i / \sqrt{d})}{\sum_j \exp(q \cdot k_j / \sqrt{d})}
```

Não , não .`w_i`É sempre zero.`k_i`Não tem nada a ver com o`q`, a pontuação`q . k_i`Não é 0  flutua em torno de zero com variação `||q||^2 / d`Após a normalização do softmax, cada token não relacionado ainda contribui.`O(1/N)`A contribuição total dos tokens não relacionados é `O((N-1)/N) = O(1)` não uma pequena quantidade.

O que o modelo quer é algo como um top-k duro: alto peso em tokens correspondentes, peso quase zero em todos os outros lugares. Softmax é muito suave para fazer isso diretamente.

### A ideia diferencial

Divida as projeções Q e K de cada cabeça em dois: $Q = (Q_1, Q_2)$E ...$K = (K_1, K_2)$Compute dois mapas de atenção:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d})
\end{aligned}
```

Output:

```math
\mathop{\mathrm{DiffAttn}} = (A_1 - \lambda \cdot A_2) V
```

A subtração cancela qualquer distribuição de ruído que os dois mapas compartilham. Se ambos os mapas tiverem peso aproximadamente uniforme nos tokens 127k não relacionados (que eles terão, em inicialização aleatória), esses cancelam. O sinal  peso máximo nos poucos tokens realmente relevantes  só cancelam se aparecer em ambos os mapas com a mesma magnitude, o que não acontecerá uma vez que o modelo se encaminhe.

`lambda`é um escalar aprendível por cabeça, parametrizado como `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`Pode ser negativo.`lambda_init`padrões para um pequeno número positivo como 0,8.

### Por que esta combinação de direção de cancelamento de ruído

Imagine dois microfones barulhentos gravando a mesma voz. Ambos pegam o alto-falante mais ruído de fundo correlacionado. Subtrair um do outro e o ruído compartilhado cai. A voz sobrevive porque os dois sinais diferem em fase ou amplitude o suficiente para evitar cancelamento completo.`lambda`Aprende exactamente este equilíbrio.

### V1 vs V2: a diferença

O V1 manteve a contagem de parâmetros igual à linha de base do Transformador. Para obter duas consultas por cabeça ele reduziu pela metade a dimensão da cabeça. Isso custou a expressividade da cabeça e  mais dolorosamente  reduziu pela metade o cache de valor por cabeça.

O V2 duplica o número de cabeças de consulta e mantém as cabeças de KV iguais (empréstimos de parâmetros da projeção ascendente). A dimensão da cabeça permanece a mesma que a linha de base. Após a subtração, a dimensão extra é projetada para baixo para corresponder à linha de base do Transformador $O_W$Três coisas acontecem ao mesmo tempo:

1. A velocidade de decodificação corresponde à linha de base (o cache KV é carregado uma vez).
2. FlashAttention é executado inalterado (sem kernel personalizado).
3. A intensidade aritmética na decodificação aumenta (mais cálculo por byte carregado a partir do HBM).

O V2 também remove o RMSNorm por cabeça que o V1 usou para estabilizar a subtração. Em escalas de pré-treino de classe 70B, esse RMSNorm desestabilizou o treinamento tardío.

### Quando chegar a ele

| Workload | Benefit |
|----------|---------|
| Long-context RAG (64k+) | Cleaner attention maps, fewer hallucinated citations |
| Needle-in-haystack benchmarks | Substantial accuracy lift past 32k |
| Multi-document QA | Less cross-document interference |
| Code completion at 8k | Marginal, not worth the architecture change |
| Short chat (< 4k) | Essentially indistinguishable from baseline |

O valor aumenta com o comprimento do contexto. Em tokens de 4k o piso de ruído é pequeno o suficiente para que a atenção padrão esteja bem. Em 128k está a machucá-lo.

### Como se apila com outros botões 2026

| Feature | Compatible with DIFF V2? |
|---------|------------------------|
| GQA | Yes (V2 increases Q heads, not KV heads) |
| MLA (DeepSeek) | Yes in principle, no published paper combining them |
| MoE | Yes (attention is independent of MLP block) |
| RoPE | Yes (unchanged) |
| YaRN / long-context scaling | Yes (exactly where DIFF helps most) |
| FlashAttention | Yes in V2 (was no in V1) |
| Speculative decoding | Yes (attention change is invisible to the spec-decode loop) |

```figure
differential-attention
```

## Construí-lo

`code/main.py`Uma consulta de brinquedo com estrutura conhecida de sinal-mais-ruído permite medir a relação ruído-cancelamento diretamente.

### Passo 1: atenção de softmax padrão

Opções de matriz de STDlib: listas de listas, matmul manual, softmax com subtração de estabilidade numérica do máximo.

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### Passo 2: Divida Q, K em duas metades

O estilo V1: reduz a metade a dimensão da cabeça. O estilo V2: mantenha a dimensão da cabeça e dobre o número de cabeças. A implementação do brinquedo usa V1 para clareza pedagógica  a matemática é idêntica, apenas a contabilidade difere.

### Passo 3: dois ramos de softmax + subtração

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

Nota: os pesos de saída podem ser negativos. Isso é bom. O cache de valor ainda lida com contribuições assinadas. A projeção V subsequente absorve o sinal.

### Passo 4: medição da cancelamento de ruído

Construir uma sequência sintética de comprimento 1024. Coloque o sinal num lugar conhecido, preencha o resto com ruído. Calcule a) o peso de atenção de softmax padrão na posição do sinal e b) o peso de atenção diferencial. Meter a relação sinal-ruído em cada um. A atenção DIFF produz de forma confiável uma relação sinal-ruído mais elevada por um fator de 3x-10x dependendo do grau de diferença entre os dois ramos.

### Passo 5: Contabilidade dos parâmetros V1 vs V2

Dado um config (hidden=4096, heads=32, d_head=128), imprima:

- Transformador de linha de base: Q, K, V de cada tamanho `hidden * hidden`, MLP em 4 * escondido.
- DIFF V1: Q, K de cada tamanho `hidden * hidden`, tamanho V `hidden * hidden`(Inalterado), cabeça dim metade internamente.`lambda`Parâmetros $(O(\text{heads} \cdot d_{\text{head}}))$- Não .
- DIFF V2: tamanho Q `2 * hidden * hidden`, tamanho K `hidden * hidden`, tamanho V `hidden * hidden`Extra-dim projetado para baixo antes .$O_W$- Adiciona o mesmo .`lambda`Parâmetros.

O brinquedo mede o custo extra do parâmetro para o V2 (aproximadamente `hidden * hidden`extra por bloco de atenção) e imprime- a.

## Usá-lo

O DIFF V2 ainda não está sendo enviado em todos os servidores de inferência de produção em abril de 2026, mas a integração está em andamento no vLLM e SGLang.

- Modelos internos de produção de longo contexto da Microsoft.
- Replicações de pesquisa em várias ações de formação de modelo aberto, com o objetivo de conteúdo de mais de 256k.
- Arquiteturas híbridas que combinam a atenção DIFF com a atenção das janelas deslizantes em camadas alternativas.

Quando chegar a isto em 2026:

- A formação de um novo modelo a partir do zero, com foco em um contexto eficaz de 64k ou mais.
- A ajuste fino de um modelo de contexto longo onde falhas perdidas no meio dominam a sua avaliação.

Quando não o farias:

- O custo da reformulação raramente compensa os pesos existentes.
- O seu contexto é sempre abaixo de 16 mil.

## Envia-o

Esta lição produz`outputs/skill-diff-attention-integrator.md`- Tendo em conta a arquitetura do modelo, o comprimento do contexto-alvo, o perfil de alucinação e o orçamento de formação, produz um plano de integração para acrescentar atenção diferenciada a uma nova corrida pré-formação ou a uma nova regulação do LoRA.

## Exercícios

1. Corra .`code/main.py`Verificar que a relação sinal-ruído relatada para a atenção diferencial é superior à atenção softmax padrão na consulta sintética.

2. Calcule o delta de contagem de parâmetros da linha de base para DIFF V1 e da linha de base para DIFF V2 para um modelo de classe 7B (hidden=4096, heads=32, d_head=128, 32 camadas). Mostre quais componentes ganharam parâmetros e quais permaneceram iguais.

3. Leia a Seção 3 do documento DIFF V1 (arXiv:2410.05258) e a Seção 2 do blog DIFF V2 Hugging Face. Em duas frases, explique por que a RMSNorm V1 por cabeça era necessária e por que a V2 poderia removê-la sem causar divergências no treinamento.

4. Implementar uma ablação: calcular a atenção diferencial com `lambda = 0`(primeira suave máxima pura) e `lambda = 1`(subtração completa). Na consulta sintética, medir como o sinal-ruído muda em toda a varredura. Identificar o `lambda`que maximiza o sinal-ruído.

5. Extenda o brinquedo para GQA + DIFF V2. Escolha 8 cabeças KV e 32 cabeças Q. Mostre que o tamanho do cache KV corresponde a um modelo GQA de linha de base com a mesma configuração (8, 32).

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Differential attention | "Two softmaxes minus each other" | Split Q, K into two halves, compute two softmax maps, subtract the second (scaled by $\lambda$) from the first, then multiply by V |
| Noise floor | "The non-zero tail of softmax" | The $O(1/N)$ weight softmax puts on every unrelated token, which sums to $O(1)$ across long contexts |
| lambda | "The subtraction scale" | Per-head learnable scalar parameterized as `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`; can be negative |
| DIFF V1 | "The ICLR 2025 version" | Original Differential Transformer; halves head dim to preserve parameter count, needs custom kernel, slower decode |
| DIFF V2 | "The January 2026 fix" | Doubles Q heads keeping KV heads; matches baseline decode speed and works with FlashAttention |
| Per-head RMSNorm | "The V1 stabilizer" | Extra norm V1 applied after the difference; V2 removed it to prevent late-training instability |
| Signal-to-noise ratio | "How much attention is wasted" | Ratio of weight on the true signal position to average weight on unrelated positions |
| Lost in the middle | "Long-context failure mode" | Empirical phenomenon where retrieval accuracy dips for documents in the middle of a long context — DIFF attention reduces this |
| Arithmetic intensity | "FLOPs per byte loaded" | Ratio V2 increased at decode by doubling queries per KV load; important for memory-bound decode |

## Mais leitura

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) o artigo original com teoria da cancelamento de ruído e ablações de longo contexto
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) a reescritura da pilha de produção, decodificação de linha de base correspondente, compatível com FlashAttention
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) Análise teórica do motivo pelo qual a subtração recupera a estrutura de atenção pré-treinada
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) Variante de parâmetro compartilhado
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) o DIFF do transformador de linha de base subtrai de
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) os objetivos de atenção do FIDF para o contexto longo
