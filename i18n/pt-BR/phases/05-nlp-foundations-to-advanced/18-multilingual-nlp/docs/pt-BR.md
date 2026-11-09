# PNL multilíngue

> Um modelo, mais de 100 idiomas, zero dados de treinamento para a maioria deles. A transferência translangual é o milagre prático da década de 2020.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## O problema

O inglês tem bilhões de exemplos rotulados. O urdu tem milhares. O maithili quase não tem nenhum. Qualquer sistema prático de NLP que atenda a um público global tem que trabalhar na longa cauda de línguas onde não existem dados de treinamento específicos de tarefas.

Os modelos multilíngues resolvem isto treinando um modelo em muitas línguas simultaneamente. A representação compartilhada permite que o modelo transfira as habilidades aprendidas em línguas de alto recurso para línguas de baixo recurso. Afinar o modelo com base na análise de sentimentos em inglês, e produz previsões surpreendentemente boas de sentimentos em Urdu fora da caixa. Isso é transferência interlingual de zero-shot, e remodelaram a forma como a PNL se transmite ao mundo.

Esta lição descreve as compensações, os modelos canônicos e a única decisão que faz com que as equipes que trabalham em várias línguas se sentem em dificuldade: escolher uma língua fonte para a transferência.

## O conceito

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**Shared vocabulary.**Os modelos multilíngues usam um sentencepiece ou wordpiece tokenizer treinado em texto de todas as línguas-alvo. O vocabulário é compartilhado: a mesma unidade de subpalavras representa o mesmo morfema em todas as línguas relacionadas. `anti-`em inglês e italiano, obtém o mesmo símbolo.

**Shared representation.**Um transformador treinado em modelagem de linguagem mascarada em muitas línguas aprende que frases semânticamente semelhantes em diferentes línguas produzem estados ocultos semelhantes. mBERT, XLM-R e NLLB exibem isso. Embedings para "cat" em inglês agrupam perto de "chat" em francês e "gato" em espanhol, assim como embaixamentos de frases completas.

**Zero-shot transfer.**Afinal, a função de um modelo é de ajustar o modelo em dados rotulados em uma língua (geralmente inglês).

**Few-shot fine-tuning.**Adicione 100-500 exemplos rotulados na língua-alvo. A precisão salta para 95-98% da linha de base inglês em tarefas de classificação. Esta é a alavanca mais econômica na PNL multilíngue.

## Os modelos

| Model | Year | Coverage | Notes |
|-------|------|----------|-------|
| mBERT | 2018 | 104 languages | Trained on Wikipedia. First practical multilingual LM. Weak on low-resource. |
| XLM-R | 2019 | 100 languages | Trained on CommonCrawl (much larger than Wikipedia). Sets the cross-lingual baseline. Base 270M, Large 550M. |
| XLM-V | 2023 | 100 languages | XLM-R with 1M-token vocabulary (vs 250k). Better on low-resource. |
| mT5 | 2020 | 101 languages | T5 architecture for multilingual generation. |
| NLLB-200 | 2022 | 200 languages | Meta's translation model; includes 55 low-resource languages. |
| BLOOM | 2022 | 46 languages + 13 programming | Open 176B LLM trained multilingually. |
| Aya-23 | 2024 | 23 languages | Cohere's multilingual LLM. Strong on Arabic, Hindi, Swahili. |

Selecione por caso de uso. Classificação funciona bem com base XLM-R como padrão sensato. tarefas geração exigem mT5 ou NLLB dependendo da tradução versus geração aberta. pares de trabalho de estilo LLM com Aya-23 ou Claude usando solicitação multilíngue explícita.

## A decisão sobre a língua-fonte (2026 investigação)

A maioria das equipes utiliza o inglês como fonte de ajuste fino. Pesquisas recentes (2026) mostram que isso é muitas vezes errado.

A semelhança linguística prevê melhor qualidade de transferência do que o tamanho do corpo bruto. Para os alvos eslavos, o alemão ou o russo geralmente vencem o inglês. Para os alvos índicos, o hindi geralmente vence o inglês.**qWALS**A métrica de similaridade (2026, baseada nos recursos do Atlas Mundial de Estruturas de Línguas) quantifica isso. **LANGRANK**(Lin et al., ACL 2019) é um método separado e anterior que classifica línguas candidatas de origem a partir de uma combinação de semelhança linguística, tamanho do corpo e parentesco genético.

Regra prática: se a sua língua-alvo tem um parente tipologicamente próximo de recursos, tente primeiro ajustar o que é, e depois compare com o inglês.

```figure
n5-crosslingual-bridge
```

## Construí-lo

### Passo 1: classificação interlingual de zero-shot

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

Um modelo, três idiomas, a mesma API. XLM-R treinado em NLI transferir dados bem para classificação através do truque de envolvimento.

### Passo 2: espaço de inserção multilingue

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

As traduções ficam próximas no espaço de inserção. Uma frase inglesa diferente fica mais longe. É isso que faz com que a recuperação, agrupamento e semelhança interlinguários funcionem.

