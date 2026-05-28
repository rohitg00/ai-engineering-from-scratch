# BERT — Modelagem de Linguagem Mascarada

> GPT prevê a próxima palavra. BERT prevê uma palavra ausente. Uma frase de diferença — e meia década de tudo que se parece com embedding.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 05 (Transformer Completo), Fase 5 · 02 (Representação de Texto)
**Tempo:** ~45 minutos

## O Problema

Em 2018 toda tarefa de NLP — sentimento, NER, QA, implicação — treinava seu próprio modelo do zero nos seus próprios dados rotulados. Não existia um checkpoint pré-treinado "entende inglês" que você pudesse fazer fine-tuning. ELMo (2018) mostrou que dá pra pré-treinar embeddings contextuais com uma LSTM bidirecional; ajudou mas não generalizou.

BERT (Devlin et al. 2018) perguntou: e se pegássemos um encoder transformer, treinássemos em todas as frases da internet e forçássemos a prever palavras ausentes do contexto dos dois lados? Depois você faz fine-tuning de uma head na sua tarefa downstream. Eficiência de parâmetros foi uma revelação.

O resultado: em 18 meses BERT e suas variantes (RoBERTa, ALBERT, ELECTRA) dominaram todos os rankings de NLP que existiam. Em 2020 todo mecanismo de busca, pipeline de moderação de conteúdo e sistema de busca semântica no mundo tinha um BERT dentro.

Em 2026 modelos encoder-only ainda são a ferramenta certa pra classificação, recuperação e extração estruturada — rodam 5–10× mais rápido por token que decoders e seus embeddings são a base de toda pilha de recuperação moderna. ModernBERT (Dez 2024) levou a arquitetura pra contexto de 8K com Flash Attention + RoPE + GeGLU.

## O Conceito

![Modelagem de linguagem mascarada: escolher tokens, mascarar, prever originais](../assets/bert-mlm.svg)

### O sinal de treinamento

Pegue uma frase: `the quick brown fox jumps over the lazy dog`.

Mascare 15% dos tokens aleatoriamente:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

Treine o modelo pra prever os tokens originais nas posições mascaradas. Como o encoder é bidirecional, prever `[MASK]` na posição 1 pode usar `brown fox jumps` nas posições 2+. Isso é o que o GPT não consegue fazer.

### As regras de máscara do BERT

Dos 15% dos tokens selecionados pra predição:

- 80% são substituídos por `[MASK]`.
- 10% são substituídos por um token aleatório.
- 10% ficam inalterados.

Por que não sempre `[MASK]`? Porque `[MASK]` nunca aparece na inferência. Treinar o modelo pra esperar `[MASK]` em 100% das posições mascaradas criaria uma mudança de distribuição entre pré-treinamento e fine-tuning. Os 10% aleatórios + 10% inalterados mantém o modelo honesto.

### Previsão da Próxima Frase (NSP) — e por que foi abandonada

BERT original também treinava em NSP: dado duas frases A e B, prever se B segue A. RoBERTa (2019) ablatou e mostrou que NSP prejudicava, não ajudava. Encoders modernos pulam.

### O que mudou em 2026: ModernBERT

O paper ModernBERT de 2024 reconstruiu o bloco com primitivas de 2026:

