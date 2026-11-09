# कैपस्टोन 12  वीडियो समझ पाइपलाइन (संच, क्यूए, खोज)

> 12 लैब्स ने मार्ेंगो + पेगासस का उत्पादन किया। वीडियोडीबी ने CRUD-for-video एपीआई भेजा। AI2 के Molmo 2 ने खुला VLM चेकपोस्ट प्रकाशित किया। जुड़वां लंबे संदर्भ वीडियो के घंटे को मूल रूप से संभालता है। टाइम लेंस-100K ने पैमाने पर समय पर जमीनीकरण को परिभाषित किया। 2026 पाइपलाइन तय की गई हैः दृश्य विभाजन, प्रति दृश्य कैप्शन + एम्बेडिंग, ट्रांसक्रिप्ट संरेखण, बहु-वेक्टर सूचकांक, और एक क्वेरी जो (शुरू, अंत) समय टिकट और फ्रेम पूर्वावलोकन के साथ उत्तर देती है। अंत पत्थर 100 घंटे का सेवन कर रहा है, सार्वजनिक बेंचमार्क पर पहुंच रहा है, और गिनती और कार्रवाई के प्रश्नों पर भ्रम को माप रहा है।

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI, pipeline scaffold)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## समस्या

लंबे समय तक वीडियो क्यूए 2026 के पैमाने पर सबसे अधिक बैंडविड्थ-भूख वाली मल्टीमोडल समस्या है। मिथुन 2.5 प्रो 2 घंटे का वीडियो देशी रूप से पढ़ सकता है, लेकिन एक queryable corpus में 100 घंटे का वीडियो निगलने के लिए अभी भी दृश्य स्तर का सूचकांक की आवश्यकता होती है। उत्पादन आकार दृश्य विभाजन (ट्रांसनेटवी 2 या पायस्कैनडेक्ट), प्रति दृश्य कैप्शन VLM (जेमिनी 2.5, क्यूवेन3-वीएल-मैक्स, या मोलमो 2) के साथ, ट्रांसक्रिप्ट संरेखण (शब्द समयशीर्षक के साथ व्हिस्पर-वी 3 टर्बो) और एक बहु-वेक्टर सूचकांक जो कैप्शन, फ्रेम एम्बेडिंग और ट्रांसक्रिप्ट को एक साथ संग्रहीत करता है, को जोड़ता है। क्वेरी पाइपलाइन (शुरू, अंत) समय स्टैम्प प्लस फ्रेम पूर्वावलोकन के साथ उत्तर देता है।

बेंचमार्क सार्वजनिक हैं (ActivityNet-QA, NeXT-GQA) और आपके स्वयं के 100 क्वेरी कस्टम सेट। गणना और कार्रवाई-प्रकार के प्रश्नों पर भ्रम ज्ञात-हार्ड विफलता वर्ग है; कैपस्टोन इसे स्पष्ट रूप से मापता है।

## अवधारणा

तीन पाइपलाइनें समानांतर में चलती हैं।**Scene segmentation**वीडियो को दृश्यों में काटता है।**VLM captioning**एक कीफ्रेम से प्रति दृश्य और एक फ्रेम एम्बेड करने के लिए एक कैप्शन उत्पन्न करता है। **ASR alignment**प्रत्येक दृश्य को बहु-वेक्टर सूचकांक (Qdrant) में तीन वेक्टर प्रकार प्राप्त होते हैंः कैप्शन एम्बेडिंग, कीफ्रेम एम्बेडिंग, ट्रांसक्रिप्ट एम्बेडिंग।

क्वेरी के समय, प्राकृतिक भाषा के प्रश्न तीनों वेक्टरों के खिलाफ फायर करता है; परिणाम आरआरएफ के साथ विलय करते हैं; एक समय-भूमि समायोजक (टाइमलेन्स शैली) शीर्ष दृश्य के भीतर (शुरू, अंत) खिड़की को परिष्कृत करता है। वीएलएम सिंथेसाइज़र (जेमेनी 2.5 प्रो या क्यूवेन 3-वीएल-मैक्स) उद्धृत समय टिकट और फ्रेम पूर्वावलोकन के साथ क्वेरी + शीर्ष दृश्य + क्रॉप किए गए फ्रेम और उत्तर लेता है।

