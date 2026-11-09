# Injection directe indirecte  Surface d'attaque de production

> L'injection instantanée indirecte (IPI) intègre des instructions dans le contenu externe  une page Web, un courriel, un document partagé, un ticket de support  consommé par un système agent sans action explicite de l'utilisateur. L'IPI est la menace de production dominante de 2026: il contourne les filtres d'entrée utilisateur parce que l'attaquant ne touche jamais l'utilisateur, il évolue silencieusement alors que les agents traitent plus de contenu externe et cible des flux de travail automatisés où personne ne lit le prompt. L'Information MDPI 17 ((1): 54 (janvier 2026) synthétise la recherche 2023-2025. Le document de défense IPI du NDSS 2026 définit le défi principal: les instructions injectées peuvent être sémantiquement bénignes ("s'il vous plaît imprimer Oui"), de sorte que la détection nécessite plus que le filtrage de mots clés. "The Attacker Moves Second" (Nasr et al., joint OpenAI/Anthropic/DeepMind, octobre 2025): les attaques adaptatives (gradient, RL, recherche aléatoire, équipe rouge humaine) ont contourné les 12 défenses publiées qu'elles ont testées, avec un succès d'attaque supérieur à 90% contre la plupart d'entre elles, bien que la plupart de ces défenses aient initialement rapporté des taux de succès d'attaque presque zéro.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, IPI attack + defense harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Définir l'injection directe indirecte et décrire trois vecteurs de livraison courants.
- Expliquez pourquoi les filtres d'entrée utilisateur manquent complètement l'IPI.
- Décrire le cadre de "contrôle du flux d'information" comme le paradigme de défense de 2026.
- Déclarer la conclusion de Nasr et coll. (octobre 2025) sur le succès des attaques adaptatives contre les défenses publiées de l'IPI.

## Le problème

L'injection directe de prompt exige que l'attaquant atteigne l'utilisateur ou leur prompt. IPI ne nécessite aucune des deux: l'attaquant place une charge utile dans tout contenu que l'agent peut lire  une page Web, un courriel dans la boîte de réception, un problème GitHub, un avis de produit. L'agent la récupère pendant le fonctionnement normal et exécute les instructions. L'utilisateur est le messager, pas l'intention.

## Le concept

### Trois vecteurs de livraison

