# चैटबॉट  नियम आधारित से न्यूरल तक LLM एजेंट

> एलिजा ने पैटर्न मैचों के साथ जवाब दिया। डायलॉगफ्लो ने इरादों का नक्शा बनाया। जीपीटी ने वजन से जवाब दिया। क्लाउड उपकरण चलाता है और सत्यापित करता है। प्रत्येक युग ने पिछले एक की सबसे बड़ी विफलता को हल किया।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## समस्या

एक उपयोगकर्ता कहता है "मैं अपनी उड़ान बदलना चाहता हूं।" सिस्टम को यह पता लगाना होगा कि वे क्या चाहते हैं, क्या जानकारी गायब है, इसे कैसे प्राप्त करें, और कार्रवाई को कैसे पूरा करें। फिर उपयोगकर्ता कहता है "उठ, क्या होगा अगर मैं इसके बजाय रद्द कर दूं? " और सिस्टम को संदर्भ को याद रखना होगा, कार्यों को स्विच करना होगा, और स्थिति को संरक्षित करना होगा।

एक एमएल सिस्टम के लिए बातचीत मुश्किल है। इनपुट खुला-सीमा है। आउटपुट को कई मोड़ों पर सुसंगत होना चाहिए। सिस्टम को दुनिया पर कार्रवाई करने की आवश्यकता हो सकती है (फ्लाइट बदलें, कार्ड चार्ज करें) । प्रत्येक गलत कदम उपयोगकर्ता के लिए दिखाई देता है।

चैटबॉट आर्किटेक्चर चार परिकल्पनाओं के माध्यम से चक्रित हुए हैं, प्रत्येक की शुरुआत इसलिए की गई क्योंकि पिछली एक बहुत ही दृश्यमान रूप से विफल रही। यह सबक उन्हें क्रम में चलाता है। 2026 उत्पादन परिदृश्य पिछले दो का एक संकर है।

## अवधारणा

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### 1950 से 2001 तक की कहानी

पहला पैराडिग्म पांच साल तक नहीं चला। यह पचास साल तक चला। इसका आर्क जानना महत्वपूर्ण है क्योंकि इसमें प्रत्येक प्रणाली एक ही मशीन है  मैच इनपुट, एक डिब्बाबंद प्रतिक्रिया जारी करें, थोड़ा राज्य  अपडेट करें और उस मशीन में नियम जोड़ने के पचास साल से सामान्य मामला कभी नहीं आया। उस छत से ही पैराडिगम्स दो से चार मौजूद हैं।

**1950.**ट्यूरिंग एक परिचालन प्रतिस्थापन का प्रस्ताव देकर "क्या मशीनें सोच सकती हैं? " से बचता हैः यदि एक पूछताछकर्ता टेलीटाइप के माध्यम से मशीन को किसी व्यक्ति से नहीं बता सकता है, तो दार्शनिक प्रश्न विवादास्पद है। क्षेत्र का नाम होने से पहले बातचीत क्षेत्र का बेंचमार्क बन जाती है।

**1956.**नाम डार्टमाउथ में एक ग्रीष्मकालीन कार्यशाला में आता है "कृत्रिम बुद्धिमत्ता" पर सिक्के इस पर अटकल है कि बुद्धिमत्ता की हर विशेषता "प्रधानतः इतनी सटीक रूप से वर्णित की जा सकती है कि इसे सिमुलेट करने के लिए एक मशीन बनाई जा सकती है।" प्रस्ताव में दो महीने के बजट के लिए पर्याप्त प्रगति की उम्मीद है।

**1966.**ELIZA एक कदम में आप बनाने के लिए परिकल्पना चाल भेजता हैः विघटन नियम इनपुट से टुकड़े खींचते हैं, फिर से इकट्ठा करने के नियमों उन्हें प्रश्न के रूप में वापस करते हैं। लगभग 200 पैटर्न कुल, शून्य स्थिति, शून्य समझ  और उपयोगकर्ताओं ने वैसे भी इसमें विश्वास किया। वीज़ेनबाम अपने शेष करियर को इस बात से चिंतित कर बिताया कि यह कितना कम मशीनरी लेता है।

