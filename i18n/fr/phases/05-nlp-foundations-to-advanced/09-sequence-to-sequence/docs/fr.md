# Modèles de séquence en séquence

> Deux RNN prétendant être traducteurs, le goulot d'étranglement qu'ils ont rencontré est la raison de l'attention.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 08 (CNNs + RNNs for Text), Phase 3 · 11 (PyTorch Intro)
**Time:** ~75 minutes

## Le problème

La classification trace une séquence de longueur variable à une seule étiquette. La traduction trace une séquence de longueur variable à une autre séquence de longueur variable. L'entrée et la sortie vivent dans différents vocabulaires, éventuellement dans des langues différentes, sans garantie de parité de longueur.

L'architecture seq2seq (Sutskever, Vinyals, Le, 2014) a décrété cela avec une recette délibérément simple. Deux RNN. L'un lit la phrase source et produit un vecteur de contexte de taille fixe. L'autre lit ce vecteur et génère le jeton de la phrase cible par jeton. Le même code que vous avez écrit pour la leçon 08, collé différemment.

Il est important de comprendre ce que cela signifie: le problème de l'échec de la PNL est le plus important dans le domaine de l'éducation.

## Le concept

**Encoder.**Un RNN qui lit la phrase source.**context vector** un résumé de la totalité de l'entrée en taille fixe.

**Decoder.**Un autre RNN initialement défini à partir du vecteur de contexte. À chaque étape, il prend le jeton généré précédemment comme entrée et produit une distribution sur le vocabulaire cible.`<EOS>`Le jeton est produit ou la longueur maximale est atteinte.

**Training:**Perte d'entropie croisée à chaque étape du décodeur, résumée sur la séquence.

**Teacher forcing.**Pendant la formation, l'entrée du décodeur à pas en pas `t`est le symbole de vérité de base à la position `t-1`En effet, les résultats obtenus par le décodeur ne sont pas les mêmes que ceux obtenus par le décodeur.**exposure bias**- Je suis désolé .

**The bottleneck.**Tout ce que le codeur a appris sur la source doit être comprimé dans ce vecteur de contexte. Les phrases longues perdent de détails. Les mots rares deviennent flou.

Attention (leçon 10) répare cela en laissant le décodeur regarder * chaque * encodeur caché état, pas seulement le dernier.

```figure
lstm-gates
```

## Faites-le

### Étape 1: un codeur

```python
import torch
import torch.nn as nn


class Encoder(nn.Module):
    def __init__(self, src_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(src_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)

    def forward(self, src):
        e = self.embed(src)
        outputs, hidden = self.gru(e)
        return outputs, hidden
```

`outputs`a une forme`[batch, seq_len, hidden_dim]` un état caché par position d'entrée. `hidden`a une forme`[1, batch, hidden_dim]`La leçon 08 dit "répondre les sorties pour la classification". Ici, nous gardons l'état caché dernier comme vecteur de contexte, et ignorons les sorties par étape.

### Étape 2: décodeur

```python
class Decoder(nn.Module):
    def __init__(self, tgt_vocab_size, embed_dim, hidden_dim):
        super().__init__()
        self.embed = nn.Embedding(tgt_vocab_size, embed_dim, padding_idx=0)
        self.gru = nn.GRU(embed_dim, hidden_dim, batch_first=True)
        self.fc = nn.Linear(hidden_dim, tgt_vocab_size)

    def forward(self, token, hidden):
        e = self.embed(token)
        out, hidden = self.gru(e, hidden)
        logits = self.fc(out)
        return logits, hidden
```

Le décodeur est appelé étape par étape. L'entrée: un lot de jetons individuels et l'état caché actuel. sortie: logits vocabulaire pour le jeton suivant et l'état caché mis à jour.

### Étape 3: cycle de formation avec l'enseignant forçant

```python
def train_batch(encoder, decoder, src, tgt, bos_id, optimizer, teacher_forcing_ratio=0.9):
    optimizer.zero_grad()
    _, hidden = encoder(src)
    batch_size, tgt_len = tgt.shape
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    loss = 0.0
    loss_fn = nn.CrossEntropyLoss(ignore_index=0)

    for t in range(tgt_len):
        logits, hidden = decoder(input_token, hidden)
        step_loss = loss_fn(logits.squeeze(1), tgt[:, t])
        loss += step_loss
        use_teacher = torch.rand(1).item() < teacher_forcing_ratio
        if use_teacher:
            input_token = tgt[:, t].unsqueeze(1)
        else:
            input_token = logits.argmax(dim=-1)

    loss.backward()
    optimizer.step()
    return loss.item() / tgt_len
```

