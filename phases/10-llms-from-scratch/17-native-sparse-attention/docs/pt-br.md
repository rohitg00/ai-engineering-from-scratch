# Native Sparse Attention (DeepSeek NSA)

> Em 64k tokens, attention consome 70-80% da latencia de decode. Todo laboratorio de modelos abertos tem um plano pra corrigir isso. O NSA da DeepSeek (melhor paper da ACL 2025) e o que persistiu: tres branches paralelas de attention -- tokens comprimidos de granulosidade grossa, tokens finos seletivamente retidos e janelas deslizantes pra contexto local -- combinados atraves de um gate aprendido. E alinhado com o hardware (friend de kernel), nativamente treinavel (funciona no pre-treinamento, nao e colado na inferencia) e em decodes de 64k roda mais rapido que FlashAttention enquanto combina ou supera a qualidade de attention completa. Esta aula constroi as tres branches de ponta a ponta e mostra por que a esparsidade e diferenciavel de ponta a ponta.

**Tipo:** Construir
**Linguagens:** Python (stdlib)
**Pre-requisitos:** Fase 7 · 12 (KV cache, flash-attention), Fase 7 · 15 (variantes de attention), Fase 10 · 16 (differential attention)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Enunciar as tres branches de attention do NSA e o que cada uma captura.
- Explicar por que o NSA e "nativamente treinavel" enquanto metodos anteriores de attention esparsa eram so pra inferencia.
- Calcular a economia de compute de attention do NSA vs attention completa em contexto 64k como funcao do tamanho do bloco de compressao e selecao top-k.
- Implementar a combinacao de tres branches em Python stdlib em uma sequencia sintetica curta e verificar se os pesos de gate se comportam.

## O Problema

Attention completa em comprimento de sequencia N custa `O(N^2)` de tempo e `O(N)` de KV cache por camada. Em 64k tokens, os numeros de compute e largura de banda de memoria sao catastrophicos. Estimativa teorica medida do paper NSA: attention conta por 70-80% da latencia total de decode em 64k. Tudo downstream -- TTFT, tokens/segundo, custo por milhao de tokens -- e dominado pelo custo de attention.

Attention esparsa e a resposta obvia. Tentativas anteriores caem em dois baldes. Esparsidade de padrao fixo (sliding-window, em blocos, stride) descarta informacao e falha em tarefas de recuperacao de longo alcance. Esparsidade na inferencia (poda de KV cache, H2O, StreamingLLM) e aplicada a um modelo pre-treinado em attention densa e recupera apenas uma fracao do speedup potencial porque o modelo nunca foi obrigado a rotear informacao pelo padrao esparsa.

Native Sparse Attention (Yuan et al., DeepSeek + PKU + UW, melhor paper da ACL 2025, arXiv:2502.11089) faz ambos: um padrao de esparsidade que o modelo aprende durante pre-treinado, implementado como um alinhado com o kernel que realmente entrega a economia de compute na inferencia. Dois anos a partir de agora, NSA ou um descendente direto e a attention padrao em todo modelo de fronteira de contexto longo.

## O Conceito

### Tres branches paralelas

Para cada consulta, NSA roda attention tres vezes, contra tres vistas diferentes do KV cache:

1. **Branch comprimida.** Tokens sao agrupados em blocos de tamanho `l` (tipicamente 32 ou 64). Cada bloco e comprimido em um unico token resumo via uma MLP pequena aprendida. A consulta attend sobre esses tokens comprimidos, obtendo uma visao granulosa grossa de toda a sequencia.

2. **Branch selecionada.** Usando os scores de attention da branch comprimida, os top-k blocos mais relevantes pra consulta atual sao identificados. Tokens granulosos (nao comprimidos) desses blocos sao lidos e a consulta attend sobre todos eles. Pense na attention da branch comprimida como o sinal de roteamento pra selecao.

3. **Branch de janela deslizante.** A consulta attend aos `W` tokens mais recentes (tipicamente 512) pra contexto local. Esta branch captura padroes de curto alcance pesados em estrutura (sintaxe, coreferencia local) que as outras duas podem perder.

As saidas das tres branches sao combinadas via um gate aprendido por posicao:

```
out = g_cmp * out_cmp + g_sel * out_sel + g_win * out_win
```

`g_cmp, g_sel, g_win` sao pesos de gate de uma MLP pequena na consulta. Nao precisam somar 1 -- podem ponderar branches independentemente.

### Por que isso e "nativamente treinavel"

O passo de selecao (top-k blocos) e discreto. Operacoes discretas quebram o fluxo de gradiente. Trabalhos anteriores de attention esparsa ou pulavam o backprop atraves da selecao (limitando treinamento) ou usavam relaxacoes continuas que nao davam esparsidade real na inferencia.

