# कैपस्टोन 06  कुबेरनेट्स के लिए डेवओप्स समस्या निवारण एजेंट

> AWS के डेवओप्स एजेंट GA चला गया, रेसोलव एआई ने अपने K8s प्लेबुक प्रकाशित किए, न्यूबर्ड ने अर्थवादी निगरानी का प्रदर्शन किया, और मेटोरो ने एआई एसआरई को प्रति-सेवा एसएलओ से जोड़ा। उत्पादन आकार तय हैः एक अलर्ट वेबहुक फायर, एक एजेंट टेलीमेट्री पढ़ता है, K8s वस्तुओं का ग्राफ चलता है, मूल कारण परिकल्पनाओं को रैंक करता है, और स्वीकृति बटन के साथ एक स्लैक संक्षिप्त पोस्ट करता है। डिफ़ॉल्ट रूप से केवल पढ़ने के लिए। एक मानव द्वारा बंद किया गया हर उपचार. यह कस्टस्टोन उस एजेंट है, 20 सिंथेटिक घटनाओं पर मूल्यांकन किया और तीन साझा मामलों पर AWS के एजेंट की तुलना में तुलना की।

**Type:** Capstone
**Languages:** Python (agent), TypeScript (Slack integration, agent scaffold)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P11 · P13 · P14 · P15 · P17 · P18
**Time:** 30 hours

## समस्या

2025-2026 एसआरई कथा बन गईः "एआई एजेंटों ने घटनाओं का triage किया, मनुष्य सुधारों को मंजूरी देते हैं।" AWS DevOps एजेंट, Resolve AI, NeuBird, Metoro, PagerDuty AIOps सभी उत्पादन में इस आकार को भेजते हैं। एजेंट Prometheus मैट्रिक्स, लोकी लॉग, Tempo निशान, kube-राज्य-मैट्रिक्स, और K8s वस्तुओं के ज्ञान ग्राफ पढ़ता है। यह पांच मिनट से कम समय में टेलीमेट्री उद्धरणों के साथ एक रैंक मूल कारण परिकल्पना का उत्पादन करता है। यह स्लैक के माध्यम से स्पष्ट मानव अनुमोदन के बिना विनाशकारी आदेशों को कभी निष्पादित नहीं करता है।

अधिकांश कठिन काम स्कोपिंग और सुरक्षा है, तर्क नहीं। एजेंट को एक डिफ़ॉल्ट रीड-केवल-बैक सतह, एक कठोर एमसीपी टूल सर्वर, और प्रत्येक विचार किए गए बनाम निष्पादित कमांड के ऑडिट लॉग की आवश्यकता है। उसे यह जानने की आवश्यकता है कि यह अपनी गहराई से बाहर कब है और बढ़ता है। और इसे सस्ता चलाना है कि ओओएम-किल कैस्केड $ 5k एजेंट बिल उत्पन्न नहीं करते हैं।

## अवधारणा

एजेंट एक ज्ञान ग्राफ पर काम करता है। नोड्स K8s ऑब्जेक्ट (पॉड, डिप्लोइमेंट्स, सर्विसेज, नोड्स, एचपीए, पीवीसी) और दूरसंचार स्रोत (प्रोमेथियस श्रृंखला, लोकी स्ट्रीम, टेम्पो ट्रैक) हैं। किनारे स्वामित्व (पॉड -> प्रतिकृतिसेट -> डिप्लोइमेंट), शेड्यूलिंग (पॉड -> नोड) और अवलोकन (पॉड -> प्रोमेथियस श्रृंखला) को एन्कोड करते हैं। ग्राफ को एक कुबे-स्टेट-मेट्रिक्स सिंक्रनाइज़ करके ताज़ा रखा जाता है और हर अलर्ट पर फिर से नमूना लिया जाता है।

जब एक अलर्ट फायर करता है, तो एजेंट प्रभावित वस्तु से रूट-कसाएं देता है। यह किनारों पर चलता है, प्रासंगिक टेलीमेट्री स्लाइस (अंतिम 15 मिनट) खींचता है, और एक परिकल्पना तैयार करता है। परिकल्पना सबूत द्वारा रैंक की जाती हैः कितने टेलीमेट्री उद्धरण इसका समर्थन करते हैं, कितना हालिया है, कितना विशिष्ट है। शीर्ष 3 परिकल्पनाएं ग्राफ-पथ दृश्यों और सुधार कार्यों के लिए अनुमोदन बटन के साथ स्लैक पर जाती हैं।

रिमेडीशन गैट है। डिफ़ॉल्ट एक्शन केवल पढ़ने के लिए अनुमति दी जाती है। विनाशकारी एक्शन (स्केल डाउन, रोलिंग बैक, पॉड हटाने) के लिए स्लैक अनुमोदन की आवश्यकता होती है; ArgoCD रोलबैक हुक के लिए एक ऑथ टोकन की आवश्यकता होती है जो एजेंट कभी नहीं रखता है। ऑडिट लॉग एजेंट * विचार *  नहीं केवल निष्पादित किए गए  के प्रत्येक कमांड को रिकॉर्ड करता है।

