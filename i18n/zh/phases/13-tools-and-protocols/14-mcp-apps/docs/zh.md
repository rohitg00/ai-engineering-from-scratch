# 无国籍议定书的MCP应用程序

> 互动结果仍然是MCP工具和资源交换. 2026-07-28的核心使交换自主,而应用程序扩展增加了沙盒浏览器表面.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**Time:** ~75 minutes

## 学习目标

- 通过MCP应用程序进行广告`server/discover`根据要求扩展功能.
- 声明一个`ui://`在调用工具之前,在工具上使用资源.
- 返回完整的工具和资源结果,在2026-07-28无状态电线上.
- 分开应用程序`ui/initialize`移除MCP核心握手的桥梁消息.
- 申请原产权验证,沙盒,CSP和最小特权权权.

## 问题

文本结果可以描述一个时间线. 它不能给用户一个时间线,他们可以过,检查或采取行动.

工具定义指出一个 工具的定义是`ui://`工具运行之前,主机可以获取和审查该资源,将其呈现成一个沙盒的iframe,并通过JSON-RPC桥接所有应用程序操作.

2026-07-28 年,核心协议发生了变化.

- 没有核心`initialize`要求或`notifications/initialized`通知
- 没有.`Mcp-Session-Id`标题
- 每个请求都包含协议版本和客户端功能.`params._meta`现在,我们要去.
- 服务器实现`server/discover`客户可以检查版本,核心功能和扩展.
- 每个成功的结果都有一个`resultType`歧视者.
- 流式HTTP每请求使用一个POST.现代GET和 DELETE输入点返回405.

应用程序桥仍然有一个叫做`ui/initialize`它属于iframe后消息方言. 它不会重建核心MCP会议.

## 概念

### 两个协议,一个功能

保持层次的明确性:

1.  MCP核心携带`server/discover`现在`tools/list`现在`tools/call`现在`resources/list`其他`resources/read`现在,我们要去.
2. 扩展MCP Apps声明UI并定义iframe到主机桥梁.
3. 浏览器的沙箱规则限制了用户界面可以达到的内容.

扩展标识符是`io.modelcontextprotocol/ui`客户端在每个请求中发送功能对象内部的扩展支持:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/ui": {}
        }
      },
      "io.modelcontextprotocol/clientInfo": {
        "name": "timeline-host",
        "version": "1.0.0"
      }
    }
  }
}
```

`clientInfo`报告的数据是自主报告的数据,而不是授权身份.

### 在转换之前发现

服务器的发现结果宣传了扩展:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {},
    "resources": {},
    "extensions": {
      "io.modelcontextprotocol/ui": {}
    }
  },
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "timeline-app-server",
      "version": "2.0.0"
    }
  }
}
```

服务器必须支持发现. 客户端不被迫在每一项行动之前调用发现,因为每个行动都具有自己的能力.

### 声明工具定义中的UI

现代应用程序合同将UI与工具绑定在`tools/list`其他:

```json
{
  "name": "notes_timeline",
  "description": "Render a timeline of notes.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline.html"
    }
  }
}
```

预定的数据是预先调用的元数据. 服务器可以预先加载,缓存和检查HTML,然后结果要求显示. 旧的平板元数据键可能会被兼容代码接受,但新服务器应该发射嵌套的元数据.`_meta.ui.resourceUri`形式.

`tools/list`包含确定性排序,`ttlMs`其他`cacheScope`使用`private`可见的工具因用户或代币而异.

### 返回数据,然后让主机绑定视图

工具调用返回普通内容加上结构化数据:

```json
{
  "resultType": "complete",
  "content": [
    {"type": "text", "text": "Timeline ready."}
  ],
  "structuredContent": {
    "notes": [
      {"id": "note-1", "title": "Discover", "created": "2026-07-28"}
    ]
  },
  "isError": false
}
```

机器主机已经知道该工具属于哪个视图. 避免发明新的内容块,只是为了重复URI.

### 作为资源使用应用程序

服务器的广告`resources`为了实现这一目标,`resources/list`运行.其确定性列表入口包括可行URI,稳定名称,描述和MIME类型.列表结果包括`resultType`服务器身份元数据,`ttlMs`其他`cacheScope`像确定性工具列表一样.

主人派了`resources/read`在流式HTTP上,请求有:

```text
POST /mcp
MCP-Protocol-Version: 2026-07-28
Mcp-Method: resources/read
Mcp-Name: ui://notes/timeline.html
```

标题值和JSON-RPC体必须匹配.不匹配是协议错误`-32020`现在,我们要去.

结果包含HTML资源和缓存提示:

