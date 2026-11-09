# Capstone 17  Tutor d'IA personnelle (adaptif, multimodal, avec mémoire)

> Khanmigo (Académie Khan), Duolingo Max, Google LearnLM / Gemini pour l'éducation, Quizlet Q-Chat et Synthesis Tutor ont tous fourni des tutoriels multimodels adaptatifs à grande échelle en 2026. La forme commune est une politique socratique (ne jamais simplement déposer la réponse), un modèle d'apprenant qui se met à jour après chaque interaction (style de suivi des connaissances bayésiennes), entrée vocale + texte + photo-mathématique, récupération de graphique du programme d'études, planification de répétition espacée et filtres de sécurité durs pour le contenu approprié à l'âge. Le but est d'envoyer un tuteur spécifique à un sujet (algebra K-12 ou introduction Python), d'exécuter une étude d'efficacité de deux semaines avec 10 apprenants et de passer un audit de sécurité du contenu.

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app, learner model scaffold), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## Problème

Le tutorat adaptatif était autrefois une niche de recherche en technologie. D'ici 2026, il est un produit de consommation. Khanmigo est déployé dans la plupart des districts scolaires américains. Duolingo Max a frappé des dizaines de millions de MAU. Le programme LearnLM / Gemini pour l'éducation de Google permet de former dans la salle de classe de Google. Le quizlet Q-Chat est assis à côté des cartes flash. Synthèse Tutor a fait une forte popularité avec les enfants curieux. Les éléments communs: entrée multimodal (type, discours, équations de photographie), pédagogie socratique (demande d'abord, explique plus tard), un modèle d'apprenant qui se met à jour après chaque interaction, et une sécurité stricte adaptée à l'âge.

Vous construirez une de ces méthodes pour une cohorte spécifique. La barre de mesure est une étude d'efficacité réelle: les scores avant et après les tests sur deux semaines avec 10 apprenants. La boucle vocale doit se sentir naturelle (capstone 03 sous-stack). La mémoire doit respecter la vie privée. Le filtre de sécurité doit passer COPPA-conscient red-team pour K-12.

## Concept

Quatre composants.**Tutor policy**est une boucle socratique: lorsque l'apprenant demande la réponse, la politique pose une question de premier plan; lorsqu'il la réalise correctement, elle passe au concept suivant; lorsqu'il est coincé, il offre une indication échafaudable. **Learner model**est le suivi des connaissances bayésiennes (ou une variante simple) qui met à jour la probabilité de maîtrise par nœud du programme de cours après chaque interaction. **Curriculum graph**est une Neo4j de concepts avec des bords prérequis; la politique passe le graphique pour choisir le concept suivant. **Memory**est un magasin épisodique + sémantique (mémoire d'agent) contenant des interactions passées, des erreurs et des préférences.

L'UX est multimodal. Entrée de texte pour les réponses typées. Entrée de voix via LiveKit + Whisper (reutilisez le capstone 03). Entrée de photo pour les problèmes mathématiques via dots.ocr ou PaliGemma 2. sortie de voix via Cartesia Sonic-2. Sécurité utilise Llama Guard 4 plus un filtre adapté à l'âge (bloqueur de contenu adulte, violence, auto-harmage) et une politique de rétention de mémoire consciente de COPPA.

L'étude d'efficacité est la livrable. 10 apprenants, pré-test et post-test, deux semaines. Rapporte le gain d'apprentissage delta et intervalle de confiance. Comparer avec une ligne de base non adaptative (le même contenu livré linéairement sans la politique du tuteur).

## Architecture

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## La pile

- Choix de sujet: algèbre K-12 ou introduction Python (choisir une pour la profondeur)
- Politique du tuteur: LangGraph sur Claude Sonnet 4.7 (avec mise en cache rapide)
- Modèle apprenant: suivi des connaissances bayésiennes (classique) ou FSRS pour l'espacement
- Graphique du programme: Neo4j des concepts + bordures prérequis + contenu des RER
- Mémoire: vecteur persistant de type agent mémoire + stockage épisodique + sémantique
- Voix: LiveKit Agents 1.0 + Cartesia Sonic-2 (sous-pied de capstone 03 à réutiliser)
- Mathématiques photo: points.ocr ou PaliGemma 2 pour la reconnaissance des équations
- Sécurité: Llama Guard 4 + filtre adapté à l'âge
- Eval: génération de questions au niveau de la fleur, utilisation pré/après les essais, outillage d'étude d'efficacité

