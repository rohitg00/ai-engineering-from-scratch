# Tradução automática

> A tradução é a tarefa que pagou pela pesquisa de PNL durante trinta anos e continua a pagar agora.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## O problema

Um modelo lê uma frase em uma língua e produz uma frase em outra. O comprimento varia. A ordem das palavras varia. Algumas palavras-fonte mapeam para múltiplas palavras-alvo e vice-versa. Idiomas recusam o mapeamento de um a um. "Eu te sinto saudável" em francês é "tu me manques"  literalmente "você me está faltando". Nenhum alinhamento de nível de palavras sobrevive a isso.

A tradução automática é a tarefa que forçou a PNL a inventar codificadores-decodificadores, atenção, transformadores e, eventualmente, todo o paradigma LLM. Cada passo adiante chegou porque a qualidade da tradução era mensurável e a lacuna entre humano e máquina era teimosa.

Esta aula salta a aula de história e ensina o pipeline de trabalho de 2026: codificador-decodificador multilingue pré-treinado (NLLB-200 ou mBART), tokenização de subpalavras, pesquisa de feixe, avaliação BLEU e chrF, e o punhado de modos de falha que ainda enviam para a produção sem ser capturados.

## O conceito

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

O MT moderno é um transformador encoder-decoder treinado em texto paralelo. O encoder lê a fonte em sua tokenization de linguagem. O decoder gera o alvo, uma subpalavra por vez, usando a saída do encoder através da atenção cruzada (leção 10).

Três opções operacionais impulsionam a qualidade do MT no mundo real.

- **Tokenizer.**SentencePiece BPE treinado em um corpo de línguas mistas.
- **Model size.**NLLB-200 600M destilado cabe em um laptop. NLLB-200 3.3B é o padrão de produção publicado. 54.5B é o limite máximo de pesquisa.
- **Decoding.**Largura do feixe 4-5 para conteúdo geral. Penaltia de comprimento para evitar saída muito curta. Decodificação limitada quando você precisa de consistência terminológica.

```figure
seq2seq-alignment
```

## Construí-lo

### Passo 1: chamada de MT pré-treinada

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(model_id)

src = "The cats are running."
inputs = tok(src, return_tensors="pt")

out = model.generate(
    **inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),
    num_beams=5,
    length_penalty=1.0,
    max_new_tokens=64,
)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
```

```text
Les chats courent.
```

Três coisas importam aqui.`src_lang`diz ao tokenizer qual script e segmentação aplicar. `forced_bos_token_id`O M2M-100 e o mBART usam suas próprias convenções e não são intercambiáveis.

### Passo 2: BLEU e chrF

BLEU mede sobreposição de n-gram entre saída e referência. Quatro tamanhos de n-gram de referência (1-4), média geométrica de precisões, penalidade de brevidade para saída muito curta. A pontuação é em [0, 100]. Comumente usado. Frustrante para interpretar: 30 BLEU é "utiliável"; 40 é "bom"; 50 é "excepcional"; diferenças abaixo de 1 BLEU são ruído.

A chrF mede a pontuação F de nível de caracteres. Mais sensível a linguagens morfologicamente ricas onde a subcontagem BLEU coincide.

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

Sempre usar`sacrebleu`A normalização da tokenização, para que as pontuações sejam comparáveis em todos os papéis, é a forma como os valores de referência enganosos acontecem.

### A hierarquia de avaliação de três níveis (2026)

A avaliação MT moderna usa três famílias métricas complementares.

- **Heuristic**Rapido, baseado em referências, interpretável, insensível à paráfrase.
- **Learned**(COMET, BLEURT, BERTScore). Modelos neurais formados em julgamento humano; comparação semântica da semelhança da tradução com a fonte e a referência. COMET tem a maior associação com a investigação MT desde 2023 e é o padrão de produção de 2026 quando a qualidade importa.
- **LLM-as-judge**(sem referência). Promover um modelo grande para avaliar traduções em termos de fluência, adequação, tom, adequação cultural. GPT-4-as-judge corresponde ao acordo humano em ~80% do tempo em que a rubrica é bem concebida.

- A pilha prática de 2026:`sacrebleu`para BLEU e chrF, `unbabel-comet`Para o COMET, e um LLM solicitado para o sinal final de cara humana, calibre cada métrica em relação a 50-100 exemplos etiquetados por humanos antes de confiar nos dados de produção.

As métricas sem referência (COMET-QE, BLEURT-QE, LLM-as-judge) permitem avaliar traduções sem referência, o que é importante para pares de línguas de cauda longa onde não existem traduções de referência.

### Passo 3: que falhas na produção

O tubo de trabalho acima traduzirá fluentemente 80% do tempo e falhará silenciosamente os restantes 20%.

- **Hallucination.**O modelo invente conteúdo que não estava na fonte. Comum no vocabulário de domínio desconhecido. Sintoma: saída é fluente, mas afirma fatos que a fonte não declarou. Mitigation: decodificação limitada em termos de domínio, revisão humana de conteúdo regulamentado, monitoramento de saída muito mais tempo do que entrada.
- **Off-target generation.**O modelo traduz para a língua errada. A NLLB é surpreendentemente propensa a isso em pares de línguas raros.`forced_bos_token_id`e sempre decodificar com uma verificação de modelo de ID de língua na saída.
- **Terminology drift.**"Registrar" torna-se "s'inscrire" no documento 1 e "creer un compte" no documento 2. Para o texto da interface e as cadeias de uso, a consistência é mais importante do que a qualidade bruta.
- **Formality mismatch.**O modelo escolhe qual for a forma mais comum no treinamento. Para conteúdo voltado para o cliente, isso geralmente é errado. Mitigation: prefixo rápido com um token de formalidade se o modelo o suporta, ou ajustar um pequeno modelo em corpora-somente formais.
- **Length explosion on short input.**Frases de entrada muito curtas geralmente produzem traduções longas demais porque a penalidade de comprimento cai de um penhasco abaixo de ~ 5 tokens de fonte.

### Passo 4: ajuste fino para um domínio

Os modelos pré-treinados são generalistas. A tradução legal, médica ou de diálogo de jogos beneficia de forma mensurável de ajustes finos em dados paralelos de domínio.

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L'accusé a plaidé coupable."},
]

ds = Dataset.from_list(pairs)


def preprocess(ex):
    return tok(
        ex["src"],
        text_target=ex["tgt"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )


ds = ds.map(preprocess, remove_columns=["src", "tgt"])

args = TrainingArguments(output_dir="out", per_device_train_batch_size=4, num_train_epochs=3, learning_rate=3e-5)
Trainer(model=model, args=args, train_dataset=ds).train()
```

