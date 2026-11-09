# Sous-flou  Architecture et réglage

> Whisper est un transformer de fenêtre de 30 secondes, encodeur-décoeur, formé sur 680 000 heures de paires audio-texte multilingues mal supervisées.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## Le problème

Whisper, publié par OpenAI en septembre 2022, était le premier modèle ASR à être livré comme une marchandise: coller audio, obtenir du texte, 99 langues, résistant au bruit, fonctionne sur un ordinateur portable.

Mais Whisper n'est pas un pipeline que vous pouvez traiter comme une boîte noire pour toujours.

1. Ce qu'il est vraiment à l'intérieur.
2. Comment le faire en morceaux, en streaming ou en long format audio correctement.
3. Quand et comment.

## Le concept

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**Architecture.**Transformateur standard encodeur-décodeur.

- Entrée: spectrogramme log-mel de 30 secondes, 80 mels, 10 ms hop → 3000 images.
- Encodeur: échantillon de con-down (étape 2) + `N`Pour les grandes v3: 32 couches, 1280-dim, 20 têtes.
- Décoder: `N`Les blocs transformateurs avec auto-attn + croisé-attn à la sortie d'encodeur.
- Résultat: des jetons BPE sur un vocabulaire de 51 865 jetons.

Le grand-v3 a des paramètres de 1,55B. Turbo utilise un décodeur à 4 couches (à partir de 32), réduisant la latence 8x avec un impact WER de < 1%.

**The prompt format.**Whisper est un modèle multitâche dirigé par des jetons spéciaux dans le décodeur prompt:

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`: tag de langue; nommer la langue parlée dans l'audio.
- `<|transcribe|>`ou `<|translate|>`: tag de tâche; transcrire le discours dans sa langue source ou le traduire en texte anglais.
- `<|notimestamps|>`: sauter les timestamps au niveau des mots (plus vite).

Le prompt est ce qui permet à un modèle de faire de nombreuses tâches.`<|en|>`à `<|fr|>`et il transcrit le français.

**30-second window.**Tout est fixé à 30 secondes. Les clips plus longs doivent être déchiquetés; les clips plus courts sont rembourrés. Les fenêtres ne sont pas diffusées en streaming natif  c'est pourquoi WhisperX, Whisper-Streaming et faster-whisper existent.

**Log-mel normalization.** `(log_mel - mean) / std`Vous devez utiliser le préprocessage de Whisper (`whisper.audio.log_mel_spectrogram`), pas `librosa.feature.melspectrogram`- Je suis désolé .

### Variantes en 2026

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### Réglage de la qualité

Flux de travail canonique en 2026:

1. Ramasser 10100 heures d'audio pour le domaine cible avec des transcriptions alignées.
2. On court .`transformers.Seq2SeqTrainer`avec `generate_with_loss`Je vous rappelle.
3. Paramètre-efficacité:`q_proj`- Je suis là .`k_proj`- Je suis là .`v_proj`Les couches d'attention réduisent la mémoire de la GPU 4x avec un coût de WER de < 0,3.
4. Fermez le codeur si vous avez < 10 heures.
5. Utilisez le propre jetonnisateur et le format prompt de Whisper; ne changez jamais de jetonnisateur.

Résultats communautaires: ajustement de la durée moyenne de 20 heures de dictation médicale réduit la RER de 12% à 4,5% du vocabulaire médical.

```figure
sp-asr-attention
```

## Faites-le

### Étape 1: exécuter Whisper hors de la boîte

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

Les défauts clés que vous devez toujours annuler: `temperature=0.0`(échantillonnage des défauts à 0,0 → 0,2 → 0,4 ... chaîne de retrait), `condition_on_previous_text=False`(évitant le problème de l' hallucination en cascade), et `no_speech_threshold=0.6`(détection du silence).

### Étape 2: forme longue en morceaux

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

WhisperX ajoute (1) le gate Silero VAD, (2) l'alignement au niveau du mot via wav2vec 2.0, (3) la diarisation via `pyannote.audio`Le cheval de travail de 2026 pour la transcription de production.

### Étape 3: régler avec LoRA

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

Puis la boucle de formation standard, un point de contrôle tous les 1000 pas, et une évaluation avec WER.

### Étape 4: inspecter ce que chaque couche apprend

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

Visualisez avec une carte thermique  vous verrez l'alignement diagonal en scannant les étapes du décodeur à travers les cadres d'encodeur. Cette diagonale est la notion de Whisper de timestamps de mots.

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper`(CTranslate2 backend) est le plus rapide CPU + GPU déduction runtime en 2026  4x plus rapide que la vanille avec une sortie identique.

## Des pièges qui vont encore arriver en 2026

- **Hallucinated text on silence.**Les paroles de la chanson "Whisper" sont formées sur des légendes comme "Thanks for watching!", "Subscribe!", toujours VAD-gate avant d'appeler.
- **`condition_on_previous_text` cascade.**Une hallucination pollue les fenêtres suivantes.`False`à moins que vous ayez besoin de fluidité à travers les morceaux.
- **Short-clip padding.**Un clip de 2 secondes rembourré à 30 secondes peut halluciner dans le silence qui suit.`pad=False`ou la porte VAD.
- **Wrong mel stats.**L'utilisation de la libérosa mels au lieu de Whisper produit une sortie presque aléatoire.`whisper.audio.log_mel_spectrogram`- Je suis désolé .

## La faire partir

- Je ne sais pas .`outputs/skill-whisper-tuner.md`- Conceptionner un pipeline de résonance ou d'inférence Whisper pour un domaine donné.

## Exercices

1. **Easy.**On court .`code/main.py`Il symbolise une requête de style Whisper, calcule les budgets de forme décodés et imprime le calendrier des pièces pour un clip de 10 minutes.
2. **Medium.**Installez`faster-whisper`, transcrire un podcast de 10 minutes, comparer WER à une transcription humaine.`language="auto"`contre forcé`language="en"`- Je suis désolé .
3. **Hard.**Utilisation de HF `datasets`, choisissez une langue avec laquelle Whisper lutte (par exemple, l'urdu), ajustez le moyen avec le LoRA pendant 2 époques sur 2 heures, et rapportez le delta WER.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 30-sec window | Whisper's limit | Hard input cap; chunk longer audio. |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` kicks off the decoder prompt. |
| Timestamps token | Temporal alignment | Every 0.02 s offset is a special token in the 51k vocab. |
| Turbo | The fast variant | 4-decoder layers, 8× faster, <1% WER regression. |
| WhisperX | The long-form wrapper | VAD + Whisper + wav2vec alignment + diarization. |
| LoRA fine-tune | Efficient tuning | Add low-rank adapters to attention; train ~0.3% of params. |
| Hallucination | The silent failure | Whisper produces fluent English from noise/silence. |

## Pour en savoir plus

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) l'architecture et la recette de formation originales.
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363)Décoeur à 4 couches, accélération 8 fois.
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747)- Longues, alignées sur les mots, quotidiennes.
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) CTranslate2 supporté, 4x plus rapide.
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) L'ACE canonique / traversée à plein FT.
