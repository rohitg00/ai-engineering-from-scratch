# T5, BART  Modèles de décodeur-encodeur

> Les encoders comprennent. Les décoders génèrent. Rassemblez-les et vous obtenez un modèle construit pour les tâches d'entrée → sortie: traduire, résumer, réécrire, transcrire.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## Le problème

Les GPT et les BERT ne découtent que pour un but différent.

- Traduction: anglais → français.
- Résumé: 5000 articles à jetons → 200 résumés à jetons.
- Reconnaissance de la parole: jetons audio → jetons texte.
- Extraction structurée: prose → JSON.

Pour ces derniers, le décodeur-encodeur fait le plus propre ajustement. L'encodeur produit une représentation dense de la source. Le décodeur génère la sortie, en assistant croisée à cette représentation à chaque étape.

Deux documents ont défini le livre de jeu moderne:

1. **T5**(Raffel et coll. 2019). " Transformateur de transfert texte-texte. " Chaque tâche de PNL est reframeée comme texte-en, texte-out. Architcture unique, vocabulaire unique, perte unique. Pré-entraîné sur la prédiction de durée masquée (spans corrompus dans l'entrée, décodez-les dans la sortie).
2. **BART**(Lewis et coll. 2019). " Transformateur bidirectionnel et auto-régressif. " Déniant l'autoencodeur: entrée corrompue de plusieurs façons (trouble, masque, supprimer, rotation), demandez au décodeur de reconstruire l'original.

En 2026, le format encodeur-décodeur se maintient là où la structure des entrées est importante:

- Sous-pard (parler → texte).
- La pile de traduction de Google.
- Certains modèles de complément de code / réparation qui ont des structures de contexte et d'édition distinctes.
- Flan-T5 et les variantes pour les tâches de raisonnement structuré.

Le décodeur-seul a gagné le spotlight, mais le décodeur-encodeur n'a jamais disparu.

## Le concept

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### La boucle avant

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

Le décodeur fonctionne autorégressivement mais assiste à la sortie du même encodeur à chaque étape.

### T5 Pré-entraînement  Corruption de la durée

Choisissez des intervalles aléatoires de l'entrée (longueur moyenne 3 jetons, 15% au total).`<extra_id_0>`- Je suis là .`<extra_id_1>`, etc. Le décodeur ne sort que les spans corrompus avec leur préfixe sentinel:

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

Un signal moins cher que de prédire toute la séquence.

### Pré-entraînement BART  dénonciation de bruit multiples

BART essaie cinq fonctions sonores:

1. Le masquage des jetons.
2. Suppression des jetons.
3. Remplissez le texte (masquer une distance, le décodeur insère la longueur correcte).
4. Permutation de la phrase.
5. La rotation des documents.

La combinaison de l'infiltration de texte + de la permutation de la phrase a produit les meilleurs nombres en aval. Le décodeur reconstruit toujours l'original.

### L'inférence

La même génération autorégressive que GPT. L'échantillonnage avide / faisceau / top-p s'applique. La recherche de faisceau (largeur 45) est standard pour la traduction et la résumé car la distribution de sortie est plus étroite que le chat.

### Quand choisir chaque variante en 2026

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | Clear source sequence; fixed output distribution; beam search works |
| Speech-to-text | Yes (Whisper) | Input modality differs from output; encoder shapes audio features |
| Chat / reasoning | No, decoder-only | No persistent "input" — the conversation is the sequence |
| Code completion | Usually no | Decoder-only with long context wins; code models like Qwen 2.5 Coder are decoder-only |
| Summarization | Either works | BART, PEGASUS beat earlier decoder-only baselines; modern decoder-only LLMs match them |
| Structured extraction | Either | T5 is clean because "text → text" absorbs any output format |

La tendance depuis ~2022: le décodeur-seul prend en charge les tâches que le décodeur-encodeur possédait auparavant parce que (a) les LLM décodeurs-seuls réglés par instruction généralisent à n'importe quoi via une demande, (b) une architecture évolue plus facilement que deux, (c) RLHF suppose un décodeur.

```figure
encoder-decoder
```

## Faites-le

Regardez !`code/main.py`Nous mettons en œuvre la corruption de la durée de vie T5 pour un corpus de jouets  la pièce la plus utile de cette leçon parce qu'elle apparaît dans chaque recette de prétrainement de codeur-décodeur depuis.

### Étape 1: Corruption de la durée

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

Le format cible est la convention T5: `<sent0> span0 <sent1> span1 ...`. L'entrée corrompue interpose des jetons inchangés avec les jetons sentinel à des endroits de décalage.

### Étape 2: vérifier le retour et le retour

Compte tenu de l'entrée et de la cible corrompus, reconstruire la phrase originale. Si votre corruption est réversible, le passe avant est bien défini. Ceci est une vérification de la santé mentale  la vraie formation ne fait jamais cela, mais le test est bon marché et attrape des bugs individuels dans votre comptabilité de durée.

### Étape 3: bruit de BART

Cinq fonctions: `token_mask`- Je suis là .`token_delete`- Je suis là .`text_infill`- Je suis là .`sentence_permute`- Je suis là .`document_rotate`- Composer deux et montrer le résultat.

## Utilisez-le

Référence de HuggingFace:

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

Le truc T5: le nom de la tâche entre dans le texte d'entrée. Le même modèle gère des dizaines de tâches parce que chaque tâche est texte-en-tête, texte-out. En 2026, ce modèle a été généralisé par des modèles décodeurs uniquement réglés par instruction, mais T5 l'a codifié en premier.

## La faire partir

Regardez !`outputs/skill-seq2seq-picker.md`. La compétence choisit entre le décodeur-encodeur et le décodeur-encodeur uniquement pour une nouvelle tâche compte tenu de la structure d'entrée-sortie, de la latence et des objectifs de qualité.

## Exercices

1. **Easy.**On court .`code/main.py`, appliquer la corruption de la durée à une phrase de 30 jetons, vérifier que la concaténage des jetons source non sentinelles avec les étendues cibles décodées reproduit l'original.
2. **Medium.**La mise en œuvre de la stratégie BART `text_infill`bruit: remplacer les intervalles aléatoires par un seul `<mask>`Le décodeur doit en déduire la longueur correcte de l'espace plus le contenu.
3. **Hard.**- Je suis bien .`flan-t5-small`Sur un petit corpus anglais → porc-latin (200 paires). Mesurer le bleu sur un ensemble de 50 paires.`Llama-3.2-1B`sur les mêmes données avec le même calcul.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | Two stacks: bidirectional encoder for input, causal decoder with cross-attention for output. |
| Cross-attention | "Where source talks to target" | Decoder's Q × encoder's K/V. The only place encoder information enters the decoder. |
| Span corruption | "T5's pretraining trick" | Replace random spans with sentinel tokens; decoder outputs the spans. |
| Denoising objective | "BART's game" | Apply a noise function to the input, train the decoder to reconstruct the clean sequence. |
| Sentinel token | "The `<extra_id_N>` placeholder" | Special tokens that tag corrupted spans in the source and re-tag them in the target. |
| Flan | "Instruction-tuned T5" | T5 fine-tuned on >1,800 tasks; made encoder-decoder competitive at instruction-following. |
| Beam search | "Decoding strategy" | Keep top-k partial sequences at each step; standard for translation/summarization. |
| Teacher forcing | "Training-time input" | During training, feed the true previous output token to the decoder, not the sampled one. |

## Pour en savoir plus

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683)- T5
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461)- Je suis un homme.
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416)- Le plan T5.
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) Whisper, le codeur-découreur canonique de 2026.
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) mise en œuvre de référence.
