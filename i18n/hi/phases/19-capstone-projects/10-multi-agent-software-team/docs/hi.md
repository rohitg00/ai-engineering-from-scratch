# कैपस्टोन 10  मल्टी-एजेंट सॉफ्टवेयर इंजीनियरिंग टीम

> 2026 में एक बहु-एजेंट इंजीनियरिंग टीम का आकार एक साथ आया हैः एक वास्तुकार योजनाएं, N कोडर समानांतर कार्यवृक्षों में काम करते हैं, एक समीक्षा गेट, एक परीक्षक सत्यापित करता है। SWE-AF के कारखाने वास्तुकला, MetaGPT के भूमिका आधारित प्रलोभन, ऑटोजेन 0.4 के टाइप किए गए अभिनेता ग्राफ, कॉग्निशन के डेविन और कारखाने के ड्रोइड सभी स्वतंत्र रूप से इस पर उतरे। समानांतर कार्यवृक्ष दीवार-घड़ी को आउटपुट में परिवर्तित करते हैं। साझा राज्य और हस्तांतरण प्रोटोकॉल विफलता सतह बन जाते हैं। मुख्य बात टीम का निर्माण करना है, एसवीई-बेंच प्रो पर मूल्यांकन करना है, और रिपोर्ट करना है कि कौन से हाथ टूटते हैं और कितनी बार।

**Type:** Capstone
**Languages:** Python / TypeScript (agents, task board scaffold), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## समस्या

एकल एजेंट कोडिंग हर्नर्स बड़े कार्यों पर एक छत पर पहुंच गए। किसी भी व्यक्ति एजेंट के कमजोर होने के कारण नहीं, बल्कि क्योंकि 200k टोकन संदर्भ एक वास्तुकला योजना प्लस चार समानांतर कोडबेस स्लाइस प्लस रिव्यूर कमेंट्री प्लस टेस्ट आउटपुट नहीं रख सकता है। मल्टी-एजेंट फैक्ट्रियां समस्या को विभाजित करती हैंः एक वास्तुकार योजना का मालिक है, कोडर समानांतर कार्यवृक्षों में कार्यान्वयन का मालिक है, एक समीक्षक द्वार, एक परीक्षक सत्यापित करता है। SWE-AF की "कारखाने" वास्तुकला, MetaGPT की भूमिकाएं, ऑटोजेन के टाइप किए गए अभिनेता ग्राफ  सभी तीन फ्रेमिंग एक ही आकार का वर्णन करते हैं।

विफलता सतह है हाथों की योजना। वास्तुकार कुछ ऐसा योजना बनाता है जो कोडर लागू नहीं कर सकते। कोडर विरोधाभासी अंतर उत्पन्न करते हैं। समीक्षक एक भ्रमपूर्ण फिक्स को मंजूरी देता है। परीक्षक एक स्टीली-राइटिंग कोडर को दौड़ता है। आप इनमें से एक टीम बनाएंगे, इसे 50 एसडब्ल्यूई-बेंच प्रो मुद्दों पर चलाएंगे, प्रत्येक हाथों को ट्रैक करेंगे, और पोस्ट-मॉर्टम प्रकाशित करेंगे।

## अवधारणा

भूमिकाएं टाइप एजेंट हैं।**Architect**(क्लाउड ओपस 4.7) अंक पढ़ता है, एक योजना लिखता है, और स्पष्ट इंटरफेस के साथ उप-कार्य में तोड़ता है। **Coders**(क्लाउड सोनेट 4.7, N समानांतर उदाहरण, प्रत्येक में `git worktree`+ डेटोन सैंडबॉक्स) स्वतंत्र रूप से उप-कार्य लागू करें। **Reviewer**(GPT-5.4) विलय अंतर को पढ़ता है और या तो अनुमोदन करता है या विशिष्ट परिवर्तनों का अनुरोध करता है। **Tester**(जिमिनी 2.5 प्रो) परीक्षण सूट को अलग से चलाता है और कलाकृतियों के साथ पास / विफलता रिपोर्ट करता है।

संचार एक साझा कार्य बोर्ड (फ़ाइल-बैक या Redis) के माध्यम से होता है। प्रत्येक भूमिका में वह कार्य होते हैं जिन्हें वह करने की अनुमति देती है। हस्तान्तरण A2A प्रोटोकॉल-टाइप संदेश हैं। समन्वय संबंधी चिंताएंः विलय-संघर्ष समाधान (संयोजक भूमिका या स्वचालित तीन-तरफा विलय), साझा-राज्य सिंक्रनाइज़ेशन (कोडर शुरू होने के बाद योजना को जमे रखा जाता है; पुनर्निर्माण अलग-अलग घटनाएं हैं), और समीक्षक गेटकीपिंग (परीक्षक अपने स्वयं के परिवर्तनों या प्रस्तावित परिवर्तनों को मंजूरी नहीं दे सकता है) ।