Deux boutons qui méritent d'être nommés.`ignore_index=0`Il saute des pertes sur les jetons de rembourrage. `teacher_forcing_ratio`est la probabilité d'utiliser le vrai jeton par rapport à la prédiction du modèle à chaque étape. Commencez à 1.0 (forcement complet de l'enseignant) et annulez jusqu'à ~0.5 sur l'entraînement pour combler l'écart de biais d'exposition.

### Étape 4: boucle d'inférence (avidité)

```python
@torch.no_grad()
def greedy_decode(encoder, decoder, src, bos_id, eos_id, max_len=50):
    _, hidden = encoder(src)
    batch_size = src.shape[0]
    input_token = torch.full((batch_size, 1), bos_id, dtype=torch.long)
    output_ids = []
    for _ in range(max_len):
        logits, hidden = decoder(input_token, hidden)
        next_token = logits.argmax(dim=-1)
        output_ids.append(next_token)
        input_token = next_token
        if (next_token == eos_id).all():
            break
    return torch.cat(output_ids, dim=1)
```

Le décodeur avide choisit le token le plus probable à chaque étape. Il peut s'égarer: une fois que vous vous engagez à un token, vous ne pouvez pas le désactiver. **Beam search**Il garde le dessus...`k`Les séquences partielles sont en vie et choisit la plus haute score complète à la fin.

### Étape 5: le cou de bouteille, démontré

Formez le modèle à la copie de jouets: source `[a, b, c, d, e]`, cible `[a, b, c, d, e]`Augmentez la longueur de la séquence, observez la précision.

```
seq_len=5   copy accuracy: 98%
seq_len=10  copy accuracy: 91%
seq_len=20  copy accuracy: 62%
seq_len=40  copy accuracy: 23%
```

Un seul état caché GRU ne peut pas mémoriser sans perte une entrée de 40 jetons. L'information est là à chaque étape de l'encodeur, mais le décodeur ne voit que l'état dernier.

## Utilisez-le

PyTorch a été .`nn.Transformer`et `nn.LSTM`- basé sur des modèles de seq2seq.`transformers`Les modèles de codeur-décodeur complets (BART, T5, mBART, NLLB) sont formés sur des milliards de jetons.

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("facebook/bart-base")
model = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-base")

src = tok("Translate this to French: Hello, how are you?", return_tensors="pt")
out = model.generate(**src, max_new_tokens=50, num_beams=4)
print(tok.decode(out[0], skip_special_tokens=True))
```

Les décodeurs modernes ont laissé tomber les RNN pour les transformateurs. La forme de haut niveau (encodeur, décodeur, générer des jetons par des jetons) est identique au papier seq2seq 2014. Le mécanisme à l'intérieur de chaque bloc est différent.

### Quand encore trouver le seq2seq basé sur le RNN

Pour les nouveaux projets, il y a des exceptions:

- Translation en streaming où vous consommez une entrée à la fois avec une mémoire limitée.
- Génération de texte sur appareil où le coût de la mémoire du transformateur est prohibitif.
- Comprendre le goulet d'étranglement entre le codeur et le décodeur est le chemin le plus rapide pour comprendre pourquoi les transformateurs ont gagné.

### Les préjugés d'exposition et leurs atténuations

- **Scheduled sampling.**Le rapport de force des enseignants pendant la formation afin que le modèle apprenne à se remettre de ses propres erreurs.
- **Minimum risk training.**Traînez sur le score BLEU au niveau de la phrase au lieu de l'entropie croisée au niveau des jetons.
- **Reinforcement learning fine-tuning.**Récompenser le générateur de séquences avec une métrique utilisée dans le RLHF moderne.

Les trois sont toujours applicables à la génération basée sur des transformateurs.

## La faire partir

- Je ne sais pas .`outputs/prompt-seq2seq-design.md`- Le numéro de la liste:

```markdown
---
name: seq2seq-design
description: Design a sequence-to-sequence pipeline for a given task.
phase: 5
lesson: 09
---

Given a task (translation, summarization, paraphrase, question rewrite), output:

1. Architecture. Pretrained transformer encoder-decoder (BART, T5, mBART, NLLB) is the default. RNN-based seq2seq only for specific constraints.
2. Starting checkpoint. Name it (`facebook/bart-base`, `google/flan-t5-base`, `facebook/nllb-200-distilled-600M`). Match the checkpoint to task and language coverage.
3. Decoding strategy. Greedy for deterministic output, beam search (width 4-5) for quality, sampling with temperature for diversity. One sentence justification.
4. One failure mode to verify before shipping. Exposure bias manifests as generation drift on longer outputs; sample 20 outputs at the 90th-percentile length and eyeball.

Refuse to recommend training a seq2seq from scratch for under a million parallel examples. Flag any pipeline that uses greedy decoding for user-facing content as fragile (greedy repeats and loops).
```

## Exercices

1. **Easy.**Mettre en œuvre la tâche de copie du jouet. Exercer un GRU seq2seq sur des paires d'entrée-sortie où la cible est égale à la source. Mesurer la précision aux longueurs 5, 10, 20.
2. **Medium.**Ajouter le décoding de recherche de faisceau avec largeur de faisceau 3. Mesurer le bleu sur un petit corpus parallèle contre la cupidité. Document où la recherche de faisceau gagne (généralement les derniers jetons) et où cela ne fait aucune différence.
3. **Hard.**- Je suis bien .`facebook/bart-base`Comparer la sortie de faisceau 4 du modèle finement ajusté avec celle du modèle de base sur les entrées conservées.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder | Input RNN | Reads source. Produces per-step hidden states and a final context vector. |
| Decoder | Output RNN | Initialized from context vector. Generates target tokens one at a time. |
| Context vector | The summary | Final encoder hidden state. Fixed size. The bottleneck attention solves. |
| Teacher forcing | Use true tokens | Feed the ground-truth previous token at training time. Stabilizes learning. |
| Exposure bias | Train/test gap | Model trained on true tokens never practiced recovering from its own mistakes. |
| Beam search | Better decoding | Keep top-k partial sequences alive at each step instead of committing greedily. |

## Pour en savoir plus

- [Sutskever, Vinyals, Le (2014). Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215)- le papier original de la suite.
- [Cho et al. (2014). Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078) introduit le GRU et le cadre encodeur-décodeur.
- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)Lisez immédiatement après cette leçon.
- [PyTorch NLP from Scratch tutorial](https://pytorch.org/tutorials/intermediate/seq2seq_translation_tutorial.html) code de suivi constructible + code d'attention.
