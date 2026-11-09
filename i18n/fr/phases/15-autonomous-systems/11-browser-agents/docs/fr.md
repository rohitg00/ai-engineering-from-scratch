# Les agents de navigation et les tâches Web à long terme

> L'agent ChatGPT (juillet 2025) a fusionné l'opérateur et les recherches approfondies en un seul agent navigateur/terminal et a fixé le niveau de BrowseComp SOTA à 68,9%. OpenAI a fermé Operator le 31 août 2025  consolidation à la couche produit. L'acquisition de Vercept par Anthropic a fait passer Claude Sonnet sur OSWorld de moins de 15% à 72,5%. WebArena-Verified (ServiceNow, ICLR 2026) a fixé le taux de faux négatif de ~11.3% dans le WebArena original et a expédié le sous-ensemble Hard de 258 tâches. Les chiffres sont réels. La surface d'attaque est également la même: le chef de la préparation d'OpenAI a déclaré publiquement que l'injection indirecte de prompt dans les agents de navigateur " n'est pas un bug qui peut être complètement corrigé. " Attaques documentées 20252026: Memories tainted (Atlas CSRF), HashJack (Cato Networks), et détournements en un clic dans Perplexity Comet.

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## Le problème

Un agent de navigateur est un agent à long horizon qui lit du contenu non fiable et prend des mesures conséquentes. Chaque page que l'agent visite est une entrée que l'utilisateur n'a pas écrite. Chaque formulaire sur chaque page est un canal de commande potentiel. Le corpus d'attaque 20252026 montre que ce n'est pas hypothétique: Tainted Memories permet à un attaquant de lier des instructions malveillantes à la mémoire de l'agent via une page créée; HashJack cache des commandes dans des fragments d'URL que l'agent visite; Perplexity Comet hijacks prend un seul clic.

La défense est inconfortable. Le chef de la préparation d'OpenAI a déclaré que la partie silencieuse était forte: l'injection directe indirecte " n'est pas un bug qui peut être complètement corrigé. " Cela est dû au fait que l'attaque vit dans la limite de lecture versus action de l'agent, qui est architecturellement floue.

Cette leçon nomme la surface d'attaque, nomme le paysage de référence (BrowseComp, OSWorld, WebArena-Verified), et modélise un scénario d'injection indirecte-immédiat minimal afin que vous puissiez raisonner sur les défenses réelles dans les leçons 14 et 18.

## Le concept

### Le paysage de 2026 en un paragraphe par système

**ChatGPT agent (OpenAI).**Lancé en juillet 2025. Unifie l'opérateur (browsing) et la recherche approfondie (recherche de plusieurs heures). Ferme l'opérateur autonome le 31 août 2025. SOTA sur BrowseComp à 68,9%; chiffres forts sur OSWorld et WebArena-Verified.

**Claude Sonnet + Vercept (Anthropic).**L'acquisition de Vercept d'Anthropic se concentre sur les capacités d'utilisation de l'ordinateur.

**Gemini 3 Pro with Browser Use (DeepMind).**L'intégration de navigateur utilise des commandes d'utilisation informatique; FSF v3 (avril 2026, leçon 20) suit spécifiquement l'autonomie dans le domaine de R&D ML.

**WebArena-Verified (ServiceNow, ICLR 2026).**Résoudre un problème bien documenté: le WebArena original avait un taux de faux négatif de ~11.3% (les tâches marquées ont échoué qui ont été réellement résolues). La version vérifiée réévaluent avec des critères de réussite curatés par l'homme et ajoute un sous-ensemble Hard de 258 tâches (article ICLR 2026, openreview.net/forum?id=94tlGxmqkN).

### BrowseComp vs OSWorld vs WebArena

| Benchmark | What it measures | Horizon |
|---|---|---|
| BrowseComp | Finding specific facts on the open web under time pressure | minutes |
| OSWorld | Agent operating a full desktop (mouse, keyboard, shell) | tens of minutes |
| WebArena-Verified | Transactional web tasks in simulated sites | minutes |
| Hard subset | WebArena-Verified tasks with multi-page state transitions | tens of minutes |

Les scores de l'OSWorld sont plus proches de " fonctionne-t-il sur mon bureau. " WebArena-Verified est plus proche de " peut-il terminer un flux. " Toute décision de production a besoin d'un critère de référence qui correspond à la répartition des tâches.

### La surface d'attaque, nommée

