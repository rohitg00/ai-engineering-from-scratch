# Modèles audio-langue  Qwen2.5-Omni, Audio Flamingo, GPT-4o Audio

> Les modèles de langage audio 2026 débattent de la parole + son environnemental + musique. Qwen2.5-Omni-7B correspond à GPT-4o Audio sur MMAU-Pro. Audio Flamingo Next bat Gemini 2.5 Pro sur LongAudioBench. L'écart entre ouvert et fermé est essentiellement fermé  sauf sur les tâches audio multi-collés, où tout le monde est presque aléatoire.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**Time:** ~45 minutes

## Le problème

Vous avez 5 secondes d'audio: les aboiements du chien, quelqu'un crie "arrête!", puis le silence.

- **Transcription.**"Qu'est-ce qui a été dit?"  Territoire de l'ASR.
- **Semantic reasoning.**"Est-ce que la personne est en danger?"  nécessite une compréhension commune des hurlements + des cris + du silence.
- **Music reasoning.**"Quels instruments jouent la mélodie?"
- **Long-audio retrieval.**"Dans cette conférence de 90 minutes, où l'instructeur a- t- il expliqué la descente des gradients?"

Un modèle unique qui répond à toutes ces questions avec un seul rappel est un **audio-language model**Separé de l'ASR pur: les LALM produisent des réponses en langage naturel de forme libre, pas seulement des transcriptions.

## Le concept

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### Le modèle à trois composants

Chaque LALM de 2026 a le même squelette:

1. **Audio encoder.**Encodeur à sourcillement · BEATs · CLAP · WavLM · ou un encodeur personnalisé par modèle.
2. **Projector.**Des fonctionnalités de l'encodeur audio de pontage linéaire ou MLP dans l'espace d'intégration de jetons du LLM.
3. **LLM.**Décoeur à base de Llama / Qwen / Gemma. Prend le texte interligé + jetons audio; génère du texte.

Formation:

- **Stage 1.**Encoder de congélation + LLM; projecteur de train uniquement sur les données ASR / sous-titres.
- **Stage 2.**Mise à jour complète / LoRA sur les tâches audio suivant les instructions (QA, raisonnement, compréhension de la musique).
- **Stage 3 (optional).**Le voicing-in / voicing-out ajoute un décodeur de parole.

### La carte modèle 2026

| Model | Backbone | Audio encoder | Output modality | Access |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | Custom + Whisper | text + speech | Apache-2.0 |
| Qwen3-Omni | Qwen3 | Custom | text + speech | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | text | NVIDIA non-commercial |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | text | NVIDIA non-commercial |
| SALMONN | Vicuna | Whisper + BEATs | text | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | text | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | text | Apache-2.0 |
| Gemini 2.5 Flash/Pro (closed) | Gemini | proprietary | text + speech | API |
| GPT-4o Audio (closed) | GPT-4o | proprietary | text + speech | API |

### Réalité de référence (2026)

**MMAU-Pro.**1800 paires de QA couvrant la parole / son / musique / mélangée.

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

Le **multi-audio column is damning for everyone.**Le hasard sur le choix multiple de 4 options = 25%; la plupart des modèles ont un score autour de là.

### Où les LALM sont utiles en 2026

- **Compliance audit of call-center recordings.**"L'agent a-t-il mentionné la divulgation requise?"
- **Accessibility.**Décrivez des événements sonores aux utilisateurs sourds (pas seulement la transcription).
- **Content moderation.**Détecter le langage violent + le ton menaçant + le contexte de fond.
- **Podcast / meeting chaptering.**Résumé sémantique, pas seulement les virages de l'orateur.
- **Music catalog analysis.**"Réservez toutes les pistes avec un changement de clé de la section B".

### Où ils ne sont pas (encore) utiles

