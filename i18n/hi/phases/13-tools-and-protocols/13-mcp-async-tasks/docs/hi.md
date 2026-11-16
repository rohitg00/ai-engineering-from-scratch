# एमसीपी कार्य विस्तारः एक देशहीन मूल पर स्थायी काम

> बिना राज्य के एमसीपी का मतलब यह नहीं है कि प्रत्येक ऑपरेशन को एक अनुरोध में पूरा किया जाना चाहिए। आधिकारिक कार्य विस्तार लंबे समय तक चलने वाले काम को एक स्पष्ट टिकाऊ हैंडल देता है। एक सर्वर उस हैंडल को वापस कर सकता है`tools/call`, किसी भी उदाहरण उत्तर दे सकता है `tasks/get`, और ग्राहक इनपुट के माध्यम से आता है `tasks/update`प्रोटोकॉल सत्रों को पुनर्जीवित किए बिना।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 11 (stateless MRTR), Phase 13 · 12 (elicitation)
**Time:** ~90 minutes

## सीखने के लक्ष्य

- स्थिर अनुप्रयोग कार्य राज्य से स्टेटलेस प्रोटोकॉल परिवहन को अलग करें।
- `io.modelcontextprotocol/tasks`अनुरोध पर क्षमताओं का विस्तार और `server/discover`. .
- सर्वर-निर्देशित पर वापस `CreateTaskResult`के साथ`resultType: "task"`केवल स्थायी सृजन के पश्चात
- `tasks/get`, कार्य प्रविष्टि को पूरा करें `tasks/update`, और सहयोग रद्द करने का अनुरोध `tasks/cancel`. .
- पुराने को हटा दें `tasks/status`,`tasks/result`और `tasks/list`अनुमान।
-  के माध्यम से वैकल्पिक कार्य सूचनाओं को साइन अप करें`subscriptions/listen`एक पोस्ट प्रतिक्रिया SSE धारा पर।
- मॉडल कार्य समाप्ति, पुनः आरंभ वसूली, इनपुट कुंजी में डुप्लिकेट, और निष्पादन त्रुटियां सही ढंग से।

## कार्य क्यों विस्तार हैं

कार्य पहली बार 2025-11-25 में एक प्रयोगात्मक कोर सुविधा के रूप में दिखाई दिए। जुलाई 2026 में पुनः डिजाइन उन्हें आधिकारिक में ले जाता है।`io.modelcontextprotocol/tasks`विस्तार ताकि क्लाइंट और सर्वर सभी के लिए कोर प्रोटोकॉल का विस्तार किए बिना अतिरिक्त जीवन चक्र में चयन कर सकते हैं।

एक्सटेंशन विनिर्देश एक ड्राफ्ट सतह बनी हुई है भले ही यह कार्य के लिए वर्तमान आधिकारिक घर है। अपने एसडीके द्वारा समर्थित एक्सटेंशन संस्करण को पिन करें, अनुरूपता परिदृश्य चलाएं, और अपने कार्यकर्ता और भंडारण डोमेन से वायर एडाप्टर को अलग करें।

यदि ऑपरेशन में इनमें से एक या अधिक गुण हों तो एक कार्य का उपयोग करेंः

- यह एक सामान्य अनुरोध समय से अधिक जीवित रह सकता है।
- एक श्रमिक कतार या बाहरी नौकरी प्रणाली पहले से ही निष्पादन का मालिक है।
- ग्राहक को अपने स्वयं के पुनः आरंभ के बाद ठीक होने की आवश्यकता है।
- निष्पादन के दौरान उपयोगकर्ता या मॉडल इनपुट के लिए ऑपरेशन रोकता है।
- रद्द करना और टिकाऊ परिणाम प्राप्त करना उत्पाद आवश्यकताएं हैं।

सस्ते निर्धारक खोज के लिए कोई कार्य न बनाएं। एक हैंडल, दृढ़ता, मतदान, समाप्ति और रद्द करना वास्तविक जटिलता है।

