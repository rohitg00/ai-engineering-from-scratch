# Modèle de protocole de contexte (MCP)

> MCP donne à un hôte d'IA un protocole pour découvrir et invoquer des outils, des ressources et des invites. La révision 2026-07-28 rend ce protocole stéréotique: la capacité et le contexte de version voyagent avec chaque demande, pas dans une poignée de main liée à la connexion.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Distinguer un hôte, client, serveur, transport et serveur primitif de MCP.
- Construire une demande JSON-RPC avec les métadonnées requises par MCP 2026-07-28.
- Utilisation `server/discover`pour inspecter les versions, l'identité et les capacités.
- Retournez les résultats typés et conscients du cache à partir d'outils, de ressources et de demandes.
- Expliquez comment le MCP sans État moderne interagit avec les serveurs de l'ère des poignées de main.
- Choisissez l'état sécurisé, le transport et les limites d'approbation pour un serveur.

## Le problème

Votre application a besoin d'une requête de base de données, d'une opération de calendrier et d'un lecteur de fichiers. Sans un protocole partagé, chaque hôte d'IA a besoin de découverte personnalisée, d'invocation, d'erreurs, de transport et de colle d'autorisation pour ces mêmes capacités.

Le MCP réduit cette matrice d'intégration. Un serveur publie une surface JSON-RPC standard. Un client conforme peut découvrir la surface, la présenter à un modèle ou à un utilisateur, l'invoquer et interpréter le résultat sans adaptateur spécifique au serveur.

Le MCP standardise la communication. Il ne décide pas à quel outil le modèle doit appeler, rendre le contenu non fiable sûr ou transformer une demande sans statut en un état d'application durable. Votre hôte et votre serveur possèdent toujours ces décisions.

## Le concept

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### Les trois serveurs primitifs

1. **Tools**Chaque outil a un nom, une description, une entrée de schéma JSON et un gestionnaire.
2. **Resources**sont nommés, contenu adressé à l'URI qu'un client peut lire.
3. **Prompts**sont des modèles réutilisables qu'un hôte peut exposer à un utilisateur.

L'hôte est l'application d'IA. Un client MCP à l'intérieur de cet hôte parle à un serveur. Le transport transporte des messages JSON-RPC entre eux.

### Les demandes de statuts remplacent la poignée de main

Le MCP 2026-07-28 est retiré `initialize`et `notifications/initialized`Il supprime également les sessions au niveau du protocole.`params._meta`- Le numéro de la liste:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

