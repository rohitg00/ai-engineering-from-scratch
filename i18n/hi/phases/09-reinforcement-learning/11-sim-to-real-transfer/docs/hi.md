# सिम-टू-रियल ट्रांसफर

> एक सिमुलेटर में प्रशिक्षित नीति जो हार्डवेयर पर विफल होती है, वह एक नीति है जो सिमुलेटर को याद करती है। डोमेन रैंडमनाइज़ेशन, डोमेन अनुकूलन और सिस्टम पहचान वास्तविकता के अंतर को पार करने के लिए शिक्षित नियंत्रकों को बनाने के लिए तीन उपकरण हैं।

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 08 (PPO), Phase 2 · 10 (Bias/Variance)
**Time:** ~45 minutes

## समस्या

एक असली रोबोट को प्रशिक्षित करना धीमा, खतरनाक और महंगा है। एक बाइपेड को चलने के लिए सीखने के लिए लाखों प्रशिक्षण एपिसोड लगते हैं; एक असली बाइपेड जो हार्डवेयर को तोड़ने के बाद भी गिर जाता है। सिमुलेशन आपको असीमित रीसेट, निर्धारणीय पुनरुत्पादन, समानांतर वातावरण और कोई भौतिक क्षति नहीं देता है।

लेकिन सिम्युलेटर गलत हैं। बीयरिंग में MuJoCo मॉडल की तुलना में अधिक घर्षण होता है। कैमरों में लेंस विकृति होती है। सिम्युलेटर में शामिल नहीं होता है। मोटर्स में देरी, प्रतिक्रिया और संतृप्ति होती है कि 99% सिम मॉडल छोड़ देते हैं। हवा, धूल और चर प्रकाश व्यवस्था एक नीति को तोड़ती है जिसे निष्क्रिय रेंडरिंग पर प्रशिक्षित किया गया है।**reality gap** सिम वितरण और वास्तविक वितरण के बीच व्यवस्थित अंतर  रोबोटिक्स के लिए तैनात आरएल की केंद्रीय समस्या है।

आपको एक ऐसी नीति की आवश्यकता है जो *सिम-टू-रियल वितरण शिफ्ट के लिए मजबूत* हो। तीन ऐतिहासिक दृष्टिकोणः सिम्युलेटर को यादृच्छिक (डोमेन यादृच्छिकता), कुछ वास्तविक डेटा (डोमेन अनुकूलन / बारीक-बारी से समायोजन) के साथ नीति को अनुकूलित करें, या वास्तविक प्रणाली के मापदंडों की पहचान करें और उन्हें मेल खाएं (सिस्टम पहचान) । 2026 में, प्रमुख नुस्खा तीनों को बड़े पैमाने पर समानांतर सिमुलेशन (आईसाक सिम, आईसाक लैब, GPU पर म्यूजोको एमजेएक्स) के साथ जोड़ता है।

## अवधारणा

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR).**टोबिन और अन्य। 2017, पेंग और अन्य। 2018 में। प्रशिक्षण के दौरान, वास्तविक रोबोट पर भिन्न हो सकते हैं कि प्रत्येक सिम पैरामीटर को यादृच्छिक करेंः द्रव्यमान, घर्षण गुणांक, मोटर पीडी लाभ, सेंसर शोर, कैमरा की स्थिति, प्रकाश व्यवस्था, बनावट, संपर्क मॉडल। नीति "आज यह किस तरह का है" पर एक सशर्त वितरण सीखती है और पूरे दायरे में सामान्यीकरण करती है। यदि असली रोबोट प्रशिक्षण के परिपत्र के भीतर आता है, तो नीति काम करती है।

- **Upside:**कोई वास्तविक डेटा की जरूरत नहीं है. एक नुस्खा, कई रोबोट.
- **Downside:**अत्यधिक यादृच्छिक प्रशिक्षण एक "सार्वभौमिक" लेकिन अत्यधिक सतर्क नीति पैदा करता है।

