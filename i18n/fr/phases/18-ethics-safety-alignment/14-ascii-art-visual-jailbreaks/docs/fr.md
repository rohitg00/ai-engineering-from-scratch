# L'art et les jailbreak visuels ASCII

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: Attaques de jailbreak basées sur l'art ASCII contre les LLM alignées" (ACL 2024, arXiv:2402.11753). Masquer les jetons pertinents pour la sécurité dans une demande nuisible, les remplacer par des rendus ASCII-art des mêmes lettres, et envoyer l'invitation masquée. GPT-3.5, GPT-4, Gémeaux, Claude, Llama-2 ne parviennent pas à reconnaître les jetons ASCII-art. L'attaque contourne les PPL (filtres de perplexité), les défenses paraphrasiques et la rétokénisation. Related: le ViTC benchmark mesure la reconnaissance des requêtes visuelles non sémantiques; StructuralSleight généralise aux structures non communes codées par texte (arbres, graphiques, JSON nichés) comme une famille d'attaques de codage.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Décrivez l'attaque ArtPrompt: étape d'identification par mot, substitution ASCII-art, dernière requête masquée.
- Expliquez pourquoi les défenses standard (PPL, Paraphrase, Retokenization) échouent sur ArtPrompt.
- Définir le TIC et décrire ce qu'il mesure.
- Décrire StructuralSleight comme une généralisation des structures encodées par texte inhabituelles arbitraires.

## Le problème

Les attaques par paraphrase et jeu de rôle (leçon 12) et par long contexte (leçon 13) fonctionnent sur le modèle au niveau du texte. ArtPrompt fonctionne au niveau de la reconnaissance: le modèle ne paralyse pas le jeton interdit. Il paralyse une image rendue en caractères. Le filtre de sécurité voit une ponctuation inoffensive. Le modèle voit un mot.

## Le concept

### ArtPrompt, deux étapes

Étape 1. Identification des mots. En cas de demande nuisible, l'attaquant utilise un LLM pour identifier les mots pertinents pour la sécurité (par exemple, " bombe " dans " comment faire une bombe "). 

Étape 2. Génération de la mise en évidence masquée. Remplacez chaque mot identifié par son rendu ASCII-art (un bloc de caractères 7x5 ou 7x7 formant la forme de la lettre). Le modèle reçoit une grille de ponctuation et d'espaces que un modèle suffisamment capable peut reconnaître comme le mot; un filtre de sécurité ne voit que la grille.

Résultat: GPT-4, Gémeaux, Claude, Llama-2, GPT-3.5 échouent tous.

### Pourquoi les défenses standard échouent

- **PPL (perplexity filter).**L'art ASCII a une grande perplexité  mais tout nouveau input le fait aussi.
- **Paraphrase.**La paraphrase du prompt détruit l'art ASCII. En pratique, les LLM de paraphrase préservent ou reconstruisent souvent l'art.
- **Retokenization.**La division des jetons différemment ne change pas le fait que la vision du modèle reconnaît les formes de lettres.

Le problème sous-jacent est que les filtres de sécurité sont au niveau des symboles ou de la sémantique; ArtPrompt fonctionne au niveau de la reconnaissance visuelle.

### Indice de référence ViTC

Reconnaissance des instructions visuelles non sémantiques. Mesure la capacité du modèle à lire ASCII-art, wingdings et autres contenus visuels non textes-sémantiques. L'efficacité d'ArtPrompt est corrélée à la précision de ViTC: plus le modèle lit le texte visuel, mieux ArtPrompt travaille dessus.

### StructuralSleight

Généralise ArtPrompt: Structures encodées par texte (UTES) peu communes. arbres, graphiques, JSON nichés, CSV-in-JSON, blocs de code de style différent. Si une structure est rare dans la formation des données de sécurité mais parseable par le modèle, elle peut cacher du contenu nocif.

L'implication de la défense: la sécurité doit être généralisée sur les représentations structurées que le modèle peut analyser.

### Analogue de la modalité d'image

Les LLM visuels (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) étendent la surface d'attaque. Les attaques de style ArtPrompt avec des images réelles sont plus fortes que les analogues ASCII-art car les encoders d'image produisent un signal plus riche.

### Là où cela s'inscrit dans la phase 18

Les leçons 12-14 décrivent trois vecteurs d'attaque orthogonales: raffinement itératif (PAIR), longueur de contexte (MSJ) et codage (ArtPrompt/StructuralSleight).

```figure
al-ascii-cloak
```

## Utilisez-le

`code/main.py`Vous pouvez masquer des mots spécifiques dans une requête nuisible avec des glyphes ASCII-art, vérifier que la chaîne masquée passe un filtre de mots clés et (en option) décoder la chaîne masquée en utilisant un simple reconnaisseur.

## La faire partir

Cette leçon produit `outputs/skill-encoding-audit.md`. Compte tenu d'un rapport de défense contre les jailbreak, il énumère les familles d'attaques de codage couvertes (art ASCII, base64, leet-speak, homoglyphe UTF-8, UTES) et la couche de défense qui capture chacune.

## Exercices

1. On court .`code/main.py`- Vérifiez que la chaîne masquée passe par un simple filtre de mots clés.

2. Implémenter un deuxième codage: base64 pour le même mot cible. Comparer le taux de contournement du filtre avec ArtPrompt et la difficulté de récupération.

3. Lisez Jiang et coll. 2024 Section 4.3 (résultats de cinq modèles). Proposez une raison pour laquelle la résistance à ArtPrompt de Claude est supérieure à celle de Gémeaux sur le même critère de référence.

4. Conçuez une défense de pré-génération qui détecte les régions en forme d'art ASCII dans le prompt. Mesurez le taux de faux positifs sur le code légitime, les tables et la notation mathématique.

5. StructuralSleight énumère 10 structures de codage.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| ArtPrompt | "the ASCII-art attack" | Two-step jailbreak that masks safety words with ASCII-art renderings |
| Cloaking | "hide the word" | Replace a forbidden token with a visual representation the model reads but the filter does not |
| UTES | "uncommon structure" | Uncommon Text-Encoded Structure — tree, graph, nested JSON, etc. used to smuggle content |
| ViTC | "visual-text capability" | Benchmark for model's ability to read non-semantic visual encoding |
| Perplexity filter | "PPL defense" | Reject prompts with high perplexity; fails because legitimate structured input also scores high |
| Retokenization | "tokenizer shift defense" | Pre-process the prompt with a different tokenizer; fails because recognition is visual |
| Homoglyph | "lookalike characters" | Unicode characters that look identical to Latin letters; bypass substring checks |

## Pour en savoir plus

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) le papier de jailbreak ASCII-art
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) Généralisation des UTES
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) attaque itérative complémentaire
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) attaque de longueur complémentaire