हलक में पड़ने वाले लोगों को गिनने के लिए बहुत जरूरी है। "कई लोग कमरे में प्रवेश करते हैं?") और एक्शन-टाइप ("क्या शेफ हलचल से पहले पानी डालता है?") सवाल बहुत ही विश्वसनीय नहीं हैं। विवरणात्मक प्रश्नों से अलग सटीकता की रिपोर्ट करें।

## वास्तुकला

```
video file / URL
      |
      v
PySceneDetect / TransNetV2  (scene segmentation)
      |
      +--- per-scene keyframe --- VLM caption + frame embedding
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- audio channel --- Whisper-v3-turbo ASR + word timestamps
      |
      v
multi-vector Qdrant: {caption_emb, keyframe_emb, transcript_emb}
      |
query:
  dense queries against all three -> RRF merge -> top-k scenes
      |
      v
TimeLens / VideoITG temporal grounding (refine start/end within scene)
      |
      v
VLM synth: query + top scenes + frame previews
      |
      v
answer + (start, end) timestamps + frame thumbs + citations
```

## स्टैक

- दृश्य विभाजनः ट्रांसनेटवी2 (अंतिम स्तर 2024-26) या PySceneDetect
- एएसआरः शब्द समयशीर्षक के साथ तेज-चुपके के माध्यम से विस्पर-वी 3 टर्बो
- VLM कैप्टन + उत्तरकर्ता: Gemini 2.5 प्रो या Qwen3-VL-Max या Molmo 2
- समय पर जमीनीकरणः टाइम लेंस-100K-प्रशिक्षित एडाप्टर या वीडियोआईटीजी
- सूचकांकः बहु-वेक्टर समर्थन वाला Qdrant (शीर्षक / फ्रेम / ट्रांसक्रिप्ट)
- यूआईः HTML5 वीडियो प्लेयर और दृश्य लघु चित्रों के साथ Next.js 15
- Eval: ActivityNet-QA, NeXT-GQA, कस्टम 100-प्रश्न हस्त लेबल सेट
- हलुसिनाशन बेंचमार्कः हाथ लेबल वाले गिनती और एक्शन प्रकार के उप-सेट

```figure
cf-scene-index
```

## इसे बनाओ

1. **Ingest walker.**YouTube URL या स्थानीय MP4 स्वीकार करें। आवश्यकतानुसार 720p तक डाउनस्केल करें। दृढ़ रहें `{video_id, file_path}`. .

2. **Scene segmentation.**TransNetV2 या PySceneDetect को निष्पादित करें`[{scene_id, start_ms, end_ms, keyframe_path}]`लक्ष्य 100 घंटे: ~6K-8K दृश्यों।

3. **ASR pass.**ऑडियो पर विस्पर-v3 टर्बो चलाएं; शब्द स्तर के समय टिकट निर्यात करें; प्रति दृश्य प्रतिलेख स्लाइस में विभाजित करें।

4. **VLM captioning.**प्रति दृश्य, कीफ्रेम और एक छोटा कैप्शन टेम्पलेट के साथ जेमिनी 2.5 प्रो (या क्यूवेन 3-वीएल-मैक्स) को कॉल करें। कैप्शन + फ्रेम एम्बेडिंग उत्पन्न करें।

5. **Multi-vector index.**तीन नामित वेक्टरों के साथ Qdrant संग्रह।`{video_id, scene_id, start_ms, end_ms, keyframe_url}`. .

6. **Query.**प्राकृतिक भाषा प्रश्न तीन घने प्रश्नों को निकालता है; पारस्परिक रैंक संलयन के साथ विलय; शीर्ष-के = 5 दृश्य।

7. **Temporal grounding.**दृश्य के भीतर (शुरू, समाप्त) विंडो को परिष्कृत करने के लिए शीर्ष दृश्य पर टाइमलेन्स शैली एडाप्टर चलाएं।