### Passo 3: Estratégia de ajuste fino de poucas tiras

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

Para 100-500 exemplos de linguagem-alvo, `num_train_epochs=5`E ...`learning_rate=2e-5`As taxas de aprendizagem mais altas causam o colapso do alinhamento multilingüe e obtém-se um modelo apenas em inglês.

## Avaliação que realmente funcione

- **Per-language accuracy on held-out sets.**Não é agregado, mas o agregado esconde a cauda longa.
- **Benchmark against monolingual baseline.**Para línguas com dados suficientes, um modelo monolingüe treinado a partir do zero às vezes supera o multilingüe.
- **Entity-level tests.**Os modelos multilíngues geralmente têm uma tokenization fraca para scripts longe do latim.
- **Cross-lingual consistency.**O mesmo significado em duas línguas deve produzir a mesma previsão.

## Usá-lo

A pilha de 2026:

| Task | Recommended |
|-----|-------------|
| Classification, 100 languages | XLM-R-base (~270M) fine-tuned |
| Zero-shot text classification | `joeddav/xlm-roberta-large-xnli` |
| Multilingual sentence embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` (see lesson 11) |
| Generative multilingual | Claude, GPT-4, Aya-23, mT5-XXL |
| Low-resource language NLP | XLM-V or a domain-specific fine-tune on related high-resource language |

Sempre orçar para ajustar a linguagem-alvo, se o desempenho é importante.

### O imposto de tokenização (o que vai mal para as línguas de baixo recurso)

Os modelos multilíngues compartilham um tokenizer em todas as suas línguas. Esse vocabulário é treinado em um corpus dominado pelo inglês, francês, espanhol, chinês, alemão. Para qualquer língua fora do conjunto dominante, três impostos compõem silenciosamente:

- **Fertility tax.**O texto de linguagem de baixo recurso tokeniza em muito mais tokens por palavra do que o inglês. Uma frase em hindi pode precisar de 3-5x os tokens de uma frase em inglês equivalente.
- **Variant recovery tax.**Cada erro de digitação, variante diacrítica, desajuste de normalização de Unicode ou variação de caso se torna uma sequência não relacionada a início frio no espaço de inserção.
- **Capacity spillover tax.**Os impostos 1 e 2 consomem posições de contexto, profundidade de camada e dimensões de incorporação. O que resta para o raciocínio real é sistematicamente menor do que o que uma linguagem de alto recurso obtém do mesmo modelo.

O sintoma prático: seu modelo treina normalmente em hindi, a curva de perda parece correta, a perplexidade de avaliação parece razoável e os resultados de produção são sutilmente errados. A morfologia desmorona no meio da frase. Inflações raras permanecem irrecuperaveis. **You cannot data-scale your way out of a broken tokenizer.**

Mitigations: escolher um tokenizer com boa cobertura para a sua língua-alvo (o vocabulário de tokens 1M do XLM-V é uma solução direta); verificar a fertilidade da tokenização no texto-alvo mantido fora antes do treinamento; usar o fallback de nível de byte (SentencePiece `byte_fallback=True`, GPT-2-style byte-level BPE) para scripts verdadeiramente long tail, então nada é OOV.

## Envia-o

Salva como`outputs/skill-multilingual-picker.md`- Não .

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## Exercícios

1. **Easy.**Execute o pipeline de classificação de tiros zero em 10 frases por língua em inglês, francês, hindi e árabe. Relate precisão em cada um. Você deve ver francês forte, hindi decente, árabe variável.
2. **Medium.**Utilização`paraphrase-multilingual-MiniLM-L12-v2`Para construir um retriever interlingual sobre um pequeno corpus de línguas mistas.
3. **Hard.**Compare a linguagem de origem inglesa e a linguagem de origem hindi para uma tarefa de classificação em hindi. Use 500 exemplos de linguagem-alvo para a linguagem de poucos tiros sob ambos os regimes. Relate qual fonte produz melhor precisão em hindi e quanto. Esta é a tese LANGRANK em miniatura.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Multilingual model | One model, many languages | Shared vocabulary and parameters across languages. |
| Cross-lingual transfer | Train on one language, run on another | Fine-tune on source, evaluate on target without target-language labels. |
| Zero-shot | No target-language labels | Transfer without fine-tuning on the target language. |
| Few-shot | Small target labels | 100-500 target-language examples used for fine-tuning. |
| mBERT | First multilingual LM | 104-language BERT pretrained on Wikipedia. |
| XLM-R | Standard cross-lingual baseline | 100-language RoBERTa pretrained on CommonCrawl. |
| NLLB | Meta's 200-language MT | No Language Left Behind. Includes 55 low-resource languages. |

## Mais leitura

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116)O papel XLM-R.
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) o artigo de análise que iniciou a linha de investigação sobre transferência translangual.
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) Papel NLLB-200.
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827)Aya, o LLM multilingue da Cohere.
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) o documento de língua-fonte QWALS/LANGRANK.
