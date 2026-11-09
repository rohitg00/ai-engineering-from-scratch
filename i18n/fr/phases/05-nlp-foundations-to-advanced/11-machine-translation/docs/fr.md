# Traduction automatique

> La traduction est la tâche qui a payé la recherche en PNL pendant trente ans et continue de payer maintenant.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## Le problème

Un modèle lit une phrase dans une langue et produit une phrase dans une autre. La longueur varie. L'ordre des mots varie. Certains mots source cartographient plusieurs mots cibles et vice versa. Les idiomes refusent de cartographier un à un. "Je te manque" en français est "tu me manques"  littéralement "je te manque". Aucun alignement au niveau des mots ne survit à cela.

La traduction automatique est la tâche qui a forcé la PNL à inventer des décodeurs, des attention, des transformateurs et finalement l'ensemble du paradigme de la LLM. Chaque pas en avant est arrivé parce que la qualité de la traduction était mesurable et que l'écart entre humain et machine était têtu.

Cette leçon passe à côté de la leçon d'histoire et enseigne le pipeline de travail de 2026: un codeur-décodeur multilingue prétrainé (NLLB-200 ou mBART), la tokenization de sous-words, la recherche de faisceaux, l'évaluation BLEU et chrF, et la poignée de modes d'échec qui sont toujours en production.

## Le concept

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

Le décodeur génère la cible, un sous-mot à la fois, en utilisant la sortie du codeur via l'attention croisée (leçon 10). Le décodeur utilise la recherche de faisceau pour éviter le piège du décodeur avide. La sortie est détocénisée, détrouquée et notée contre une référence.

Trois choix opérationnels sont à l'origine de la qualité MT du monde réel.

- **Tokenizer.**Le vocabulaire partagé entre les langues est ce qui permet de créer des paires de nulles coups dans le NLLB.
- **Model size.**NLLB-200 600M distillé s'adapte à un ordinateur portable. NLLB-200 3.3B est le plafond de production publié.
- **Decoding.**La largeur du faisceau est de 4 à 5 pour le contenu général. La longueur est de la peine pour éviter une sortie trop courte. Le décoding est restreint lorsque vous avez besoin de cohérence terminologique.

```figure
seq2seq-alignment
```

## Faites-le

### Étape 1: appel MT prétrainé

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

Trois choses comptent ici.`src_lang`indique au tokeniser quel script et quelle segmentation appliquer. `forced_bos_token_id`Le décodeur indique quel langage générer. Les deux sont des astuces spécifiques à la NLLB; mBART et M2M-100 utilisent leurs propres conventions et ne sont pas interchangeables.

### Étape 2: BLEU et chrF

BLEU mesure la superposition n-gramme entre la sortie et la référence. Quatre tailles de référence n-gramme (1-4), moyenne géométrique des précisions, peine de breveté pour la sortie trop courte. Le score est en [0, 100].

chrF mesure le score F au niveau des caractères. Plus sensible aux langages riches en morphologie où le sous-compte BLEU correspond.

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

Toujours utiliser `sacrebleu`Il normalise la marquage afin que les scores soient comparables sur tous les papiers.

### La hiérarchie d'évaluation à trois niveaux (2026)

L'évaluation moderne de la MT utilise trois familles métriques complémentaires.

- **Heuristic**Rapide, basé sur la référence, interprétable, insensible à la paraphrase.
- **Learned**(COMET, BLEURT, BERTScore). Modèles neuronaux formés sur le jugement humain; comparer la similitude sémantique de la traduction à la source et à la référence. COMET a la plus grande association avec la recherche sur les MT depuis 2023 et est le défaut de production de 2026 où la qualité compte.
- **LLM-as-judge**(sans référence). Promouvoir un grand modèle pour évaluer les traductions en termes de fluidité, d'adéquation, de ton, d'adéquation culturelle. GPT-4-as-judge correspond à l'accord humain dans ~80% des cas où la rubrique est bien conçue. Utilisation pour le contenu ouvert où aucune référence n'existe.

La pile pratique de 2026: `sacrebleu`pour les BLEU et les chrF, `unbabel-comet`Pour les données de production, il est nécessaire de calibrer chaque métrique en fonction de 50 à 100 exemples étiquetés par l'homme.