La version du protocole et les capacités du client sont nécessaires.`_meta`, un champ requis manquant ou un champ requis avec le type incorrect est malformé et renvoie des paramètres invalides (`-32602`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             `UnsupportedProtocolVersionError`(le secteur de l'énergie)`-32022`Un serveur peut traiter une demande valide sans récupérer un dossier de négociation antérieur.

L'état de l'application n'est pas maintenu par un programme de connexion, mais il est possible de le faire en fonction de la connexion de l'application.`Mcp-Session-Id`Si un flux de travail a besoin de continuité, le serveur met une poignée opaque et le client passe cette poignée comme argument d'outil ordinaire lors d'appels ultérieurs.

### Découverte et sélection de version

Chaque serveur moderne implémentera `server/discover`. Le résultat annonce les versions, les capacités et l'identité du serveur pris en charge:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

Un client peut appeler une autre méthode directement et gérer une erreur de version, mais la découverte rend explicite l'affichage des capacités et la sélection de version. Une version non prise en charge retourne `UnsupportedProtocolVersionError`avec code `-32022`Les données de ce rapport contiennent:`supported`, une série de révisions de serveur, et `requested`, la révision rejetée.

En studio, un client de double époque sonde avec`server/discover`Un résultat de découverte ou une erreur moderne reconnue comme`UnsupportedProtocolVersionError`Toute erreur ou délai qui n'est pas reconnu comme moderne permet de revenir à 2025-11-25`initialize`Le comportement hérité est le code de compatibilité, pas le code par défaut moderne.

### Les résultats sont explicites

Chaque résultat de base 2026-07-28 a`resultType`- Le numéro de la liste:

- `complete`signifie que l'opération est terminée.
- `input_required`signifie que le serveur a besoin d'un autre voyage aller-retour à travers le modèle de demandes de plusieurs voyages aller-retour.`tools/call`- Je suis là .`resources/read`ou `prompts/get`- Je suis désolé .

Les clients doivent traiter un résultat hérité qui omet `resultType`comme complète.

Les serveurs doivent inclure `io.modelcontextprotocol/serverInfo`dans chaque résultat `_meta`Cette identité est auto-déclarée et est destinée à l'affichage, à l'enregistrement et au débogage, et non à des décisions de sécurité.

Liste et résultats de lecture aussi porter `ttlMs`et `cacheScope`- Une déterministe .`tools/list`ordre plus un indice de fraîcheur permet aux clients de mettre en cache la découverte en toute sécurité et améliore la stabilité du cache rapide. `cacheScope: public`autorise la mise en cache partagée; `private`Il est possible de les réutiliser dans le contexte de l'appel.

### Le format du fil et le transport

MCP utilise JSON-RPC 2.0 sur stdio ou HTTP par flux.

- Une demande a été faite `jsonrpc`- Je suis là .`id`- Je suis là .`method`, et `params`- Je suis désolé .
- Une réponse a la correspondance `id`et soit `result`ou `error`- Je suis désolé .
- Une notification n' a pas été faite `id`et ne s'attend à aucune réponse.

Une requête POST reçoit soit un objet JSON, soit un flux d'événements Server-Sent qui se termine avec la réponse finale. Une notification acceptée POST reçoit HTTP 202 sans corps de réponse; cette révision de base ne définit aucune notification client-serveur sur Streamable HTTP.

Il n'y a pas de flux GET de MCP indépendant, de point d'extrémité de session DELETE, `Mcp-Session-Id`ou `Last-Event-ID`Les notifications de changement de longue durée utilisent une`subscriptions/listen`POST dont la réponse reste ouverte comme un flux SSE.

### Entrée du client sans requêtes initiées par le serveur

Les versions antérieures permettent à un serveur d' envoyer des requêtes telles que `sampling/createMessage`- Je suis là .`roots/list`ou `elicitation/create`Le protocole actuel utilise des demandes de plusieurs voyages ronds à la place.`resultType: input_required`avec au moins un des`inputRequests`ou `requestState`. Le client recueille toute entrée demandée, réessaye la méthode d'origine avec un nouvel ID JSON-RPC et le correspondant `inputResponses`, et fait écho à l' exact`requestState`Si vous n'avez pas été fourni`inputRequests`Si vous étiez présent, la nouvelle tentative est omise.`inputResponses`- Je suis désolé .

Les racines, l'échantillonnage et l'enregistrement restent fonctionnels mais sont dépassés, de sorte que les nouvelles mises en œuvre ne devraient pas les adopter.`inputRequests`, jamais comme requêtes JSON-RPC indépendantes du serveur au client. préférer des paramètres de fichier ou de répertoire explicites, des URIs de ressources, la configuration du serveur et l'intégration directe du fournisseur de modèles.

```figure
mcp-nxm-collapse
```

## Faites-le

### Étape 1: enregistrer une surface de serveur

L'enregistrement reste simple même si le contrat de demande a été modifié:

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

La mise en œuvre expédiée en `code/main.py`Il utilise délibérément la bibliothèque standard pour que vous puissiez voir chaque enveloppe plutôt que de déléguer le protocole à un SDK.

### Étape 2: joindre des métadonnées à chaque demande

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

Ne mettez pas ces métadonnées en cache uniquement dans un objet de connexion. Le serveur les valide à chaque demande.

### Étape 3: découvrir avant de l'inscrire

Appel`server/discover`, choisissez une version prise en charge, puis appelez `tools/list`- Une direct .`tools/list`est également valable si vous connaissez déjà la version et que vous pouvez gérer `-32022`- Je suis désolé .

La démo renvoie les listes d' outils en ordre de noms et les attache `ttlMs`- Je suis là .`cacheScope`- Je suis là .`resultType`Un appel d'outil renvoie un résultat complet, non caché parce que sa sortie peut dépendre de l'état actuel.

### Étape 4: Mapeur de la même demande à HTTP

Une télécommande .`tools/call`POST comprend des en-têtes qui reflètent le corps JSON-RPC:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

Le `MCP-Protocol-Version`l' en-tête doit correspondre à la version de `_meta`- Je suis là .`Mcp-Method`est requis pour chaque demande JSON-RPC et doit correspondre `method`- Je suis là .`Mcp-Name`est nécessaire uniquement pour `tools/call`- Je suis là .`resources/read`, et `prompts/get`, où il doit correspondre au nom de l'outil, à l'URI de ressource ou au nom de la requête.`HeaderMismatch`code `-32020`- Je suis désolé .

### Étape 5: Faire respecter la sécurité en dehors de l'état du protocole

- Valider l'autorisation et le public sur chaque requête HTTP.
- Lier les serveurs locaux à localhost et valider `Origin`sur le HTTP par flux.
- Marquez les outils mutants avec `destructiveHint: true`et nécessitent l'approbation de l'hôte.
- Passer le répertoire et la portée du fichier explicitement au lieu de dépendre des racines dépassées.
- Traiter les ressources et les résultats des outils comme des données non fiables.
- Garder la stdout réservée à JSON-RPC sous stdio; écrire des diagnostics à stderr.

## Utilisez-le

Exécutez la leçon de son répertoire:

```bash
python3 code/main.py
npx tsx code/main.ts
cd code
python3 -m unittest discover tests -v
```

La première ligne devrait indiquer la découverte de `demo-server`au protocole `2026-07-28`- Alors inspectez .`MCPClient.request`: il reconstruit `_meta`supprimer les métadonnées d'une demande et observer le serveur la rejeter.

## La faire partir

`outputs/skill-mcp-server-designer.md`Il est nécessaire de trouver un résultat de découverte, une politique de métadonnées par requête, des listes déterministes de cache-conscients, des manipulations explicites de l'état, des en-têtes de transport, des règles d'autorisation et d'approbation.

## Continuez la plongée profonde du MCP

Cette leçon vous donne le modèle de protocole.

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md)couvre les schémas d'entrée fermés, le contenu structuré, les métadonnées de routage, la pagination opaque, l'autorisation de termination et la différence entre les erreurs de protocole et de domaine d'outil.
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md)couvre l'annulation de la demande, l'annulation durable de la tâche, les délais, l'idempotence, la contre-pression, le tampon de proxy et le comportement de reconnexion.
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md)couvre la preuve de l'espace de noms, l'origine des artefacts, les broches immuables, le dérivé en direct, l'état du registre, les preuves d'admission et le retour en arrière.
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md)couvre les transcriptions de fil dorées et négatives, les âges de version stricts, les différentiels SDK, les preuves par procuration, la rédaction, les portes de santé et le retour de sortie.