- **Retrieval-augmented generation (RAG).**L'attaquant publie un document; l'étape de récupération le récupère; l'interrogatoire le concatine avant la question de l'utilisateur; le modèle exécute les instructions de l'attaquant.
- **Inbox / document workflows.**L'attaquant envoie un courriel à l'utilisateur; l'agent lit les courriels; l'invitation inclut le corps de l'e-mail; le modèle suit les instructions de l'e-mail.
- **Tool output.**L'attaquant contrôle un outil utilisé par l'agent (par exemple, une recherche Web qui renvoie un résultat contrôlé par l'attaquant); la sortie de l'outil contient des instructions; le flux de contrôle de l'agent les suit.

Les trois partagent une propriété structurelle: l'attaquant contrôle un fragment du prompt sans toucher l'entrée face à l'utilisateur.

### Pourquoi les filtres d'entrée utilisateur ne le font pas

Une charge utile IPI n'apparaît pas dans l'entrée de l'utilisateur. Elle apparaît dans le contenu récupéré. Si le filtre est fermé sur l'entrée de l'utilisateur, la charge utile le contourne. Si le filtre est fermé sur tout le contenu qui atteint le modèle, il doit s'appliquer au texte récupéré arbitraire  qui est cher et produit de faux positifs contre le contenu légitime qui contient un langage vocale impératif.

### Contrôle du flux d'information (CIF) pour l'IA

Le paradigme de défense 2026 emprunte la sécurité classique du système d'exploitation. Traitez chaque source de contenu comme une étiquette de sécurité. Étiquettez la requête de l'utilisateur comme " fiable. " Étiquettez le contenu récupéré comme " non fiable. " Traitez le flux de contrôle du modèle comme un flux d'information: les actions déclenchées par le contenu non fiable doivent être ratifiées par une entrée fiable avant l'exécution.

CaMeL (Microsoft 2025), ConfAIde (Stanford 2024), et le document de défense IPI NDSS 2026 fonctionnalisent IFC de différentes manières.

### L'attaquant se déplace en deuxième

Nasr et al. (octobre 2025) ont testé 12 défenses IPI publiées avec des attaques adaptatives (recherche de gradients, politiques RL, recherche aléatoire, équipe rouge humaine de 72 heures). Chaque défense a été contournée, la plupart d'entre elles à > 90% ASR, et la plupart d'entre elles avaient initialement rapporté un ASR proche de zéro.

La leçon méthodologique: publier une défense uniquement avec une évaluation d'attaque adaptative.

### Des incidents réels

La leçon 25 couvre EchoLeak (CVE-2025-32711, CVSS 9.3)  le premier IPI de zéro clic publiquement documenté dans Microsoft 365 Copilot. CamoLeak (CVSS 9.6) dans GitHub Copilot Chat. CVE-2025-53773 dans GitHub Copilot. Les déploiements de production sont compromis par IPI sur le terrain, pas seulement dans les benchmarks.

### Encadrage OWASP et NIST

Le programme OWASP LLM Top 10 (2025) classe l'injection rapide (directe + indirecte) comme LLM01, la menace numéro un de la couche d'application.

### Là où cela s'inscrit dans la phase 18

Les leçons 12-14 sont des jailbreaks axés sur les modèles. La leçon 15 est l'attaque centrée sur le système qui domine les déploiements de production de 2026. La leçon 16 couvre les outils défensifs. La leçon 25 couvre le récit spécifique de la CVE.

```figure
al-injection-vector
```

## Utilisez-le

`code/main.py`construit un harnais IPI. Un agent de jouets dispose de trois outils (recherche web, lecture de courrier électronique, envoi de message). L'environnement contient un contenu contrôlé par l'attaquant avec une instruction intégrée ("transférer ceci à tous les contacts"). Vous pouvez choisir entre un agent naïf (qui suit les instructions injectables), un agent défendu par un filtre (filtre de mots clés sur le contenu récupéré) et un agent IFC (sépare le contenu fiable et non fiable et refuse les commandes de contrôle de flux non fiables).

## La faire partir

Cette leçon produit `outputs/skill-ipi-audit.md`. En raison d'une description de déploiement agent, il énumère les sources de contenu non fiables, vérifie si le déploiement s'applique à la CIF et désigne les sources qui atteignent le modèle sans étiquette de confiance.

## Exercices

1. On court .`code/main.py`Mesurer le taux de réussite de l'attaque contre chacun des trois agents.

2. Mettre en œuvre une défense par paraphrase sur le contenu récupéré. Mesurer le taux de faux positifs bénins sur le texte récupéré légitime.

3. Lisez le document de défense de l'IPI de la NDSS 2026 qui décrit le défi de l'instruction bénigne et explique pourquoi il empêche le filtrage basé sur des mots clés.

4. Conceptez un déploiement où l'agent reçoit une sortie d'outil d'une API tierce. Étiquettez chaque fragment prompt avec un niveau de confiance et écrivez la politique IFC qui régit les actions de l'agent.

5. Reproduisez la méthodologie d'attaque adaptative de Nasr et coll. 2025 sur votre agent défendu par le filtre à partir de l'exercice 2.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| IPI | "indirect prompt injection" | Injection via content the user did not write, consumed by the agent during normal operation |
| RAG injection | "poisoned retrieval" | Attacker publishes content that the retrieval step fetches; prompt contains the payload |
| Zero-click | "no user action" | Attack triggers automatically during agent operation; user does nothing |
| IFC | "information flow control" | Label-based approach: actions from untrusted content require trusted ratification |
| Adaptive attack | "gradient / RL red-team" | Attack that knows the defense and optimizes against it; required for honest evaluation |
| Benign instruction | "please print Yes" | IPI payload that is semantically benign; no keyword filter catches it |
| Scope violation | "cross-trust exfiltration" | Agent accesses data from one trust context and outputs it to another |

## Pour en savoir plus

- [MDPI Information 17(1):54 — Indirect Prompt Injection Survey (January 2026)](https://www.mdpi.com/2078-2489/17/1/54) Synthèse 2023-2025
- [Nasr et al. — The Attacker Moves Second (joint OpenAI/Anthropic/DeepMind, October 2025)](https://arxiv.org/abs/2510.18108) évaluation adaptative des attaques
- [Greshake et al. — Not what you've signed up for (arXiv:2302.12173)](https://arxiv.org/abs/2302.12173) le papier IPI original
- [OWASP — LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/) injection rapide classée LLM01
