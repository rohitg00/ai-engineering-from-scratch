# Capstone 12  Vidéo compréhension du pipeline (scène, QA, recherche)

> Douze laboratoires ont produit Marengo + Pegasus. VideoDB a envoyé l'API CRUD pour vidéo. Molmo 2 de l'AI2 a publié des points de contrôle VLM ouverts. Gemini traite des heures de vidéo de manière native. TimeLens-100K a défini le repérage temporel à l'échelle. Le pipeline 2026 est réglé: segmentation de scène, sous-titre + intégration par scène, alignement de transcriptions, index multivéctoriel et requête répondant avec (début, fin) timestamps plus prévisualisation de cadres. La pierre angulaire ingère 100 heures, atteint des critères de référence publics, et mesure les hallucinations sur les questions de comptage et d'action.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI, pipeline scaffold)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## Problème

L'AQ vidéo de longue forme est le problème multimodal le plus affamé de bande passante à l'échelle de 2026. Gemini 2.5 Pro peut lire une vidéo de 2 heures nativement, mais ingérer 100 heures de vidéo dans un corpus consultable nécessite toujours un index de niveau scène. La forme de production combine la segmentation de scène (TransNetV2 ou PySceneDetect), le sous-titre par scène avec un VLM (Gemini 2.5, Qwen3-VL-Max ou Molmo 2), l'alignement des transcripts (Whisper-v3-turbo avec timestamps de mots) et un index multivéctoriel qui stocke les sous-titres, l'intégration de cadres et les transcripts côte à côte. Le pipeline de requêtes répond avec des timestamps (début, fin) plus des prévisualisations de cadres.

Les points de référence sont publics (ActivityNet-QA, NeXT-GQA) plus votre propre ensemble personnalisé de 100 requêtes.

## Concept

Trois pipelines circulent en parallèle à l'ingestion. **Scene segmentation**coupe la vidéo en scènes. **VLM captioning**génère une légende par scène et un cadre intégré à partir d'un clavier. **ASR alignment**Les trois flux sont rejoints par (scene_id, intervalle de temps). Chaque scène obtient trois types de vecteurs dans un index multi-vecteur (Qdrant): insert de titre, insert de tableau de bord, insert de transcription.

Au moment de la requête, la question en langage naturel se déclenche contre les trois vecteurs; les résultats fusionnent avec RRF; un adaptateur de mise à terre temporelle (au style TimeLens) raffinera la fenêtre (début, fin) dans la scène supérieure. Le synthétiseur VLM (Gemini 2.5 Pro ou Qwen3-VL-Max) prend la requête + scènes supérieures + cadres coupés et les réponses avec des timestamps cités et une vue d'avance du cadre.

Les mesures d'hallucination sont importantes. Les questions de comptage ("combien de personnes entrent dans la pièce?") et de type action ("le chef verse-t-il avant de bouger?") sont notoirement peu fiables.

## Architecture

```
video file / URL
      |
      v
PySceneDetect / TransNetV2  (scene segmentation)
      |
      +--- per-scene keyframe --- VLM caption + frame embedding
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- audio channel --- Whisper-v3-turbo ASR + word timestamps
      |
      v
multi-vector Qdrant: {caption_emb, keyframe_emb, transcript_emb}
      |
query:
  dense queries against all three -> RRF merge -> top-k scenes
      |
      v
TimeLens / VideoITG temporal grounding (refine start/end within scene)
      |
      v
VLM synth: query + top scenes + frame previews
      |
      v
answer + (start, end) timestamps + frame thumbs + citations
```

## La pile

- Segmentation des scènes: TransNetV2 (état de pointe 2024-26) ou PySceneDetect
- ASR: Whisper-v3-turbo via le whisper plus rapide avec des timestamps de mots
- VLM caption + réponseur: Gemini 2.5 Pro ou Qwen3-VL-Max ou Molmo 2
- Le système de mise à terre temporelle: adaptateur TimeLens-100K ou vidéoITG
- Index: Qdrant avec support multi-vectoriel (caption / cadre / transcription)
- Interface utilisateur: Next.js 15 avec le lecteur vidéo HTML5 et les miniatures de scènes
- Eval: ActivityNet-QA, NeXT-GQA, ensemble personnalisé étiqueté à la main à 100 questions
- Indice de référence des hallucinations: sous-ensembles de comptage et de type d'action avec étiquettes manuelles

```figure
cf-scene-index
```