NSA contorna isso: a attention da branch comprimida E uma attention granulosa grossa diferenciavel em toda a sequencia. A operacao top-k so reutiliza os maiores scores de attention da branch comprimida pra escolher quais blocos granulosos carregar. Os gradientes fluem atraves dos scores da branch comprimida (que influenciam tanto a saida comprimida QUANTO a logica de selecao), e a contribuicao dos blocos selecionados pra saida final tambem e diferenciavel. A operacao nao-diferenciavel `top_k` e um no-op no grafo computacional forward -- ela so controla quais blocos sao carregados da memoria.

Por isso o NSA pode ser usado no pre-treinamento de ponta a ponta. O modelo aprende a rotear informacao pelas tres branches conjuntamente, produzindo um padrao esparsa que na inferencia realmente entrega o speedup prometido.

### Kernel alinhado com hardware

O kernel do NSA e projetado pra hierarquias modernas de memoria de GPU. O kernel carrega queries por grupos de GQA (loop externo), busca os blocos KV esparsas correspondentes por grupo (loop interno) e roda attention no SRAM. Como cada grupo de consulta ve os mesmos blocos selecionados (selecao e por grupo de consulta, nao por head de consulta), as cargas KV sao amortizadas no grupo. A intensidade aritmetica continua alta.

O paper reporta kernels Triton rodando 9x mais rapido que FlashAttention em decodes de 64k, com a razao de speedup crescendo com o comprimento da sequencia. Kernels forward e backward sao fornecidos.

### O orcamento de compute

Seja `N` o comprimento da sequencia, `l` o tamanho do bloco de compressao, `k` a contagem de selecao top-k, `w` a janela deslizante, `b` o tamanho do bloco selecionado (tipicamente igual a `l`).

- Branch comprimida: `O(N/l)` keys por consulta, entao `O(N * N / l)` total.
- Branch selecionada: `O(k * b)` keys por consulta, entao `O(N * k * b)`.
- Branch deslizante: `O(w)` keys por consulta, entao `O(N * w)`.

Total: `O(N * (N/l + k*b + w))`.

Com `N = 64k, l = 64, k = 16, b = 64, w = 512`: custo por consulta e `1000 + 1024 + 512 = 2536 keys`. Attention completa e `64000 keys`. Reducao de compute de 25x.

Com `N = 128k, l = 64, k = 16, b = 64, w = 512`: custo por consulta e `2000 + 1024 + 512 = 3536 keys`. Attention completa e `128000 keys`. Reducao de 36x. O beneficio cresce com o comprimento da sequencia, que e o ponto inteiro.

### Como se compara

| Metodo | Diferenciavel | Speedup real na inferencia | Recuperacao de longo alcance |
|--------|---------------|---------------------------|------------------------------|
| Apenas janela deslizante | sim | sim | falha |
| Strided / esparsa em blocos | sim | sim | parcial |
| Poda de KV (H2O, StreamingLLM) | N/A (na inferencia) | sim | parcial |
| MoBA (Moonshot) | parcial | sim | bom |
| NSA | sim (nativamente) | sim (9x em 64k) | combina com attention completa |

MoBA (Moonshot, arXiv:2502.13189) foi publicado simultaneamente e usa uma abordagem similar tres-e-melhor-que-um, aplicando o principio MoE em blocos de attention. NSA e MoBA sao as duas arquiteturas pra conhecer em 2026 pra pre-treinamento de contexto longo.

## Construir

`code/main.py` implementa as tres branches em uma sequencia sintetica curta e mostra:

- A MLP de compressao (um baseline simples de mean-pool e usado pra clareza pedagogica; o NSA real usa uma MLP aprendida).
- A selecao de bloco top-k guiada pelos scores da branch comprimida.
- A attention de janela deslizante nos ultimos `w` tokens.
- A combinacao com gate.
- Um print do numero de compute comparando com attention completa.

### Passo 1: comprimir tokens em blocos

```python
def compress(K, l):
    n = len(K)
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[d] for row in block) / len(block) for d in range(len(K[0]))]
        out.append(summary)
    return out
```

### Passo 2: attention da branch comprimida

Rode attention por softmax da consulta contra as keys comprimidas. Os scores da branch comprimida servem de sinal pra selecao top-k.

### Passo 3: selecao de bloco top-k

Escolha os indices dos `k` blocos comprimidos com maior pontuacao. Carregue os tokens originais nao comprimidos desses blocos e rode attention sobre eles.

### Passo 4: attention de janela deslizante

Pegue os ultimos `w` tokens e rode attention padrao sobre eles.

### Passo 5: gate + combinar

Uma MLP pequena na consulta produz tres pesos de gate. A saida final e uma soma ponderada das saidas das tres branches.

### Passo 6: contagem de compute

Imprima o numero de keys atendidas por consulta para cada branch e o total. Compare com `N` (attention completa). Em uma sequencia sintetica de 1024 tokens com `l = 32, k = 4, w = 128`, NSA ve `32 + 128 + 128 = 288` keys por consulta versus 1024 para attention completa -- 3.5x menos.

## Usar

NSA esta sendo enviado no pipeline proprio de pre-treinamento de contexto longo da DeepSeek. Status de integracao em stacks publicas de inferencia em abril de 2026:

