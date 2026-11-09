# Le caching rapide et le caching du contexte

> Votre système de mise en cache est de 4000 jetons. Votre contexte RAG est de 20.000 jetons. Vous envoyez les deux avec chaque demande. Vous payez également pour les deux  à chaque fois. Le caching rapide permet au fournisseur de garder ce préfixe chaud de son côté et vous facture 10% du taux normal sur la réutilisation.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## Le problème

Un agent de codage envoie le même message de 15 000 jetons à Claude à chaque tour de conversation.$3/M input tokens is $0,90 en entrée coût seul  avant l'un des messages réels de l'utilisateur. Multipliez par 10 000 conversations quotidiennes et la facture atteint 9 000 $ / jour pour le texte qui ne change jamais.

Vous ne pouvez pas réduire le prompt sans nuire à la qualité. Vous ne pouvez pas éviter de l'envoyer  le modèle a besoin de lui à chaque tournant. La seule étape est d'arrêter de payer le prix complet pour un préfixe que le fournisseur a déjà vu.

Cette décision est la mise en cache rapide. Anthropic l'a expédié en août 2024 (avec une variante TTL prolongée de 1 heure en 2025), OpenAI l'a automatisé plus tard cette année-là, Google a expédié la mise en cache explicite de contexte aux côtés de Gemini 1.5, et les trois l'offrent maintenant comme une fonctionnalité de première classe sur leurs modèles frontaliers.

## Le concept

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.**Lorsque le préfixe d'une demande correspond à celui d'une demande récente, le fournisseur sert le cache KV de la mise en œuvre précédente au lieu de recoder les jetons. Vous payez une petite prime d'écriture la première fois et une grande réduction de lecture chaque fois après.

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.**Si un jeton diffère entre les requêtes, tout après le premier jeton diffère est une erreur.

### L' aménagement convivial au cache

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

Violez l'ordre  mettez le message de l'utilisateur au-dessus de la demande du système, interrompez les récupérations dynamiques entre quelques prises de vue  et le cache ne frappe jamais.

### Le calcul de l'équilibre

La prime d'écriture de 25% d'Anthropic (5 minutes TTL) se paie à la première lecture, car une lecture cache coûte 0,1 fois. 1 écrit + 1 lecture moyenne 0,675x coût par demande (économiser 32%); 1 écrit + 10 lecture moyenne 0,205x (économiser 80%). Le TTL d'une heure facture 2 fois pour l'écriture, donc ce bloc a besoin de deux lectures pour sortir en avant. Règle générale: cache tout ce que vous attendez de réutiliser au moins 3 fois dans le TTL; cela élimine les pannes sur l'un ou l'autre TTL.

```figure
prompt-cache-hit
```

## Faites-le

### Étape 1: Cachage des demandes anthropographiques avec des marqueurs explicites

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM = [
    {
        "type": "text",
        "text": "You are a senior Python reviewer. Follow the rubric exactly.\n\n" + RUBRIC_15K_TOKENS,
        "cache_control": {"type": "ephemeral"},
    }
]

def review(code: str):
    return client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": code}],
    )
```

Le `cache_control`Le marqueur indique à Anthropic de stocker le bloc pendant 5 minutes.

**Response usage fields:**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # paid at 1.25x
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # paid at 0.1x
```

Vérifiez les deux champs dans l' IC  si `cache_read_input_tokens`reste à zéro sur les demandes, vos clés de cache sont à la dérive.

### Étape 2: TTL prolongé d'une heure

Pour les travaux de longue durée, le délai de 5 minutes expire entre les travaux.`ttl`- Le numéro de la liste:

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

Le TTL d'une heure coûte deux fois la prime d'écriture (50% par rapport à la valeur de base au lieu de 25%) mais rembourse rapidement sur tout lot réutilisant le préfixe plus de 5 fois.

### Étape 3: Mise en cache automatique d'OpenAI

OpenAI ne vous donne rien à configurer. Tout préfixe de plus de 1.024 jetons qui correspond à une demande récente obtient automatiquement une réduction de 50%.

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # long and stable
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # the discounted portion
```

La même règle de mise en page de cache est applicable.`user`champ (utilisé comme composant de clé cache) et outils de réorganisation.

### Étape 4: Cachage explicite du contexte de Gémeaux

Gemini traite le cache comme un objet de première classe que vous créez et nommez:

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3.8-flash",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=["Review this code:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

Gemini charge le stockage par token·heure aussi longtemps que le cache dure et lit à ~25% du taux d'entrée normal. C'est la bonne forme lorsque vous réutilisez le même prompt géant sur plusieurs sessions sur plusieurs jours.

### Étape 5: Mesurer le taux de production

Regardez !`code/main.py`Pour un comptable simulé de trois fournisseurs qui suit le calcul de l'écriture/lecture/mal et calcule le coût mixte par 1K de demandes.

## Des pièges qui vont encore arriver en 2026

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"`chaque requête est ratée. déplacer les timestamps en dessous du point de rupture du cache.
- **Tool reordering.**La sérialisation des outils dans un ordre stable  un réarrangement dicté entre les déploiements casse chaque coup.
- **Free-text near-duplicates.**"Vous êtes utile". vs "Vous êtes un assistant utile".  une différence de 1 octet = total.
- **Too-small blocks.**Anthropic impose un plancher de 1.024 jetons (2 048 pour Haiku).
- **Blind cost dashboards.**Divisez les "tokens d'entrée" en caché et non caché. Sinon, une baisse de trafic ressemble à une victoire caché.