| Componente | BERT Original (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Posicional | Aprendido absoluto | RoPE |
| Ativação | GELU | GeGLU |
| Normalização | LayerNorm | Pre-norm RMSNorm |
| Attention | Dense completa | Alternada local (128) + global |
| Comprimento de contexto | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

E ao contrário da stack de 2018, é nativo pra Flash Attention. Inferência é 2–3× mais rápida em comprimento 8K que DeBERTa-v3 com pontuações GLUE melhores.

### Casos de uso que ainda escolhem encoder em 2026

| Tarefa | Por que encoder vence decoder |
|--------|------------------------------|
| Embeddings de recuperação / busca semântica | Contexto bidirecional = melhor qualidade de embedding por token |
| Classificação (sentimento, intenção, toxicidade) | Um passo forward; sem custo de geração |
| NER / rotulagem de tokens | Saída por posição, nativamente bidirecional |
| Implicação zero-shot (NLI) | Classificador no topo do encoder |
| Reranker pra RAG | Score de cross-encoder, 10× mais rápido que rerankers LLM |

## Construindo

### Passo 1: lógica de mascaramento

Veja `code/main.py`. A função `create_mlm_batch` recebe uma lista de IDs de token, tamanho do vocabulário e probabilidade de máscara. Retorna IDs de entrada (com máscaras aplicadas) e rótulos (só nas posições mascaradas, -100 em outro lugar — convenção de ignore index do PyTorch).

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    rótulos = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            rótulos[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, rótulos
```

### Passo 2: rodar predição MLM num corpus minúsculo

Treine um encoder de 2 camadas + head MLM num vocabulário de 20 palavras, 200 frases. Sem gradiente — fazemos verificações de forward pass. Treinamento completo precisa PyTorch.

### Passo 3: comparar tipos de máscara

Mostre como a regra de três mantém o modelo utilizável sem `[MASK]`. Preveja numa frase sem máscara e numa frase mascarada. Ambas devem produzir distribuições de token razoáveis porque o modelo viu ambos os padrões no treinamento.

### Passo 4: fine-tuning da head

Substitua a head MLM por uma head de classificação num dataset de sentimento brinquedo. Só a head treina; o encoder fica congelado. Esse é o padrão que toda aplicação BERT segue.

## Usando

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embeddings de modelo são BERTs com fine-tuning.** Modelos `sentence-transformers` como `all-MiniLM-L6-v2` são BERTs treinados com perda contrastiva. O encoder é o mesmo. A perda mudou.

**Cross-encoders rerankers também são BERTs com fine-tuning.** Classificação de pares em `[CLS] consulta [SEP] doc [SEP]`. A attention bidirecional entre consulta e doc é o que dá aos cross-encoders sua vantagem de qualidade sobre biencoders.

**Quando não escolher BERT em 2026.** Qualquer coisa generativa. O encoder não tem como produzir tokens autoregressivamente. Também: qualquer coisa abaixo de 1B parâmetros onde um decoder pequeno pode igualar qualidade com mais flexibilidade (Phi-3-Mini, Qwen2-1.5B).

## Entregando

Veja `outputs/skill-bert-finetuner.md`. A skill define um fine-tuning de BERT (escolha de backbone, eespecificaçãoificação da head, dados, avaliação, parada) pra uma nova tarefa de classificação ou extração.

## Exercícios

1. **Fácil.** Rode `code/main.py` e imprima a distribuição de máscaras em 10.000 tokens. Confirme que ~15% são selecionados e, desses, ~80% viram `[MASK]`.
2. **Médio.** Implemente mascaramento de palavras inteiras: se uma palavra é tokenizada em subpalavras, mascare todas as subpalavras juntas ou nenhuma. Meça se isso melhora acurácia de MLM em um corpus de 500 frases.
3. **Difícil.** Treine um BERT tiny (2 camadas, d=64) em 10.000 frases de um dataset público. Faça fine-tuning do token `[CLS]` pra sentimento SST-2. Compare com um baseline decoder-only em parâmetros equivalentes — qual ganha?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| MLM | "Modelagem de linguagem mascarada" | Sinal de treinamento: substitui aleatoriamente 15% dos tokens por `[MASK]`, prevê os originais. |
| Bidirecional | "Olha pros dois lados" | Attention do encoder sem máscara causal — cada posição vê todas as outras. |
| `[CLS]` | "O token pooler" | Token eespecificaçãoial anteposto a cada sequência; seu embedding final é a representação nível frase. |
| `[SEP]` | "Separador de segmento" | Separa sequências pareadas (ex: consulta/doc, frase A/B). |
| NSP | "Previsão da próxima frase" | Segunda tarefa de pré-treinamento do BERT; mostrada como inútil no RoBERTa, abandonada depois de 2019. |
| Fine-tuning | "Adaptar a uma tarefa" | Manter o encoder maiormente congelado; treinar uma head pequena em cima pra tarefa downstream. |
| Cross-encoder | "Um reranker" | BERT que recebe consulta e doc como entrada, gera score de relevância. |
| ModernBERT | "Atualização 2024" | Encoder reconstruído com RoPE, RMSNorm, GeGLU, attention local/global alternada, contexto 8K. |

## Leituras Complementares

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) — paper original.
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) — como treinar BERT direito; mata NSP.
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) — detecção de token substituído vence MLM em compute equivalente.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) — paper ModernBERT.
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) — referência canônica de encoder.