```json
{
  "resultType": "complete",
  "contents": [
    {
      "uri": "ui://notes/timeline.html",
      "mimeType": "text/html;profile=mcp-app",
      "text": "<!doctype html>...",
      "_meta": {
        "ui": {
          "csp": {
            "connectDomains": [],
            "resourceDomains": [],
            "frameDomains": [],
            "baseUriDomains": []
          },
          "permissions": {}
        }
      }
    }
  ],
  "ttlMs": 60000,
  "cacheScope": "public"
}
```

### 缓存用户界面资源作为可执行内容

应用程序资源不能与普通散文交换.其缓存输入可以执行桥码,染工具数据,并请求主机调整的操作.按法式键键键键.`ui://`服务器身份和版本,资源内容消化,以及授权文本`cacheScope`永远不要在主题中重复使用私有应用资源,因为HTML或其政策元数据可能会不同,即使URI是相同的.

无效的输入`ttlMs`工具的使用期限过去了.`_meta.ui.resourceUri`修改链接,服务器版本或被允许的描述符针变化,或一个被确认的资源更改订阅命名为URI.在重新安装之前重新检查和重新应用CSP和权限审查.一个过时的iframe不能仅仅因为新资源版本尚未加载而保留更广泛的权限.

### 在功能政策之前拒绝线索模糊性

验证有故意的顺序.首先验证JSON-RPC形状,并需要字符串协议元数据以及对象客户端能力地图.然后将路由头条与机体进行比较.只有那么才能决定是否支持匹配的协议版本.这个顺序阻止代理和服务器解释不同的请求.

| Condition | HTTP | JSON-RPC error |
|-----------|------|----------------|
| Header and body version, method, or name disagree | 400 | `-32020` |
| Header and body agree on an unsupported version | 400 | `-32022`, with `data` exactly `{"supported":["2026-07-28"],"requested":"<actual>"}` |
| `resources/read` lacks the Apps extension capability | 400 | `-32021`, with `data.requiredCapabilities.extensions.io.modelcontextprotocol/ui` |
| Method is unknown | 404 | `-32601` |

没有JSON-RPC通知`id`服务器从来没有发出一个JSON-RPC响应.一个被接受的HTTP通知返回202的空格.一个错误可以改变HTTP状态,但它仍然不能为通知创建一个JSON-RPC错误体.

### 沙盒是边界,不是信任判决

应用程序不能直接读取主机的cookies,本地存储器或页面DOM.所有权限的工作必须跨越桥梁.

使用以下默认:

- 让所有CSP域名列表空,然后只添加应用程序需要的原始. 使用 `connectDomains`对于搜索,XHR和WebSocket;使用`resourceDomains`对于脚本,风格,图像和字体.
- 实际情况下,将代码和数据捆绑起来.
- 要求任何相机,麦克风或位置许可,除非可见的功能需要它.
- 子`postMessage`对于其他任何起源,
- 处理工具参数,工具结果,资源文本和桥梁消息作为不可信的输入.
- 保持用户同意在主机中. iframe不能批准其自己的后果行动.

别复制一个固定的`sandbox`根据应用程序的原始模型和其自己的隔离设计,主机必须选择旗.

允许的域仍然是透路径.`connectDomains: ["https://api.example.com"]`意思是,任何执行应用程序中的脚本都可以将允许的数据发送到那里. 确切的原产地匹配可以防止目的地混,但它并不能决定有效载荷是否适合. 默认保持连接访问空,避免将载体代币放置在iframe中,在实际情况下通过主机进行代理狭窄操作,限制响应和请求大小,并审计用户的行为导致了每个输出请求. 治疗`resourceDomains`单独与`connectDomains`;允许加载字体或脚本不应允许任意加载数据.

### 应用程序桥梁有自己的生命周期

应用程序桥是一个JSON-RPC方言`postMessage`它可以交换`ui/initialize`其他`ui/*`通过该系统,可通过 技术技术来实现`tools/call`现在,我们要去.

视图发送`ui/initialize`随着`appInfo`其他`appCapabilities`接待器返回其功能和接待器语境.`ui/notifications/initialized`服务主必须等到此应用程序通知,然后向视图发送消息.

通过本地握手,一个iframe和一个主机框架之间建立了一个桥梁.它不会谈判MCP协议版本,创建服务器状态,或创建运输会话. 注意确切的预写:核心`notifications/initialized`应用程序被删除`ui/notifications/initialized`通过桥接工具调用生成的核心请求是一个新的自主请求,具有新的JSON-RPCID和完整的请求元数据.

### 主机背景,行动和撤销