Les mesures sans référence (COMET-QE, BLEURT-QE, LLM-as-judge) vous permettent d'évaluer les traductions sans référence, ce qui est important pour les paires de langues à longue queue où les traductions de référence n'existent pas.

### Étape 3: les pannes de production

Le pipeline de travail ci-dessus traduira fluidement 80% du temps et échouera silencieusement les 20% restants.

- **Hallucination.**Le modèle invente un contenu qui n'était pas dans la source. C'est courant dans le vocabulaire de domaine inconnu. Symptom: la sortie est fluide mais affirme des faits que la source n'a pas déclarés. Atténuation: décoding restreint sur les termes de domaine, examen humain sur le contenu réglementé, suivi de la sortie beaucoup plus longtemps que l'entrée.
- **Off-target generation.**Le modèle traduit dans la mauvaise langue. La NLLB est étonnamment encline à cela sur des paires de langues rares.`forced_bos_token_id`et toujours décoder avec un modèle de langue-ID de vérification de la sortie.
- **Terminology drift.**"Sign up" devient "s'inscrire" dans le document 1 et "creer un compte" dans le document 2. Pour le texte de l'interface utilisateur et les chaînes d'utilisation, la cohérence est plus importante que la qualité brute.
- **Formality mismatch.**Le modèle choisit la forme la plus courante dans la formation. Pour le contenu axé sur le client, c'est généralement faux.
- **Length explosion on short input.**Les phrases d'entrée très courtes produisent souvent des traductions trop longues car la peine de longueur tombe d'un raclée inférieure à ~ 5 jetons source.

### Étape 4: réglage de domaine

Les modèles prétraînés sont généraux. La traduction juridique, médicale ou de dialogue de jeu bénéficie de manière mesurable d'une mise en forme fine sur les données parallèles de domaine.

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

Quelques milliers d'exemples parallèles de haute qualité dépassent quelques centaines de milliers de ceux qui sont grattés sur le net.

## Utilisez-le

La pile de production 2026 pour MT:

| Use case | Recommended starting point |
|---------|---------------------------|
| Any-to-any, 200 languages | `facebook/nllb-200-distilled-600M` (laptop) or `nllb-200-3.3B` (production) |
| English-centric, high quality, 50 languages | `facebook/mbart-large-50-many-to-many-mmt` |
| Short runs, cheap inference, English-French/German/Spanish | Helsinki-NLP / Marian models |
| Latency-critical browser-side | ONNX-quantized Marian (~50 MB) |
| Maximum quality, willing to pay | GPT-4 / Claude / Gemini with translation prompts |

Les LLM dépassent désormais les modèles spécialisés MT sur plusieurs paires de langues à partir de 2026, en particulier sur le contenu idiomatique et le long contexte.

## La faire partir

- Je ne sais pas .`outputs/skill-mt-evaluator.md`- Le numéro de la liste:

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

## Exercices

1. **Easy.**Traduction d' un paragraphe en français de 5 phrases en anglais et retour en anglais en utilisant `nllb-200-distilled-600M`Mesurer la proximité du retour vers l'original. Vous devriez voir la préservation sémantique avec la dérive de choix de mots.
2. **Medium.**Implémenter une vérification de l' identifiant de langue sur les sorties de traduction en utilisant `fasttext lid.176`ou `langdetect`Intégrer dans l'appel MT afin que les générations hors cible soient capturées avant de revenir.
3. **Hard.**- Je suis bien .`nllb-200-distilled-600M`Sur un corpus de domaine de votre choix de 5 000 paires, mesurez BLEU sur un ensemble de temps avant et après l'ajustement.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | Translation score | N-gram precision with brevity penalty. [0, 100]. |
| chrF | Character F-score | Character-level F-score. More sensitive for morphologically rich languages. |
| NMT | Neural MT | Transformer encoder-decoder trained on parallel text. The 2017+ default. |
| NLLB | No Language Left Behind | Meta's 200-language MT model family. |
| Constrained decoding | Controlled output | Force specific tokens or n-grams to appear / not appear in the output. |
| Hallucination | Invented content | Model output that is not supported by the source. |

## Pour en savoir plus

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672) le document de la NLLB.
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/)Pourquoi ?`sacrebleu`est la seule façon correcte de signaler BLEU.
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) le papier chrF.
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) réglage pratique de la marche.
