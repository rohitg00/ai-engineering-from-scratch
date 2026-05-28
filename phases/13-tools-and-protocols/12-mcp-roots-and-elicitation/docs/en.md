# Roots and Elicitation - Scope設定と実行中のUser Input

> Hard-coded pathは、userが別のprojectを開いた瞬間に壊れます。pre-filled tool argumentは、userの指定が不足していると破綻します。Rootsはserverのscopeをuser-controlledなURI集合に限定します。Elicitationはtool callの途中でpauseし、formやURLを通じてstructured inputをuserに求めます。2つのclient primitiveが、よくあるMCP failure modeを2つ修正します。SEP-1036（URL-mode elicitation、2025-11-25）は2026年上半期を通じてexperimentalです。依存する前にSDK versionを確認してください。

**種別:** 構築
**言語:** Python (stdlib, roots + elicitation demo)
**前提条件:** Phase 13 · 07 (MCP server)
**所要時間:** 約45分

## 学習目標

- `roots`を宣言し、`notifications/roots/list_changed`に応答する。
- serverのfile operationを、宣言されたroot set内のURIに制限する。
- `elicitation/create`を使って、tool callの途中でuserにconfirmationやstructured inputを求める。
- form-modeとURL-mode elicitationを選び分ける（後者はexperimentalであり、drift riskに注意する）。

## 問題

notes MCP serverがproductionで直面する具体的なfailureが2つあります。

**壊れたpath assumption。** serverは`~/notes`を前提に書かれています。別のmachineでnotesを`~/Documents/Notes`に置いているuserは、tool callがsilentに失敗する（file not found）か、さらに悪い場合は誤った場所へwriteします。

**userなら分かるmissing argument。** userが「古いTPS report noteを削除して」と頼みます。modelは`notes_delete(title: "TPS report")`を呼びますが、2023年、2024年、2025年のmatching noteが3つあります。toolは推測できません。"ambiguous"で失敗するのは煩わしく、3つすべてに実行するのは致命的です。

Rootsは最初の問題を修正します。clientは`initialize`時に、serverが触れてよいURI集合を宣言します。Elicitationは2つ目を修正します。serverはtool callをpauseし、`elicitation/create`を送ってどれを選ぶかをuserに尋ねます。

## コンセプト

### Roots

clientは`initialize`でroot listを宣言します。

```json
{
  "capabilities": {"roots": {"listChanged": true}}
}
```

その後serverは`roots/list`をcallできます。

```json
{"roots": [{"uri": "file:///Users/alice/Documents/Notes", "name": "Notes"}]}
```

serverはrootsをboundaryとして扱わなければなりません。root set外のfile read/writeはすべて拒否されます。これはclientによって強制されるものではありません（serverは依然としてuserがtrustしたcodeです）が、spec-compliantなserverはこれを守ります。

userがrootを追加または削除すると、clientは`notifications/roots/list_changed`を送ります。serverは`roots/list`を再callし、boundaryを更新します。

### なぜrootsはclient primitiveなのか

Rootsはuserのconsent modelを表すため、clientによって宣言されます。userはClaude Desktopに「このnotes serverに、この2つのdirectoryへのaccessを与える」と伝えました。serverはそのscopeを広げることはできません。

### Elicitation: defaultのform mode