## वास्तुकला

```
PagerDuty / Alertmanager webhook
           |
           v
     FastAPI receiver
           |
           v
   LangGraph root-cause agent
           |
           +---- read-only MCP tools ----+
           |                             |
           v                             v
   K8s knowledge graph              telemetry slices
     (Neo4j / kuzu)              Prometheus, Loki, Tempo
   ownership + scheduling          last 15m, scoped
           |
           v
   hypothesis ranking (evidence weight)
           |
           v
   Slack brief + approval buttons
           |
           v (approved)
   ArgoCD rollback hook / PagerDuty escalate
           |
           v
   audit log: considered vs executed, every command
```

## स्टैक

- अवलोकनशीलता के स्रोतः प्रोमेथियस, लोकी, टेम्पो, कुबे-स्टेट-मेट्रिक्स
- ज्ञान ग्राफः K8s वस्तुओं के Neo4j (प्रबंधित) या kuzu (एम्बेड) + दूरदर्शन किनारे
- एजेंट: लैंगग्राफ प्रति उपकरण अनुमति सूची के साथ, डिफ़ॉल्ट रूप से केवल पढ़ने के लिए
- उपकरण परिवहनः स्ट्रीमबलएचटीपी पर फास्टएमसीपी; स्वीकृति गेट के पीछे विनाशकारी उपकरण के लिए अलग सर्वर
- मॉडलः मूल कारण तर्क के लिए क्लाउड सोनेट 4.7, लॉग सारांश के लिए मिथुन 2.5 फ्लैश
- सुधारः ArgoCD रोलबैक वेबहुक, PagerDuty escalate, Slack अनुमोदन कार्ड
- लेखा परीक्षाः केवल अनुलग्नक संरचनात्मक लॉग (विचारित, निष्पादित, अनुमोदित, परिणाम)
- तैनातीः K8s तैनाती अपनी संकीर्ण RBAC भूमिका के साथ; अलग नाम स्थान

```figure
ce-rootcause-walk
```

## इसे बनाओ

1. **Graph ingestion.**प्रत्येक 30 के दशक में Neo4j/kuzu में kube-state-metrics को सिंक करें। नोड्सः पॉड, डिप्लोयमेंट, नोड, सर्विस, पीवीसी, एचपीए। किनारेः OWNED_BY, SCHEDULED_ON, EXPOSES, MOUNTS, SCALES। टेलीमेट्री ओवरले किनारेः OBSERVED_BY (एक पॉड को प्रोमेथियस श्रृंखला द्वारा देखा जाता है) ।

2. **Alert receiver.**फास्टएपीआई एंडपॉइंट जो पेजड्यूटी या अलर्टमैनेजर वेबहुक को स्वीकार करता है। प्रभावित वस्तुओं और एसएलओ उल्लंघन को निकालें।

3. **Read-only tool surface.**Wrap kubectl, Prometheus query, Loki logql, Tempo traceql FastMCP के माध्यम से। प्रत्येक उपकरण में एक संकीर्ण RBAC क्रिया ("प्राप्त करें", "सूची", "वर्णन") है। डिफ़ॉल्ट सर्वर में कोई "हटाएं", "exec", "पैमाना" नहीं है।

4. **Root-cause agent.**तीन नोड्स के साथ लैंगग्राफः `sample`पिछले 15 मिनट के टेलीमेट्री स्लाइस खींचता है,`walk`पड़ोसियों के लिए ग्राफ से पूछताछ करता है,`hypothesize`टेलीमेट्री उद्धरणों के साथ मूल कारण उम्मीदवारों को क्रमबद्ध किया गया मसौदा।

5. **Evidence scoring.**प्रत्येक परिकल्पना का स्कोर = हाल ही में * विशिष्टता * ग्राफ-पथ लंबाई विपरीत * उद्धरण संख्या है। शीर्ष-3 लौटाएं।

6. **Slack brief.**परिकल्पना, ग्राफ-पथ विज़ुअलाइज़ेशन (एक उपग्राफ छवि सर्वर-साइड प्रस्तुत) के साथ एक संलग्नक पोस्ट करें, और अधिकतम एक सुधार कार्रवाई के लिए अनुमोदन बटन।

7. **Remediation gate.**विनाशकारी उपकरण (स्केल डाउन, रोल बैक, डिलीट) एक स्वीकृति टोकन के पीछे एक दूसरे एमसीपी सर्वर पर रहते हैं। एजेंट उन्हें केवल तब ही कॉल कर सकता है जब स्लैक कार्ड को मानव द्वारा अनुमोदित किया जाता है।

8. **Audit log.**केवल JSONL जोड़ेंः प्रत्येक उम्मीदवार कमांड के लिए, लॉग करें कि क्या इसे विचार किया गया था, क्या इसे निष्पादित किया गया था, किसने इसे मंजूरी दी थी। दैनिक S3 पर भेजें।