## बिना नागरिकता मूल, राज्य के साथ आवेदन

MCP 2026-07-28 हटाता है `initialize`,`notifications/initialized`, प्रोटोकॉल सत्र, और `Mcp-Session-Id`. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .

एक कार्य आईडी स्पष्ट आवेदन राज्य हैः

- सर्वर इसे वापस करने से पहले इसे बनाए रखता है।
- ग्राहक इसे स्टोर कर सकता है और फिर से शुरू करने के बाद फिर से मतदान कर सकता है।
- पहचान किसी भी प्रतिकृति के लिए मार्ग प्रदान कर सकते हैं जो एक ही टिकाऊ स्टोर द्वारा समर्थित है।
- प्रत्येक कार्य पद्धति पर प्राधिकरण की जांच की जाती है।
- समाप्ति और हटाने को कार्य क्षेत्रों द्वारा परिभाषित किया जाता है, न कि परिवहन जीवनकाल द्वारा।

यह एक कनेक्शन से जुड़ी छिपी हुई स्थिति से परिचालन रूप से भिन्न है।

चार जीवन अलग रखेंः

| State | Lifetime | Where it belongs |
|---|---|---|
| Protocol metadata | One request | `params._meta`, validated again on every call |
| Transport work | One stdio request or HTTP response | In-flight coordinator with a bounded deadline |
| MRTR continuation | One retry sequence | Integrity-protected `requestState`, plus replay controls when needed |
| Durable task | Across requests, replicas, restarts, and reconnects | Shared application store keyed by an authorized `taskId` |

प्रक्रिया मेमोरी में एक कार्य रिकॉर्ड को स्थानांतरित करने से MCP स्टेटफुल नहीं होता है। यह एप्लिकेशन को अविश्वसनीय बनाता है। प्रोटोकॉल स्टेटलेस रहता है, लेकिन बाद में एक`tasks/get`एक अन्य प्रतिकृति को निर्देशित रिकॉर्ड को पुनर्प्राप्त नहीं कर सकता है। हैंडल वापस करने से पहले दृढ़ता से, फिर किरायेदार और प्रधान जांच के तहत प्रत्येक कार्य विधि को एक ही साझा रिकॉर्ड को हल करने के लिए बनाएँ।

## क्षमता पर बातचीत

ग्राहक प्रत्येक पात्र अनुरोध पर समर्थन का विज्ञापन करता हैः

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {}
      }
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "lesson-client",
      "version": "1.0.0"
    }
  }
}
```

सर्वर सटीकता वापस करता है `supportedVersions`, क्षमताओं, `ttlMs`और `cacheScope`से`server/discover`यह उपकरण का विज्ञापन करता है, इसलिए यह अनिवार्य भी लागू करता है।`tools/list`. . यह परिणाम एक निर्धारक लौटाता है `generate_report`वर्णक, वैध वस्तु `inputSchema`,`resultType: "complete"`, सर्वर पहचान मेटाडेटा, और सार्वजनिक कैश संकेत.

एक क्लाइंट से कार्य विधि जो विस्तार रिटर्न नहीं घोषित की `-32021`, ग्राहक क्षमता की कमी, साथ `data.requiredCapabilities` पर सेट किया गया`{"extensions":{"io.modelcontextprotocol/tasks":{}}}`. एक असमर्थित प्रोटोकॉल स्ट्रिंग रिटर्न`-32022`सटीक रूप से`supported`और `requested`डेटा; एक गायब या गैर स्ट्रिंग संस्करण रिटर्न `-32602`. .

JSON-RPC के बिना एक लिफाफा `id`एक सूचना है. रिसीवर इसे संसाधित कर सकता है, लेकिन यह कोई JSON-RPC परिणाम या त्रुटि नहीं देता है. एक स्ट्रीम करने योग्य HTTP एडाप्टर रिटर्न करता है `202 Accepted`स्वीकार किए गए अधिसूचना के लिए कोई निकाय नहीं है।

वर्तमान में, केवल `tools/call`कार्य-वर्धित निष्पादन का समर्थन करता है. अपने आंतरिक अमूर्त डिजाइन ताकि भविष्य के अनुरोध प्रकार भंडारण को फिर से लिखने की आवश्यकता नहीं है.

## सर्वर-निर्देशित कार्य सृजन

पुराने ग्राहक ध्वज `params._meta.task.required`क्लाइंट विस्तार समर्थन की घोषणा करता है, तो सर्वर तय करता है कि क्या एक विशेष `tools/call`एक कार्य बन जाता है।

अनुरोधः

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {"size": "large"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

उत्तरः

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Preparing report outline.",
    "createdAt": "2026-08-21T10:30:00Z",
    "lastUpdatedAt": "2026-08-21T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 1000
  }
}
```

