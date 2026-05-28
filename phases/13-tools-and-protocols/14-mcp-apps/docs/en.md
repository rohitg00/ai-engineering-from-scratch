# MCP Apps — `ui://`によるInteractive UI Resources

> Text-onlyなtool outputでは、agentが見せられるものに限界がある。MCP Apps（SEP-1724、2026年1月26日公式）は、toolがsandboxed interactive HTMLを返し、それをClaude Desktop、ChatGPT、Cursor、Goose、VS Code内にinline renderできるようにする。Dashboard、form、map、3D sceneを1つのextensionで扱える。このlessonでは`ui://` resource scheme、`text/html;profile=mcp-app` MIME、iframe-sandbox postMessage protocol、serverがHTMLをrenderできるようにした時のsecurity surfaceを歩く。

**種別:** 構築
**言語:** Python (stdlib, UI resource emitter), HTML (sample app)
**前提条件:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**所要時間:** 約75分

## Learning Objectives

- Tool callから`ui://` resourceを返し、正しいMIMEとmetadataを設定する。
- `_meta.ui.resourceUri`、`_meta.ui.csp`、`_meta.ui.permissions`でtoolに紐づくUIを宣言する。
- UI-to-host communication向けのiframe sandbox postMessage JSON-RPCを実装する。
- UI起点攻撃を防ぐCSPとpermissions-policy defaultsを適用する。

## 問題

2025年頃の`visualize_timeline` toolは「14個のnotesを時系列に整理しました: ...」というparagraphを返せた。しかしusersが本当に欲しいのはinteractive timelineである。MCP Apps以前の選択肢は、client-specific widget APIs（Claude artifacts、OpenAI Custom GPT HTML）か、UIなしのどちらかだった。

MCP Apps（SEP-1724、2026年1月26日ship）はこのcontractをstandardizeする。Tool resultは`ui://...` URIと`text/html;profile=mcp-app` MIMEを持つ`resource`を含む。Hostは、それをsandboxed iframe内で、制限されたCSPと明示的に許可されない限りnetwork accessなしでrenderする。Iframe内のUIは、小さなpostMessage JSON-RPC dialectでhostへmessageを送る。

互換client（Claude Desktop、ChatGPT、Goose、VS Code）は同じ`ui://` resourceを同じようにrenderする。1つのserver、1つのHTML bundle、universal UIである。

## The Concept

### The `ui://` resource scheme

Toolは次を返す。

```json
{
  "content": [
    {"type": "text", "text": "Here is your notes timeline:"},
    {"type": "ui_resource", "uri": "ui://notes/timeline"}
  ],
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline",
      "csp": {
        "defaultSrc": "'self'",
        "scriptSrc": "'self' 'unsafe-inline'",
        "connectSrc": "'self'"
      },
      "permissions": []
    }
  }
}
```

その後hostは`ui://notes/timeline` URIに対して`resources/read`を呼び、次を受け取る。

```json
{
  "contents": [{
    "uri": "ui://notes/timeline",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!doctype html>..."
  }]
}
```

### Iframe sandbox

HostはHTMLをsandboxed `<iframe>`内でrenderする。

- `sandbox="allow-scripts allow-same-origin"`（またはserver declarationに応じてより厳しく）。
- Server-declared CSPをresponse headers経由で適用。
- Host origin由来のcookiesやlocalStorageはない。
- Network accessはCSPの`connectSrc`に制限される。

### postMessage protocol

Iframeは`window.postMessage`でhostと通信する。小さなJSON-RPC 2.0 dialectである。

常に`targetOrigin`をpeerのexact originへpinし、受信側ではpayload処理前に`event.origin`をallowlistで検証する。このchannelのbodyにはtool callsとresource readsが載るため、どちら側でも`"*"`は使わない。

```js
// iframe to host  (pin to host origin)
window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "host.callTool",
  params: { name: "notes_update", arguments: { id: "note-14", title: "..." } }
}, "https://host.example.com");

// host to iframe  (pin to iframe origin)
iframe.contentWindow.postMessage({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [...] }
}, "https://iframe.example.com");

// receiver on both sides
window.addEventListener("message", (event) => {
  if (event.origin !== "https://expected-peer.example.com") return;
  // safe to process event.data
});
```

UIが呼べるhost-side methods:

- `host.callTool(name, arguments)` — server toolをinvokeする。
- `host.readResource(uri)` — MCP resourceを読む。
- `host.getPrompt(name, arguments)` — prompt templateを取得する。
- `host.close()` — UIを閉じる。

すべてのcallは引き続きMCP protocolを通り、server permissionsを継承する。

### Permissions

`_meta.ui.permissions` listは追加capabilitiesを要求する。

- `camera` — userのcameraへaccessする（scan-a-document UIで使う）。
- `microphone` — voice input。
- `geolocation` — location。
- `network:*` — `connectSrc`だけより広いnetwork access。

各permissionは、UI render前にuserへ見せるpromptである。

### Security risks

Iframe内のHTMLもHTMLである。新しいattack surfaceがある。