**1972.**स्टैनफोर्ड में बनाया गया पैरी, जो कि पारानोआ का मॉडल है, वह यह भी जोड़ता है कि एलिजा की क्या कमी थीः आंतरिक स्थिति। भय, क्रोध और अविश्वास के लिए संख्यात्मक चर प्रत्येक मोड़ और गेट पर अपडेट होते हैं जो अगले स्क्रिप्ट को चलाता है, इसलिए समान इनपुट अब तक की बातचीत के आधार पर अलग-अलग प्रतिक्रियाएं उत्पन्न करते हैं। एक अंधेरे ट्रांसक्रिप्ट परीक्षण में, मनोचिकित्सकों ने PARRY को मानव रोगियों से अलग किया। यह व्यक्ति कंडीशनिंग का प्रत्यक्ष पूर्वज है  एक प्रणाली शीघ्र तीन फ्लोट के रूप में लागू किया गया। उसी वर्ष, दोनों बॉट ARPANET पर एक दूसरे की ओर इशारा किए गए थे: एक चिकित्सक स्क्रिप्ट जो एक paranoia state machine से साक्षात्कार कर रहा था, एक नेटवर्क पर पहली बॉट-टू-बॉट बातचीत।

**1995.**एलिस पैटर्न-टेम्पलेट जोड़े के लिए एक एक्सएमएल बोली एआईएमएल के साथ एलिज़ा नुस्खा को स्केल करता है। लगभग 40,000 हस्तलिखित श्रेणियां, तीन लोबनर पुरस्कार जीतता है। इसने नियम आधारित प्रणालियों के स्केल कानून को साबित कियाः अधिक नियम कवरेज खरीदते हैं, कभी सामान्यता नहीं। हर नियम एक दायित्व है जिसे किसी को बनाए रखना चाहिए।

**2001.**स्मार्टचild 30 मिलियन इंस्टेंट मैसेजिंग उपयोगकर्ताओं के सामने नुस्खा रखता है और बैकेंड लुकअप जोड़ता है  मौसम, स्टॉक, फिल्म समय  टेम्पलेट में spliced। स्क्विंट और यह 2001 पोशाक पहनने के लिए कॉल करने का उपकरण हैः इरादे का विश्लेषण करें, सेवा पर कॉल करें, परिणाम को उत्तर में प्रस्तुत करें।

पचास साल, एक तंत्र, बढ़ते नियम गिनती. यह प्रतिमान समाप्त नहीं क्योंकि किसी ने इसे खारिज किया लेकिन क्योंकि हाथ से लिखे राज्य मशीनों के रखरखाव लागत कवर के साथ रैखिक रूप से बढ़ता है जबकि उपयोगकर्ता अपेक्षाएं पिछले सप्ताह जो कुछ भी देखा है उसके साथ बढ़ती हैं।

```figure
chatbot-lineage
```

**Rule-based (ELIZA, AIML, DialogFlow).**हाथ से लिखे गए पैटर्न उपयोगकर्ता के इनपुट से मेल खाते हैं और प्रतिक्रियाएं उत्पन्न करते हैं। इरादे वर्गीकरण पूर्वनिर्धारित प्रवाहों के लिए मार्ग। स्लॉट भरने वाली राज्य मशीनें आवश्यक जानकारी एकत्र करती हैं। यह संकीर्ण दायरे के भीतर शानदार ढंग से काम करती है जिसके लिए इसे डिज़ाइन किया गया था। इसके तुरंत बाहर विफल होता है। अभी भी सुरक्षा-महत्वपूर्ण डोमेन (बैंकिंग प्रमाणीकरण, एयरलाइन बुकिंग) में जहाज जहां भ्रामकता सहन नहीं की जाती है।

**Retrieval-based.**एक FAQ-style system. प्रत्येक जोड़ी (उक्ति, प्रतिक्रिया) को एन्कोड करें। रनटाइम पर, उपयोगकर्ता के संदेश को एन्कोड करें और निकटतम संग्रहीत प्रतिक्रिया प्राप्त करें। ज़ेडस्क की क्लासिक "समान लेख" सुविधा सोचें। नियम से बेहतर पैराफ्रेसेस संभालता है। कोई पीढ़ी नहीं, इसलिए कोई भ्रम नहीं।