**System Identification (SI).**सिमुलेटर के मापदंडों को प्रशिक्षण से पहले वास्तविक दुनिया के डेटा में फिट करें। यदि आप वास्तविक रोबोट पर आर्म-जॉइंट घर्षण को माप सकते हैं, तो इसे सिम में प्लग करें। फिर एक नीति को प्रशिक्षित करें जो उन मानों की उम्मीद करता है। वास्तविक प्रणाली तक पहुंच की आवश्यकता होती है लेकिन वास्तविकता अंतर को सीधे कम करता है।

- **Upside:**सटीक, कम शोर प्रशिक्षण लक्ष्य।
- **Downside:**शेष मॉडल त्रुटि नीति के लिए अदृश्य है; छोटे अज्ञात प्रभाव (जैसे, मोटर डैडबैंड) अभी भी तैनाती को तोड़ते हैं।

**Domain Adaptation.**सिम में प्रशिक्षण, वास्तविक डेटा की एक छोटी मात्रा के साथ बारीक-टीक. दो स्वादः

- **Real2Sim2Real:**एक अवशिष्ट सिम्युलेटर सीखें $f(s, a, z) - f_{\text{sim}}(s, a)$वास्तविक रोलआउट का उपयोग करके, सही सिम में प्रशिक्षण. बहुत वास्तविक डेटा के बिना अंतर बंद.
- **Observation adaptation:**एक नीति को प्रशिक्षित करें जो एक सीखे गए फीचर एक्सट्रैक्टर (जैसे, GAN पिक्सेल-टू-पिक्सेल) के माध्यम से वास्तविक ओएस → सिम-जैसे ओएस का नक्शा बनाता है। नियंत्रक सिम में रहता है।

**Privileged learning / teacher-student.**Miki et al. 2022 (ANYmal quadruped) * शिक्षक को सिमुलेशन में प्रशिक्षित करें जो विशेष जानकारी तक पहुंच रखता है (भूमि सत्य घर्षण, इलाके की ऊंचाई, IMU बहाव) * छात्र को अलग करें जो केवल वास्तविक सेंसर अवलोकन देखता है। छात्र इतिहास से विशेषताओं का अनुमान लगाना सीखता है, भौतिक मापदंडों के बीच मजबूत।

**Massively parallel simulation.**20242026. इसहाक लैब, म्यूजोको एमजेएक्स, ब्राक्स सभी एक ही जीपीयू पर हजारों समानांतर रोबोट चलाते हैं। 4,096 समानांतर मानवविदों के साथ पीपीओ घंटों में वर्षों के अनुभव को एकत्र करता है। प्रशिक्षण वितरण के विस्तार के साथ "वास्तविकता अंतर" छोटा हो जाता है; DR लगभग मुक्त हो जाता है जब उन 4,096 एनवी में से प्रत्येक में अलग-अलग यादृच्छिक पैरामीटर होते हैं।

**The real-world 2026 recipe (quadruped walking example):**

1. बड़े पैमाने पर समानांतर सिम डोमेन-संदिग्ध गुरुत्वाकर्षण, घर्षण, मोटर लाभ, उपयोगिता लोड के साथ।
2. प्राधान्य प्राप्त जानकारी (भूमि मानचित्र, शरीर की गति, जमीन सत्य) के साथ प्रशिक्षित शिक्षक नीति।
3. छात्र नीति केवल प्रोपियोसेप्शन (पैर जोड़ों के एन्कोडर) का उपयोग करके शिक्षक से निष्कर्षित।
4. वास्तविक IMU पर ऑटोकोडर के माध्यम से वैकल्पिक अवलोकन अनुकूलन।
5. 10+ वातावरण पर शून्य शॉट, यदि यह विफल रहता है, तो सुरक्षा प्रतिबंधित पीपीओ के साथ वास्तविक दुनिया में मिनटों का बारीकी से समायोजन करें।

```figure
f3-reality-gap
```

## इसे बनाओ

इस पाठ का कोड * शोर * संक्रमण के साथ ग्रिडवर्ल्ड पर डोमेन रैंडमटाइजेशन का एक छोटा सा प्रदर्शन है। हम एक नीति का प्रशिक्षण देते हैं जो "सिम" में रैंडम स्लिप संभावनाओं का अनुभव करता है और प्रशिक्षण के दौरान कभी नहीं देखे गए स्लिप स्तर के साथ "वास्तविक" पर मूल्यांकन करता है। आकार सीधे MuJoCo-to-हार्डवेयर स्थानांतरण के लिए मैप्स करता है।