टोकन प्रवर्धन छिपी लागत है। प्रत्येक भूमिका सीमा संक्षेप में संकेत और प्रसव संदर्भ जोड़ती है। एक 40 वक्र एकल एजेंट रन चार भूमिकाओं पर कुल 160 वक्र बन जाता है। rubric विशेष रूप से टोकन दक्षता बनाम एकल एजेंट बेसलाइन का वजन करता है क्योंकि सवाल "क्या मल्टी-एजेंट काम करता है" नहीं है, लेकिन "क्या यह प्रति डॉलर जीतता है।"

## वास्तुकला

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## स्टैक

- ऑर्केस्ट्रेशनः साझा राज्य + प्रति एजेंट उप-ग्राफ के साथ लैंगग्राफ
- संदेशः टाइप किए गए इंटरएजेंट संदेशों के लिए A2A प्रोटोकॉल (Google 2025)
- मॉडल: ओपस 4.7 (आर्किटेक्ट), सोनेट 4.7 (कोडर), जीपीटी-5.4 (रिव्यूर), जेमिनी 2.5 प्रो (टेस्टर)
- कार्यवृक्ष अलगाव: `git worktree add`प्रति कोड + डेटोन सैंडबॉक्स
- विलय समन्वयक: कस्टम थ्री-वे विलय + एलएलएम-मध्यस्थ संघर्ष समाधान
- Eval: SWE-bench Pro (50 issues), SWE-AF scenarios, HumanEval++ यूनिट टेस्ट के लिए
- अवलोकनशीलताः रोल-टैग किए गए स्पैन के साथ लैंगफ्यूज, प्रति एजेंट टोकन लेखांकन
- तैनातीः K8 प्रत्येक भूमिका के साथ अलग तैनाती + HPA बैकलॉग पर

```figure
ce-team-handoff
```

## इसे बनाओ

1. **Task board.**टाइप संदेशों के साथ फ़ाइल समर्थित JSONL: `plan_request`,`subtask`,`diff_ready`,`review_needed`,`test_needed`,`approved`,`rejected`,`replan_needed`एजेंट टैग की सदस्यता लेते हैं।

2. **Architect.**GitHub के मुद्दे को पढ़ता है, एक योजना टेम्पलेट के साथ ओपस 4.7 चलाता है जिसमें स्पष्ट उप-कार्य इंटरफ़ेस (टच फ़ाइलें, सार्वजनिक कार्य, परीक्षण प्रभाव) की आवश्यकता होती है। एक जारी करता है `plan_request`उप-कार्य के साथ एक DAG.

3. **Coders.**N समानांतर श्रमिकों, प्रत्येक बोर्ड से एक उपकार्य का दावा करता है। प्रत्येक एक नया उत्पन्न करता है।`git worktree add`शाखा और डेटोन सैंडबॉक्स. उपकार्य को लागू करता है. उत्सर्जन`diff_ready`पैच + टेस्ट डेल्टा के साथ।

4. **Merge coordinator.**सभी कोडर-करने पर, तीन-तरफा N शाखाओं को एक स्टेजिंग शाखा में मिलाता है। एलएलएम-मध्यस्थ संघर्ष समाधान केवल जब फ़ाइल-स्तर ओवरलैप मौजूद है।

5. **Reviewer.**GPT-5.4 मिश्रित अंतर को पढ़ता है। यह लेखक द्वारा किए गए अंतर को मंजूरी नहीं दे सकता।`approved`(नो-ओप) या `review_feedback`विशिष्ट परिवर्तन अनुरोधों को संबंधित कोडर को वापस भेजा जाता है।

6. **Tester.**Gemini 2.5 प्रो परीक्षण सूट एक साफ रेत बॉक्स में चलाता है. कलाकृतियों को कैप्चर करता है. उत्सर्जन.`test_passed`या `test_failed`असफल परीक्षण लूप वापस विफल उप-कार्य के मालिक कोडेटर के लिए.