A qualidade dos dados de formação é a maior alavanca de produção.

## Usá-lo

A pilha de produção de 2026 para MT:

| Use case | Recommended starting point |
|---------|---------------------------|
| Any-to-any, 200 languages | `facebook/nllb-200-distilled-600M` (laptop) or `nllb-200-3.3B` (production) |
| English-centric, high quality, 50 languages | `facebook/mbart-large-50-many-to-many-mmt` |
| Short runs, cheap inference, English-French/German/Spanish | Helsinki-NLP / Marian models |
| Latency-critical browser-side | ONNX-quantized Marian (~50 MB) |
| Maximum quality, willing to pay | GPT-4 / Claude / Gemini with translation prompts |

Os LLM agora superam os modelos especializados de MT em vários pares de idiomas a partir de 2026, particularmente no conteúdo idiomático e longo contexto. A troca é o custo por token e a latência. Escolha um LLM quando o comprimento do contexto, a consistência estilística ou a adaptação de domínio através de questões mais importantes do que o throughput.

## Envia-o

Salva como`outputs/skill-mt-evaluator.md`- Não .

```markdown
---
name: mt-evaluator
description: Evaluate a machine translation output for shipping.
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

Given a source text and a candidate translation, output:

1. Automatic score estimate. BLEU and chrF ranges you would expect. State whether a reference is available.
2. Five-point human-verifiable check list: (a) content preservation (no hallucinations), (b) correct language, (c) register / formality match, (d) terminology consistency with glossary if provided, (e) no truncation or length explosion.
3. One domain-specific issue to probe. E.g., for legal: named entities and statute citations. For medical: drug names and dosages. For UI: placeholder variables `{name}`.
4. Confidence flag. "Ship" / "Ship with review" / "Do not ship". Tie to the severity of issues found in step 2.

Refuse to ship a translation without a language-ID check on output. Refuse to evaluate without a reference unless the user explicitly opts in to reference-free scoring (COMET-QE, BLEURT-QE). Flag any content over 1000 tokens as likely needing chunked translation.
```

## Exercícios

1. **Easy.**Traduza um parágrafo de 5 frases em inglês para o francês e de volta para o inglês usando `nllb-200-distilled-600M`- Medir o quão perto a viagem de ida e volta é do original.
2. **Medium.**Implementar uma verificação de identificação de língua nas saídas de tradução usando `fasttext lid.176`ou `langdetect`Integrar-se na chamada MT para que as gerações fora do alvo sejam capturadas antes de retornarem.
3. **Hard.**- A música é perfeita .`nllb-200-distilled-600M`A medida de BLEU em um conjunto de duração antes e depois de ajuste fino.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | Translation score | N-gram precision with brevity penalty. [0, 100]. |
| chrF | Character F-score | Character-level F-score. More sensitive for morphologically rich languages. |
| NMT | Neural MT | Transformer encoder-decoder trained on parallel text. The 2017+ default. |
| NLLB | No Language Left Behind | Meta's 200-language MT model family. |
| Constrained decoding | Controlled output | Force specific tokens or n-grams to appear / not appear in the output. |
| Hallucination | Invented content | Model output that is not supported by the source. |

## Mais leitura

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672)O artigo da NLLB.
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/)Porquê ?`sacrebleu`é a única forma correta de comunicar o BLEU.
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/)- o papel de chrF.
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) A prática de ajuste fino.
