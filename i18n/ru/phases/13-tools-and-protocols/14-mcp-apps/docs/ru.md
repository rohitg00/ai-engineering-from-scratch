# MCP Apps — интерактивные UI-ресурсы через `ui://`

> Только текстовый вывод инструментов ограничивает то, что могут показать агенты. MCP Apps (SEP-1724, официально с 26 января 2026 года) позволяют инструменту вернуть песочницированный интерактивный HTML, рендерящийся встроенно в Claude Desktop, ChatGPT, Cursor, Goose и VS Code. Дашборды, формы, карты, 3D-сцены — всё через одно расширение. Этот урок разбирает схему ресурсов `ui://`, MIME `text/html;profile=mcp-app`, протокол postMessage в iframe-песочнице и поверхность безопасности, которая возникает вместе с разрешением серверу рендерить HTML.

**Тип:** Build**Языки:** Python (stdlib, UI resource emitter), HTML (sample app)**Предварительные требования:** Фаза 13 · 07 (MCP server), Фаза 13 · 10 (resources)**Время:** ~75 минут
## Цели обучения

- Вернуть ресурс `ui://` из вызова инструмента и задать правильный MIME и метаданные.
- Объявить UI инструмента, связанный с ним, через `_meta.ui.resourceUri`, `_meta.ui.csp` и `_meta.ui.permissions`.
- Реализовать postMessage JSON-RPC в iframe-песочнице для коммуникации UI с хостом.
- Применить настройки по умолчанию для CSP и политики permissions, защищающие от атак, исходящих от UI.

## Проблема

Инструмент `visualize_timeline` образца 2025 года мог вернуть «Вот 14 заметок, организованных хронологически: ...». Это абзац текста. Пользователи на самом деле хотят интерактивную временную шкалу. До MCP Apps варианты были такими: специфичные для клиента API виджетов (артефакты Claude, OpenAI Custom GPT HTML) или отсутствие UI вовсе.

MCP Apps (SEP-1724, вышел 26 января 2026 года) стандартизируют этот контракт. Результат вызова инструмента содержит `resource`, чей URI имеет вид `ui://...`, а MIME — `text/html;profile=mcp-app`. Хост рендерит его в песочницированном iframe с ограниченной CSP и без доступа к сети, если он явно не предоставлен. UI внутри iframe отправляет сообщения хосту через крошечный диалект postMessage JSON-RPC.

Каждый совместимый клиент (Claude Desktop, ChatGPT, Goose, VS Code) рендерит один и тот же ресурс `ui://` одинаково. Один сервер, один HTML-бандл, универсальный UI.

## Концепция

### Схема ресурсов `ui://`

Инструмент возвращает:

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

Затем хост вызывает `resources/read` на URI `ui://notes/timeline` и получает в ответ:

```json
{
  "contents": [{
    "uri": "ui://notes/timeline",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!doctype html>..."
  }]
}
```

### Песочница iframe

Хост рендерит HTML внутри песочницированного `<iframe>` с:

- `sandbox="allow-scripts allow-same-origin"` (или строже, по объявлению сервера).
- CSP, объявленной сервером, применённой через заголовки ответа.
- Без cookie, без localStorage из origin хоста.
- Доступ к сети ограничен `connectSrc` в CSP.

### Протокол postMessage

Iframe общается с хостом через `window.postMessage`. Крошечный диалект JSON-RPC 2.0:

Всегда закрепляйте `targetOrigin` за точным origin получателя, а на принимающей стороне проверяйте `event.origin` по разрешённому списку, прежде чем обрабатывать любую полезную нагрузку. Никогда не используйте `"*"` ни для одной из сторон этого канала — тело несёт вызовы инструментов и чтение ресурсов.

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

Доступные методы на стороне хоста, которые может вызвать UI:

- `host.callTool(name, arguments)` — вызывает инструмент сервера.
- `host.readResource(uri)` — читает ресурс MCP.
- `host.getPrompt(name, arguments)` — получает шаблон промпта.
- `host.close()` — закрывает UI.

Каждый вызов по-прежнему проходит через протокол MCP и наследует разрешения сервера.

### Permissions

Список `_meta.ui.permissions` запрашивает дополнительные возможности:

- `camera` — доступ к камере пользователя (используется для UI сканирования документа).
- `microphone` — голосовой ввод.
- `geolocation` — местоположение.
- `network:*` — более широкий доступ к сети, чем позволяет один `connectSrc`.

Каждое разрешение — это запрос, который пользователь видит до того, как UI отрендерится.

### Риски безопасности

HTML в iframe остаётся HTML. Новая поверхность атаки:

- **Инъекция промпта через UI.** Злонамеренный UI сервера может показать текст, который выглядит как системное сообщение, и обмануть пользователя. Рендеринг хоста должен визуально отличать UI сервера от UI хоста.
- **Эксфильтрация через `connectSrc`.** Если CSP разрешает `connect-src: *`, UI может отправить данные куда угодно. По умолчанию должно быть строго.
- **Clickjacking.** UI накладывается поверх chrome хоста. Хосты должны предотвращать манипуляции с z-index и применять правила непрозрачности.
- **Кража фокуса.** UI забирает фокус клавиатуры и перехватывает следующее сообщение. Хосты должны это перехватывать.

Phase 13 · 15 разбирает это подробно в рамках безопасности MCP; этот урок лишь вводит тему.