- **Prompt-injection via UI.** Malicious server UIがsystem messageのように見えるtextを表示し、userを騙す。Host renderingはserver UIとhost UIを視覚的に区別すべきである。
- **Exfiltration via `connectSrc`.** CSPが`connect-src: *`を許すと、UIはdataをどこにでも送れる。Defaultはstrictであるべき。
- **Clickjacking.** UIがhost chromeへ重なる。Hostsはz-index manipulationを防ぎ、opacity rulesを強制する必要がある。
- **Steal focus.** UIがkeyboard focusを取り、次のmessageをcaptureする。Hostsはinterceptしなければならない。

Phase 13 · 15ではMCP securityの一部としてこれらを深掘りする。このlessonでは導入に留める。

### `ui/initialize` handshake

Iframe load後、postMessageで`ui/initialize`を送る。

```json
{"jsonrpc": "2.0", "id": 0, "method": "ui/initialize",
 "params": {"theme": "dark", "locale": "en-US", "sessionId": "..."}}
```

Hostはcapabilitiesとsession tokenで応答する。UIは以後のhost callすべてでsession tokenを使う。

### AppRenderer / AppFrame SDK primitives

ext-apps SDKは2つのconvenience primitivesを提供する。

- `AppRenderer`（server side）— React / Vue / Solid componentをwrapし、正しいMIMEとmetadataを持つ`ui://` resourceをemitする。
- `AppFrame`（client side）— resourceを受け取り、iframeをmountし、postMessageをmediateする。

これらを使ってもよいし、HTMLとJSON-RPCをhand-rollしてもよい。

### Ecosystem status

MCP Appsは2026年1月26日にshipした。2026年4月時点のclient support:

- **Claude Desktop.** 2026年1月からfull support。
- **ChatGPT.** Apps SDK経由でfull support（underlying protocolは同じMCP Apps）。
- **Cursor.** Beta。settingsで有効化する。
- **VS Code.** Insider buildsのみ。
- **Goose.** Full support。
- **Zed, Windsurf.** Roadmapped。

Production servers: dashboards、map visualizations、data tables、chart builders、sandbox IDE previews。

## Use It

`code/main.py`はnotes serverを拡張し、`ui://notes/timeline` resourceを返す`visualize_timeline` toolを追加する。さらに、そのURIに対する`resources/read` handlerが、SVG timelineを含む小さいが完全なHTML bundleを返す。HTMLはstdlib-templatedで、build systemはない。stdlibではbrowserを操作できないため、postMessageはJS commentsとしてsketchされている。

見るべき点:

- Tool responseの`_meta.ui`にresourceUri、CSP、permissionsが入る。
- HTMLはnetwork accessなしでrenderされ、dataはすべてinlineされる。
- JSは`window.parent.postMessage`経由で`host.callTool`を呼ぶ（stdlib demoではdocumented but inert）。

## Ship It

このlessonは`outputs/skill-mcp-apps-spec.md`を生成する。Interactive UIの恩恵を受けるtoolを与えると、このskillはfull MCP Apps contractを作る。`ui://` URI、CSP、permissions、postMessage entrypoints、security checklistを含む。

## Exercises

1. `code/main.py`を実行し、emitされたHTMLをinspectする。HTMLをbrowserで直接開き、SVGがrenderされることを確認する。その後、UIが`host.callTool("notes_update", ...)`を呼ぶためのpostMessage contractをsketchする。

2. CSPを強化する。`'unsafe-inline'`を削除し、nonce-based script policyを使う。HTML generation codeの何が変わるか。

3. Noteをその場で編集するform付きのsecond UI resource `ui://notes/editor`を追加する。Userがsubmitしたら、iframeが`host.callTool("notes_update", ...)`を呼ぶ。

4. UIのattack surfaceをauditする。Malicious serverはどこにcontentをinjectできるか。Iframe sandboxは何を防ぎ、何を防がないか。

5. SEP-1724 specを読み、このtoy implementationが使っていないMCP Apps SDK capabilityを1つ特定する。（Hint: component-level state sync）

## Key Terms

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| MCP Apps | 「interactive UI resources」 | 2026-01-26にshipされたSEP-1724 extension |
| `ui://` | 「App URI scheme」 | UI bundles向けresource scheme |
| `text/html;profile=mcp-app` | 「The MIME」 | MCP App HTMLのcontent-type |
| Iframe sandbox | 「render container」 | CSPとpermissions付きでUIをbrowser sandbox化する仕組み |
| postMessage JSON-RPC | 「UI-to-host wire」 | Host calls用の小さなJSON-RPC-over-postMessage dialect |
| `_meta.ui` | 「tool-UI binding」 | Tool resultをUI resourceへ紐づけるmetadata |
| CSP | 「Content-Security-Policy」 | scripts、network、stylesの許可sourceを宣言する |
| AppRenderer | 「server SDK primitive」 | Framework componentを`ui://` resourceへ変換する |
| AppFrame | 「client SDK primitive」 | postMessageをmediateするiframe mount helper |
| `ui/initialize` | 「handshake」 | UIからhostへ送る最初のpostMessage |

## 参考文献

- [MCP ext-apps — GitHub](https://github.com/modelcontextprotocol/ext-apps) — reference implementation and SDK
- [MCP Apps specification 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) — formal spec document
- [MCP — Apps extension overview](https://modelcontextprotocol.io/extensions/apps/overview) — high-level documentation
- [MCP blog — MCP Apps launch](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) — 2026年1月launch post
- [MCP Apps API reference](https://apps.extensions.modelcontextprotocol.io/api/) — JSDoc-style SDK reference