**Neural (seq2seq).**एन्कोडर-डेकोडर वार्तालाप लॉग पर प्रशिक्षित है। खरोंच से प्रतिक्रिया उत्पन्न करता है। सामान्य आउटपुट ("मुझे नहीं पता") और तथ्यात्मक बहाव के लिए तरल लेकिन प्रवण। विषय पर कभी भी विश्वसनीय नहीं। कारण Google, फेसबुक और माइक्रोसॉफ्ट के पास 2016-2019 में सभी निराशाजनक चैटबॉट थे।

**LLM agents.**एक भाषा मॉडल एक लूप में लपेटा हुआ है जो योजना, उपकरण कॉल करता है, और परिणामों की पुष्टि करता है। एक लंबे प्रॉम्प्ट के साथ एक चैटबॉट नहीं। एक एजेंट लूपः योजना → कॉल टूल → परिणाम का निरीक्षण करें → अगला कदम तय करें। पुनर्प्राप्ति-पहले ग्राउंडिंग (RAG) इसे भ्रामक होने से रोकता है। उपकरण कॉल इसे वास्तव में चीजें करने देते हैं। यह 2026 वास्तुकला है।

चार प्रतिमान अनुक्रमिक प्रतिस्थापन नहीं हैं। एक 2026 उत्पादन चैटबॉट सभी चार मार्गों के माध्यम से चलता हैः प्रमाणीकरण और विनाशकारी कार्यों के लिए नियम आधारित, FAQ के लिए पुनर्प्राप्ति, प्राकृतिक वाक्यांश के लिए तंत्रिका पीढ़ी, अस्पष्ट खुले प्रश्नों के लिए एलएलएम एजेंट।

## इसे बनाओ

### चरण 1: नियम आधारित पैटर्न मिलान

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

20 पंक्तियों में ELIZA। चिंतन चाल ("मैं दुखी महसूस करता हूं" → "आप दुखी क्यों महसूस करते हैं") 1966 के वेइज़ेनबाम के एक धार्मिक मनोचिकित्सक डेमो है। अभी भी शिक्षाप्रद है।

### चरण 2: प्राप्ति आधारित (FAQ)

इस चित्रात्मक स्निपेट की आवश्यकता होती है`pip install sentence-transformers`(जो मशाल खींचता है) चलना योग्य`code/main.py`इस सबक के लिए एक stdlib जैकार्ड समानता का उपयोग करता है इसके बजाय, इसलिए सबक बाहरी निर्भरता के बिना चलाता है।

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

यदि सबसे अच्छा मैच पर्याप्त करीब नहीं है, तो वापस `None`और सिस्टम को बढ़ते रहने दें।

### चरण 3: तंत्रिका पीढ़ी (आधार रेखा)

एक छोटे से निर्देश-ट्यून एन्कोडर-डेकोडर (FLAN-T5) या एक ठीक-ट्यून वार्तालाप मॉडल का उपयोग करें। उत्पादन- 2026 में अपने आप में उपयोग नहीं किया जा सकता (विपरीतता, विषय से बाहर बहाव, तथ्यगत बकवास), लेकिन प्राकृतिक वाक्यांश के लिए हाइब्रिड प्रणालियों के अंदर जहाज। डायलॉगपीटी शैली के केवल डिकोडर मॉडल को एक सुसंगत उत्तर उत्पन्न करने के लिए स्पष्ट मोड़ विभाजक और ईओएस हैंडल की आवश्यकता होती है; एक शिक्षण उदाहरण के लिए एक फ्लैन-टी 5 टेक्स्ट2 टेक्स्ट पाइपलाइन बॉक्स से बाहर काम करती है।

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### चरण 4: एलएलएम एजेंट लूप

2026 उत्पादन की आकृतिः

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

तीन बातें नाम करने के लिए। उपकरण कॉल करने योग्य कार्य हैं जो LLM का आह्वान कर सकते हैं। लूप समाप्त होता है जब LLM एक उपकरण कॉल के बजाय एक अंतिम उत्तर देता है। चरण बजट अस्पष्ट कार्यों पर अंतहीन लूपों को रोकता है।