- Théorie de la musique à grains fins (en dessous du niveau d'accord).
- Réflexion attribuée par l'orateur sur de longues conversations (dégrades passés 10 minutes).
- Comparaison audio multi- (22-26% est à peine au-dessus du hasard).
- Réflexion en streaming en temps réel (la plupart sont des déductions de lot hors ligne).

```figure
v4-alm-tokens
```

## Faites-le

### Étape 1: requête Qwen2.5-Omni

```python
from transformers import AutoModelForCausalLM, AutoProcessor

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Omni-7B", torch_dtype="auto")

audio, sr = load_wav("clip.wav", sr=16000)
messages = [{
    "role": "user",
    "content": [
        {"type": "audio", "audio": audio},
        {"type": "text", "text": "What sounds do you hear, and what's happening?"},
    ],
}]
inputs = processor.apply_chat_template(messages, tokenize=True, return_tensors="pt")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### Étape 2: le modèle du projecteur

```python
import torch.nn as nn

class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)

    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
```

C'est tout. Le projecteur est généralement de 1 à 3 couches linéaires.

### Étape 3: comparation MMAU / LongAudioBench

```python
from datasets import load_dataset
mmau = load_dataset("gamma-lab-umd/MMAU-Pro", split="test")
mcq = mmau.filter(lambda item: len(item["choices"] or []) > 1)

correct = 0
for item in mcq:
    answer = call_model(item["audio_path"], item["question"], item["choices"])
    if answer == item["answer"]:
        correct += 1
print(f"Accuracy: {correct / len(mcq):.3f}")
```

`audio_path`points dans les repo de l'ensemble de données `data.zip`(environ 47 Go), alors téléchargez-le et déchiffrez-le avant de marquer. Cette boucle de correspondance exacte est une vérification de la santé mentale, et non le scoreur de référence, de sorte que son nombre n'est pas comparable aux résultats publiés de MMAU-Pro. L'évaluateur officiel compare les réponses à choix multiples en intégrant des similitudes (NV-Embed-v2), note les réponses à fin ouverte avec un juge de LLM et vérifie les réponses suivant les instructions avec des règles de régex:`model_output`colonne et courir `evaluate_mmau_pro_comprehensive.py`de la [MMAU-Pro repo](https://github.com/sonalkum/MMAUPro)- Rapportez chacun`category`Les nombres agrégés se cachent là où le modèle échoue.

## Utilisez-le

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## Les pièges

- **Over-trust on multi-audio.**Si votre tâche a besoin de "quel clip a X", la performance au niveau aléatoire est réelle.
- **Long-audio degradation.**Au bout de 10 minutes, la plupart des modèles ont une rupture de l'attribution des haut-parleurs.
- **Hallucinations on silence.**Le même problème de Whisper hérité des LALM qui utilisent le codeur Whisper.
- **Benchmark cherry-picking.**Les articles de blog des vendeurs mettent en évidence les catégories de meilleurs cas.

## La faire partir

- Je ne sais pas .`outputs/skill-alm-picker.md`. Choisissez LALM + sous-ensemble de référence + mode de sortie (texte par rapport à la parole) pour une tâche d'interprétation audio donnée.

## Exercices

1. **Easy.**On court .`code/main.py`pour voir un modèle de projecteur de jouet + faux enroulement LALM de (audio-embedding, text-tokens) → jetons de sortie.
2. **Medium.**Comparer avec le nombre de messages du journal.
3. **Hard.**Construire une ligne de base de sous-titres audio minimale: BEATs encodeur + projecteur à 2 couches + gelé Llama-3.2-1B. Toneur fin seulement le projecteur sur AudioCaps. Comparer à SALMONN sur Clotho-AQA.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder. |
| Projector | Adapter | Small MLP mapping audio features into LLM embedding space. |
| MMAU | The benchmark | 10k audio-QA pairs across speech, sound, music. |
| MMAU-Pro | Harder MMAU | 1800 multi-audio / reasoning-heavy questions. |
| LongAudioBench | Long-form eval | Multi-minute clips with semantic queries. |
| Voice-in / voice-out | Speech-native | Model ingests speech and emits speech without text detour. |

## Pour en savoir plus

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759) architecture de référence.
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B)- Le discours dans le discours.
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128)Le leader de longue voix ouverte.
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) LongAudioBench SOTA.
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289) pionnier du double encodeur.
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/) classement en direct en 2026.
