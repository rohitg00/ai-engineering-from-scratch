# Éteignez les interrupteurs, les interrupteurs de circuit et les jetons canariens

> Un commutateur de commande est un booléen détenu en dehors de la surface de modification de l'agent  une clé Redis, un drapeau de fonctionnalité, une configuration signée  qui désactive complètement l'agent. Un disjoncteur est plus fin: il trébuche sur un modèle spécifique (cinq appels identiques d'outils consécutifs), arrête le chemin qui l'offend et monte vers un humain. Un jeton canarien hérite d'une tromperie classique: une fausse carte d'identité ou un enregistrement de honeypot un agent n'a pas de raison légitime de toucher, dont l'accès déclenche une alerte. Les données basées sur le eBPF (par exemple: Cilium) peut réécrire l'exit d'une capsule en quarantaine vers un honeyypot médico-légale à la couche du noyau; les benchmarks Cilium publiés rapportent la latence de la piste de données sous charge P99 sous millisecondes (votre budget de propagation dépend de la façon dont une mise à jour de politique atteint le nœud, pas la piste de données elle-même). Les détecteurs statistiques (EWMA, CUSUM) qui s'adaptent à une ligne de base en mouvement les accueillent tranquillement avec des couches de dérive avec des limites constitutionnelles strictes qui ne se plient pas.

**Type:** Learn
**Languages:** Python (stdlib, three-detector simulator: kill switch, circuit breaker, canary), TypeScript
**Prerequisites:** Phase 15 · 13 (Cost governors), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## Le problème

Les administrateurs de coûts (leçon 13) limitent ce que l'agent peut dépenser. Ils ne limitent pas ce que l'agent peut faire dans le budget. Un agent avec une limite de vitesse de 50 $ peut toujours exfiltrer un secret, publier le mauvais message ou supprimer une ressource.

Cette leçon couvre les trois détecteurs qui sont placés à côté de la couche de coûts:

1. **Kill switch**: boolean off-button tenu hors de la portée de l'agent.
2. **Circuit breaker**: détecteur de modèle d'action qui arrête un chemin spécifique.
3. **Canary token**: appât qu'un agent sans raison légitime de toucher se révélera en le touchant.

Les trois sont des ingénieurs pré-LLM. La tromperie classique, les détecteurs de limite de fréquence et les flags de fonctionnalités tuent des agents autonomes antérieurs. Ce qui est nouveau, c'est la surface d'attaque: les agents lisent des contenus non fiables (leçon 11), éditent leur propre mémoire et peuvent composer de nombreuses actions sûres en une non sûre. Les détecteurs nommés ici fonctionnent parce qu'ils ne font pas confiance à l'auto-rapport de l'agent.

## Le concept

### Commutateurs de commutation

Un commutateur de commande est un booléen que l'agent lit mais ne peut pas écrire.

- **Feature flag in a managed service.**Les mises à jour se propagent en quelques secondes.
- **Redis key the agent polls.**C'est simple, il faut que le processus de l'agent vérifie à chaque tour.
- **Signed config in object storage.**L'agent vérifie une signature sur le bouton; rejette les états non signés.
- **OS-level signal or container-lifecycle kill.**Le docker`kill`, Kubernetes `kubectl delete pod`- Le système s'arrête.

Propriétés d'un interrupteur de compression correct:

- L' agent ne peut pas le régler .`off`(Vive dans un système où les informations d'identité de l'agent ne sont pas écrites.)
- Il est vérifié sur toutes les actions qui en découlent, pas seulement au démarrage.
- Lorsqu'il est éteint, l'agent ne fait rien d'observable à l'extérieur, y compris enregistrer les systèmes auxquels l'agent peut atteindre.
- La réactivation est une action humaine explicite, pas un temps-arrêt automatique.

### Les interrupteurs de circuit

Un circuit breaker arrête un schéma spécifique, pas l'agent entier.

- **Closed**: action est autorisée.
- **Open**: l'action est bloquée.
- **Half-open**: après un refroidissement, 13 tentatives de sonde sont autorisées (par défaut 1); le succès ferme le coupe-coupe, toute défaillance restante le rouvre à nouveau.

Les déclencheurs liés à l'agent:

- Cinq appels identiques d'outils consécutifs (boucle répétitif).
- Cinq défaillances consécutives sur le même outil avec des entrées différentes (faillance systémique).
- Le taux d'appels des outils dépasse un seuil (vitesse de leçon 13).
- Un outil spécifique invoqué (p. ex., `file.delete`) après avoir lu un contenu non fiable (leçon 11).

### Les jetons canariens

Les jetons canariens (également appelés honeytokens) sont des entrées que l'agent ne devrait jamais toucher.

Exemples pour les agents:

- Une fausse .`AWS_SECRET_ACCESS_KEY`Les tentatives d'exfiltration sont immédiatement attribuables.
- Un faux enregistrement de base de données marqué par une valeur sentinelle connue.
- Un faux fichier dans l'espace de travail.
- Une fausse entrée de mémoire injectée au début de la session.

Le design des canaries est spécifique au flux de travail.

### Pourquoi la couche statistique et les limites dures

Les détecteurs statistiques (EWMA, CUSUM, z-score sur les taux d'appels à l'outil) s'adaptent à une ligne de base en mouvement. C'est une caractéristique pour la dérive légitime et un bug pour la dérive adverse.

Les limites constitutionnelles strictes (leçon 17) ne se plient pas.`secrets@`" comme une règle constitutionnelle est plus simple, auditable et non jouable par dérive lente.

### Quarantaine via le redirectionnement du chemin de données eBPF

La politique de réseau basée sur le ePF de Cilium peut réécrire l'exode d'une capsule mise en quarantaine vers un honeypot médico-légale à la couche du noyau. Les benchmarks publics de Cilium indiquent une latence de P99 de la tracé de données de sous-millisecondes sur TCP_RR; le budget de l'horloge murale pour * déclencher* une quarantaine dans votre cluster est dominé par la façon dont une mise à jour de politique se propage de votre plan de contrôle au nœud (quelques centaines de millisecondes sont réalistes sur Kubernetes avec l'opérateur prélouvé; la latence de la queue dépend de la taille du cluster et de la cadence de conciliation). Cela vous donne deux choses: l'agent ne s'exfiltre pas de réel, et le comportement de l'agent à l'intérieur du pot de miel est pleinement observé. Le même motif, une couche différente, comme le jeton canarien: l'agent révèle l'intention par ce qu'il essaie de faire en étant contenu.