वास्तविक उत्पादन जोड़ता हैः पुनर्प्राप्ति-पहले जमीनीकरण (प्रत्येक एलएलएम कॉल से पहले प्रासंगिक डॉक्स इंजेक्ट करें), गार्डरेल्स (पहली पुष्टि के बिना विनाशकारी कार्यों को अस्वीकार करें), अवलोकन (प्रत्येक चरण को लॉग करें), और मूल्यांकन (स्वचालित जांचें कि एजेंट व्यवहार विशिष्टता पर रहता है) ।

### चरण 5: हाइब्रिड रूटिंग

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

पैटर्नः विनाशकारी कुछ भी के लिए निर्धारक नियम, डिब्बाबंद FAQs के लिए पुनर्प्राप्ति, एलएलएम एजेंटों के लिए सब कुछ और. यह है कि 2026 में जहाज ग्राहक सहायता प्रणाली।

## इसका प्रयोग करें

2026 स्टैकः

| Use case | Architecture |
|---------|---------------|
| Booking, payment, authentication | Rule-based state machines + slot filling |
| Customer support FAQs | Retrieval over curated answers |
| Open-ended help chat | LLM agent with RAG + tool calls |
| Internal tools / IDE assistants | LLM agent with tool calls (search, read, write) |
| Companion / character chatbots | Tuned LLM with persona system prompt, retrieval on knowledge |

हमेशा उत्पादन में हाइब्रिड रूटिंग का उपयोग करें। कोई भी वास्तुकला हर अनुरोध को अच्छी तरह से संभालती नहीं है। रूटिंग परत स्वयं आमतौर पर एक छोटा इरादा वर्गीकरण है।

## विफलता मोड जो अभी भी जहाज

- **Confident fabrication.**एमएलएम एजेंट का दावा है कि उसने एक कार्रवाई पूरी की है जिसे उसने नहीं किया था। मिटावः परिणामों की जांच करें, लॉग टूल कॉल करें, एमएलएम को सफल टूल रिटर्न के बिना कुछ करने का दावा करने की अनुमति न दें।
- **Prompt injection.**उपयोगकर्ता पाठ डालेगा जो सिस्टम प्रॉम्प्ट को ओवरराइड करता है। LLM01 को LLM अनुप्रयोगों के लिए OWASP शीर्ष 10 में रखा गया है 2025. दो स्वादः प्रत्यक्ष इंजेक्शन (चैट में पेस्ट किया गया) और अप्रत्यक्ष इंजेक्शन (दस्तावेजों, ईमेल या उपकरण आउटपुट में छिपा हुआ एजेंट पढ़ता है) ।

  हमले की दरें परिदृश्य के अनुसार भिन्न होती हैं। सामान्य उपकरण उपयोग और कोडिंग बेंचमार्क में सीमा मॉडल के बीच मापा गया सफलता दर ~0.5-8.5% है। विशिष्ट उच्च जोखिम सेटअप (एआई कोडिंग एजेंटों के खिलाफ अनुकूलन हमले, कमजोर ऑर्केस्ट्रेशन) ~ 84% तक पहुंच गए हैं। उत्पादन सीवीई में इकोलीक (सीवीई-2025-32711, सीवीएसएस 9.3)  शामिल है Microsoft 365 कॉपिलॉट में शून्य-क्लिक डेटा-एक्सफिल्ट्रेशन त्रुटि हमलावर-नियंत्रित ईमेल द्वारा ट्रिगर की गई।

  कम करने के लिएः उपयोगकर्ता इनपुट को पूरे लूप में अविश्वसनीय माना जाए; टूल कॉल से पहले सैनिटाइज करें; मुख्य प्रॉम्प्ट से टूल आउटपुट को अलग करें; प्लान-वेरिफाय-एक्ज्यूट (पीवीई) पैटर्न का उपयोग करें जहां एजेंट पहले योजना बनाता है, फिर निष्पादन से पहले उस योजना के खिलाफ प्रत्येक कार्रवाई का सत्यापन करता है (यह नए अप्रत्याशित कार्यों के इंजेक्शन से टूल परिणामों को रोकता है); विनाशकारी कार्यों के लिए उपयोगकर्ता की पुष्टि की आवश्यकता होती है; टूल स्कोप पर न्यूनतम विशेषाधिकार लागू करें।

  किसी भी मात्रा में शीघ्र इंजीनियरिंग इस जोखिम को पूरी तरह से समाप्त नहीं करती है। बाहरी रनटाइम रक्षा परतों (एलएलएम गार्ड, अनुमतियों की सत्यापन, अर्थहीनता का पता लगाने) की आवश्यकता होती है।
