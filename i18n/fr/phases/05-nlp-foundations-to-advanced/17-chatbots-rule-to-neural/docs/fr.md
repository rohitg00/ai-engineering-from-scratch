# Chatbots  Règles basées sur les neurones aux agents de LLM

> ELIZA répond avec des correspondances de motifs. DialogFlow carte des intentions. GPT répond à partir de poids. Claude exécute des outils et vérifie. Chaque ère a résolu le pire échec de l'autre.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## Le problème

Un utilisateur dit "Je veux changer mon vol". Le système doit comprendre ce qu'il veut, quelles informations manquent, comment l'obtenir et comment terminer l'action.

La conversation est difficile pour un système ML. L'entrée est ouverte. La sortie doit être cohérente sur plusieurs tours. Le système peut avoir besoin d'agir sur le monde (changement de vol, charge d'une carte). Chaque mauvaise étape est visible à l'utilisateur.

Les architectures de chatbot ont fait le tour de quatre paradigmes, chacun introduit parce que le précédent a échoué trop visiblement. Cette leçon les accompagne dans l'ordre.

## Le concept

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### Le demi-siècle écrit, 1950-2001

Le premier paradigme n'a pas duré cinq ans. Il a duré cinquante. Savoir son arc compte parce que chaque système en lui est la même machine  correspond à l'entrée, émet une réponse en conserve, met à jour un petit état  et cinquante ans d'ajout de règles à cette machine n'ont jamais produit le cas général. Ce plafond est pourquoi les paradigmes de deux à quatre existent.

**1950.**Turing échappe à la question de savoir si les machines peuvent penser en proposant un substitut opérationnel: si un interrogateur ne peut pas distinguer la machine d'une personne par télétype, la question philosophique est discutable.

**1956.**Le nom de l'atelier d'été à Dartmouth est "intelligence artificielle" sur la supposition que chaque caractéristique de l'intelligence "peut en principe être décrite si précisément qu'une machine peut être fabriquée pour la simuler".

**1966.**ELIZA envoie le truc de réflexion que vous construisez dans l'étape 1: les règles de décomposition tirent des fragments de l'entrée, les règles de réassemblage les font écho en tant que questions.

**1972.**PARRY, construit à Stanford pour modéliser la paranoïa, ajoute la pièce dont ELIZA manquait: l'état intérieur. Les variables numériques pour la peur, la colère et la méfiance se mettent à jour à chaque tournant et à chaque porte où le script est lancé ensuite, de sorte que les entrées identiques produisent des réponses différentes selon la conversation jusqu'à présent. Dans un test de transcription aveugle, les psychiatres ont distingué PARRY des patients humains au hasard. C'est l'ancêtre direct du conditionnement de personnalité  un système de prompt mis en œuvre en trois floats. La même année, les deux robots se sont pointés vers l'autre sur ARPANET: un script de thérapeute interviewé par une machine d'état paranoïaque, la première conversation bot-to-bot sur un réseau.

**1995.**ALICE étalonne la recette ELIZA avec AIML, un dialecte XML pour les paires de modèles-templates. Environ 40 000 catégories écrites à la main, trois prix Loebner. Il a prouvé la loi d'étalon des systèmes basés sur des règles: plus de règles achètent la couverture, jamais la généralité. Chaque règle est une responsabilité que quelqu'un doit maintenir.

**2001.**SmarterChild met la recette devant 30 millions d'utilisateurs de messagerie instantanée et ajoute des recherches en arrière-plan  météo, actions, horaires de cinéma  enregistrés dans des modèles.

Cinquante ans, un seul mécanisme, une règle croissante compte. Le paradigme a pris fin non pas parce que quelqu'un l'a refusé mais parce que le coût de maintenance des machines d'état écrites à la main augmente linéairement avec la couverture tandis que les attentes des utilisateurs augmentent avec ce qu'ils ont vu la semaine dernière.

```figure
chatbot-lineage
```

**Rule-based (ELIZA, AIML, DialogFlow).**Les modèles écrits à la main correspondent à l'entrée de l'utilisateur et produisent des réponses. Les classifiants d'intention se dirigent vers des flux prédéfinis. Les machines de remplissage de machines à sous recueillent les informations requises. Fonctionne brillant dans le cadre étroit pour lequel elles ont été conçues. Échoue immédiatement en dehors de celui-ci.

**Retrieval-based.**Un système de type FAQ. Encodez chaque paire de (expression, réponse). En temps d'exécution, encodez le message de l'utilisateur et récupérez la réponse stockée la plus proche. Pensez à la caractéristique classique "articles similaires" de Zendesk.

**Neural (seq2seq).**Le décodeur-encodeur est formé sur les journaux de conversation. Génère des réponses à partir de zéro. Fluent mais sujet à des sorties génériques ("je ne sais pas") et à des dérives factuelles.

**LLM agents.**Un modèle de langage enveloppé dans une boucle qui planifie, appelle des outils et vérifie les résultats. Pas un chatbot avec une longue demande. Un boucle d'agent: planifier → appeler outil → observer le résultat → décider de la prochaine étape.

Les quatre paradigmes ne sont pas des remplacements séquentiels. Un chatbot de production 2026 traverse les quatre: une procédure basée sur des règles pour l'authentification et les actions destructives, une récupération pour les FAQ, une génération neurale pour la phrasé naturelle, un agent LLM pour les requêtes ouvertes ambiguës.

## Faites-le

### Étape 1: correspondance des modèles basés sur des règles

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(.*)", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "I don't understand."
```

ELIZA en 20 lignes. La ruse de réflexion ("Je me sens triste" → "Pourquoi vous vous sentez triste") est la démo de psychothérapeute canonique de Weizenbaum 1966.

### Étape 2: Résumé de la demande (FAQ)

Ce morceau illustratif exige`pip install sentence-transformers`Le volant.`code/main.py`pour cette leçon utilise une similitude de Jaccard stdlib à la place, donc la leçon fonctionne sans dépendances externes.

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items, original packaging."),
]


encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
faq_questions = [q for q, _ in FAQ]
faq_embeddings = encoder.encode(faq_questions, normalize_embeddings=True)


def faq_respond(user_input, threshold=0.5):
    q_emb = encoder.encode([user_input], normalize_embeddings=True)[0]
    sims = faq_embeddings @ q_emb
    best = int(np.argmax(sims))
    if sims[best] < threshold:
        return None
    return FAQ[best][1]
```

Le refus basé sur le seuil est le choix de conception clé.`None`et laisser le système s'escalader.

### Étape 3: génération neuronale (ligne de base)

Utilisez un petit encodeur-décodeur ajusté aux instructions (FLAN-T5) ou un modèle de conversation ajusté. Production-inutile par lui-même en 2026 (contradiction, dérive hors sujet, absurdité factuelle), mais naviguent à l'intérieur des systèmes hybrides pour la phrasé naturelle. Les modèles de décodeur à style dialogPT ont besoin de séparateurs de tour explicites et de manœuvres EOS pour produire des réponses cohérentes; un pipeline de texte2text FLAN-T5 fonctionne à l'extérieur de la boîte pour un exemple d'enseignement.

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### Étape 4: boucle d'agent de LLM

La forme de production de 2026:

```python
def agent_loop(user_message, tools, llm, max_steps=5):
    history = [{"role": "user", "content": user_message}]
    for _ in range(max_steps):
        response = llm(history, tools=tools)
        tool_call = response.get("tool_call")
        if tool_call:
            tool_name = tool_call.get("name")
            args = tool_call.get("arguments")
            if not isinstance(tool_name, str) or tool_name not in tools:
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": str(tool_name), "content": f"error: unknown tool {tool_name!r}"})
                continue
            if not isinstance(args, dict):
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": tool_name, "content": f"error: arguments must be a dict, got {type(args).__name__}"})
                continue
            fn = tools[tool_name]
            result = fn(**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

Les outils sont des fonctions appelées que le LLM peut invoquer. La boucle se termine lorsque le LLM renvoie une réponse finale au lieu d'un appel à l'outil. Le budget des étapes empêche des boucles infinies sur des tâches ambiguës.

La production réelle ajoute: la première mise à terre de récupération (injection de documents pertinents avant chaque appel de LLM), les barreaux (réjection d'actions destructives sans confirmation), l'observabilité (enregistrement de chaque étape) et les évaluations (vérification automatique du comportement des agents en fonction des spécifications).

### Étape 5: routage hybride

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)
```

Le modèle: des règles déterministes pour tout ce qui est destructeur, la récupération pour les FAQ en conserve, les agents de LLM pour tout le reste.

## Utilisez-le

La pile de 2026:

| Use case | Architecture |
|---------|---------------|
| Booking, payment, authentication | Rule-based state machines + slot filling |
| Customer support FAQs | Retrieval over curated answers |
| Open-ended help chat | LLM agent with RAG + tool calls |
| Internal tools / IDE assistants | LLM agent with tool calls (search, read, write) |
| Companion / character chatbots | Tuned LLM with persona system prompt, retrieval on knowledge |

Il est important de noter que les méthodes de routage sont généralement utilisées pour les besoins de la production.

## Mode d'échec qui est toujours expédié

- **Confident fabrication.**L'agent de la LLM affirme avoir effectué une action qu'il n'a pas effectuée.
- **Prompt injection.**L'utilisateur insère du texte qui supprime le système de demande. LLM01 classé dans le Top 10 de l'OWASP pour les applications LLM 2025. Deux saveurs: injection directe (collection dans le chat) et injection indirecte (clandestin dans les documents, les e-mails ou les sorties d'outils que l'agent lit).

  Les taux d'attaques varient selon les scénarios. Les taux de réussite mesurés varient entre 0,5-8,5% sur les modèles frontaliers dans les critères de référence généraux d'utilisation des outils et de codage. Les configurations spécifiques à haut risque (attaques adaptatives contre les agents de codage de l'IA, orchestration vulnérable) ont atteint ~84%. Les CVE de production incluent EchoLeak (CVE-2025-32711, CVSS 9.3)  une faille d'exfiltration de données en clics zéro dans Microsoft 365 Copilot déclenchée par un courriel contrôlé par l'attaquant.

  Atténuations: traiter les entrées utilisateur comme non fiables tout au long de la boucle; désinfecter avant les appels à l'outil; isoler les sorties de l'outil de la demande principale; utiliser le modèle Plan-Verifier-Exécuter (PVE) où l'agent planifie d'abord, puis vérifie chaque action contre ce plan avant l'exécution (ce qui empêche les résultats de l'outil d'injecter de nouvelles actions non planifiées); exiger la confirmation de l'utilisateur pour des actions destructives; appliquer le moins de privilèges aux champs d'outil.

  Aucune quantité d'ingénierie rapide n'élimine complètement ce risque.
- **Scope creep.**L'agent se retire de la tâche parce qu'un appel à l'outil a rendu des informations tangentielles liées.
- **Infinite loops.**L'agent appelle toujours le même outil, l'atténuation: budget, dédoublement des appels, juge de la loi sur "on fait des progrès".
- **Context window exhaustion.**Les longues conversations poussent les premiers tours hors contexte.

## La faire partir

- Je ne sais pas .`outputs/skill-chatbot-architect.md`- Le numéro de la liste:

```markdown
---
name: chatbot-architect
description: Design a chatbot stack for a given use case.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Given a product context (user need, compliance constraints, available tools, data volume), output:

1. Architecture. Rule-based, retrieval, neural, LLM agent, or hybrid (specify which paths go where).
2. LLM choice if applicable. Name the model family (Claude, GPT-4, Llama-3.1, Mixtral). Match to tool-use quality and cost.
3. Grounding strategy. RAG sources, retrieval method (see lesson 14), tool contracts.
4. Evaluation plan. Task success rate, tool-call correctness, off-task rate, hallucination rate on held-out dialogs.

Refuse to recommend a pure-LLM agent for any destructive action (payments, account deletion, data modification) without a structured confirmation flow. Refuse to skip the prompt-injection audit if the agent has write access to anything.
```

## Exercices

1. **Easy.**Implémenter la réponse basée sur les règles ci-dessus avec 10 modèles pour un bot de commande de café. Cas de bord de test: double commande, modifications, annulation, intention non claire.
2. **Medium.**Construisez une FAQ hybride + LLM fallback. 50 entrées de FAQ en conserve pour un produit SaaS, LLM fallback avec récupération sur le site des documents. Mesurez le taux de refus et la précision sur 100 questions de support réelles.
3. **Hard.**Implémenter la boucle d'agent ci-dessus avec trois outils (recherche, lecture-utilisateur-données, envoyer-email). Exécuter une évaluation avec 50 scénarios de test, y compris des tentatives d'injection rapide. Rapporte le taux de hors-task, taux de défaillance de tâche, et tout succès d'injection.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Intent | What the user wants | Categorical label (book_flight, reset_password). Routed to a handler. |
| Slot | A piece of info | Parameter the bot needs (date, destination). Slot filling is the sequence of asks. |
| RAG | Retrieval plus generation | Retrieve relevant docs, then ground the LLM's response. |
| Tool call | Function invocation | LLM emits a structured call with name + args. Runtime executes, returns result. |
| Agent loop | Plan, act, verify | Controller that runs LLM calls interleaved with tool calls until task complete. |
| Prompt injection | User attacks prompt | Malicious input that tries to override the system prompt. |

## Pour en savoir plus

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) le document qui a fait de la conversation le point de référence du domaine.
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) le papier original basé sur des règles.
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6)  L'architecture parallèle à l'affection de PARRY, le premier chatbot à l'état.
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239)Le dernier article sur le chatbot neuronal de Google, juste avant que les agents de la LLM ne prennent le relais.
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)Le papier qui a nommé le modèle de boucle d'agent.
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) L'orientation de production de 2024 qui est toujours valable en 2026.
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) le papier d'injection rapide.
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) le classement qui a fait de l'injection rapide la principale préoccupation de sécurité.
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) Des défenses pratiques de la couche d'orchestration, y compris les flux de planification- vérification- exécution et de confirmation par l'utilisateur.
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) le CVE canonique d'exfiltration de données par clic zéro à partir d'injection directe directe.
