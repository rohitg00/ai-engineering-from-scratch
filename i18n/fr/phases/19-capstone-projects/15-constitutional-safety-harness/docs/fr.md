# Capstone 15  Harness de sécurité constitutionnelle + Range Red-Team

> Les classifiants constitutionnels d'Anthropic, Meta's Llama Guard 4, Google's ShieldGemma-2, NVIDIA's Nemotron 3 Content Safety et X-Guard pour la couverture multilingue ont défini la pile de classifiants de sécurité de 2026. Garak, PyRIT, NVIDIA Aegis et promptfoo sont devenus les outils d'évaluation des adversaires standard. NeMo Guardrails v0.12 les lie à un pipeline de production. Ce capstone le regroupe: un harnais de sécurité en couches autour d'une application cible, un agent autonome de l'équipe rouge qui gère plus de 6 familles d'attaque, et une course constitutionnelle d'autocritique qui produit un delta d'innocuité mesurable.

**Type:** Capstone
**Languages:** Python (safety pipeline, red team), TypeScript, YAML (policy configs)
**Prerequisites:** Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 18 (ethics, safety, alignment)
**Phases exercised:**P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## Problème

La frontière de la sécurité de la LLM en 2026 n'est pas de savoir si les classifiateurs fonctionnent (ils le font, approximativement) mais de savoir comment les composer correctement autour d'une application de production sans refuser trop ou laisser de trous évidents. La Garde Lama 4 traite des violations de la politique anglaise. X-Guard (132 langues) gère le jailbreak multilingue. ShieldGemma-2 capture une injection rapide basée sur une image. NVIDIA Nemotron 3 La sécurité des contenus couvre les catégories d'entreprises. Les classifiateurs constitutionnels d'Anthropic sont une approche distincte utilisée pendant la formation plutôt que dans le service.

L'évolution des attaques est également importante. PAIR et TAP automatisent la découverte de jailbreak. GCG exécute des attaques de suffixe basées sur des gradients. Les attaques multi-turn et code-switch exploitent la mémoire de l'agent. Tout LLM déployé a besoin d'une gamme de red-team  garak et PyRIT sont les pilotes canoniques  plus des atténuations documentées et des résultats marqués par CVSS.