सर्वर को यह हैंडल तब तक नहीं लौटाया जाना चाहिए जब तक कि `tasks/get`एक अंततः सुसंगत स्टोर में, जवाब देने से पहले पढ़ने की दृश्यता का इंतजार करें। अन्यथा एक क्लाइंट को एक वैध दिखने वाली आईडी प्राप्त हो सकती है और तुरंत "नहीं मिला" हो सकता है।

एक कार्य प्रतिक्रिया इस अर्थ में अवांछित है कि ग्राहक कार्य मोड का अनुरोध नहीं करता है। यह अवांछित नहीं हैः वर्तमान अनुरोध को अभी भी विस्तार का विज्ञापन करना चाहिए।

## कार्य का रूप

प्रत्येक कार्य में निम्नलिखित शामिल हैंः

- `taskId`: स्थिर सर्वर-जनित पहचानकर्ता;
- `status``working`,`input_required`,`completed`,`cancelled`या `failed`.
- `createdAt`और `lastUpdatedAt`: आईएसओ 8601 समयशीर्षक;
- `ttlMs`: निर्माण से समाप्ति अवधि, या `null`विज्ञापनित सीमा के लिए नहीं;
- वैकल्पिक `pollIntervalMs`: सर्वर की वर्तमान न्यूनतम सुझावित मतदान कैडेन्स;
- वैकल्पिक `statusMessage`: उपयोगकर्ता या मॉडल के संदर्भ में।

स्थिति-विशिष्ट फ़ील्ड केवल तभी दिखाई देते हैं जब यह प्रासंगिक होः

- `input_required`शामिल है `inputRequests`. .
- `completed`मूल अनुरोध की जानकारी शामिल है `result`आकार।
- `failed`एक JSON-RPC शामिल `error`वस्तु।

ग्राहक को सम्मान करना चाहिए`pollIntervalMs`. सर्वर अधिक आक्रामक सर्वेक्षणों की दर-सीमा सीमित कर सकता है और कार्य जीवनकाल के दौरान अंतराल बदल सकता है।

## `tasks/get`

ग्राहक वर्तमान स्नैपशॉट के लिए पूछता हैः

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/get
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

`tasks/get`स्वयं पूर्ण हो गया है, इसलिए इसका परिणाम हमेशा होता है `resultType: "complete"`. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .`status: "working"`या `status: "input_required"`. .

यह अंतर एक आम पार्सर बग को रोकता हैः

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