## Faites-le

1. **Ingest walker.**Acceptez les URL YouTube ou les MP4 locaux. Reducer à 720p si nécessaire. Persistez `{video_id, file_path}`- Je suis désolé .

2. **Scene segmentation.**Exécutez TransNetV2 ou PySceneDetect pour produire `[{scene_id, start_ms, end_ms, keyframe_path}]`Cible 100 heures: 6K-8K scènes.

3. **ASR pass.**Exécutez Whisper-v3-turbo en audio; exportez des timestamps au niveau du mot; partagez en tranches de transcriptions par scène.

4. **VLM captioning.**Par scène, appelez Gemini 2.5 Pro (ou Qwen3-VL-Max) avec le clavier et un modèle de sous-titres court.

5. **Multi-vector index.**La collecte de Qdrant avec trois vecteurs nommés.`{video_id, scene_id, start_ms, end_ms, keyframe_url}`- Je suis désolé .

6. **Query.**La question du langage naturel met en place trois questions denses; fusionner avec la fusion réciproque de rang; top-k=5 scènes.

7. **Temporal grounding.**Exécutez l'adaptateur TimeLens sur la scène supérieure pour affiner la fenêtre (début, fin) de la scène.

8. **VLM synth.**Appelez Gemini 2.5 Pro avec requête + clips de scènes 3 (en images ou courts clips) + transcriptions.`(video_id, start_ms, end_ms)`Les citations.

9. **Eval.**Exécutez ActivityNet-QA et NeXT-GQA. Construisez un ensemble personnalisé de 100 requêtes. Rapportez l'exactitude globale + répartition par classe (compte, action, description).

## Utilisez-le

```
$ video-qa ask --url=https://youtube.com/watch?v=X "how many cars pass the intersection in the first minute?"
[scene]    23 scenes detected
[asr]      transcript complete, 4m12s
[index]    69 vectors written (23 scenes x 3)
[query]    top scene: scene 3 [01:32-01:54], confidence 0.84
[ground]   refined window: [00:12-00:58]
[synth]    gemini 2.5 pro, 1.4s
answer:    5 cars pass the intersection between 00:12 and 00:58.
citations: [scene 3: 00:12-00:58]
          [frame preview at 00:14, 00:27, 00:44, 00:51, 00:57]
```

## La faire partir

`outputs/skill-video-qa.md`En donnant une URL YouTube ou une vidéo téléchargée, le pipeline indique les scènes et répond aux questions avec des citations marquées par le temps.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Intersection-over-union on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and custom 100-query |
| 20 | Ingest throughput | Hours of video per dollar spent |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy separately |
| **100** | | |

## Exercices

1. Swap Gemini 2.5 Pro pour Qwen3-VL-Max sur le passe de sous-titres.

2. Réduire l'intégration de cadres par scène à un vecteur combiné au lieu de plusieurs vecteurs. Mesurer la régression de récupération.

3. Construire un mode "compte strict": le synthétiseur extrait chaque instance comptée avec un timestamp et l'utilisateur clique pour vérifier. Mesurer si la vérification de l'utilisateur réduit les hallucinations.

4. Le coût de l'ingestion est de 3 heures de vidéo par dollar sur trois options VLM.

5. Ajouter une transcription diarisée par haut-parleur: exécuter la diarisation du haut-parleur pyannote sur l'audio et intégrer des transcriptions par haut-parleur.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scene segmentation | "Shot detection" | Cutting video into scenes at shot boundaries |
| Multi-vector index | "Caption + frame + transcript" | Qdrant collection with named vectors per representation |
| Temporal grounding | "When exactly did it happen" | Refining the (start, end) window for a query answer |
| Frame embedding | "Visual representation" | A vector embedding of a keyframe; used for scene-visual similarity |
| RRF fusion | "Reciprocal rank fusion" | Merge strategy across multiple ranked lists; a classic hybrid-retrieval trick |
| Counting hallucination | "Miscount" | Known failure mode of VLMs on "how many X" questions |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## Pour en savoir plus

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) ouverture des points de contrôle VLM
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) Terrestrisation temporelle à l'échelle
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) la référence hébergée
- [VideoDB](https://videodb.io) Reference de l'API CRUD pour vidéo
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) référence commerciale
- [TransNetV2](https://github.com/soCzech/TransNetV2) modèle de segmentation de scène
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) alternative ouverte classique
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) référence de référence d'évaluation