`elicitation/create`はform schemaとnatural-language promptを受け取ります。

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Delete 'TPS report'? Multiple notes match; pick one.",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "note_id": {
          "type": "string",
          "enum": ["note-3", "note-7", "note-14"]
        },
        "confirm": {"type": "boolean"}
      },
      "required": ["note_id", "confirm"]
    }
  }
}
```

clientはformをrenderし、userのanswerを集めて返します。

```json
{
  "action": "accept",
  "content": {"note_id": "note-14", "confirm": true}
}
```

actionは3つあります。`accept`（userが入力した）、`decline`（userが閉じた）、`cancel`（userがtool call全体を中止した）。

Form schemaはflatです。v1ではnested objectはsupportされていません。SDKは通常、single layerより複雑なものをrejectします。

### Elicitation: URL mode（SEP-1036, experimental）

2025-11-25の新機能です。serverはschemaの代わりにURLを送ります。

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Sign in to GitHub",
    "url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

clientはURLをbrowserで開き、完了を待ち、userが戻ってきたらreturnします。formでは不十分なOAuth flow、payment authorization、document signingに有用です。

Drift-risk note: SEP-1036のresponse shapeはまだ安定途上です。一部のSDKはcallback URLを返し、別のSDKはcompletion tokenを返します。productionでURL modeを使う前に、使用するSDKのrelease noteを読んでください。

### Elicitationが適切な場合

- destructive actionの前のuser confirmation（destructive hint + elicitation）。
- Disambiguation（N個のmatchから1つを選ぶ）。
- First-run setup（API key、directory、preference）。
- OAuth-style flow（URL mode）。

### Elicitationが不適切な場合

- modelがproseで質問できたtoolのrequired argumentを埋めること。elicitation dialogではなく、通常のre-promptを使います。
- high-frequency call。Elicitationはconversationを中断します。loop内で発火させないでください。
- serverが後からvalidateできるもの。validateしてerrorを返し、modelにtextでuserへ尋ねさせます。

### Human-in-the-loop bridge

Elicitationとsamplingを合わせると、MCPの"human-in-the-loop" modelが実現します。serverのagent loopは、user input（elicitation）またはmodel reasoning（sampling）のためにpauseできます。Phase 13 · 11ではsamplingを扱いました。このlessonではelicitationを扱います。両者を組み合わせると、mid-loop control全体を構成できます。

## Use It

`code/main.py`はnotes serverを次で拡張します。

- root-list-changed notificationの後でserverが再queryする`roots/list` response。
- 複数のnoteがmatchしたときに`elicitation/create`でdisambiguateする`notes_delete` tool。
- first-run config pageを開くURL-mode elicitationを使う`notes_setup` tool（simulated）。
- 宣言済みrootsの外側にあるURIへのoperationを拒否するboundary check。

demoは3つのscenarioを実行します。happy path（1 match）、disambiguation（3 matchesでelicitation発火）、out-of-root-write（rejected）です。

## Ship It

このlessonは`outputs/skill-elicitation-form-designer.md`を生成します。user confirmationやdisambiguationを必要とする可能性があるtoolについて、このskillはelicitation form schemaとmessage templateを設計します。

## 演習

1. `code/main.py`を実行してください。disambiguation pathをtriggerし、simulated user answerがtoolへ戻されることを確認してください。

2. 毎回elicitation confirmationを必要とする新しいtool `notes_archive`を追加してください（destructive hint）。UXを確認してください。modelがtextで再質問する場合と比べてどう違いますか。

3. first-run OAuth flow向けにURL-mode elicitationを実装してください。drift riskに注意し、SDK-version guardを追加してください。

4. `roots/list` handlingを拡張してください。notificationが届いたら、serverはroot外になった可能性のあるopen file handleをatomicallyにre-readし、rescanするべきです。

5. GitHub上のSEP-1036 issue discussion threadを読んでください。serverがURL-mode callbackを扱う方法に影響するopen questionを1つ特定してください。

## 主要用語

| Term | よく言われること | 実際の意味 |
|------|------------------|------------|
| Root | "Consent boundary" | clientがserverに触れることを許可したURI |
| `roots/list` | "Server asks for scope" | clientが現在のroot setを返す |
| `notifications/roots/list_changed` | "User changed scope" | clientがroot setの変化を通知する |
| Elicitation | "Ask the user mid-call" | structured user inputを求めるserver-initiated request |
| `elicitation/create` | "The method" | elicitation request用のJSON-RPC method |
| Form mode | "Schema-driven form" | client UIでformとしてrenderされるflat JSON Schema |
| URL mode | "Browser redirect" | SEP-1036 experimental。URLを開いて待つ |
| `accept` / `decline` / `cancel` | "User response outcomes" | serverが処理する3つのbranch |
| Disambiguation | "Pick one" | toolにN個のcandidateがあるときの一般的なelicitation use case |
| Flat form | "Top-level properties only" | elicitation schemaはnestできない |

## 参考資料

- [MCP - Client roots spec](https://modelcontextprotocol.io/specification/draft/client/roots) - canonicalなroots reference
- [MCP - Client elicitation spec](https://modelcontextprotocol.io/specification/draft/client/elicitation) - canonicalなelicitation reference
- [Cisco - What's new in MCP elicitation, structured content, OAuth enhancements](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements) - 2025-11-25 additionsのwalk-through
- [MCP - GitHub SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol) - URL-mode elicitation proposal（experimental、drift-risk）
- [The New Stack - How elicitation brings human-in-the-loop to AI tools](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/) - UX walkthrough
