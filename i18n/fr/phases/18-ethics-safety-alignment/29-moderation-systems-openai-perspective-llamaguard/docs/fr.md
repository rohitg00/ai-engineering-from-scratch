# Systèmes de modération  OpenAI, Perspective, Garde Lama

> Les systèmes de modération de production mettent en œuvre les politiques de sécurité définies dans les leçons 12 à 16.`omni-moderation-latest`(2024) basé sur GPT-4o classifie le texte + les images dans un appel; 42% mieux sur le test multilingue que la version précédente; le schéma de réponse renvoie 13 catégories de booléans  harcèlement, harcèlement/menace, haine, haine/menace, illicite, illicite/violente, auto-harmage, auto-harmage/intention, auto-harmage/instructions, sexuel, sexuel/minors, violence, violence/graphique; gratuit pour la plupart des développeurs. Modèles en couches: modération des entrées (pré-génération), modération des sorties (post-génération), modération personnalisée (règles de domaine). Les appels parallèles asynchrone cachent la latence; une réponse placeholder peut couvrir l'attente pendant que la modération d'entrée est terminée. Llama Guard 3/4 (leçon 16): 14 dangers liés aux MLCommons, abus d'interprète de code, 8 langues (v3), multi-image (v4). API de perspective (Google Jigsaw): score de toxicité antérieur à la vague de la MLL en tant que modérateur; toxicité principalement à dimension unique avec des variantes de toxicité sévère/insulte/prophétie; référence pour la recherche sur la modération du contenu. Dépréciations: Modérateur de contenu Azure a été déprécié en février 2024, retiré en février 2027, remplacé par Azure AI Content Safety.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, three-layer moderation harness)
**Prerequisites:** Phase 18 · 16 (Llama Guard / Garak / PyRIT)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Décrivez la taxonomie de catégorie de l'API OpenAI Moderation et la différence qu'elle présente avec l'ensemble des MLCommons de Llama Guard 3.
- Décrivez les trois modèles de couche de modération (entrée, sortie et personnalisation) et nommez un mode d'échec de chacun.
- Décrivez la position de l'API Perspective comme une ligne de base pré-LLM et pourquoi elle reste utilisée dans la recherche.
- Indiquez le calendrier de dépréciation Azure.

## Le problème

Les leçons 12-16 décrivent les attaques et les outils de défense. La leçon 29 couvre les systèmes de modération déployés qui fonctionnent les défenses à la surface où les utilisateurs touchent le produit.

## Le concept

### API de modération OpenAI

`omni-moderation-latest`(2024). Construit sur GPT-4o. Classifie le texte + les images en un appel. Gratuit pour la plupart des développeurs.

Catégories (13 booliens dans le schéma de réponse):
- le harcèlement, le harcèlement/la menace
- haine, haine ou menace
- L'autodestruction, l'autodestruction/l'intention, l'autodestruction/l'instruction
- sexuels, sexuels/minors
- violence, violence/graphique
- Illicite, illicite/violente

Le soutien multimodal s' applique à `violence`- Je suis là .`self-harm`, et `sexual`Mais pas !`sexual/minors`Le reste est uniquement texte.

Pour le code de la bande dans `code/main.py`Nous allons faire tomber le `/threatening`- Je suis là .`/intent`- Je suis là .`/instructions`, et `/graphic`Les codes de production devraient utiliser le schéma complet de 13 catégories.

Les résultats par catégorie; les applications fixent des seuils.

### Garde de la lame 3/4

