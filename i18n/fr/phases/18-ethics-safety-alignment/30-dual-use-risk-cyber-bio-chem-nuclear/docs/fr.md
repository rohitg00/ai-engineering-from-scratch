# Risque de double utilisation  Cyber, bio, chimique, nucléaire

> L'image à double usage de 2026, domaine par domaine. Bio/chimique: Leçon 17 couvre le WMDP; l'essai d'acquisition d'armes biologiques d'Anthropic (2,53 fois plus) et l'avertissement du Cadre de préparation d'OpenAI d'avril 2025 v2 ("sur le point d'aider significativement les novices à créer des menaces biologiques connues") marquent le point de basculement. Cyber (rapport Anthropic de novembre 2025): Les acteurs étatiques liés à la Chine ont utilisé l'outil de codage agent de Claude pour automatiser jusqu'à 90% d'une campagne de cyberattaque, avec une intervention humaine seulement en 4-6 étapes; OpenAI "accès fiable" pilote donne aux organisations de sécurité vérifiées l'accès aux capacités de travail de double usage défensif. Erosion de la lacune d'exécution chimique/biologique: la défense classique était "l'accès à l'information seul est insuffisant". Les modèles frontaliers à vision (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) peuvent observer la vidéo wet-lab et fournir une correction en temps réel. Décembre 2025: OpenAI a démontré que GPT-5 faisait l'itération sur des expériences de laboratoire humide, atteignant une amélioration de l'efficacité de 79 fois grâce à l'optimisation du protocole axée sur l'IA. Modèle novice versus expert: L'IA offre une amélioration relative plus grande aux novices mais une plus grande capacité absolue aux experts.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 18 (safety frameworks), Phase 18 · 28 (ecosystem)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Décrivez le récit de la bio-élévation 2024-2025: " élévation légère " -> " sur le point de déclin " -> " élévation de 2,53 fois insuffisante pour exclure ASL-3 ".
- Décrivez le rapport cyber-anthropique de novembre 2025: l'automatisation liée à la Chine dans 90% des cyberattaques.
- Décrire l'érosion de la gamme d'exécution chimique/biologique: correction en temps réel des expériences en laboratoire humide en fonction de la vision.
- Indiquez l'asymétrie absolue entre le débutant et l'expert et ses implications pour la construction de cas de sécurité.

## Le problème

La leçon 17 est la méthodologie de mesure. La leçon 30 est l'état de la mesure de 2026. La situation a considérablement changé entre 2024 et la fin de 2025: trois des quatre domaines ont franchi un seuil que les cadres de 2024 n'ont pas prévu.

## Le concept

### Résumé de la rédaction bio/chimique

Trois phases (repetition à partir de la leçon 17 pour la cohérence):

1. **2024 "mild uplift."**Les évaluations précoces de préparation/RSP ont révélé de petits avantages pour les débutants par rapport à la recherche sur Internet.
2. **April 2025 "on the cusp."**OpenAI PF v2 a averti que les modèles étaient "au bord d'une aide significative pour les novices à créer des menaces biologiques connues".
3. **2025 Anthropic bioweapon-acquisition trial.**Étude contrôlée pour débutants; augmentation de 2,53 fois des tâches de phase d'acquisition; insuffisante pour exclure l'ASL-3.

Le changement est qualitatif: "légère" est devenue "plausiblement permettante" en dix-huit mois, même sans percée de capacité.

### Érosie de la gamme d'exécution chimique/biologique

Défense historique: l'information est nécessaire mais insuffisante; l'habileté à exécuter le protocole bloque les novices.

- **Real-time protocol correction.**GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1 peut observer des erreurs vidéo et flags en milieu de procédure.
- **December 2025 OpenAI demonstration.**GPT-5 qui fait l'itération sur des expériences de laboratoire humide améliore l'efficacité de 79 fois par l'optimisation du protocole.

Les résultats: l'exécution des compétences en défense est en train de s'éroder.

### Le cyber-élan (novembre 2025)

Rapport de novembre 2025 d'Anthropic: Les acteurs de l'État liés à la Chine ont utilisé l'outil de codage agent de Claude pour automatiser 80-90% d'une campagne d'attaque cybernétique.

Les conséquences:
- Le codage agentique est le primitif de l'automatisation des attaques. L'aide cybernétique antérieure à l'IA était limitée au niveau des extraits de code; les flux de travail agentiques intègrent la reconnaissance, l'exploitation, la post-exploitation et l'exfiltration.
- Les 4 à 6 étapes humaines sont le goulot d'étranglement; les gains de capacité futurs réduiraient ce nombre.
- Deuxième utilisation défensive: le pilote d'accès fiable d'OpenAI fournit aux organisations de sécurité vérifiées (entreprises de réaction aux incidents établies, gouvernement) un accès aux capacités de défense.