Vous durcirez une application cible (soit un modèle 8B ajusté aux instructions ou un des chatbots RAG d'autres capstones), vous lancerez 6 familles d'attaque contre elle et produirez une mesure d'innocuité avant/après.

## Concept

Le pipeline de sécurité est de cinq couches. **Input sanitize**: déchiffrer les caractères à largeur zéro, décoder base64/rot13, normaliser Unicode. **Policy layer**: NeMo Guardrails v0.12 rail (extérieur du domaine, toxicité, extraction d'III). **Classifier gate**: Llama Guard 4 sur les entrées, X-Guard sur les entrées non anglaises, ShieldGemma-2 sur les entrées d'image. **Model**: le MLL cible. **Output filter**: Llama Guard 4 sur la sortie, Presidio PII scrub, exécution de la citation le cas échéant. **HITL tier**: les sorties marquées par un risque élevé vont à une file d'attente Slack.

La gamme de l'équipe rouge fonctionne sur un planificateur. PAIR et TAP détectent de manière autonome les jailbreaks. GCG exécute des attaques de suffixe basées sur le gradient. ASCII / base64 / rot13 encodant des attaques. Attaques multi-tours (adoption de personnalité, exploitation de mémoire). Attaques de commutateur de code (mixte anglais avec swahili ou thaï). Chaque course produit un fichier de résultats structuré avec CVSS score et dévoiler la chronologie.

La course constitutionnelle-autocritique est une intervention de formation. Prenez 1k de tentatives de maltraitance, faites rédiger un modèle de réponse, critiquez-le contre une constitution écrite (règles de ne pas faire de mal), et reprenez la formation sur la boucle de critique. Mesurez le delta avant/après de l'innocuité sur une évaluation prolongée.

## Architecture

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## La pile

- Les catégories de sécurité: Llama Guard 4, ShieldGemma-2, NVIDIA Nemotron 3 Sécurité du contenu, X-Guard
- Cadre de garde: NeMo Guardrails v0.12 + OPA
- Les pilotes de l'équipe rouge: garak (NVIDIA), PyRIT (Microsoft Azure), NVIDIA Aegis, promptfoo
- Les agents de jailbreak: PAIR (Chao et coll., 2023), Tree-of-Attacks (TAP), suffixe GCG
- Formation constitutionnelle: boucle d'autocritique à l'anthropique + SFT sur les critiques
- Le président de la République
- Cible: un modèle 8B ajusté aux instructions ou un des autres chatbots RAG des capstones

```figure
cf-safety-stack
```

## Faites-le

1. **Target setup.**Installez un modèle 8B réglé par les instructions sur vLLM (ou réutilisez un chatbot RAG d'un autre capstone).

2. **Safety pipeline wrap.**Veuillez brancher le pipeline à cinq couches autour de la cible.

3. **Classifier coverage.**Charger Llama Guard 4, X-Guard (multilingue), ShieldGemma-2 (image). Chacun est chargé sur un petit ensemble étiqueté pour établir les lignes de base.

4. **Red-team scheduler.**Garak, PyRIT, un agent PAIR, un agent TAP, un coureur GCG, un attaquant multi-tours et un attaquant de code-switch.

5. **Attack suite.**Six familles d'attaques: (1) jailbreak automatique PAIR, (2) TAP tree-of-attacks, (3) suffixe de gradient GCG, (4) codage ASCII / base64 / rot13, (5) personnalité multi-tourne, (6) commutateur de code multilingue.

6. **Constitutional self-critique.**Cure 1k tentatives de destruction. Pour chacune, la cible rédige une réponse. Un critique LLM marque contre une constitution écrite ("ne faire aucun mal", "citer des preuves, "rejeter des demandes illégales").

7. **Over-refusal measurement.**Suivre le taux de faux positifs sur une suite de requêtes bénignes (par exemple, XSTest).

8. **CVSS scoring.**Pour chaque jailbreak réussi, marquez CVSS 4.0 (vecteur d'attaque, complexité, impact).

9. **Range automation.**Tout ce qui précède est exécuté sur un cron; les résultats sont écrits dans une file d'attente; la régression de refus excessif alerte le feu à Slack.

## Utilisez-le

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## La faire partir

`outputs/skill-safety-harness.md`est le produit livrable. un pipeline de sécurité en couches de qualité de production plus une gamme de rouges reproductible avec des delta avant et après inoffensivité.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families exercised, 2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate vs XSTest benign pass rate |
| 20 | Self-critique delta | Before/after harmlessness on held-out eval |
| 20 | Documentation and disclosure | CVSS-scored findings with timeline |
| 15 | Automation and repeatability | Everything runs on cron with alerts |
| **100** | | |

## Exercices

1. Exécutez le plugin de garak pour l'injection rapide sur un chatbot RAG et comparez le taux de réussite de l'attaque avec et sans la couche de filtrage de sortie.

2. Ajouter une septième famille d'attaques: injection directe indirecte par le biais de documents récupérés. Mesurer la défense supplémentaire requise.

3. Mettre en œuvre un mode "refuser avec aide": lorsque la barrière de protection est bloquée, la cible offre une réponse connexe plus sûre au lieu d'un refus plat.

4. La différence de couverture multilingue: trouver une langue où X-Guard est moins performant.

5. Exécutez l'autocritique constitutionnelle sur un modèle 30B et mesurez si le delta est en échelle.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Layered safety | "Defense in depth" | Multiple guardrails at input, gate, output, HITL |
| Llama Guard 4 | "Meta's safety classifier" | The 2026 reference input/output content classifier |
| PAIR | "Jailbreak agent" | Paper (Chao et al.) on LLM-driven jailbreak discovery |
| TAP | "Tree-of-Attacks" | Tree-search variant of PAIR |
| GCG | "Greedy coordinate gradient" | Gradient-based adversarial suffix attack |
| Constitutional self-critique | "Anthropic-style training" | Target drafts -> critic scores -> rewrite -> retrain |
| XSTest | "Benign probe set" | Benchmark for over-refusal regression |
| CVSS 4.0 | "Severity score" | Standard vulnerability scoring for safety findings |

## Pour en savoir plus

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) référence à l'heure de formation
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) le classifiateur entrée/sortie 2026
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) sécurité d'image + sécurité multimodal
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) référence d'entreprise
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) Sécurité multilingue en 132 langues
- [garak](https://github.com/NVIDIA/garak) Kit d'outils de l'équipe rouge NVIDIA
- [PyRIT](https://github.com/Azure/PyRIT) Microsoft red-team framework
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) Cadre ferroviaire
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) papier d' agent de jailbreak