### चरण 1: पैरामीटर सिम

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip`वास्तविक रोबोटिक्स में यह घर्षण, द्रव्यमान, मोटर लाभ हो सकता है  सिमुलेटर के बीच स्थानांतरित करने वाला कुछ भी।

### चरण 2: DR के साथ ट्रेन

प्रत्येक एपिसोड की शुरुआत में, नमूना `slip ~ Uniform[0.0, 0.4]`. पीपीओ / क्यू-लर्निंग / प्रशिक्षण कुछ भी. कई एपिसोड के लिए ऐसा करें.

### चरण 3: "वास्तविक" स्लिप पर शून्य शॉट का मूल्यांकन करें

`slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}`. पहले चार प्रशिक्षण सहायता के अंतर्गत आते हैं; `0.5`और `0.7`एक डीआर-प्रशिक्षित नीति को अंदर समर्थन के लगभग अनुकूलन में रहना चाहिए और बाहर से सौम्य रूप से गिरावट आना चाहिए। एक फिक्स्ड-स्लिप-प्रशिक्षित नीति अपनी प्रशिक्षण स्लिप के बाहर नाजुक होगी।

### चरण 4: संकीर्ण प्रशिक्षण की तुलना करें

 के साथ एक दूसरी नीति को प्रशिक्षित करें`slip = 0.0`केवल उसी पर मूल्यांकन करें`slip`आप एक विनाशकारी गिरावट देखना चाहिए जैसे ही वास्तविक स्लिप > 0.

## फंदे

- **Too much randomization.**ट्रेन पर `slip ∈ [0, 0.9]`और आपकी नीति इतनी जोखिम-विरोधी है कि वह कभी भी इष्टतम मार्ग का प्रयास नहीं करती है। वास्तविक दुनिया में * अपेक्षित * वितरण से मेल खाएं, "कुछ भी हो सकता है" नहीं।
- **Too little randomization.**एक पतले स्लाइस पर प्रशिक्षण और नीति को सामान्य नहीं किया जा सकता। अनुकूलन पाठ्यक्रम (स्वचालित डोमेन यादृच्छिकता) का उपयोग करें जो वितरण को बढ़ाता है क्योंकि नीति में सुधार होता है।
- **Misidentified parameter space.**गलत चीज़ को यादृच्छिक करें (कैमरा रंग जब वास्तविक अंतर मोटर देरी है) और DR मदद नहीं करता है। पहले असली रोबोट की प्रोफ़ाइल करें।
- **Privileged info leakage.**एक शिक्षक जो केवल अवलोकनों के बजाय वैश्विक स्थिति का उपयोग कार्यों के लिए करता है, वह एक छात्र को उत्पन्न कर सकता है जो पकड़ नहीं सकता है। सुनिश्चित करें कि शिक्षक की नीति छात्रों द्वारा अवलोकन इतिहास दिए जाने के लिए व्यवहार्य है।
- **Sim-to-sim transfer failure.**यदि आपकी नीति कठिन सिम संस्करण के लिए मजबूत नहीं है, तो यह वास्तविक दुनिया के लिए भी मजबूत नहीं होगी। तैनाती से पहले हमेशा एक लंबे समय तक चलने वाले सिम संस्करण पर परीक्षण करें।
- **No real-world safety envelope.**एक नीति जो सिम में काम करती है और "वास्तविक में काम करती है" बिना एक कम स्तर की सुरक्षा ढाल के अभी भी हार्डवेयर को तोड़ सकती है। एक गैर-शिक्षित नियंत्रक में गति सीमा, टोक़ सीमा, संयुक्त सीमा जोड़ें।

## इसका प्रयोग करें

2026 सिम-टू-रियल स्टैकः

| Domain | Stack |
|--------|-------|
| Legged locomotion (ANYmal, Spot, humanoid) | Isaac Lab + DR + privileged teacher / student |
| Manipulation (dexterous hands, pick-and-place) | Isaac Lab + DR + DR-GAN for vision |
| Autonomous driving | CARLA / NVIDIA DRIVE Sim + DR + real fine-tune |
| Drone racing | RotorS / Flightmare + DR + online adaptation |
| Finger/in-hand manipulation | OpenAI Dactyl (DR at unprecedented scale) |
| Industrial arms | MuJoCo-Warp + SI + small real fine-tune |

सभी पैमाने पर नियंत्रण के लिए, कार्यप्रवाह एक समान हैः सिम को यथासंभव फिट करें, जो आप फिट नहीं कर सकते हैं उसे यादृच्छिक करें, विशाल नीतियों को प्रशिक्षित करें, डिस्टिल करें, सुरक्षा ढाल के साथ तैनात करें।

## इसे भेजें

`outputs/skill-sim2real-planner.md`:

```markdown
---
name: sim2real-planner
description: Plan a sim-to-real transfer pipeline for a given robot + task, covering DR, SI, and safety.
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