```figure
cf-tutor-loop
```

## Faites-le

1. **Curriculum graph.**Construisez un Neo4j de 50 à 150 nœuds conceptuels (par exemple, l'algèbre K-12 de "ligne numérique" à "formule quadratique") avec des bords prérequis.

2. **Learner model.**Initializer le suivi des connaissances bayésiennes avec des antécédents: deviner, glisser, apprentissage. Mise à jour de maîtrise par concept après chaque interaction. Persistant par apprenant.

3. **Tutor policy.**LangGraph avec des nœuds: `read_signal`(la réponse de l'élève était-elle correcte / partielle / coincée ?),`select_concept`(graphe de programme de cours de marche en choisissant le concept de la plus haute priorité), `scaffold`(Précédent socratique),`update_mastery`- Je suis désolé .

4. **Memory.**Chaque interaction écrit à un magasin épisodique. Les erreurs et les préférences favorisent la mémoire sémantique. Politique de conservation consciente de COPPA: suppression automatique après 1 an, accessible aux parents.

5. **Voice path.**Le travailleur de LiveKit Agents attaché à la politique de tutorat. ASR via Whisper-v3-turbo. TTS via Cartesia Sonic-2.

6. **Photo-math path.**Télécharger ou capturer une image; exécuter dots.ocr ou PaliGemma 2 pour reconnaître l'équation; fournir à l'enseignant une entrée structurée.

7. **Safety.**Chaque sortie de modèle passe par Llama Guard 4 + un filtre adapté à l'âge (bloqueur de l'automutilation, contenu adulte, violence).

8. **Efficacy study.**10 apprenants, pré-test (baseline standardisée de 30 questions), deux semaines d'interaction avec les tuteurs (3 sessions/semaine), post-test.

9. **Weekly progress reports.**Pour chaque apprenant, générez automatiquement un résumé PDF des sujets explorés, des trajectoires de maîtrise et des étapes suivantes recommandées.

## Utilisez-le

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## La faire partir

`outputs/skill-ai-tutor.md`Un tuteur adaptatif spécifique à la matière avec une entrée multimodal, un modèle d'apprenant, une mémoire, une sécurité et une efficacité mesurée.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | Pre/post-test delta in a 10-learner two-week study |
| 20 | Socratic fidelity | Rubric score on transcript samples |
| 20 | Multimodal UX | Voice + photo + text coherence end to end |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## Exercices

1. Exécuter l'étude d'efficacité avec et sans le modèle adaptatif de l'apprenant (ordre de concepts aléatoires).

2. Ajoutez une sonde multimodal: la même question conceptuelle fournie comme texte, voix et photo. Mesurez si les apprenants convergent plus rapidement avec la modalité qu'ils préfèrent.

3. Construire un tableau de bord parent: sujets pratiqués, trajectoires de maîtrise, concepts à venir, événements de sécurité (quels que soient les accidents de garde-ferre).

4. Ajouter un mode de commutation de langue: le tuteur accepte l'entrée en espagnol et enseigne en espagnol.

5. Encore une fois, il est important de vérifier que l'apprenant A ne peut pas voir les données de l'apprenant B même lors d'une attaque de recréation de la vidéo vocale.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | Tutor asks a leading question rather than giving the answer |
| Bayesian knowledge tracing | "BKT" | Classic learner-model equations for mastery probability per concept |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 spaced-repetition scheduler, better than SM-2 |
| Curriculum graph | "Concept DAG" | Neo4j of concepts with prerequisite edges |
| Episodic memory | "Per-interaction log" | Every interaction stored for later retrieval |
| Semantic memory | "Learned pattern store" | Compacted mistakes and preferences promoted from episodic |
| COPPA | "Kids privacy law" | US law restricting data collection from children under 13 |

## Pour en savoir plus

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) tutorat de référence pour les consommateurs K-12
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) tutorat de référence pour l'apprentissage des langues
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) modèle de référence hébergé
- [Quizlet Q-Chat](https://quizlet.com) référence alternative
- [Synthesis Tutor](https://www.synthesis.com) référence de démarrage
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) programmeur de répétition à distance
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) modèle classique des apprenants
- [LiveKit Agents](https://github.com/livekit/agents) épilation de voix