## Utilisez-le

La pile de mise en cache de 2026:

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

Combiner avec le caching sémantique (phase 11 · 11) pour la couche de message utilisateur: manches de caching prompt *reutilisation identique aux jetons*, manches de caching sémantique *reutilisation identique aux significations*.

## La faire partir

- Ça va .`outputs/skill-prompt-caching-planner.md`- Le numéro de la liste:

```markdown
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

Given a prompt (system + tools + few-shot + retrieval + history + user) and a usage profile (requests per hour, TTL needed, provider), output:

1. Layout. Reordered sections with a single cache breakpoint marked; explain which sections are stable, which are volatile.
2. Provider mode. Anthropic cache_control, OpenAI automatic, or Gemini CachedContent. Justify from TTL and reuse pattern.
3. Break-even. Expected reads per write within TTL; net cost vs no-cache with math.
4. Verification plan. CI assertion that cache_read_input_tokens > 0 on the second identical request; dashboard split by cached vs uncached tokens.
5. Failure modes. List the three most likely reasons the cache will miss in this setup (dynamic timestamp, tool reorder, near-duplicate text) and how you will prevent each.

Refuse to ship a cache plan that places a dynamic field above the breakpoint. Refuse to enable 1h TTL without a reuse count that makes the 2x write premium pay back.
```

## Exercices

1. **Easy.**Faites une conversation de 10 tours avec un système de 5000 jetons contre Claude.`cache_control`Rapporte le projet de loi de jeton d'entrée pour chacun.
2. **Medium.**Écrivez un harnais de test qui, compte tenu d'un modèle prompt et d'un journal de demande, calcule le taux de réussite et les économies en dollars attendus par fournisseur (Anthropic 5m, Anthropic 1h, OpenAI automatique, Gemini explicite).
3. **Hard.**Construire un optimisateur de mise en page: une demande et une liste de champs marqués `stable=True/False`, réécrire la demande pour mettre un seul point de rupture de cache à la position maximale de cache-friendly sans perdre des informations.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Prompt caching | "Makes long prompts cheap" | Reusing a provider-side KV-cache for matching prefixes; 50-90% discount on repeated input tokens. |
| `cache_control` | "The Anthropic marker" | Content-block attribute that declares "everything up to here is cacheable"; `{"type": "ephemeral"}`. |
| Cache write | "Paying the premium" | The first request that populates the cache; billed at ~1.25x input rate on Anthropic, free on OpenAI. |
| Cache read | "The discount" | Subsequent requests matching the prefix; billed at 10% (Anthropic), 50% (OpenAI), ~25% (Gemini). |
| TTL | "How long it lives" | Seconds the cache stays warm; Anthropic 5m default (extendable 1h), OpenAI best-effort up to 1h, Gemini user-set. |
| Extended TTL | "1-hour Anthropic cache" | `{"type": "ephemeral", "ttl": "1h"}`; 2x write premium but worth it for batch reuse. |
| Prefix match | "Why my cache missed" | Caches only hit when every token from the start up to the breakpoint is byte-identical. |
| Context caching (Gemini) | "The explicit one" | Google's named, storage-billed cache object; best for multi-day reuse of large corpora. |

## Pour en savoir plus

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) `cache_control`Une heure TTL, des tables de réparation.
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) correspondance automatique des préfixes.
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) `CachedContent`API et prix de stockage.
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) poste de lancement original avec numéros de latence.
- Phase 11 · 05 (ingénierie du contexte)  où couper le prompt pour que le cache puisse atterrir.
- Phase 11 · 11 (Cachage et coût)  couples de mise en cache avec un cache sémantique sur les messages utilisateurs.
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) le modèle de mémoire KV-cache qui invite à la mise en cache expose aux utilisateurs; explique pourquoi un préfixe en cache est ~ 10 fois moins cher à relire que à recomputer.
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) préfill est le raccourci de mise en cache de phase rapide; ce document explique pourquoi le TTFT diminue considérablement sur le cache frappé alors que le TPOT n'est pas affecté.
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) le caching rapide se trouve aux côtés du décoding spéculatif, de l'attention flash et de la MQA/GQA comme leviers qui plient la courbe des coûts d'inférence; lisez ceci pour les trois autres.