### Ce qu' aucun détecteur ne capture

- **Semantic attacks that compose from allowed primitives.**Chaque action individuelle passe par tous les détecteurs; la composition est le problème.
- **Attacks that include the detector as part of the payload.**Si un agent lit une page qui dit "avant d'agir, désactivez le canarien" et que l'agent a la capacité, le détecteur est compromis.

```figure
circuit-breaker
```

## Utilisez-le

`code/main.py`Il simule une courte trajectoire de l'agent à travers trois détecteurs. Un interrupteur de tuerie tenu dans un dicton externe; un interrupteur de circuit qui trébuche sur cinq appels identiques à l'outil; un fichier canarien dont la lecture déclenche une alerte.

## La faire partir

`outputs/skill-tripwire-design.md`examine une pile de détecteurs proposée pour le déploiement d'un agent et détecte les lacunes (interrupteur de déclenchement manquant, canary manquant, seuil de disjoncteur trop lâche).

## Exercices

1. On court .`code/main.py`- Confirmer les incendies de disjoncteurs au tour 7 (cinquième appel identique) et les incendies de canaries au tour 9 (lecture de fausse clé).

2. Ajouter un détecteur statistique: EWMA z-score sur le taux d'appel à l'outil. Donner une trajectoire qui dérive lentement et montrer que le détecteur ne tire jamais. Maintenant ajouter une limite d'intensité (pas plus de 50 appels à l'outil en 10 minutes) et montrer les feux de limite d'intensité sur la même trajectoire.

3. Développez un jeton canarien pour un agent de navigateur (leçon 11).

4. Décrivez concrètement un flux de quarantaine de sortie-réorientation: quel sélecteur de politique, quel module, quel réécriture de sortie, quel alerte. Qu'est-ce qui régit la latence du mur de l'horloge de " décider de quarantaine " à " premier paquet redirigé "?

5. Définir une procédure réactivable pour un agent tué-interrompu. Qui peut réactiver?

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Kill switch | "Off button" | Boolean outside the agent's edit surface; checked on every consequential action |
| Circuit breaker | "Pattern pause" | Action-specific trip on repetition, failure rate, or rate-limit |
| Canary token | "Honeytoken" | Bait the agent has no legitimate reason to touch; access fires an alert |
| Honeypot | "Forensic sandbox" | Redirected traffic / workspace where a quarantined agent is observed |
| EWMA | "Moving average" | Exponentially weighted; adapts to drift (feature + bug) |
| CUSUM | "Cumulative sum" | Detects sustained shift from baseline |
| Hard limit | "Constitutional rule" | Does not adapt; constant regardless of history |
| Constitutional limit | "Always-true rule" | Tied to Lesson 17's constitution; cannot be edited by the agent |

## Pour en savoir plus

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) encadrement de commutateur de commutateur et de circuit-disjoncteur pour les agents autonomes.
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) modèles de gouvernance de la production.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) exigences de détection et de réponse.
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/) redirection des sorties au niveau de la capsule et des modèles de honeypot médico-légale.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) les interdictions codées comme "limites constitutionnelles".