9. **Synthetic incident suite.**20 परिदृश्यों का निर्माण करेंः OOMKill कैस्केड, DNS फ्लैप, HPA थ्रेश, पीवीसी भरने, शोर पड़ोसी, दोषपूर्ण साइडकार, खराब कॉन्फिगमैप रोलआउट, प्रमाण पत्र रोटेशन, छवि-प्ल बैकऑफ, आदि। मूल कारण सटीकता और समय-से-अनुमान पर एजेंट को स्कोर करें।

## इसका प्रयोग करें

```
webhook: alert.pagerduty.com -> checkout-api SLO breach, error rate 14%
[graph]   affected: Deployment checkout-api (3 Pods, Node ip-10-2-3-4)
[walk]    neighbors: ReplicaSet checkout-api-abc, Service checkout-api,
           recent rollout 14m ago
[sample]  prometheus error_rate 14%, up-trend; loki 500s on /api/v2/pay
[hypo]    #1 bad rollout: latest image checkout-api:v2.41 fails /healthz
          citations: deploy.yaml (rev 42), prometheus errorRate, loki 500 stack
[slack]   [ROLL BACK to v2.40]  [ESCALATE]  [IGNORE]
          (approval required; agent does not roll back unilaterally)
```

## इसे भेजें

`outputs/skill-devops-agent.md`एक K8s क्लस्टर और चेतावनी स्रोत को देखते हुए, एजेंट रैंक मूल कारण परिकल्पना और एक स्लैक-गेट remediation प्रवाह पैदा करता है।

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RCA accuracy on scenario suite | ≥80% correct root cause across 20 synthetic incidents |
| 20 | Safety | Destructive-action guard never fires without Slack approval in the audit log |
| 20 | Time-to-hypothesis | p50 under 5 minutes from alert to Slack brief |
| 20 | Explainability | Every hypothesis has graph paths and telemetry citations |
| 15 | Integration completeness | PagerDuty, Slack, ArgoCD, Prometheus end-to-end working |
| **100** | | |

## व्यायाम

1. अपने एजेंट को उसी तीन घटनाओं पर चलाएं AWS के DevOps एजेंट को डेमो किया गया है।

2. एक "नज़दीक चूक" लेखा परीक्षा जो एजेंट * माना गया * जो विनाशकारी हो सकता है जो किसी भी आदेश को चिह्नित जो अनुमति के बिना हो जाएगा जोड़ें। एक सप्ताह के दौरान लगभग चूक दर मापें।

3. क्लाउड सोनट 4.7 से स्व-होस्ट किए गए Llama 3.3 70B के लिए परिकल्पना मॉडल को बदलें। प्रत्येक घटना के लिए RCA सटीकता डेल्टा और डॉलर मापें।

4. एक कारण फ़िल्टर बनाएंः एक वास्तविक मूल कारण से संबंधित टेलीमेट्री स्पाइक को अलग करें। 20 परिदृश्य लेबल पर एक छोटा वर्गीकरण प्रशिक्षित करें।

5. एक रोलबैक ड्राई रन जोड़ेंः उसी मैनिफेस्ट के साथ एक स्टेजिंग क्लस्टर के खिलाफ ArgoCD रोलबैक। स्लैक अनुमोदन बटन से पहले लाइव क्लस्टर में रोलबैक योजना की जांच करें।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| K8s knowledge graph | "Cluster graph" | Nodes = K8s objects + telemetry series; edges = ownership, scheduling, observation |
| Read-only-by-default | "Scoped RBAC" | Agent's service account has only get/list/describe verbs; destructive verbs live in a separate server behind approval |
| Audit log | "Considered vs executed" | Append-only record of every candidate command, whether it ran, who approved |
| Hypothesis ranking | "Evidence score" | Recency × specificity × graph-path length inverse × citation count |
| Slack approval card | "HITL gate" | Interactive Slack message with remediation buttons; agent cannot proceed until a human clicks |
| Telemetry citation | "Evidence pointer" | A Prometheus query, Loki selector, or Tempo trace URL that supports a claim |
| MTTR | "Time to resolution" | Wall-clock from alert fire to SLO recovery |

## आगे पढ़ना

- [AWS DevOps Agent GA](https://aws.amazon.com/blogs/mt/announcing-general-availability-of-aws-devops-agent/): 2026 के कैनोनिक संदर्भ
- [Resolve AI K8s troubleshooting](https://resolve.ai/blog/kubernetes-troubleshooting-in-resolve-ai) प्रतियोगी संदर्भ
- [NeuBird semantic monitoring](https://www.neubird.ai) अर्थिक ग्राफ दृष्टिकोण
- [Metoro AI SRE](https://metoro.io) SLO-first उत्पादन फ्रेमिंग
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) समूह-राज्य स्रोत
- [LangGraph](https://langchain-ai.github.io/langgraph/) संदर्भ एजेंट ऑर्केस्ट्रेटर
- [FastMCP](https://github.com/jlowin/fastmcp) पायथन एमसीपी सर्वर फ्रेमवर्क
- [ArgoCD rollback](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_rollback/) बंद सुधार लक्ष्य