1. **Indirect prompt injection.**Le contenu de la page non fiable contient des instructions. L'agent les lit. L'agent les exécute. Exemples publics: 2024 Kai Greshake et al., 2025 Tainted Memories paper, 2026 HashJack (Cato Networks).
2. **URL fragment / query injection.**Le `#fragment`ou la chaîne de requête d'une URL parcouru contient des commandes.
3. **Memory-binding attacks.**Page instruit l'agent d'écrire une mémoire persistante (leçon 12 couvre l'état durable).
4. **CSRF-shaped attacks on authenticated sessions.**Classe de mémoires contaminées: l'agent est connecté quelque part; la page de l'attaquant émet des demandes de changement d'état que l'agent exécute avec les cookies de l'utilisateur.
5. **One-click hijack.**Un bouton visuellement inoffensif conduit une charge utile suivie par l'agent.
6. **Content-Security-Policy holes in the agent's host surface.**Les couches de rendu et d'outils peuvent être elles-mêmes des vecteurs d'attaque; la pile de navigateur-en-un-browser-agent est large.

### Pourquoi " pas entièrement patchable "

L'attaque est isomorphe à la capacité de l'agent. L'agent doit lire des contenus non fiables pour faire son travail. Tout contenu que l'agent lit pourrait contenir des instructions. Toutes les instructions que l'agent suit pourraient être mal alignées sur la demande réelle de l'utilisateur. Les défenses (limites de confiance, classifiants, permis d'outils, HITL sur les actions conséquentes) augmentent le coût de l'attaque et réduisent son rayon d'explosion. Ils ne ferment pas la classe.

Il s'agit du même modèle de raisonnement que le théorème de Lob (leçon 8): l'agent ne peut pas prouver que le prochain jeton est sûr; il ne peut que mettre en place un système où les jetons dangereux sont plus détectables.

### Une posture de défense qui va en fait

- **Read / write boundary.**Lire n'est jamais une conséquence. Écrire (envoyer un formulaire, publier du contenu, appeler un outil avec des effets secondaires) nécessite une nouvelle approbation humaine si le contenu d'initiation provient de l'extérieur de la limite de confiance.
- **Tool allowlist per task.**L'agent peut parcourir la page; il ne peut pas initier un virement bancaire à moins que cet outil n'ait été explicitement activé pour la tâche.
- **Session isolation.**Les sessions d'agent de navigateur sont exécutées uniquement avec des informations d'identification à portée de main. Aucun auteur de production, aucun courriel personnel.
- **Content sanitizer.**Le HTML récupéré est dépouillé des mauvais modèles connus avant d'être concaténé dans le contexte du modèle. (Réduit les attaques faciles; ne met pas fin aux charges utiles sophistiquées.)
- **HITL on consequential actions.**Le modèle proposé-et-committé (leçon 15).
- **Canary tokens on memory.**Si une entrée de mémoire est activée, l'utilisateur la voit (leçon 14).

```figure
injection-boundary
```

## Utilisez-le

`code/main.py`Un site est bénin, l'un a une tache d'injection directe de prompt dans le texte visible, l'autre a une injection de fragment d'URL (non visible mais dans le contexte de l'agent). Le script montre (a) ce qu'un agent naïf ferait, (b) ce qu'une limite de lecture / écriture capture, (c) ce qu'un désinfectant capte, (d) ce que l'un ou l'autre ne capte.

## La faire partir

`outputs/skill-browser-agent-trust-boundary.md`Les objectifs de la mise en œuvre de l'agent de navigation proposée sont les suivants: quelles zones de confiance il touche, quels sont les écrits qu'il est autorisé à écrire et quelles défenses doivent être mises en place avant la première mise en œuvre.

## Exercices

1. On court .`code/main.py`. Identifier les attaques que le désinfectant capture mais que la limite de lecture/écriture ne capture pas et celles qui n'attaquent que la limite de lecture/écriture.

2. Étendre le désinfectant pour détecter une classe d'injection de fragments d'URL de style HashJack. Mesurer le taux de faux positifs sur les URL bénignes avec des fragments légitimes.

3. Choisissez un vrai flux de travail d'agent de navigateur que vous connaissez (par exemple, " réserver un vol ").

4. Lisez le document ICLR 2026 WebArena-Verified. Identifiez une catégorie de tâches où le score WebArena original n'était pas fiable et expliquez comment le sous-ensemble Verified le résolve.

5. Conçuez un canary de mémoire pour un navigateur.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Indirect prompt injection | "Bad page text" | Untrusted content in a page the agent reads contains instructions the agent executes |
| Tainted Memories | "Memory attack" | Agent writes an attacker-supplied instruction to durable memory; triggered next session |
| HashJack | "URL fragment attack" | Payload hidden in URL fragment / query string is in the agent's context but not visibly rendered |
| One-click hijack | "Bad button" | Visible affordance rides a follow-on payload the agent executes |
| BrowseComp | "Web search benchmark" | Finding specific facts on the open web; minute-scale horizon |
| OSWorld | "Desktop benchmark" | Full OS control; multi-step GUI tasks |
| WebArena-Verified | "Fixed web-task benchmark" | ServiceNow's regraded WebArena with Hard subset |
| Read/write boundary | "Side-effect gate" | Reading never consequential; writing requires fresh approval if content is out-of-trust |

## Pour en savoir plus

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) fusion de l'opérateur et de la recherche approfondie; BrowseComp SOTA.
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) la lignée de l'opérateur et l'architecture qui est devenue l'agent ChatGPT.
- [Zhou et al. — WebArena](https://webarena.dev/) l'indice de référence original.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) papier ICLR 2026 à sous-ensemble fixe.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) inclut la discussion sur la surface d'attaque pour les agents informatiques.
