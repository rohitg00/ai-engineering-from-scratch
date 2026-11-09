# Conformité  SOC 2, HIPAA, RGPD, PCI-DSS, Loi sur l'IA de l'UE, ISO 42001

> La couverture multi-cadres est une mise de table pour les transactions d'entreprise de 2026. **EU AI Act**: en vigueur depuis le 1er août 2024. La plupart des exigences en matière de risque élevé sont appliquées le 2 août 2026. Amendes allant jusqu'à 15 millions d'euros ou 3% du chiffre d'affaires global pour les obligations liées à des systèmes à risque élevé (art. 99(4)); jusqu'à 35 millions d'euros ou 7% pour les pratiques interdites d'IA (art. 99(3)).**Colorado AI Act**: effective le 30 juin 2026 (retardé à partir de février 2026 par SB25B-004)  évaluations d'impact pour les systèmes à haut risque, droit à un recours contre les décisions de l'IA.**SOC 2 Type II**: exigence de fait de l'IA B2B (type II, pas type I, pour les fintech). **GDPR**: la plus grande amende spécifique à l'IA documentée est de 30,5 M€ contre Clearview AI (DPA néerlandais, septembre 2024); Garante italienne a émis 15 M€ contre OpenAI en décembre 2024 (plus tard annulée en appel en mars 2026).**HIPAA**: les services de santé obligés  ne peuvent pas envoyer PHI à des services d'IA externes sans BAA. **PCI-DSS**: La couverture de la couche d'interaction de l'IA nécessite une configuration + des accords contractuels, pas automatiquement. **ISO 42001**: une norme de gouvernance émergente de l'IA, une demande croissante d'approvisionnement aux côtés de l'ISO 27001. Profil de référence: OpenAI maintient SOC 2 Type 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, PCI-DSS pour les composants de paiement ChatGPT. La cartographie croisée réduit la fatigue de l'audit: contrôle l'accès à la carte à travers l'ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a).