Given a robot platform, a task, and access to real hardware time, output:

1. Reality gap inventory. Suspected sources ranked by expected impact (contact, sensing, actuation delay, vision).
2. DR parameters. Exact list, ranges, distribution. Justify each range against real measurements.
3. SI steps. Which parameters to measure; measurement method.
4. Teacher/student split. What privileged info the teacher uses; what obs the student uses.
5. Safety envelope. Low-level limits, emergency stops, backup controller.

Refuse to deploy without (a) a zero-shot sim-variant test, (b) a safety shield, (c) a rollback plan. Flag any DR range wider than 3× measured real variability as likely over-randomized.
```

## व्यायाम

1. **Easy.**फिक्स्ड-स्लिप ग्रिडवर्ल्ड (स्लिप=0.0) पर Q-लर्निंग एजेंट को प्रशिक्षित करें।$\text{slip} \in \lbrace 0.0, 0.1, 0.3, 0.5 \rbrace$. प्लॉट रिटर्न बनाम स्लिप .
2. **Medium.**DR Q-learning एजेंट के लिए नमूना लेने का प्रशिक्षण `slip ~ Uniform[0, 0.3]`. . उसी स्वीप का मूल्यांकन करें. DR स्लिप=0.5 (बाहर-वितरण) पर कितना खरीदता है?
3. **Hard.**एक पाठ्यक्रम लागू करेंः स्लिप = 0.0 से शुरू करें, जब भी नीति 90% के अनुकूल स्तर पर पहुंचती है, तब DR सीमा का विस्तार करें। स्लिप = 0.3 शून्य-शॉट के मुकाबले एक निश्चित DR बेसलाइन तक पहुंचने के लिए कुल पर्यावरण चरणों का माप करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Reality gap | "Sim-to-real difference" | Distribution shift between training and deployment physics/sensing. |
| Domain randomization (DR) | "Train across random sims" | Randomize sim parameters during training so policy generalizes. |
| System identification (SI) | "Measure real and fit sim" | Estimate real physical parameters; set sim to match. |
| Domain adaptation | "Fine-tune on real data" | Small real-world fine-tune after sim training; may adapt obs or dynamics. |
| Privileged info | "Ground truth for teacher" | Information only the sim has; student must infer it from obs history. |
| Teacher/student | "Distill privileged -> observable" | Teacher trained with shortcuts; student learns to mimic without them. |
| ADR | "Automatic Domain Randomization" | Curriculum that widens DR ranges as the policy improves. |
| Real2Sim | "Close the gap with real data" | Learn a residual to make the sim mimic real rollouts. |

## आगे पढ़ना

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) मूल डीआर पेपर (रोबोटिक्स के लिए दृष्टि) ।
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) गतिशीलता, चार गुना गतिशीलता के लिए डीआर।
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) Dactyl, एडीआर पैमाने पर।
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) ANYmal के लिए शिक्षक-छात्रा।
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) विशाल समानांतर सिम जो 20252026 के तैनाती को चलाता है।
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) एडीआर पाठ्यक्रम विधि।
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) डायना फ्रेमिंग (योजना + रोलआउट के लिए एक मॉडल का उपयोग करें) जो आधुनिक सिम-टू-रियल पाइपलाइनों का आधार है।
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) बेंचमार्क परिणामों के साथ सिम-टू-रियल तरीकों का वर्गीकरण।
