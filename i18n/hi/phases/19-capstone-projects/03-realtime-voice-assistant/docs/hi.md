# कैपस्टोन 03  रियल-टाइम वॉयस असिस्टेंट (एएसआर से एलएलएम से टीटीएस)

> एक आवाज एजेंट जो सही महसूस करता है, उसके पास 800ms से कम अंत-से-अंत विलंबता है, जानता है कि आपने कब बात करना बंद कर दिया है, बारगे-इन को संभालता है, और बिना रुके किसी उपकरण को कॉल कर सकता है। रिटेल, वापी, लाइवकिट एजेंट्स, और पिपेकेट सभी 2026 में इस बार में आए। वे इसे एक ही आकार के साथ करते हैंः एक स्ट्रीमिंग एएसआर, एक टर्न-डिटेक्टर, एक स्ट्रीमिंग एलएलएम, और एक स्ट्रीमिंग टीटीएस, सभी वेबआरटीसी के माध्यम से वायर्ड प्रत्येक कूद पर आक्रामक विलंबता बजट के साथ। एक का निर्माण, WER और MOS मापने और गलत कट-ऑफ दर, और पैकेट हानि के तहत इसे चलाएं.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client, scheduler scaffold)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:**P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## समस्या

2025-2026 के दौरान आवाज सबसे तेजी से बढ़ रही एआई यूएक्स श्रेणी रही है। तकनीकी छत हर तिमाही गिरती रही। ओपनएआई रीयलटाइम एपीआई, जेमिनी 2.5 लाइव, कार्टेशिया सोनिक-2, इलेवनलैब्स फ्लैश वी3, लाइवकिट एजेंट्स 1.0 और पिपेकेट 0.0.70 सभी ने सब 800ms के तहत पहला ऑडियो आउट आउट आउट पहुंच में रखा। बार अकेले विलंबता नहीं है। यह बातचीत का अनुभव हैः उपयोगकर्ता को काटने से बचना, काटने से बचना, वाक्य के बीच में एक व्यवधान से उबरना, ऑडियो को रोकने के बिना वार्तालाप के बीच में एक उपकरण को कॉल करना, चिड़चिड़ा मोबाइल नेटवर्क को जीवित रखना।

आप तीन REST कॉल को सिलाई करके वहां नहीं पहुंच सकते। वास्तुकला को अंत से अंत तक स्ट्रीमिंग पाइपलाइन किया जाता है। इसे बनाएं और विफलता मोड दिखाई देते हैंः पृष्ठभूमि टीवी पर फोन ऑडियो शूट के लिए ट्यून किया गया VAD, एक टर्न-डिटेक्टर जो कभी नहीं आता है, एक टीटीएस जो उत्सर्जन से पहले 400ms बफर करता है। शीर्ष पत्थर लोड के तहत एक समय में इन एक को ठीक करना है और विलंबता और गुणवत्ता रिपोर्ट प्रकाशित करना है।

## अवधारणा

पाइपलाइन में पांच स्ट्रीमिंग चरण हैंः**audio in**(ब्राउजर या पीएसटीएन से वेबआरटीसी), **ASR**(डीपग्राम नोवा-3 या तेज़-फुसफुसाहट से आंशिक प्रतिलेखन को स्ट्रीमिंग करना), **turn detection**(वीएडी प्लस एक छोटे मोड़-डिटेक्टर मॉडल जो पूर्ण संकेतों के लिए आंशिक प्रतिलेखन पढ़ता है), **LLM**(चक्र पूरा होने के तुरंत बाद टोकन स्ट्रीमिंग), **TTS**(पहले LLM टोकन के ~ 200ms के भीतर ऑडियो स्ट्रीमिंग) ।

तीन पारस्परिक चिंताएं।**Barge-in**: जब उपयोगकर्ता एजेंट बोलते समय बोलता है, तो टीटीएस रद्द करता है और एएसआर तुरंत उठाता है। **Tool use**: वार्तालाप समारोह के बीच कॉल (मौसम, कैलेंडर) को ऑडियो को रोकते हुए एक साइड चैनल पर चलाना चाहिए; एजेंट एक पुष्टिकरण टोकन ("एक सेकंड ...") को प्री-फिल करता है यदि विलंबता 300ms से अधिक है। **Backpressure**: पैकेट हानि के दौरान आंशिक प्रतिलेखन रखे जाते हैं, VAD भाषण-गेट की सीमा को बढ़ाता है, और एजेंट एक अनपहचानित संदेश पर बोलने से बचता है।