Le côté défensif de ce travail commence par la lecture du code compilé que vous êtes autorisé à analyser.[Lesson 13.32](../../../13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md), démantèlement en [Lesson 13.33](../../../13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md), en lelevant à un pseudocode en [Lesson 13.34](../../../13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md), et un registre de preuves qui garde les faits observés séparés de ceux déduits dans[Lesson 13.35](../../../13-tools-and-protocols/35-evidence-confidence-and-unknowns/docs/en.md)- Le .[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)Une machine montre le pipeline complet sur une fonction. un agent qui fait ce travail a besoin du même registre, parce qu'une décompilation confiante peut encore reposer sur une devinette.

### Le nucléaire

Le modèle de menace est différent: l'acquisition de matériaux fissiles domine la difficulté, pas l'information. L'élévation de l'IA sur la couche d'information offre une élévation limitée des débutants dans la pratique.

### Le débutant relatif contre l'expert absolu

Un schéma dans les quatre domaines:

- **Novice-relative uplift.**Le taux de multiplication est élevé.
- **Expert-absolute capability.**Un expert extrait plus qu'un novice parce que l'expert sait quoi demander et comment interpréter.

Implication pour les cas de sécurité: s'attaquer uniquement à l'élévation des capacités des débutants (via des filtres d'entrée, des refus, de l'incertitude) est insuffisant pour un contrôle absolu par l'expert.

### Synthèse interdomaine

| Domain | 2024 | 2025 | Inflection |
|---|---|---|---|
| Bio | mild uplift | 2.53x uplift, ASL-3 approach | acquisition-phase automation |
| Chem | mild uplift | execution-gap erosion via vision | real-time wet-lab correction |
| Cyber | code assistance | 80-90% campaign automation | agentic coding |
| Nuclear | limited | limited | material-access bottleneck holds |

Trois domaines ont franchi des seuils, l'un reste délimité par des barrières non-informatiques.

### Là où cela s'inscrit dans la phase 18

La leçon 30 est la pierre angulaire: la photo actuelle de double usage que chaque leçon précédente contribue à mesurer, limiter ou gouverner. Les leçons 17-18 donnent la mesure et les cadres; les leçons 12-16 donnent l'outillage d'évaluation; les leçons 24-25 donnent la couche réglementaire et de divulgation; la leçon 28 donne l'écosystème de recherche.

```figure
an-uplift-asymmetry
```

## Utilisez-le

Aucun code. Lisez le rapport cyber-anthropique de novembre 2025, le cadre de préparation d'OpenAI v2 mise à jour d'avril 2025, et le résumé du Conseil sur les risques stratégiques 2025 AI x Bio.

## La faire partir

Cette leçon produit `outputs/skill-dual-use-triage.md`. Compte tenu d'une revendication de capacité ou d'un rapport d'incident de 2026, il trient les quatre domaines et identifie si la revendication affecte la capacité relative à l'amélioration des compétences des débutants, la capacité absolue des experts ou les deux.

## Exercices

1. Lisez le rapport cyber de novembre 2025 d'Anthropic. Enumérez les étapes 4-6 d'intervention humaine et discutez quelle serait la première à être automatisée dans un modèle de nouvelle génération.

2. L'écart d'exécution chimique/biologique s'est réduit par vision.

3. L'élévation nucléaire semble limitée par l'accès aux matériaux.

4. Construire un dossier de sécurité (leçon 18 trois piliers) pour un modèle frontalier cybercapable qui limite à la fois le développement des débutants et des experts.

5. Choisissez l'un des quatre domaines et écrivez une prévision de 2027 en un paragraphe basée sur la trajectoire 2024-2025. Identifiez les preuves qui pourraient falsifier votre prédiction.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Uplift | "AI helps attackers" | Increase in attacker capability attributable to AI assistance |
| Novice-relative uplift | "multiplicative" | How much AI helps a novice vs status-quo |
| Expert-absolute capability | "ceiling" | Maximum capability an expert can extract from the model |
| Execution gap | "doing vs knowing" | Historical defense: tacit wet-lab skill blocks novices |
| Agentic coding | "autonomous attacks" | Multi-step autonomous cyber-task execution |
| Acquisition phase | "pre-synthesis steps" | Procurement, equipment, permit stages of a bio threat |
| Trusted access | "defender-only pilot" | OpenAI 2025 program giving vetted defenders capability access |

## Pour en savoir plus

- [Anthropic — November 2025 cyber threat report](https://www.anthropic.com/news/disrupting-AI-espionage) Automatisation des campagnes liées à la Chine
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) bio "sur le bord"
- [Anthropic — RSP v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) Les seuils biologiques ASL-3
- [Council on Strategic Risks — 2025 AI x Bio wrapup](https://councilonstrategicrisks.org/2025/12/22/2025-aixbio-wrapped-a-year-in-review-and-projections-for-2026/) Synthèse de fin d'année