- **DeepSeek interno**: nativo, pesos publicados usam NSA ou seu sucessor DSA (Deepseek Sparse Attention).
- **vLLM**: suporte experimental NSA em desenvolvimento pra pesos DeepSeek-V3.x.
- **SGLang**: benchmarks do NSA publicados; caminho de producao segue o vLLM.
- **llama.cpp / CPU**: nao suportado; o overhead da decomposicao do kernel nao vale na throughput de CPU.

Quando usar NSA:

- Run de pre-treinamento ou treinamento continuo almejando 64k+ de contexto com orcamento de compute serio.
- Inferencia dos checkpoints proprios de contexto longo da DeepSeek. Os pesos sao nativos do NSA.

Quando nao usar:

- Servindo um modelo denso pre-treinado existente. Voce nao pode adaptar NSA sem treinamento continuado.
- Contexto abaixo de 16k. O overhead das tres branches domina as economias.
- Chat interativo em batch-1. Decode sensivel a latencia se beneficia, mas so em contextos longos.

## Entregar

Esta aula produz `outputs/skill-nsa-integrator.md`. Dada uma eespecificaçãoificacao de run de pre-treinamento de contexto longo, produz um plano de integracao do NSA: tamanho do bloco de compressao, top-k, janela deslizante, largura da MLP de gate, escolha do kernel e as avaliacoes eespecificaçãoificas de contexto longo que justificariam a mudanca arquitetural.

## Exercicios

1. Rode `code/main.py` em uma sequencia sintetica de 1024 tokens. Varie `(l, k, w)` em tres presets e imprima as contagens de compute. Identifique o preset que atinge o menor numero de keys por consulta enquanto mantem 95% de recuperacao contra attention completa em um teste de agulha no palheiro.

2. Substitua o compressor de mean-pool por uma MLP pequena aprendida (2 camadas, hidden 32). Treine em uma tarefa sintetica onde o sinal e a media de um bloco. Meça a diferenca de perplexidade contra o baseline de mean-pool em dados de retencao.

3. Implemente a MLP de gate. Ela recebe a consulta como entrada e retorna tres escalares. Mostre que o gate se comporta de forma sensata: ponderacao aproximadamente uniforme em queries aleatorias, peso alto na branch selecionada quando a consulta atinge um bloco distante.

4. Calcule o orcamento de memoria do KV cache para um modelo 70B com NSA habilitado em contexto 128k. KV heads sao 8, head dim 128, BF16. Compare com attention completa e com MLA (a Fase 10, Aula 14 mostrou os numeros do MLA). Identifique o comprimento de sequencia onde o KV cache da branch granulosa fina do NSA iguala o da attention completa.

5. Leia a Secao 4 do paper NSA (arXiv:2502.11089) e explique em tres frases por que os scores de attention da branch comprimida sao reutilizados pra selecao top-k ao inves de calcular um score de roteamento separado. Ligue a resposta ao fluxo de gradiente.

## Termos Principais

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Branch comprimida | "Visao grossa" | Attention sobre keys media por bloco que fornece contexto global em O(N/l) keys por consulta |
| Branch selecionada | "Blocos top-k" | Attention granulosa fina sobre os `k` blocos com maiores scores da branch comprimida |
| Janela deslizante | "Contexto local" | Attention sobre os ultimos `W` tokens pra padroes de curto alcance |
| Treinabilidade nativa | "Pre-treinar com a esparsidade ligada" | O padrao de esparsidade e aprendido durante pre-treinamento, nao colado na inferencia |
| Tamanho do bloco de compressao l | "Tamanho do grupo pra visao grossa" | Quantos tokens sao mesclados em um unico resumo; 32-64 tipico |
| Top-k | "Blocos pra manter" | Numero de blocos comprimidos cujos tokens nao comprimidos sao lidos; 16 tipico |
| Janela deslizante W | "Raio de attention local" | Tipicamente 512; menor prejudica coesao local, maior desperdica compute |
| Gate de branch | "Como misturar as tres" | Saida de MLP por posicao que pondera as contribuicoes das tres branches |
| Alinhamento de hardware | "Esparsidade friend de kernel" | Padrao esparsa escolhido pro kernel real de GPU atingir o speedup teorico |
| DSA | "O sucessor do NSA" | Deepseek Sparse Attention, a arquitetura que veio depois do NSA na linhagem DeepSeek |

## Leitura Complementar

- [Yuan et al. -- Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, Melhor Paper da ACL 2025)](https://arxiv.org/abs/2502.11089) -- o paper
- [DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) -- a familia de arquitetura que o NSA foca
- [Moonshot AI -- MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) -- trabalho simultaneo, attention estilo MoE sobre blocos
- [Beltagy et al. -- Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) -- origens do sliding-window
- [Xiao et al. -- StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) -- baseline de esparsidade na inferencia que NSA melhora
- [Dao et al. -- FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) -- o baseline de attention completa que kernels NSA superam em 64k