माप पट्टी मात्रात्मक है। 15 डीबी एसएनआर पर हैमिंग VAD बेंचमार्क पर 8% से नीचे WER। मापने वाले 100 कॉल पर 800ms से नीचे पहला ऑडियो आउट p50। मापने की दर 3% से कम है। टीटीएस पर 4.2 से ऊपर MOS। एकल g5.xlarge पर 50 समवर्ती कॉल। ये संख्याएं डिलीवर हैं।

## वास्तुकला

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (or Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         turn-detector     side-channel
(Deepgram         (Silero)          (LiveKit)        tools
 Nova-3 /         speech-gate    completion score    (weather,
 Whisper-v3)      per 20ms        on partials        calendar)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascaded Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     audio back to caller
            |
            v
   OpenTelemetry voice traces -> Langfuse
```

## स्टैक

- परिवहन: लाइवकिट एजेंट्स 1.0 (वेबआरटीसी) प्लस Twilio PSTN गेटवे; वैकल्पिक ढांचे के रूप में Pipecat 0.0.70
- एएसआरः डीपग्राम नोवा-3 (स्ट्रीमिंग, sub-300ms पहले आंशिक) या तेज-चुपकाव Whisper-v3-turbo स्वयं होस्ट
- VAD: Silero VAD v5 प्लस LiveKit बारी-डिटेक्टर (छोटा ट्रांसफार्मर जो आंशिक प्रतिलेखन पढ़ता है)
- LLM: बंद एकीकरण के लिए ओपनएआई जीपीटी-4o-रियल टाइम, जेमिनी 2.5 फ्लैश लाइव, या कैस्केड क्लाउड हैकु 4.5 (स्ट्रीमिंग पूर्णता, अलग ऑडियो पथ)
- टीटीएसः कार्टेशिया सोनिक-2 (कम से कम प्रथम बाइट), एलेवनलैब्स फ्लैश v3, या स्व-होस्ट के लिए ओपन-सोर्स ऑर्फियस
- उपकरणः मौसम/कैलेंडर/बुकिंग के लिए फास्टएमसीपी साइड-चैनल; एजेंट प्री-एमिट फिलर यदि उपकरण 300ms से अधिक लेता है
- अवलोकनशीलताः ओपनटेलीमेट्री आवाज स्पैन, ऑडियो रिप्ले के साथ लैंगफ्यूज आवाज निशान
- तैनातीः स्व-होस्ट किए गए विस्पर + ऑर्फियस के लिए एकल g5.xlarge (24GB VRAM); सबसे कम विलंबता के लिए होस्ट किए गए एपीआई

```figure
ce-voice-latency
```

## इसे बनाओ

1. **WebRTC session.**एक लाइवकिट कमरे और एक वेब क्लाइंट जो माइक्रोफोन ऑडियो स्ट्रीम करता है स्थापित करें. सर्वर पर, एक एजेंट कार्यकर्ता जो कमरे में शामिल हो जाता है संलग्न करें.

2. **ASR streaming.**डीपग्राम नोवा-3 (या GPU पर तेजी से चिपचिपा) पर 20ms PCM फ्रेम फ़ीड करें। आंशिक और अंतिम प्रतिलेखन की सदस्यता लें। आंशिक विलंबता पर लॉग करें।

3. **VAD and turn detector.**फ्रेम स्ट्रीम पर सिलेरो VAD v5 चलाएं। भाषण-अंत घटना पर, नवीनतम आंशिक प्रतिलेख के खिलाफ लाइवकिट टर्न-डिटेक्टर को चालू करें। केवल "पूर्ण हो जाओ" का वादा करें जब VAD 500ms के लिए चुप हो जाए और टर्न-डिटेक्टर को पूरा करने के लिए स्कोर > 0.6 हो जाए।

4. **LLM stream.**पूर्ण होने पर, चल रही बातचीत के साथ LLM कॉल शुरू करें और अंतिम प्रतिलेख. टोकन स्ट्रीम करें. पहले टोकन पर, TTS को सौंप दें.

5. **TTS stream.**कार्टेशिया सोनिक-2 ऑडियो टुकड़े वापस स्ट्रीम करता है. पहला टुकड़ा पहले एलएलएम टोकन के 200 मिमी के भीतर सर्वर छोड़ना चाहिए. लाइवकिट कमरे में टुकड़े जारी करें; क्लाइंट वेबआरटीसी जिएटर बफर के माध्यम से खेलता है।

6. **Barge-in.**जब VAD TTS खेल रहा है के दौरान नए उपयोगकर्ता भाषण का पता चलता है, TTS धारा तुरंत रद्द, शेष LLM आउटपुट छोड़ दें, और ASR को फिर से हथियार.`tts_canceled`स्पैन।

7. **Tool side channel.**कार्य-कॉल करने वाले उपकरण के रूप में मौसम और कैलेंडर को पंजीकृत करें। जब बुलाया जाए, तो कॉल को एक साथ फायर करें; यदि यह 300ms के भीतर हल नहीं होता है, तो एलएलएम को "एक सेकंड, मुझे जांचने दें" को एक फिलर के रूप में जारी रखें; उपकरण लौटने के बाद फिर से शुरू करें।

8. **Eval harness.**100 कॉल रिकॉर्ड करें. WER की गणना करें (एक लंबे समय तक चलने वाले ट्रांसक्रिप्ट के खिलाफ), झूठी कट-ऑफ दर (टीटीएस वाक्य के बीच में होने पर रद्द कर दिया गया), पहली ऑडियो आउट p50, टीटीएस एमओएस (मानव या एनआईएसक्यूए), और एक जिक्र-लॉस टेस्ट (पैकेट का 3% ड्रॉप) ।

9. **Load test.**सिंथेटिक कॉलर के साथ एकल g5.xlarge पर 50 समवर्ती कॉल चलाएं। निरंतर प्रथम ऑडियो आउट p95 मापें।

## इसका प्रयोग करें

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] tool call emitted @880ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @940ms
[llm  ] first token @990ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## इसे भेजें

`outputs/skill-voice-agent.md`एक डोमेन (ग्राहक सहायता, शेड्यूलिंग या कियोस्क) को देखते हुए, यह एक LiveKit एजेंट के साथ खड़ा होता है ASR/VAD/LLM/TTS पाइपलाइन माप पट्टी के लिए ट्यून।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## व्यायाम

1. G5.xlarge पर तेजी से चुप्पी मारने वाले v3 टर्बो के लिए डीपग्राम नोवा-3 को बदलें. विलंबता और WER अंतर मापें. पहचानें कि सीपीयू बनाम जीपीयू निर्णयों का क्या महत्व है।

2. एक अंतराल-आ arbitrage नीति जोड़ेंः एजेंट क्या करता है जब उपयोगकर्ता उपकरण कॉल के दौरान घुसपैठ करता है? तीन नीतियों (हार्ड रद्द, समाप्ति-उपकरण-तो-स्टॉप, अगली बारी में कतार) की तुलना करें।

3. एक विरोधी टर्न डिटेक्टर परीक्षण करेंः उपयोगकर्ता को वाक्य के बीच में लंबे समय तक विराम दें। 900ms से अधिक फ्लाई किए बिना सबसे कम झूठी कट-ऑफ के लिए VAD मौन सीमा और टर्न डिटेक्टर स्कोर सीमा को समायोजित करें।

4. टीवीलियो के माध्यम से पीएसटीएन पर एक ही एजेंट को तैनात करें। पीएसटीएन के पहले ऑडियो आउट की तुलना वेबआरटीसी से करें। जिएटर-बफर और कोडेक अंतरों की व्याख्या करें।

5. गैर-अंग्रेजी भाषाओं (जापानी, स्पेनिश) के लिए आवाज गतिविधि का पता लगाने जोड़ें. भाषा-विशिष्ट ठीक-ठाक के मुकाबले सिलेरो VAD v5 झूठी ट्रिगर दर मापें.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## आगे पढ़ना

- [LiveKit Agents 1.0](https://github.com/livekit/agents) संदर्भ वेबआरटीसी एजेंट फ्रेमवर्क
- [Pipecat](https://github.com/pipecat-ai/pipecat) वैकल्पिक पायथन-पहले स्ट्रीमिंग एजेंट फ्रेमवर्क
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) एकीकृत भाषण मॉडल के लिए संदर्भ
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) स्ट्रीमिंग एएसआर संदर्भ
- [Silero VAD v5](https://github.com/snakers4/silero-vad) VAD संदर्भ मॉडल
- [Cartesia Sonic-2](https://docs.cartesia.ai) कम विलंबता वाले टीटीएस संदर्भ
- [Retell AI architecture](https://docs.retellai.com) उत्पादन आवाज एजेंट वास्तुकला
- [Vapi.ai production stack](https://docs.vapi.ai) वैकल्पिक उत्पादन संदर्भ