कोई नहीं है`tasks/result`जब कार्य पूरा हो जाता है, अगले `tasks/get`प्रतिक्रिया मूल में समाहित है `CallToolResult``result`:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "completed",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:34:12Z",
  "ttlMs": 900000,
  "result": {
    "resultType": "complete",
    "content": [
      {"type": "text", "text": "Generated large report with approved outline."}
    ],
    "structuredContent": {"size": "large", "approved": true},
    "isError": false,
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "tasks-demo",
        "version": "1.0.0"
      }
    }
  },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "tasks-demo",
      "version": "1.0.0"
    }
  }
}
```

बाहरी `resultType`कहते हैं `tasks/get`आरपीसी पूरा हुआ।`result.resultType`कहा जाता है कि मूल उपकरण कॉल पूरा किया गया है. उस घोंसले भेदभाव की आवश्यकता है. घोंसले`CallToolResult`अपने स्वयं के भी ले जाना चाहिए `io.modelcontextprotocol/serverInfo`इस पाठ में इसे एक अनटाइप किए गए उपयोगिता लोड को संग्रहीत करने के बजाय शामिल किया गया है।

कोई नहीं है`tasks/list`. सत्र रहित सर्वर सुरक्षित रूप से यह अनुमान नहीं लगा सकते कि कनेक्शन-स्कोप की सूची में कौन से कार्य शामिल हैं. इतिहास की आवश्यकता वाले अनुप्रयोगों को स्पष्ट फ़िल्टर और स्वामित्व नियमों के साथ एक अधिकृत डोमेन टूल का खुलासा करना चाहिए।

## कार्य निष्पादन के दौरान इनपुट

कार्य इनपुट और कोर एमआरटीआर समान दिखते हैं लेकिन विभिन्न निरंतरताओं का उपयोग करते हैं।

### कार्य सृजन से पहले आवश्यक इनपुट

रिटर्न कोर `resultType: "input_required"`मूल से `tools/call`ग्राहक इसे पूरा करता है और उस मूल कॉल को पुनः प्रयास करता है. केवल उन समवर्ती MRTR राउंड समाप्त होने के बाद कार्य को बनाएँ.

### कार्य सृजन के बाद आवश्यक इनपुट

`input_required`. .`tasks/get`उल्लेखनीय को उजागर करता है `inputRequests`, और ग्राहक प्रतिक्रिया भेजता है के माध्यम से `tasks/update`ग्राहक मूल को पुनः प्रयास नहीं करता है`tools/call`. .

स्नैपशॉट:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "input_required",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:31:00Z",
  "ttlMs": 900000,
  "inputRequests": {
    "approve_outline": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Approve the generated report outline?",
        "requestedSchema": {
          "type": "object",
          "properties": {"approved": {"type": "boolean"}},
          "required": ["approved"]
        }
      }
    }
  }
}
```