- **Scope creep.**एजेंट कार्य से बाहर जाता है क्योंकि एक उपकरण कॉल स्पर्शात्मक रूप से संबंधित जानकारी लौटाता है। मिटावः संकीर्ण उपकरण अनुबंध; सिस्टम को तुरंत केंद्रित रखें; कार्य से बाहर दर के लिए मूल्यांकन जोड़ें।
- **Infinite loops.**एजेंट एक ही उपकरण को कॉल करता रहता है।
- **Context window exhaustion.**लंबी बातचीत सबसे पहले के टर्न को संदर्भ से बाहर धकेलती है। मिट्यागः पुराने टर्न का सारांश दें, समानता के आधार पर प्रासंगिक पिछले टर्न को पुनर्प्राप्त करें, या लंबे संदर्भ मॉडल का उपयोग करें।

## इसे भेजें

`outputs/skill-chatbot-architect.md`:

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

## व्यायाम

1. **Easy.**एक कॉफी शॉप आदेश बॉट के लिए 10 पैटर्न के साथ ऊपर नियम आधारित प्रतिक्रिया लागू करें. परीक्षण किनारे मामलेः डबल आदेश, संशोधन, रद्द, अस्पष्ट इरादा।
2. **Medium.**एक हाइब्रिड FAQ + LLM fallback का निर्माण करें। SaaS उत्पाद के लिए 50 डिब्बाबंद FAQ प्रविष्टियाँ, डॉक्स साइट पर पुनर्प्राप्त करने के साथ LLM fallback। 100 वास्तविक समर्थन सवालों पर अस्वीकार दर और सटीकता को मापें।
3. **Hard.**उपरोक्त एजेंट लूप को तीन टूल (खोज, पढ़ें-उपयोगकर्ता-डेटा, भेजें-ईमेल) के साथ लागू करें। शीघ्र इंजेक्शन प्रयासों सहित 50 परीक्षण परिदृश्यों के साथ एक मूल्यांकन चलाएं। आउट-टास्क दर, विफल कार्य दर और किसी भी इंजेक्शन सफलता की रिपोर्ट करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Intent | What the user wants | Categorical label (book_flight, reset_password). Routed to a handler. |
| Slot | A piece of info | Parameter the bot needs (date, destination). Slot filling is the sequence of asks. |
| RAG | Retrieval plus generation | Retrieve relevant docs, then ground the LLM's response. |
| Tool call | Function invocation | LLM emits a structured call with name + args. Runtime executes, returns result. |
| Agent loop | Plan, act, verify | Controller that runs LLM calls interleaved with tool calls until task complete. |
| Prompt injection | User attacks prompt | Malicious input that tries to override the system prompt. |

## आगे पढ़ना

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) पेपर जो बातचीत को क्षेत्र का बेंचमार्क बनाता है।
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) मूल नियम आधारित चैटबॉट पेपर।
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6)  PARRY की प्रभाव-विभेदक वास्तुकला, पहला राज्यपूर्ण चैटबॉट।
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239) गूगल के देर से तंत्रिका चैटबॉट पेपर, LLM एजेंटों के कब्जे से ठीक पहले।
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) कागज जो एजेंट लूप पैटर्न का नाम दिया।
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) 2024 उत्पादन की भविष्यवाणी जो अभी भी 2026 में है।
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) शीघ्र इंजेक्शन पेपर।
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) रैंकिंग जो शीघ्र इंजेक्शन को सुरक्षा की सबसे बड़ी चिंता बनाती है।
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) योजना-सत्यापन-कार्यवाही और उपयोगकर्ता-सत्यापन प्रवाह सहित व्यावहारिक संगठनात्मक-स्तर रक्षा।
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) अप्रत्यक्ष शीघ्र इंजेक्शन से शून्य-क्लिक डेटा-एक्सफिल्ट्रेशन सीवीई। लेखन-उपयोग एजेंटों को रनटाइम रक्षा की आवश्यकता क्यों है के लिए संदर्भ मामला।