### Рукопожатие `ui/initialize`

После загрузки iframe отправляет `ui/initialize` через postMessage:

```json
{"jsonrpc": "2.0", "id": 0, "method": "ui/initialize",
 "params": {"theme": "dark", "locale": "en-US", "sessionId": "..."}}
```

Хост отвечает возможностями и токеном сессии. UI использует токен сессии при каждом последующем вызове хоста.

### Примитивы SDK AppRenderer / AppFrame

SDK ext-apps предоставляет два удобных примитива:

- `AppRenderer` (сторона сервера) — оборачивает компонент React / Vue / Solid и выдаёт ресурс `ui://` с правильным MIME и метаданными.
- `AppFrame` (сторона клиента) — получает ресурс, монтирует iframe и опосредует postMessage.

Вы можете использовать их или собрать HTML и JSON-RPC вручную.

### Состояние экосистемы

MCP Apps вышел 26 января 2026 года. Поддержка клиентами по состоянию на апрель 2026 года:

- **Claude Desktop.** Полная поддержка с января 2026 года.
- **ChatGPT.** Полная поддержка через Apps SDK (тот же базовый протокол MCP Apps).
- **Cursor.** Бета; включается в настройках.
- **VS Code.** Только Insider-сборки.
- **Goose.** Полная поддержка.
- **Zed, Windsurf.** В дорожной карте.

Серверы в продакшене: дашборды, визуализации карт, таблицы данных, конструкторы диаграмм, превью песочничных IDE.

```figure
t3-ui-sandbox
```

## Практика

`code/main.py` расширяет сервер заметок инструментом `visualize_timeline`, который возвращает ресурс `ui://notes/timeline`, плюс обработчиком `resources/read` для этого URI, который возвращает небольшой, но полный HTML-бандл со SVG-временной шкалой. HTML шаблонизируется stdlib — без системы сборки. postMessage набросан в комментариях JS, поскольку stdlib не может управлять браузером.

На что обратить внимание:

- `_meta.ui` в ответе инструмента несёт resourceUri, CSP, permissions.
- HTML рендерится без доступа к сети; все данные встроены инлайном.
- JS вызывает `host.callTool` через `window.parent.postMessage` (задокументировано, но неактивно в этой демонстрации на stdlib).

## Поставка

Этот урок производит `outputs/skill-mcp-apps-spec.md`. Учитывая инструмент, которому пошёл бы на пользу интерактивный UI, навык производит полный контракт MCP Apps: URI `ui://`, CSP, permissions, точки входа postMessage и чек-лист безопасности.

## Упражнения

1. Запустите `code/main.py` и изучите выданный HTML. Откройте HTML прямо в браузере; убедитесь, что SVG рендерится. Затем набросайте контракт postMessage, который UI использовал бы для вызова `host.callTool("notes_update", ...)`.

2. Ужесточите CSP: уберите `'unsafe-inline'` и используйте политику скриптов на основе nonce. Что меняется в коде генерации HTML?

3. Добавьте второй UI-ресурс `ui://notes/editor` с формой для редактирования заметки на месте. Когда пользователь отправляет форму, iframe вызывает `host.callTool("notes_update", ...)`.

4. Проаудируйте поверхность атаки UI. Где злонамеренный сервер мог бы внедрить контент? От чего защищает песочница iframe, а от чего — нет?

5. Прочитайте спецификацию SEP-1724 и определите одну возможность SDK MCP Apps, которую эта игрушечная реализация не использует. (Подсказка: синхронизация состояния на уровне компонента.)

## Ключевые термины

| Термин | Что говорят люди | Что это на самом деле означает |
|------|----------------|------------------------|
| MCP Apps | «Интерактивные UI-ресурсы» | Расширение SEP-1724, вышедшее 26.01.2026 |
| `ui://` | «Схема URI приложения» | Схема ресурсов для UI-бандлов |
| `text/html;profile=mcp-app` | «Тот самый MIME» | Content-type для HTML MCP App |
| Iframe sandbox | «Контейнер рендеринга» | Песочница браузера для UI с CSP и permissions |
| postMessage JSON-RPC | «Канал UI-хост» | Крошечный диалект JSON-RPC поверх postMessage для вызовов хоста |
| `_meta.ui` | «Связка инструмент-UI» | Метаданные, связывающие результат инструмента с UI-ресурсом |
| CSP | «Content-Security-Policy» | Объявляет разрешённые источники для скриптов, сети, стилей |
| AppRenderer | «Примитив серверного SDK» | Превращает компонент фреймворка в ресурс `ui://` |
| AppFrame | «Примитив клиентского SDK» | Помощник монтирования iframe, опосредующий postMessage |
| `ui/initialize` | «Рукопожатие» | Первое postMessage-сообщение от UI к хосту |

## Дополнительное чтение

- [MCP ext-apps — GitHub](https://github.com/modelcontextprotocol/ext-apps) — референсная реализация и SDK
- [MCP Apps specification 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) — формальный документ спецификации
- [MCP — Apps extension overview](https://modelcontextprotocol.io/extensions/apps/overview) — документация высокого уровня
- [MCP blog — MCP Apps launch](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) — пост о запуске в январе 2026 года
- [MCP Apps API reference](https://apps.extensions.modelcontextprotocol.io/api/) — справка по SDK в стиле JSDoc
