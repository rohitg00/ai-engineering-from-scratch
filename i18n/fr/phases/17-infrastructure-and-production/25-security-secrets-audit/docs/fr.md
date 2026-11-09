# Sécurité  Secrets, rotation des clés API, journaux d'audit, garde-rails

> Éliminer la diffusion secrète via des coffres-forts centralisés (coffre-fort HashiCorp, gestionnaire de secrets AWS, coffre-fort Azure). Ne stockez jamais les informations dans les fichiers de configuration, env fichiers dans VCS, feuilles de calcul. Utiliser des rôles IAM au lieu de clés statiques; OIDC pour CI/CD. Le modèle d'IA-gateway est la solution 2026: applications → gateway → fournisseur de modèle, avec gateway tirant des informations d'identification de la caisse en temps d'exécution. Retournez dans la caisse et toutes les applications se dérouleront en quelques minutes  pas de redéploiements, pas de Slack "qui a la nouvelle clé" messages. Politique de rotation ≤ 90 jours; analyse avec TruffleHog / GitGuardian / Gitleaks à chaque commande. La confiance nulle: MFA, SSO, RBAC/ABAC, jetons de courte durée, posture du dispositif. Le scrubbing des PII utilise la reconnaissance d'entités pour masquer les PHI/PII avant de les transférer; la tokenization cohérente (approche Mesh) trace les valeurs sensibles aux titulaires de places stables afin que le LLM préserve la sémantique du code/relation. Exit du réseau: services de LLM dans des sous-réseaux VPC/VNet dédiés uniquement en liste blanche `api.openai.com`- Je suis là .`api.anthropic.com`Le pilote d'incident 2026: l'attaque de la chaîne d'approvisionnement Vercel via des informations de base CI/CD compromises a filtré l'environnement sur des milliers de déploiements de clients.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy PII-scrubber + audit-log writer)
**Prerequisites:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Enumérez les quatre modèles anti-gestion secrète (fichiers de configuration dans VCS, env hardcodé, feuilles de calcul, clés statiques) et nommez leurs remplacements.
- Expliquez le modèle d'IA-gateway-pulls-from-vault comme norme de production de 2026.
- Implémenter un dépistage des PII avec une tokénisation cohérente (même valeur → même placeholder) afin que la sémantique survienne.
- Nombre de l'incident de 2026 de la chaîne d'approvisionnement Vercel et ce qu'il a enseigné sur l'hygiène des certificats CI/CD.

## Le problème

Un stagiaire s' engage `.env`Les clés sont déjà dans l'historique de git  GitGuardian scan le capture, votre processus de rotation est "Réfraîchir l'équipe, mettre à jour 40 fichiers de configuration, redéployer tous les services". 8 heures plus tard, la moitié de vos services sont en direct et la moitié attendent le déploiement des fenêtres.

Les instructions de l'utilisateur incluent "Mon SSN est 123-45-6789. " L'adresse est OpenAI. Vous avez un BAA mais votre politique interne est de masquer les informations personnelles avant de les envoyer.

Par ailleurs, le module de votre groupe EKS peut atteindre n'importe quel hôte Internet, quelqu'un exfilte les données via DNS à un domaine contrôlé par l'attaquant.

La sécurité des services de LLM doit traiter les trois vecteurs et le prouver par la suite.

## Le concept

### Voûte centralisée + tirage du rôle IAM

**Vault**HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager. Une source de vérité.

**IAM role**: app/gateway authentifie par son identité IAM, pas une clé statique. Vault renvoie le secret pour la durée de vie du jeton.

**The AI-gateway pattern**: porte de sortie `OPENAI_API_KEY`Retournez dans la chambre à sous, la prochaine demande obtient la nouvelle clé.

### Politique de rotation ≤ 90 jours

Toutes les clés API, les jetons racines de la caisse, les informations d'identification CI/CD, la rotation automatique lorsque cela est possible, la rotation manuelle enregistrée et suivie.

### Scanner secret

- **TruffleHog** régex + entropie sur les commits.
- **GitGuardian** commercial, haute précision.
- **Gitleaks** OSS, fonctionne dans l'IC.

Arrêtez les relations si un nouveau secret est détecté.

### Poise de confiance zéro

- Les FAM sont exigés sur tous les comptes.
- SSO par SAML/OIDC.
- RBAC (basé sur le rôle) ou ABAC (basé sur les attributs) pour l'accès aux grains fins.
- Les jetons de courte durée (heures, pas jours).
- Position de l'appareil  seulement les appareils corporels avec cryptage disque.