14 catégories de risques MLCommons (organisées différemment des 13 booliens de schéma de réponse d'OpenAI). Supporte 8 langues (v3). Llama Guard 4 (avril 2025) est natifement multimodal, 12B.

Les taxonomies OpenAI et Llama Guard se chevauchent mais divergent. OpenAI a "illicite" comme une catégorie large; Llama Guard a "crimes violents" et "crimes non violents" séparément.

### API de perspective (Google Jigsaw)

Système de notation de toxicité antérieur à la vague de la LLM en tant que modérateur (avant 2020). Catégories: TOXICITÉ, SEVERE_TOXICITÉ, INSULT, PROFANITÉ, THREAT, IDENTITÉ_ATTACK. Score primaire à une seule dimension (TOXICITÉ) avec des variantes sous-dimensionnelles.

Largement utilisé comme base de recherche de modération de contenu parce que l'API est stable, documentée et a des années de données d'étalonnage. Pour les cas d'utilisation modernes LLM adjacents, Llama Guard ou OpenAI Moderation est généralement mieux adapté.

### Le motif à trois couches

1. **Input moderation.**Classifier le prompt de l'utilisateur avant la génération. Rejeté si marqué.
2. **Output moderation.**Classifier la sortie du modèle avant la livraison. Remplacer par un refus si marqué.
3. **Custom moderation.**Règles spécifiques à un domaine (régex, permis, politique commerciale).

Les trois couches sont séquentielles par conception: la modération d'entrée doit être terminée avant la génération et la modération de sortie se déroule après la génération. Le parallélisme s'applique à l'intérieur d'une couche  exécutant plusieurs classifiateurs (par exemple, OpenAI Moderation + Llama Guard + Perspective) simultanément sur le même texte cachant la latence par classifiateur. En tant qu'optimisation optionnelle, une réponse placeholder ("un moment, vérification...") peut être affichée pendant que la modération d'entrée est complète et que le streaming de token-1 est reporté. Le comportement du drapeau est configurable: rejeter, désinfecter, escalader à l'examen humain.

### Mode d'échec

- **Input only.**Ne capture pas les hallucinations de sortie (les attaques de codage de leçon 12-14 contournent les classifiateurs d'entrée).
- **Output only.**Permet à toute entrée d'atteindre le modèle; augmente le coût; surfaces de raisonnement interne à l'attaquant.
- **Custom only.**Les régexes sont fragiles.

La couche est par défaut.

### Dépréciation de l'azur

Modérateur de contenu Azure: dépassé en février 2024, retraité en février 2027. remplacé par Azure AI Content Safety, basé sur LLM et intégré à Azure OpenAI. La migration est un projet de niveau de terrain 2024-2027 pour les déploiements Azure.

### Là où cela s'inscrit dans la phase 18

La leçon 16 couvre les outils de modération dans le contexte de l'équipe rouge. La leçon 29 couvre la modération déployée. La leçon 30 se termine avec les preuves actuelles de capacité à double usage.

```figure
an-moderation-layers
```

## Utilisez-le

`code/main.py`construit un harnais de modération à trois couches: modérateur d'entrée (mot clé + score de catégorie), modérateur de sortie (même classifiateur sur la sortie), modérateur personnalisé (règles de domaine). Vous pouvez exécuter les entrées et observer quelle couche capture quoi.

## La faire partir

Cette leçon produit `outputs/skill-moderation-stack.md`- En raison d'un déploiement, il recommande une configuration de pile de modération: quel classifiateur à l'entrée, quel à la sortie, quelles règles personnalisées et quel juge pour les cas de bord.

## Exercices

1. On court .`code/main.py`- Faites passer une entrée bénigne, limite et nocive à travers les trois couches.

2. Élargir le harnais avec un score de toxicité de style Perspective-API pour une catégorie spécifique.

3. Lisez les documents API de modération OpenAI et la liste des catégories Llama Guard 3. Mettez chaque catégorie OpenAI dans les catégories Llama Guard les plus proches. Identifiez trois catégories qui ne sont pas nettement cartographiées.

4. Conceptez une pile de modération pour un déploiement d'assistant de code (par exemple, GitHub Copilot). Identifiez les catégories les plus et les moins pertinentes et proposez des règles personnalisées.

5. Azure Content Moderator prend sa retraite en février 2027. Planifiez une migration vers Azure AI Content Safety. Identifiez l'élément à risque le plus élevé de la migration.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OpenAI Moderation | "omni-moderation-latest" | GPT-4o-based 13-category (text) classifier with partial multimodal support |
| Perspective API | "Google Jigsaw toxicity" | Pre-LLM-era toxicity scoring baseline |
| Llama Guard | "MLCommons 14-category" | Meta's hazard classifier (v3: 8B text, 8 langs; v4: 12B multimodal) |
| Input moderation | "pre-generation filter" | Classifier on user prompt before model call |
| Output moderation | "post-generation filter" | Classifier on model output before delivery |
| Custom moderation | "domain rules" | Deployment-specific rules (regex, allowlist, policy) |
| Layered moderation | "all three layers" | Standard production deployment pattern |

## Pour en savoir plus

- [OpenAI Moderation API docs](https://platform.openai.com/docs/api-reference/moderations) point final de l'omni-modération
- [Meta PurpleLlama + Llama Guard](https://github.com/meta-llama/PurpleLlama) Répôt de garde de l'armée
- [Google Jigsaw Perspective API](https://perspectiveapi.com/) Score de toxicité
- [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/) Remplacement d'Azure