**Type:** Learn
**Languages:** (Python, TypeScript optional: compliance is policy + process, not code)
**Prerequisites:** Phase 17 · 25 (Security), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Enumerer les sept cadres 2026 pertinents pour les produits LLM et correspondre chacun à un segment de clients.
- Citons le calendrier de mise en œuvre de la loi sur l'IA de l'UE (en vigueur en août 2024; mise en œuvre à haut risque en août 2026) et le plafond d'amendes à deux niveaux (€15M / 3% pour les obligations à haut risque, €35M / 7% pour les pratiques interdites).
- Expliquez pourquoi le nettoyage des données personnelles après traitement n'est pas suffisant pour le RGPD et nommez la rédaction en temps réel de la couche d'inférence comme norme défendable.
- Décrire la cartographie des contrôles croisés (par exemple, des cartes de contrôle d'accès à l'ISO 27001 A.5.15-5.18 + RGPD Art. 32 + HIPAA §164.312 ((a)).

## Le problème

L'achat d'un client d'entreprise demande SOC 2 Type II, GDPR, HIPAA BAA, ISO 27001, et " déclaration de conformité à la loi sur l'IA de l'UE. " Votre équipe a SOC 2 Type I. Vous avez six mois de type II et n'avez pas encore commencé les enregistrements de l'article 30 du RGPD.

La couverture multi-cadres n'est pas un problème de LLM  c'est un problème d'entreprise-SaaS, avec des superpositions spécifiques à la LLM. Les équipes d'approvisionnement en 2026 veulent une matrice avec une rangée par cadre et une colonne par contrôle, pas un PDF.

## Le concept

### Les sept cadres

| Framework | Scope | LLM-specific requirement |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS baseline | Process controls audited over 6-12 months |
| HIPAA | US healthcare | BAA required; PHI cannot leave infrastructure without signed agreement |
| GDPR | EU users | Real-time PII redaction; data subject rights; Article 30 records |
| PCI-DSS | Payment data | Configuration + contracts for AI touching payment |
| EU AI Act | Serving EU users | Risk tier classification; high-risk systems: conformity assessment, documentation, logging |
| Colorado AI Act | Serving CO residents | Impact assessments; right to appeal |
| ISO 42001 | AI governance | Emerging; pairs with ISO 27001 |

### L'UE AI Act

- 1er août 2024: en vigueur.
- 2 février 2025: les pratiques interdites en matière d'IA sont appliquées.
- 2 août 2026: mise en œuvre des systèmes à haut risque (évaluation de la conformité, documentation, enregistrement).
- Août 2027: systèmes à haut risque dans les produits en vertu d'une législation harmonisée.

Niveaux de risque: inacceptable (interdit), haut risque (conformité + enregistrement), risque limité (transparence), risque minimal (pas de contrainte). La plupart des B2B LLM SaaS sont à risque limité; des risques élevés sont introduits pour l'emploi, le crédit, l'éducation, l'application de la loi, la migration, les services essentiels.

Amendes (article 99): jusqu'à 15 millions d'euros ou 3% du chiffre d'affaires global annuel pour violation des obligations du système à haut risque (article 99(4); jusqu'à 35 millions d'euros ou 7% pour pratiques interdites d'IA (article 99(3)); selon le montant le plus élevé.

### GDPR  Rédaction en temps réel est la norme

Le nettoyage post-traitement (rédact PII après que le LLM le voit) n'est pas une posture défendable  le modèle a déjà vu les données.

- Reconnaissance de l'entité avant l'appel à la formation de Master.
- La tokenization cohérente (approche Mesh) préserve la sémantique.
- Conservez uniquement les instructions éditées + l'opt-in consenté en cru.

Récente application: 30,5 M€ contre Clearview AI (DPA néerlandais, septembre 2024) est la plus grande amende GDPR spécifique à l'IA documentée à ce jour; 15 M€ contre OpenAI (Garante italienne, décembre 2024) est la plus grande amende spécifique à la LLM, bien qu'elle ait été annulée en appel en mars 2026 et que la décision reste en cours d'examen.

### HIPAA  BAA n' est pas facultatif

Vous ne pouvez pas envoyer de PHI à des services d'IA externes sans un accord d'association commerciale signé. Les trois plateformes de LLM hyperscaler (Bedrock, Azure OpenAI, Vertex) offrent des BAA. OpenAI direct API offre BAA. Antropic direct API offre BAA. Confirmez avant d'envoyer PHI.

### SOC 2 type II

Type I: contrôles conçus et documentés.
Type II: les contrôles fonctionnent efficacement sur 6 à 12 mois.

Les achats B2B en 2026 sont par défaut de type II. Le type I est un démarreur; le type II est la porte.

Les facteurs d'audit communs: les journaux d'accès (qui a vu quoi), la gestion des changements (comment il a été déployé), les évaluations des risques (quartier), la réponse aux incidents (testée)?

### Cartographie des cadres croisés

Une politique de contrôle d'accès satisfait à plusieurs contrôles de cadre:

| Control | Frameworks |
|---------|-----------|
| Access logging | ISO 27001 A.5.15-5.18, GDPR Art. 32, HIPAA §164.312(a) |
| Change management | ISO 27001 A.8.32, PCI DSS Req. 6, HIPAA breach-notification scope |
| Encryption in transit | ISO 27001 A.8.24, GDPR Art. 32, HIPAA §164.312(e) |
| Secrets management | ISO 27001 A.8.19, PCI DSS Req. 8, SOC 2 CC6.1 |

Les outils de conformité (Drata, Vanta, Secureframe) automatisent cette cartographie.

### ISO 42001  émergents

Publié fin 2023. Exigence croissante d'approvisionnement aux côtés de l'ISO 27001. Cadre de gouvernance de l'IA, y compris la gestion des risques, la qualité des données, la transparence, la surveillance humaine.

### Le profil de référence d'OpenAI

OpenAI maintient SOC 2 Type 2, ISO/IEC 27001:2022, ISO/IEC 27701:2019, GDPR/CCPA/HIPAA (BAA) / FERPA, PCI-DSS pour les composants de paiement ChatGPT. Cela représente environ la table des entreprises en 2026.

### Les chiffres que vous devriez vous rappeler

- Amendes de l'UE en matière d'IA: jusqu'à 15 millions d'euros / 3% (obligations à haut risque, article 99(4)); jusqu'à 35 millions d'euros / 7% (pratiques interdites, article 99(3)).
- L'application de la loi sur l'IA de l'UE à haut risque: 2 août 2026.
- La plus grande amende GDPR spécifique à l'IA documentée: 30,5 M€, Clearview AI (DPA néerlandais, septembre 2024).
- La plus grande amende du RGPD spécifique au LLM: 15 millions d'euros, OpenAI (Garante italienne, décembre 2024; annulée en appel en mars 2026).
- Ventile SOC 2 de type II: 6 à 12 mois de contrôle opérationnel.
- Date d'entrée en vigueur de la Loi sur l'IA du Colorado: 30 juin 2026 (retardée à partir de février 2026 par SB25B-004).

```figure
i4-control-matrix
```

## Utilisez-le

`code/main.py`est une feuille de calcul de conformité en Python  étant donné un contrôle, il énumère les cadres qu'il satisfait.

## La faire partir

Cette leçon produit `outputs/skill-compliance-matrix.md`- compte tenu du segment client et de la géographie, spécifie les cadres et les contrôles requis.

## Exercices

1. Votre premier client d'entreprise a besoin de SOC 2 Type II, HIPAA BAA, déclaration de l'UE AI Act. Quelle est la position minimale de conformité viable pour gagner l'accord?
2. Classifier trois produits hypothétiques de MLL selon les niveaux de risque de la Loi sur l'IA de l'UE.
3. Vous avez accidentellement envoyé le PHI à un fournisseur sans BAA.
4. Débattre de la nécessité d'une ISO 42001 en 2026 pour un fournisseur d'IA de marché moyen.
5. Mapez vos champs de journaux d'audit du LLM (phase 17 · 25) à au moins trois contrôles-cadres.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SOC 2 Type II | "audited controls" | Controls operating over 6-12 months, independently attested |
| HIPAA BAA | "healthcare contract" | Business Associate Agreement; required for PHI |
| GDPR | "EU privacy" | Real-time PII redaction is the defensible 2026 standard |
| EU AI Act | "EU AI rules" | High-risk enforcement August 2026; €15M / 3% (high-risk obligations) — €35M / 7% (prohibited practices) |
| Colorado AI Act | "US AI state law" | June 30, 2026 effective (delayed by SB25B-004); impact assessments |
| ISO 42001 | "AI governance" | Emerging framework for AI risk + transparency |
| ISO 27001 | "security ISMS" | Information Security Management System baseline |
| Conformity assessment | "EU AI doc package" | High-risk requirement: docs, testing, logging |
| Cross-framework mapping | "one control, many frames" | Single policy satisfies multiple framework controls |

## Pour en savoir plus

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) profil de référence de conformité.
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) source principale.
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) source principale.
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) La norme du système de gestion de l'IA.