8. **VLM synth.**Gemini 2.5 Pro को क्वेरी + शीर्ष 3 दृश्य क्लिप (छवि या लघु क्लिप के रूप में) + ट्रांसक्रिप्ट के साथ कॉल करें।`(video_id, start_ms, end_ms)`उद्धरण।

9. **Eval.**ActivityNet-QA और NeXT-GQA चलाएं. 100 क्वेरी का कस्टम सेट बनाएं. समग्र सटीकता + प्रति वर्ग विभाजन (गणना, कार्रवाई, वर्णनात्मक) की रिपोर्ट करें.

## इसका प्रयोग करें

```
$ video-qa ask --url=https://youtube.com/watch?v=X "how many cars pass the intersection in the first minute?"
[scene]    23 scenes detected
[asr]      transcript complete, 4m12s
[index]    69 vectors written (23 scenes x 3)
[query]    top scene: scene 3 [01:32-01:54], confidence 0.84
[ground]   refined window: [00:12-00:58]
[synth]    gemini 2.5 pro, 1.4s
answer:    5 cars pass the intersection between 00:12 and 00:58.
citations: [scene 3: 00:12-00:58]
          [frame preview at 00:14, 00:27, 00:44, 00:51, 00:57]
```

## इसे भेजें

`outputs/skill-video-qa.md`यूट्यूब यूआरएल या अपलोड किए गए वीडियो को देखते हुए, पाइपलाइन दृश्यों को सूचकांकित करता है और समय के साथ उद्धरणों के साथ सवालों के जवाब देता है।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Intersection-over-union on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and custom 100-query |
| 20 | Ingest throughput | Hours of video per dollar spent |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy separately |
| **100** | | |

## व्यायाम

1. उपशीर्षक पास पर Qwen3-VL-Max के लिए Gemini 2.5 प्रो बदलें। मानव-मूल्यांकन 50 दृश्यों के नमूने पर उपशीर्षक गुणवत्ता डेल्टा रिपोर्ट करें।

2. प्रति दृश्य फ्रेम एम्बेडिंग को मल्टी-वेक्टर के बजाय एक pooled वेक्टर में कम करें। पुनर्प्राप्ति प्रतिगमन मापें।

3. "कंटेंट सख्त" मोड बनाएंः सिंथेसाइज़र प्रत्येक गिने गए उदाहरण को एक समय टिकट के साथ निकालता है और उपयोगकर्ता सत्यापन के लिए क्लिक करता है। मापें कि क्या उपयोगकर्ता सत्यापन भ्रम को कम करता है।

4. बेंचमार्क सेवन लागतः तीन VLM विकल्पों पर वीडियो के घंटे-प्रति डॉलर। सबसे अच्छा स्थान चुनें।

5. स्पीकर डायरीकृत प्रतिलिपि जोड़ेंः ऑडियो पर पियानोट स्पीकर डायरीकरण चलाएं और प्रति स्पीकर प्रतिलिपि प्रतिलिपिएँ एम्बेड करें। "एलिस ने एक्स के बारे में क्या कहा?" प्रश्न प्रदर्शित करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scene segmentation | "Shot detection" | Cutting video into scenes at shot boundaries |
| Multi-vector index | "Caption + frame + transcript" | Qdrant collection with named vectors per representation |
| Temporal grounding | "When exactly did it happen" | Refining the (start, end) window for a query answer |
| Frame embedding | "Visual representation" | A vector embedding of a keyframe; used for scene-visual similarity |
| RRF fusion | "Reciprocal rank fusion" | Merge strategy across multiple ranked lists; a classic hybrid-retrieval trick |
| Counting hallucination | "Miscount" | Known failure mode of VLMs on "how many X" questions |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## आगे पढ़ना

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) वीएलएम चेकपोस्ट खोलें
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) समय के आधार पर पैमाने पर
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) होस्ट किए गए संदर्भ
- [VideoDB](https://videodb.io) CRUD-for-video API संदर्भ
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) वाणिज्यिक संदर्भ
- [TransNetV2](https://github.com/soCzech/TransNetV2) दृश्य विभाजन मॉडल
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) क्लासिक ओपन विकल्प
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) संदर्भ मूल्यांकन बेंचमार्क