अद्यतनः

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/update
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_outline": {
        "action": "accept",
        "content": {"approved": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

सफलता प्रतिक्रिया एक खाली मान्यता है प्लस `resultType: "complete"`राज्य परिवर्तन अंततः सुसंगत हो सकता है, इसलिए ग्राहक मतदान या सुनने के लिए जारी है।

प्रत्येक `inputRequests`कुंजी पूरे कार्य जीवनकाल के लिए अद्वितीय होना चाहिए। दोहराया `tasks/get`स्नैपशॉट एक ही अपूर्ण कुंजी दिखा सकते हैं; क्लाइंट UI को डुप्लिकेट करते हैं और सर्वर अज्ञात, प्रतिस्थापित या पहले से ही पूरा कुंजी के लिए प्रतिक्रियाओं को अनदेखा करते हैं। आंशिक अद्यतन कार्य को छोड़ सकता है `input_required`जब तक सभी आवश्यक कुंजी उत्तर नहीं दिया जाता।

## रद्द करना सहकारी है

`tasks/cancel`कार्य को पहले समाप्त कर सकता है, रद्द या बाद में संक्रमण की अनदेखी कर सकता है।

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/cancel
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/cancel",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

तीनों कार्य पद्धतियों के लिए,`Mcp-Name`दर्पण `params.taskId`. यह JSON-RPC विधि का नाम दोहराता नहीं है। `code/main.py`इस नियम को केंद्रीकृत करता है `make_http_request`. .

पाठ कार्यकर्ता तुरंत रद्द करने का सम्मान करता है, दोहराए गए कॉल को अक्षम करता है। एक उत्पादन ग्राहक को अभी भी पुष्टि से अंतिम कार्य स्थिति का अनुमान लगाने के बजाय रद्द करने को सहकारी माना जाना चाहिए।

उपयोग न करें`notifications/cancelled`यह सूचना रद्द करने के अनुरोध से संबंधित है, स्थायी कार्य नहीं।

अंतर रूटिंग सीमा पर मायने रखता है। अनुरोध रद्द करने का लक्ष्य एक उड़ान में JSON-RPC ऑपरेशन या इसकी अनुरोध-स्कोप HTTP प्रतिक्रिया है।`tools/call`पहले से ही वापस आ गया है `resultType: "task"`, यह अनुरोध पूरा हो गया है और इसके परिवहन को बंद करने से स्थायी नौकरी का नाम या रोक नहीं सकता है। `tasks/cancel`यह एक नया अधिकृत आरपीसी है।`params.taskId`, आईडी में दर्पण है कि `Mcp-Name`, कार्य के मालिक बैक-एंड को हल करता है, सहकारी रद्द करने के इरादे को रिकॉर्ड करता है, और बिना दावा किए श्रमिक को रोक दिया गया है की पुष्टि देता है।

एक गेटवे को अनुरोध समन्वयकों और कार्य मार्गों को विभिन्न तालिकाओं में रखना चाहिए। प्रतिक्रिया समाप्त होने पर अनुरोध तालिका गायब हो सकती है। कार्य मार्ग को टर्मिनल स्थिति और प्रतिधारण समाप्त होने तक जीवित रहना चाहिए। [Lesson 29: MCP Reliability, Cancellation, and Flow Control](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md)दौड़, समय-समय, असमर्थता, प्रतिकूल दबाव और दोनों मार्गों के लिए नियम फिर से बनाने के लिए।

## वैकल्पिक सूचनाएं

मतदान आधार रेखा है. एक ग्राहक जो पुश अद्यतन चाहता है भेजता है`subscriptions/listen`कार्य आईडी के साथ। Streamable HTTP के लिए, यह एक POST है जिसका जवाब एक अनुरोध-स्कोप एसएसई धारा है। जीवित रखने के लिए कोई स्टैंडअलोन GET घटना धारा और कोई प्रोटोकॉल सत्र नहीं है।

सर्वर स्वीकार आईडी को स्वीकार करता है `notifications/subscriptions/acknowledged`और फिर भेज सकते हैं पूर्ण स्नैपशॉट के माध्यम से `notifications/tasks`. प्रमाणीकरण और प्रत्येक कार्य सूचना के साथ`io.modelcontextprotocol/subscriptionId`में `_meta`, बराबर `subscriptions/listen`अनुरोध आईडी. प्रत्येक कार्य सूचना अन्यथा क्या के बराबर है `tasks/get`उस पल में वापस आ जाएगा।

ग्राहकों को अभी भी कार्य विस्तार घोषित करना होगा. उन्हें घटना पुनरावृत्ति या घटना पर निर्भर करने के बजाय टिकाऊ कार्य आईडी से फिर से कनेक्ट और फिर से शुरू करना चाहिए`Last-Event-ID`. .

## असफलता सेमेटिक

दो त्रुटि परतों का सही उपयोग करें।

### प्रोटोकॉल त्रुटि

अमान्य विधि पैरामीटर या अज्ञात कार्य आईडी JSON-RPC त्रुटि वापस, आम तौर पर `-32602`. विस्तार समर्थन रिटर्न गायब `-32021`आवश्यक क्षमता वस्तु के साथ।

### कार्य निष्पादन परिणाम

-  के साथ एक सामान्य उपकरण परिणाम`isError: true`अभी भी एक `completed`कार्य क्योंकि उपकरण कॉल ने इसका परिभाषित परिणाम दिया।
- स्थगित निष्पादन के दौरान एक JSON-RPC त्रुटि कार्य करता है `failed`और यह JSON-RPC त्रुटि को संग्रहीत करता है `error`. .
- उपयोगकर्ता अस्वीकार कर सकता है`cancelled`, एक पूरा अस्वीकार परिणाम, या किसी अन्य डोमेन विशिष्ट सुरक्षित परिणाम. विकल्प दस्तावेज.

## स्थायित्व, समाप्ति और स्वामित्व

कम से कम कार्य आईडी, स्थिति, समय टिकट, ttl, सर्वेक्षण अंतराल, मूल ऑपरेशन स्वामित्व, परिणाम या त्रुटि, अप्रासंगिक इनपुट अनुरोध, और सभी जारी इनपुट कुंजी को बरकरार रखें।

भंडारण कुंजी में एक प्रामाणिक किरायेदार और प्रधान को शामिल करना चाहिए या हल करना चाहिए। एक कार्य आईडी को जानने से पहुंच नहीं होनी चाहिए। प्रत्येक पर स्वामित्व की जांच करें `tasks/get`,`tasks/update`,`tasks/cancel`, और सदस्यता।

`ttlMs`एक क्लाइंट इसे बैकस्टॉप के रूप में व्यवहार कर सकता है जब कोई कार्य अवलोकन योग्य अपडेट उत्पन्न करना बंद कर देता है। एक सर्वर विफल हो सकता है और बाद में समाप्त हो चुके कार्य को हटा सकता है। इसे पूरा होने के बाद कई मिलीसेकंड के लिए पूरा परिणाम बनाए रखने के लिए एक वादा के रूप में वर्णित न करें।

परमाणु लिखता है या लेनदेन का उपयोग करें। पाठ एक अस्थायी फ़ाइल लिखता है और परमाणु रूप से इसे नाम बदलता है। एक बहु-प्रतिलिपि सेवा एक साझा टिकाऊ स्टोर और एक कार्यकर्ता पट्टे या समकक्ष समवर्ती नियंत्रण का उपयोग करना चाहिए।

```figure
tp-task-lifecycle
```

## इसे बनाओ

`code/main.py`एक निर्धारक कार्य सेवा को लागू करता हैः

- `server/discover`रिटर्न `supportedVersions`, कैश संकेत, और कार्य विस्तार.
- `tools/list`एक निर्धारक, कैश करने योग्य लौटाता है `generate_report`एक मान्य इनपुट योजना के साथ वर्णक।
- `tools/call`लौटने से पहले कार्य बनाता है और जारी रखता है `resultType: "task"`. .
- एक नया सेवा उदाहरण उसी कार्य को पुनः लोड करता है, पुनः आरंभ वसूली का प्रदर्शन करता है।
- `tasks/get`पूर्ण कार्य स्नैपशॉट लौटाता है।
- कार्यकर्ता से स्थानांतरित होता है `working``input_required`. .
- `tasks/update`फॉर्म उत्तर स्वीकार करता है और एक खाली पूर्ण पुष्टि देता है।
- मजदूर एक घोंसले को स्टोर करता है `CallToolResult`अपने स्वयं के साथ `resultType`और सर्वर पहचान, फिर संक्रमण करने के लिए `completed`. .
- `tasks/cancel`इस कार्यान्वयन में असमर्थ है।
- HTTP बिल्डर सेट `Mcp-Name``params.taskId`के लिए`tasks/get`,`tasks/update`और `tasks/cancel`. .
- सूचना सहायता प्रदाता `notifications/subscriptions/acknowledged`और `notifications/tasks`, दोनों को सुनने के अनुरोध आईडी के साथ टैग किया गया है।
- आईडी-कम सूचनाओं में JSON-RPC प्रतिक्रिया नहीं होती है।

कार्यकर्ता पृष्ठभूमि के धागे में सोने के बजाय स्पष्ट रूप से आगे बढ़ता है। यह प्रत्येक राज्य संक्रमण निर्धारक बनाता है और प्रोटोकॉल उदाहरण को कतार यांत्रिकी से अलग रखता है।

## इसका प्रयोग करें

भंडारण मूल सेः

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

अपेक्षित परिणाम अनुक्रमः

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

यह भी सत्यापित करें कि `tasks/status`,`tasks/result`और `tasks/list`आधुनिक सेवा में नहीं मिला वापसी विधि।
यह सत्यापित करें `tools/list`निर्धारक है और प्रत्येक वर्तमान HTTP कार्य विधि के माध्यम से अपनी कार्य आईडी को दर्शाता है `Mcp-Name`. .

## इसे भेजें

`outputs/skill-task-store-designer.md`अब विस्तार-जागरूक डिजाइन का उत्पादन करता हैः क्षमता बातचीत, टिकाऊ-पूर्व-वापसी निर्माण, वर्तमान विधियां, इनपुट अद्यतन प्रवाह, स्वामित्व, समाप्ति, रद्द, सदस्यता, और हटाए गए प्रयोगात्मक विधियों से प्रवास।

## व्यायाम

1. एक दूसरा अपूर्व इनपुट कुंजी जोड़ें. एक आंशिक भेजें `tasks/update`और साबित करें कि कार्य शेष है `input_required`जब तक दोनों कुंजी उत्तर नहीं दिया जाता।
2. दुकान में किरायेदार स्वामित्व जोड़ें और गलत प्रमाणित प्रधान द्वारा प्रस्तुत एक मान्य कार्य आईडी को अस्वीकार करें।
3. एक कर्मचारी पट्टे की समाप्ति के साथ जोड़ें। यह प्रदर्शित करें कि दो सेवा प्रदाताओं को एक ही कार्य को एक साथ पूरा नहीं किया जा सकता है।
4.  के लिए एक POST- प्रतिक्रिया SSE एडाप्टर को लागू करें`subscriptions/listen`. GET जोड़ना नहीं, `Last-Event-ID`, या सत्र के हेडर.
5. समाप्ति सफाई जोड़ें. एक समाप्ति कार्य को गलत कार्य आईडी से अलग करें, बिना क्रॉस-रिटायेंट अस्तित्व लीक किए।

## प्रमुख शर्तें

| Term | Meaning in the current extension |
|------|----------------------------------|
| Tasks extension | Optional `io.modelcontextprotocol/tasks` capability for durable async work |
| `CreateTaskResult` | Server-directed `resultType: "task"` response to an eligible request |
| `tasks/get` | Poll a full current task snapshot, including terminal result or pending input |
| `tasks/update` | Submit responses to a task's outstanding `inputRequests` |
| `tasks/cancel` | Acknowledge cooperative cancellation intent |
| `input_required` | Task status indicating client input is outstanding |
| `pollIntervalMs` | Server-suggested minimum delay before another poll |
| `ttlMs` | Expiry duration measured from task creation |
| Durable-before-return | Rule that the task id must resolve before its handle is sent |
| `notifications/tasks` | Optional full task snapshot delivered on a subscribed SSE response |

## विरासत संगतता

2025-11-25 प्रयोगात्मक सतह में ग्राहक द्वारा अनुरोधित कार्य वृद्धि का उपयोग किया गया,`tasks/status`,`tasks/result`, और वैकल्पिक `tasks/list`. उन नामों को केवल एक चिपका हुआ विरासत एडाप्टर के अंदर रखें. एक वर्तमान क्लाइंट विस्तार क्षमता का उपयोग करता है, सर्वर-निर्देशित हैंडल स्वीकार करता है, चुनाव `tasks/get`, आपूर्ति इनपुट के साथ `tasks/update`, और कार्य स्नैपशॉट से अंतिम परिणाम पढ़ता है.

## आगे पढ़ना

- [Official MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