服务主持人仍然是启动桥接后的权威.一个视频只能通过主机广告的功能请求工具操作,导航,剪辑板使用或其他特权效应.主机验证了输入的请求,当前用户,目标和参数,应用了批准政策,并可能拒绝它.按点击和有效的桥接消息表达了意图;没有一个权威.

处理主题,大小和可访问性作为一个变化的主机环境而不是一次性染输入:

- 应用主机提供的颜色和类型符号,然后当主题或对比偏好发生变化时,
- 让查看报告所需的尺寸,但让主机盖并应用iframe尺寸,以便内容不能逃离布局或创建欺骗性叠加.
- 保存键盘顺序,可见的焦点,可访问的名称,屏幕阅读器状态,足够的对比,放大,以及iframe内部的运动减少行为.
- 重新测试主机控制器和查看控制器之间的重点转移,在改变尺寸和重新呈现后.

应用程序开放期间,功能可被撤销,因为用户改变帐户,政策改变,服务器被隔离,或主机缩小同意.`ui/initialize`在撤销时,拒绝待定的特权调用,停止不再符合政策的网络活动,清除敏感的转载状态,并在用户界面资源本身不再被允许时重新安装或返回文本.

### 倒退是合同的一部分

应用程序知情的服务器仍然可以为不广告UI扩展的主机服务:

- 返回相同的工具`_meta.ui`在`tools/list`现在,我们要去.
- 保存一个有用的文本结果`tools/call`现在,我们要去.
- 拒绝`resources/read`对于缺失能力错误的UI.
- 决策工具是否完成时,永远不要假设一个iframe存在.

```figure
t3-ui-sandbox
```

## 建立它

`code/main.py`通过Skype,它可以通过Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Skype,Syyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy`server/discover`列出工具和资源,执行工具,并提供一个独立的HTML资源.

该模型已经接受了分析的体体和路由标题. 它不是完整的HTTP适配器,也不解析`Content-Type`或`Accept`. 使用第09课程来完成需要的完整的流通 HTTP 适配器`Content-Type: application/json`其他`Accept`含有两者中的值`application/json`其他`text/event-stream`现在,我们要去.

运行它:

```bash
cd phases/13-tools-and-protocols/14-mcp-apps
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

检查输出中的五件事:

1. 每次电话都是独立的.
2. 每个要求都有`_meta`能否实现.
3. `resources/list`在任何资源阅读之前返回稳定描述符.
4. 每个结果都有`resultType`服务器身份元数据.
5. 没有出现核心会议标识符.

## 用它

开始`server/discover`确认`io.modelcontextprotocol/ui`在服务器扩展地图中显示.`tools/list`首先,一个是用App功能,一次是没有App功能.

阅读`ui://notes/timeline.html`查找HTML`hostOrigin`其他`event.origin`两条线是桥梁没有使用野生卡片目标的最小可见证据.

## 运送它

这一课是很好的.`outputs/skill-mcp-apps-spec.md`通过它,在编写框架代码之前,可审查应用程序合同.它迫使作者指定当前的核心包裹,扩展谈判,倒退,UI资源,缓存政策,CSP,权限,桥梁方法和同意界限.

## 运动

1. 改为空扩展地图. 确认`tools/list`保持工具,但删除 UI 绑定.
2. 发送`Mcp-Name: ui://notes/other.html`通过一个读取时间线的器官.`-32020`现在,我们要去.
3. 改变资源为`cacheScope: private`描述使用者特定的条件,证明其合理.
4. 转换脚本到`https://static.example.com/app.js`添加这个来源到`resourceDomains`并且解释了新的供应链风险.
5. 添加一个`notes_open`按键通过主机. 保持用户批准在主机.

## 关键词

| Term | Meaning |
|------|---------|
| MCP Apps | Optional extension for interactive HTML rendered by an MCP host |
| `io.modelcontextprotocol/ui` | Extension identifier advertised by both peers |
| `ui://` | Resource scheme for an App's UI template |
| `text/html;profile=mcp-app` | MIME type for MCP App HTML |
| `server/discover` | Current RPC for protocol and capability discovery |
| `resources/list` | Mandatory resource listing method when the server advertises resources |
| `resultType` | Required discriminator for modern successful results |
| `ui/initialize` | First Apps bridge request, separate from removed core initialization |
| `ui/notifications/initialized` | Apps View readiness notification sent after the host responds |
| CSP | Browser policy that restricts scripts, styles, images, and network origins |
| Text fallback | Tool behavior retained for a host without Apps support |

## 进一步阅读

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [MCP Apps build guide](https://modelcontextprotocol.io/extensions/apps/build)
- [Official extension support matrix](https://modelcontextprotocol.io/extensions/client-matrix)