Suivez-les dans l'ordre où le serveur franchira une frontière d'équipe ou de confiance. Ensemble, ils passent de la méthode fonctionne à le contrat reste sécurisé et diagnostique par déploiement.

## Exercices

1. Ajouter un `subtract`outil et confirmer `tools/list`reste dans l'ordre alphabétique.
2. Retirez la clé de version du protocole et vérifiez les paramètres invalides (`-32602`Envoyez alors la version bien formée mais non soutenue `2025-11-25`, vérifier `-32022`, confirme`requested`Il est possible de choisir entre les deux.`supported`- Je suis désolé .
3. Ajouter un serveur-minté `draftId`Expliquez pourquoi c'est l'état de l'application plutôt qu'une session de protocole.
4. Retour `input_required`En cas de besoin de confirmation par l'utilisateur, essayez à nouveau l'appel original avec un nouvel identifiant, un `inputResponses`l'entrée, et l'excès `requestState`au lieu d'inventer une demande JSON-RPC serveur-client.
5. Décrire un client de studio à deux époques. Traiter un résultat ou une erreur reconnue moderne comme moderne, et permettre le retour à l'erreur.`initialize`uniquement pour une erreur ou un délai non reconnu.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MCP | "Tool protocol for LLMs" | JSON-RPC protocol for server discovery, tools, resources, prompts, and extensions |
| Host | "The AI app" | Owns the model and UI and mounts one or more MCP clients |
| Client | "The connector" | Speaks MCP to one server on behalf of a host |
| Stateless MCP | "No session" | Every request carries version and capabilities; no protocol state is keyed by a connection |
| `server/discover` | "Capability probe" | Required server method advertising versions, capabilities, and identity |
| `resultType` | "Result state" | Marks a result as `complete` or `input_required` |
| State handle | "Workflow id" | Server-minted application identifier passed as an ordinary argument |
| Streamable HTTP | "Remote transport" | One POST endpoint with JSON or request-scoped SSE responses |
| MRTR | "Ask and retry" | Input request embedded in a result, followed by a retry of the original operation |

## Pour en savoir plus

- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