### PII / PHI de détergition

Avant que le message ne quitte votre infra:

1. Le système de reconnaissance d'entités (spaCy NER, Presidio, commercial).
2. Masque d' entités correspondantes: `"My SSN is 123-45-6789"`- Je suis là.`"My SSN is [SSN_TOKEN_A3F]"`- Je suis désolé .
3. Tokenization cohérente (approche Mesh): cartes de la même valeur pour le même titulaire de place afin que le LLM préserve les relations.
4. Le suivi des résultats de la recherche est un processus de révision des résultats de la recherche.

Les filtres de régex statiques capturent les schémas de base, le NER en capture plus.

### Gardiens d'entrée + sortie

Entrée: blocage des jailbreaks connus, des sujets interdits; limite de tarifs par utilisateur.

Résultats: scrub de régex pour les secrets divulgués (modèles de clés API, modèles de courrier électronique dans les contextes de refus), classifiant pour les violations de politiques.

### Liste blanche des sorties de réseau

Services de MLL dans un sous-réseau dédié:
- Liste blanche: `api.openai.com`- Je suis là .`api.anthropic.com`, points d'extrémité de vecteur DB, points d'extrémité de voûte.
- Tout le reste: déposez.
- DNS via résolveur réservé aux autorisations (éviter d'exfil d'exfil d'exfil d'exfil de DNS).

### Registre d'audit

Logique immutable de chaque appel de LLM avec:
- Une timestamp.
- Utilisateur / locataire.
- Hash rapide (pas demande brute pour la confidentialité).
- Modèle + version.
- Les jetons comptent.
- Le coût.
- Le hash de réponse.
- Toutes les sorties de garde.

Réservation selon les exigences réglementaires (SOC 2 1 an, HIPAA 6 ans).

### L'incident de Vercel de 2026

Attaque de la chaîne d'approvisionnement: les informations d'identification de l'interface informatique/CD compromises sont filtrées dans l'environnement dans des milliers de déploiements de clients.

### Les chiffres que vous devriez vous rappeler

- Politique de rotation: ≤ 90 jours.
- Scan sur chaque commande: TruffleHog / GitGuardian / Gitleaks.
- Vercel 2026: Crédits d'informations et de données personnelles compromis → Des milliers d'environnements de clients ont été divulgués.
- Rétention du journal d'audit: SOC 2 = 1 an, HIPAA = 6 ans.

```figure
i4-vault-rotation
```

## Utilisez-le

`code/main.py`met en œuvre un dépistage des DII de jouets avec une tokenization cohérente et un journal d'audit uniquement annexe.

## La faire partir

Cette leçon produit `outputs/skill-llm-security-plan.md`- Compte tenu de la portée réglementaire et de l'état actuel, les plans de migration de la caisse, de scrubber, de sortie, de vérification.

## Exercices

1. On court .`code/main.py`Envoyez deux messages faisant référence au même SSN. Confirmez que les deux obtiennent le même placeholder.
2. Conceptualiser la politique d'exode du réseau pour un déploiement vLLM-on-EKS appelant OpenAI + Anthropic + Weaviate.
3. Vous découvrez une clé dans l'historique de la git (deux ans). Quelle est la bonne réponse  tourner la clé, scrub l'historique, ou les deux? justifier.
4. Votre journal d'audit augmente de 10 Go par jour.
5. Débattez si la reverse-tokenization (remplacement des valeurs réelles dans la réponse LLM) vaut la complexité par rapport à garder les titulaires de place visibles.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Vault | "secrets store" | Centralized credential management service |
| IAM role | "identity-based auth" | Role assumed by app; returns short-lived creds |
| OIDC for CI/CD | "cloud-issued tokens" | No static keys in CI — identity via OIDC |
| TruffleHog / GitGuardian / Gitleaks | "secret scanners" | Commit-time secret detection |
| RBAC / ABAC | "access control" | Role-based vs attribute-based |
| PII scrubbing | "data masking" | Remove or tokenize sensitive entities |
| Consistent tokenization | "stable placeholders" | Same value → same token each time |
| Mesh approach | "Mesh tokenization" | Semantic-preserving tokenization pattern |
| Egress whitelist | "outbound allowlist" | Only permitted domains reachable |
| Audit log | "immutable history" | Append-only record for compliance |

## Pour en savoir plus

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) Détection et anonymisation des informations personnelles.
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