7. **Handoff accounting.**एक भूमिका सीमा पार करने वाले प्रत्येक संदेश को लैंगफ्यूज में उपयोगिता भार आकार और मॉडल के साथ एक स्पैन मिलता है। प्रति उपकार्य टोकन प्रवर्धन (कोडर_टोकन + रिव्यूर_टोकन + टेस्टर_टोकन + आर्किटेक्ट_शेयर / कोडर_टोकन) की गणना करें।

8. **Eval.**50 SWE-बेंच प्रो मुद्दों पर चलाएं. एक एकल एजेंट बेसलाइन (एक एकल वर्क ट्री में एक सोनेट 4.7) के साथ पास@1 और $- प्रति-समाधान-समस्या की तुलना करें।

9. **Post-mortem.**प्रत्येक असफल मुद्दे के लिए, उस हस्तान्तरण की पहचान करें जो टूट गया था (प्लान बहुत अस्पष्ट, विलय संघर्ष, समीक्षक गलत अनुमोदन, परीक्षक फ्लेक) । हस्तान्तरण विफलता हिस्टोग्राम का उत्पादन करें।

## इसका प्रयोग करें

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## इसे भेजें

`outputs/skill-multi-agent-team.md`समस्या URL और समानांतरता स्तर को देखते हुए, टीम प्रति भूमिका टोकन लेखांकन के साथ एक विलय-तैयार PR का उत्पादन करती है।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Matched 50-issue subset, pass@1 |
| 20 | Parallel speedup | Wall-clock vs single-agent baseline |
| 20 | Review quality | False-approval rate on injected-bug probe |
| 20 | Token efficiency | Total tokens per solved issue vs single-agent |
| 15 | Coordination engineering | Merge-conflict resolution, handoff-failure histogram |
| **100** | | |

## व्यायाम

1. एक स्पष्ट बग को मध्य-चलन में एक भिन्न (अतिरिक्त) में इंजेक्ट करें`return None`समीक्षाकर्ता की झूठी स्वीकृति दर को मापें। समीक्षाकर्ता को तब तक ट्यून करें जब तक झूठी स्वीकृति 5% से कम न हो जाए।

2. दो कोडर (आर्किटेक्ट + दो कोडर + रिव्यूर + टेस्टर) तक कम करें, प्रत्येक कोडर दो उप-कार्य क्रमशः चलाता है। दीवार घड़ी और पास दर की तुलना करें।

3. विलय समन्वयक को एकल-लेखक प्रतिबंध के साथ बदलें (उपकार्य अलग फ़ाइल सेट को छूते हैं) आर्किटेक्ट पर योजना भार मापें।

4. GPT-5.4 से Claude Opus 4.7 तक स्वैप रिव्यूरर। झूठी स्वीकृति दर और टोकन लागत डेल्टा को मापें।

5. एक पांचवीं भूमिका जोड़ेंः दस्तावेजकर्ता (हायकू 4.5) । समीक्षा के बाद, यह एक चेंजलॉग प्रविष्टि उत्पन्न करता है। यह मापें कि क्या दस्तावेज की गुणवत्ता अतिरिक्त टोकन खर्च को उचित ठहराती है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Parallel worktree | "Isolated branch" | `git worktree add` producing a fresh working tree per coder |
| Task board | "Shared message bus" | File or Redis store of typed messages agents subscribe to |
| Handoff | "Role boundary" | Any message crossing from one role's context to another's |
| Token amplification | "Multi-agent overhead" | Total tokens across roles / single-agent tokens for the same task |
| A2A protocol | "Agent-to-agent" | Google's 2025 spec for typed inter-agent messages |
| Merge coordinator | "Integrator" | Component that runs three-way merge and mediates conflicts |
| False approval | "Reviewer hallucination" | Reviewer approves a diff with known bugs |

## आगे पढ़ना

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) संदर्भ 2026 बहु-एजेंट कारखाना
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) भूमिका आधारित बहु एजेंट ढांचा
- [AutoGen v0.4](https://github.com/microsoft/autogen) माइक्रोसॉफ्ट के टाइप किए गए एक्टर फ्रेमवर्क
- [Cognition AI (Devin)](https://cognition.ai) संदर्भ उत्पाद
- [Factory Droids](https://www.factory.ai) वैकल्पिक संदर्भ उत्पाद
- [Google A2A protocol](https://a2a-protocol.org/latest/) अंतर एजेंट संदेश विनिर्देश
- [git worktree documentation](https://git-scm.com/docs/git-worktree) अलगाव सब्सट्रेट
- [SWE-bench Pro](https://www.swebench.com) मूल्यांकन लक्ष्य
