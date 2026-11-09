# उत्पादन में निगरानी मॉडल  डेटा ड्रिफ्ट और अवधारणा ड्रिफ्ट

> एक तैनात मॉडल त्रुटि संदेश के बिना विफल रहता है। यह स्कोर वापस करता रहता है जबकि दुनिया अपने प्रशिक्षण डेटा से दूर जाती है, और केवल निगरानी अंतर को दिखाती है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## सीखने के लक्ष्य

- चार स्तरों पर निगरानी संकेतों का चयन करेंः सिस्टम स्वास्थ्य, इनपुट, भविष्यवाणियां और परिणाम
- संयुक्त वितरण के उस हिस्से द्वारा सह-विवर्तन बहाव, पूर्व बहाव और अवधारणा बहाव को अलग करें जो बदलता है
- जनसंख्या स्थिरता सूचकांक, दो नमूने के कोलमोगोरोव-स्मिरनोव आंकड़े और शून्य से चि-क्वायर परीक्षण को लागू करें
- एक फिक्स्ड रेफरेंस विंडो की तुलना स्लाइडिंग वर्तमान विंडो से करें, और समझाएं कि विंडो आकार शोर और देरी में कैसे बदलाव करता है
- एक चेतावनी नीति तैयार करें जो प्रभाव आकार, कई परीक्षणों के साथ झूठी अलार्मों को सीमित करती है, और एक दृढ़ता नियम
- तय करें कि किस प्रकार के बहाव को पुनर्व्यवस्थापन की आवश्यकता है, किसको नए लेबल की आवश्यकता है, और किसको कोई कार्रवाई की आवश्यकता नहीं है

## समस्या

भुगतान जोखिम मॉडल 95 प्रतिशत सटीकता के साथ लाइव हो जाता है। दो महीने बाद, एक मार्केटिंग अभियान में ऐप उपयोगकर्ताओं को बड़ी टोकरी के साथ लाया जाता है। चार महीने बाद, धोखाधड़ी करने वाले अपनी रणनीति बदलते हैं, और पहले सुरक्षित भुगतान वापस चार्ज में बदलना शुरू हो जाते हैं।

मॉडल सेवा इस सब के दौरान प्रत्येक अनुरोध के लिए HTTP 200 लौटाती है। विलंबता सामान्य है, और लॉग में कोई त्रुटि नहीं दिखाई देती है। समस्या का पहला संकेत क्षति के हफ्तों बाद चार्जबैक के बारे में वित्त रिपोर्ट है।

सॉफ्टवेयर निगरानी जांचता है कि क्या एक सेवा जवाब देती है. मॉडल निगरानी जांचता है कि क्या जवाब अभी भी सही हैं, और क्या डेटा अभी भी मॉडल को प्रशिक्षित करने वाले डेटा की तरह दिखता है। इस पाठ में उस दूसरे काम के लिए आंकड़े, खिड़कियां और अलर्ट नीति का निर्माण किया जाता है। आप उन्हें दो इंजेक्टेड परिवर्तनों के साथ सिंथेटिक स्ट्रीम पर चलाते हैं और देखते हैं कि कौन सा मॉनिटर किस परिवर्तन पर प्रतिक्रिया करता है।

## अवधारणा

### क्या निगरानी करनी है

चार परतों की निगरानी करें, पहले तीन सतर्कता देते हैं, केवल चौथे स्तर की सटीकता को मापते हैं और यह देर से आता है।

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

इनपुट मॉनिटरिंग इस पाठ का मुख्य विषय है, क्योंकि यह लेबल आने से पहले काम करता है। इसका एक सीमा है जो डेमो दिखाता हैः कुछ परिवर्तन इनपुट को छूने से बचे रहते हैं।

### तीन प्रकार की बहाव

इनपुटों की संयुक्त वितरण लिखें `x`और लेबल `y`दो तरीकों सेः

```math
P(x, y) = P(x) \cdot P(y \mid x) = P(y) \cdot P(x \mid y)
```

प्रत्येक प्रकार की बहाव एक अलग कारक बदलता हैः

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

गामा और अन्य को परिवर्तन के लिए बुलाओ `P(y | x)`वास्तविक अवधारणा बहाव. वे एक परिवर्तन में कहते हैं`P(x)`जो छोड़ देता है`P(y | x)`उनके सर्वेक्षण में यह भी पता चलता है कि यह समय के साथ कैसे होता हैः अचानक, क्रमिक, धीरे-धीरे, या एक अवधारणा के रूप में जो वापस आता है.

यदि मॉडल ने सीखा है तो यह हमेशा चोट नहीं पहुंचाता है।`P(y | x)`यह अभी भी सटीकता खो सकता है जब यातायात कम प्रशिक्षण डेटा के साथ क्षेत्रों में स्थानांतरित होता है या निर्णय सीमा के करीब.

### विलंबित लेबल

परिणाम भविष्यवाणी के बाद आता है। देरी समस्या पर निर्भर करती हैः

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

देरी के दौरान, आपके पास इनपुट और भविष्यवाणियां हैं लेकिन कोई परिणाम नहीं हैं। इनपुट और भविष्यवाणियों की निगरानी करें, जब वे आते हैं तो लेबलों में शामिल हों, और केवल लेबल वाले भाग पर परिणाम मीट्रिक की गणना करें। डेमो में 500 घटनाओं का लेबल देरी का उपयोग किया जाता है, इसलिए परिणाम मॉनिटर हमेशा अतीत में 500 घटनाओं को देखता है।

### संदर्भ और वर्तमान खिड़कियां

प्रत्येक बहाव परीक्षण में दो नमूनों की तुलना की जाती हैः

- **Reference window.**प्रशिक्षण डेटा, या उत्पादन की अवधि जिसे आपने हाथ से जांच की है। यह तब तक तय रहता है जब तक आप पुनः प्रशिक्षण नहीं करते।
- **Current window.**नवीनतम घटनाएँ, या तो अंतिम `N`घटनाएँ या अंतिम `T`घंटों।

एक स्लाइडिंग विंडो अपने आकार से एक कदम छोटे से आगे बढ़ती है, इसलिए लगातार खिड़कियां ओवरलैप होती हैं। एक टंबलिंग विंडो अपने पूर्ण आकार से आगे बढ़ती है। खिड़की का आकार एक व्यापार है। एक छोटी खिड़की जल्दी प्रतिक्रिया करती है लेकिन धूल के रूप में शोर को स्कोर करती है। एक बड़ी खिड़की स्थिर है लेकिन देरी से परिवर्तन की सूचना देती है।

मौसमीता ने भोले खिड़कियों को तोड़ दिया। कई उत्पादों में सोमवार का ट्रैफ़िक शनिवार के ट्रैफ़िक से अलग है। संदर्भ को एक पूर्ण चक्र को कवर करें, या प्रत्येक खिड़की को एक पूर्ववर्ती चक्र में एक ही अवधि के साथ तुलना करें।

### जनसंख्या स्थिरता सूचकांक

PSI क्रेडिट स्कोरिंग से आता है। संदर्भ मानों को कंटेनरों में काटें, आमतौर पर संदर्भ डेसिल्स पर दस कंटेनर, ताकि प्रत्येक कंटेनर संदर्भ का 10 प्रतिशत रखता हो। प्रत्येक कंटेनर में वर्तमान मानों के हिस्से की गणना करें। फिर प्रति कंटेनर एक शब्द जोड़ेंः

```math
\text{PSI} = \sum_{\text{bins}} (\text{current\_share} - \text{reference\_share}) \cdot \ln\left(\frac{\text{current\_share}}{\text{reference\_share}}\right)
```

शून्य के हिस्से के साथ एक बिन लॉग को अनंत बनाता है, इसलिए प्रत्येक हिस्से को 0.0001 जैसे छोटे मूल्य तक क्लिप करें। PSI सममित है। यह वर्तमान से संदर्भ के लिए KL विचलन के बराबर है।

अभ्यासकर्ताओं ने स्थिर बैंड के साथ पीएसआई पढ़ाः 0.1 से नीचे स्थिर है, 0.1 से 0.25 तक मध्यम बदलाव है, और 0.25 से ऊपर एक महत्वपूर्ण बदलाव है। इन बैंडों को एक सम्मेलन के रूप में देखें, न कि एक परीक्षण के रूप में। पीएसआई कंटेनरों की संख्या के साथ बढ़ता है और नमूना आकार के साथ सिकुड़ता है। डेमो में, 500 घटनाओं की खिड़कियां बिना ड्रिफ्ट स्कोर के 0.01 से 0.04 के बीच हैं।

### कोलमोगोरोव-स्मिर्नोव सांख्यिकी

दो नमूने के एस आंकड़े `D`दो अनुभवजन्य संचयी वितरण कार्यों के बीच सबसे बड़ा ऊर्ध्वाधर अंतर हैः

```math
D = \max_x \left\lvert F_{\text{reference}}(x) - F_{\text{current}}(x) \right\rvert
```

`D`समान नमूनों के लिए 0 और नमुने के लिए 1 है जो ओवरलैप नहीं करते हैं। इसमें कोई डिब्बे की आवश्यकता नहीं है। p-मूल्य कोलमोगोरोव वितरण से आता है जिसमें प्रभावी नमूना आकार होता है `n * m / (n + m)`. .

बड़े नमूनों के साथ, p-मूल्य शून्य पर जाता है एक अंतर के लिए जो किसी को भी परवाह नहीं करता है। 0.02 मानक विचलन की एक शिफ्ट प्रति विंडो में एक मिलियन घटनाओं के साथ "महत्वपूर्ण" है। उपयोग `D`प्रभाव आकार के रूप में खुद को, और केवल जब दोनों के लिए सतर्क`D`और p-मूल्य अपने सीमाओं से अधिक है।

### श्रेणीगत विशेषताओं के लिए चि-क्वायर परीक्षण

किसी श्रेणीगत सुविधा के लिए, जैसे कि भुगतान चैनल, दो पंक्तियों (संदर्भ, वर्तमान) और प्रति श्रेणी एक स्तंभ के साथ एक तालिका बनाएं। प्रत्येक सेल में अपेक्षित संख्या पंक्ति और स्तंभ कुल से आती हैः

```math
\begin{aligned}
\text{expected}[r][c] &= \text{row\_total}[r] \cdot \text{column\_total}[c] / \text{grand\_total} \\
\text{chi2} &= \sum_{\text{cells}} (\text{observed} - \text{expected})^2 / \text{expected}
\end{aligned}
```

परीक्षण में है`k - 1``k`श्रेणी. एक श्रेणी जो केवल वर्तमान विंडो में दिखाई देती है एक बड़ा शब्द जोड़ती है, इसलिए परीक्षण नए मानों पर प्रतिक्रिया करता है। क्रेमर का V प्रभाव आकार है। दो पंक्तियों वाली तालिका के लिए, यह  के वर्गमूल के बराबर है`chi2 / grand_total`. .

### चेतावनी सीमा और झूठी अलार्म

प्रत्येक परीक्षण में एक झूठी अलार्म दर है`alpha`निगरानी कई परीक्षण चलाता है. 50 सुविधाओं की जाँच हर घंटे पर`alpha = 0.05`लोग अलार्म पढ़ने से बहुत पहले ही रुक जाते हैं।

चार नियम अलर्ट दर को उपयोगी रखते हैंः

1. **Correct for multiple tests.**बोनफेर्रोनी सुधार विभाजित करता है `alpha`परीक्षणों की संख्या के अनुसार। डेमो एक परिवार का उपयोग करता है`alpha`दो परीक्षणों पर 0.01 का, इसलिए प्रत्येक परीक्षण 0.005 का उपयोग करता है।
2. **Require an effect size.**केवल जब पीएसआई,`D`, या क्रैमर के V भी एक सीमा से गुजरता है.
3. **Require persistence.**चेतावनी केवल बाद में`k`लगातार ड्रिफ्ट खिड़कियों. डेमो का उपयोग करता है`k = 2`. .
4. **Separate warnings from alerts.**एक चेतावनी डैशबोर्ड पर जाती है। एक चेतावनी एक व्यक्ति को जाती है।

डेमो नियम 2 काम कर रहा है दिखाता है. एक साफ खिड़की में 0.0009 के एक चि-वर्ग p-मूल्य है, प्रति परीक्षण से नीचे`alpha`. इसके क्रैमर V 0.1 से नीचे है, इसलिए पॉलिसी एक चेतावनी रिकॉर्ड करता है, एक अलर्ट नहीं.

### पुनर्व्यास ट्रिगर

पुनर्व्यवस्था के लिए तीन आम ट्रिगर हैंः

- **Schedule.**यह सरल है, लेकिन जब कुछ नहीं बदला तो यह फिर से प्रशिक्षण देता है और जब कुछ हुआ तो इंतजार करता है।
- **Drift.**जब महत्वपूर्ण विशेषताओं पर इनपुट बहाव सीमा से ऊपर रहता है तो पुनः प्रशिक्षण।
- **Performance.**जब एक परिणाम मीट्रिक संदर्भ मूल्य से कम छूट एक सहिष्णुता गिर जाता है।

इस प्रकार की बहाव तय करती है कि पुनर्व्यवस्था क्या कर सकती हैः

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

पुनः प्रशिक्षण के बाद, नवीनतम लेबल वाले डेटा पर नए मॉडल का परीक्षण करें। सिस्टम डिजाइन पाठ के छाया और कैनरी चरणों के साथ इसे बाहर रोल करें। फिर नए प्रशिक्षण डेटा के लिए संदर्भ विंडो को रीसेट करें।

```figure
mlprod-drift-psi
```

## इसे बनाओ

कोड में `code/main.py`केवल मानक पुस्तकालय का उपयोग करता है।

### चरण 1: क्वांटिल डिब्बे और पीएसआई

कचरे के किनारे संदर्भ डेसिल हैं।`bisect_right`प्रत्येक मूल्य का कचरा ढूंढता है।

```python
def quantile_edges(reference: list[float], bins: int = 10) -> list[float]:
    ordered = sorted(reference)
    n = len(ordered)
    edges = [ordered[min(n - 1, (n * i) // bins)] for i in range(1, bins)]
    return sorted(set(edges))


def psi_from_fractions(expected: list[float], actual: list[float], eps: float = 1e-4) -> float:
    total = 0.0
    for e, a in zip(expected, actual):
        e, a = max(e, eps), max(a, eps)
        total += (a - e) * math.log(a / e)
    return total
```

### चरण 2: केएस आंकड़ा और उसका p-मूल्य

दोनों क्रमबद्ध नमूनों को एक साथ चलाएं। प्रत्येक अलग-अलग मूल्य पर, दोनों नमूनों में इसकी प्रत्येक प्रति को पार करें, फिर दो संचयी शेयरों की तुलना करें। यह सही ढंग से बंधन को संभालता है।

```python
def ks_statistic(sample_a: list[float], sample_b: list[float]) -> float:
    a, b = sorted(sample_a), sorted(sample_b)
    n, m = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < n and j < m:
        x = min(a[i], b[j])
        while i < n and a[i] <= x:
            i += 1
        while j < m and b[j] <= x:
            j += 1
        d = max(d, abs(i / n - j / m))
    return d
```

p-मूल्य कोलमोगोरोव वितरण के लिए श्रृंखला का उपयोग करता है,`2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`, के साथ `lambda = sqrt(n * m / (n + m)) * D`. .

### चरण 3: चि-क्वायर परीक्षण

`chi2_sf`यह नियमित ऊपरी अपूर्ण गामा फ़ंक्शन के माध्यम से चि-क्वायर अस्तित्व फ़ंक्शन की गणना करता है। यह छोटे तर्क के लिए एक श्रृंखला और बड़े तर्क के लिए एक निरंतर अंश का उपयोग करता है। `chi_square_test`दो पंक्तियों की तालिका बनाता है, आंकड़े की गणना करता है, और p-मूल्य और Cramér के V लौटाता है।

```python
def chi_square_test(reference_counts: dict[str, int], current_counts: dict[str, int]) -> ChiSquareResult:
    categories = [c for c in sorted(set(reference_counts) | set(current_counts))
                  if reference_counts.get(c, 0) + current_counts.get(c, 0) > 0]
    rows = [[reference_counts.get(c, 0) for c in categories], [current_counts.get(c, 0) for c in categories]]
    row_totals = [sum(r) for r in rows]
    grand = sum(row_totals)
    if len(categories) < 2 or 0 in row_totals:
        return ChiSquareResult(0.0, 0, 1.0, 0.0)
    statistic = 0.0
    for col, _ in enumerate(categories):
        col_total = rows[0][col] + rows[1][col]
        for r in range(2):
            expected = row_totals[r] * col_total / grand
            statistic += (rows[r][col] - expected) ** 2 / expected
    dof = len(categories) - 1
    return ChiSquareResult(statistic, dof, chi2_sf(statistic, dof), math.sqrt(statistic / grand))
```

### चरण 4: विंडो और ड्रिफ्ट मॉनिटर

`SlidingWindow`आखिरी को रखता है `size`एक `deque`. .`DriftMonitor`संदर्भ डिब्बे की गणना करता है और एक बार गिनता है।`check`विधि पीएसआई लौटाता है, `D`, और प्रत्येक संख्यात्मक विशेषता के लिए KS p-मूल्य, और प्रत्येक श्रेणीत्मक विशेषता के लिए चि-वर्ग परिणाम।

### चरण 5: अलर्ट नीति

नीति प्रत्येक मीट्रिक सेट को एक स्तर में बदल देती है और प्रत्येक संकेत के लिए लगातार ड्रिफ्ट विंडो गिनती करती हैः

```python
def level(self, metrics: dict[str, float]) -> str:
    if "psi" in metrics:
        if metrics["psi"] >= self.psi_drift or (metrics["ks"] >= self.ks_drift and metrics["ks_p"] < self.alpha):
            return "drift"
        return "warn" if metrics["psi"] >= self.psi_warn else "ok"
    if metrics["p"] < self.alpha and metrics["v"] >= self.min_cramers_v:
        return "drift"
    return "warn" if metrics["p"] < self.alpha else "ok"
```

`update`रिटर्न `ALERT`खिड़की पर जो रेखा को पूरा करता है, और `resolved`अलर्ट के बाद पहली साफ खिड़की पर।

### चरण 6: इंजेक्शन के साथ धारा

इस धारा में 9000 भुगतान घटनाएं हैं।`amount`, ए `channel`, और एक धोखाधड़ी `label`चार खंडों द्वारा परिभाषित किया गया हैः

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

मॉडल एक सीमा है `amount`विंडोज 500 घटनाओं को आयोजित करता है और 250 तक आगे बढ़ता है। लेबल 500 घटनाओं के लिए देर से पहुंचते हैं।

```bash
python3 code/main.py
npx tsx code/main.ts
```

```console
  end    PSI   KS D   chi2 p    acc  levels (amount/channel/accuracy)  events
 3000  0.010  0.041  3.0e-01  0.932  ok/ok/ok
 3250  0.152  0.163  7.6e-06  0.924  drift/warn/ok
 3500  0.463  0.298  2.8e-26  0.936  drift/drift/ok                     ALERT amount
 3750  0.609  0.343  3.5e-35  0.942  drift/drift/ok                     ALERT channel
 ...
 5500  0.026  0.044  2.6e-01  0.898  ok/ok/ok                           resolved amount, resolved channel
 ...
 7250  0.040  0.048  7.1e-01  0.848  ok/ok/drift
 7500  0.022  0.039  6.1e-01  0.778  ok/ok/drift                        ALERT accuracy
```

परिणाम को तीन भागों में पढ़ेंः

- **Covariate drift.**घटना 3000 पर बहाव शुरू होता है, और `amount`चेतावनी 3500 पर है। सटीकता 0.89 से 0.95 के बीच रहती है, क्योंकि लेबल नियम नहीं बदला है।
- **Recovery.**इनपुट 5000 पर सामान्य हो जाते हैं, और दोनों अलर्ट 5500 पर हल हो जाते हैं।
- **Concept drift.**6. इनपुट मॉनिटरों पर इनपुट की गति घटती है। इनपुट मॉनिटरों पर इनपुट की गति घटती है। इनपुट मॉनिटरों पर इनपुट की गति घटती है। इनपुट मॉनिटरों पर इनपुट में परिवर्तन नहीं होता है। इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटरों पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटरों पर इनपुट मॉनिटर पर इनपुट मॉनिटरों पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटरों पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटरों पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट मॉनिटर पर इनपुट की सटीक सटीक सटीकताटर पर इनपुट मॉनिटर पर इनपुट की सटीक सटीक सटीक बढ़ बढ़ता है।

## इसका प्रयोग करें

**scipy.** `scipy.stats`इस पाठ को चलाने के लिए स्किपी की आवश्यकता नहीं है।

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

हमने जाँच की`ks_statistic`और `chi_square_test`केएस सांख्यिकी, चि-चौरस सांख्यिकी और चि-चौरस पी-मूल्य फ्लोटिंग-पॉइंट सटीकता से मेल खाए। 200 से अधिक यादृच्छिक जोड़े के नमूने, केएस पी-मूल्य स्किपी के मूल्य से 18 प्रतिशत तक भिन्न थे। सबसे बड़े अंतराल बहुत छोटे पी-मूल्य पर थे।

हमारे कोड कोलमोगोरोव वितरण सीमा का उपयोग करता है।`ks_2samp`एक सटीक विधि का उपयोग करता है जब दोनों नमूनों में अधिकतम 10,000 मान होते हैं। इसका असंबोटिक मोड गोल प्रभावी नमूना आकार के साथ एक परिमित नमूना वितरण का उपयोग करता है। दो श्रेणियों के साथ, `chi2_contingency`डिफ़ॉल्ट रूप से Yates की निरंतरता सुधार लागू करता है, इसलिए आंकड़े वहां भिन्न होते हैं।

**Monitoring libraries.**कई ओपन सोर्स लाइब्रेरी इन परीक्षणों को रिपोर्ट और डैशबोर्ड के साथ पैक करती हैंः

- **Evidently**एक कॉलम पर एक बहाव परीक्षण चुनता है। 1000 पंक्तियों या उससे कम के संदर्भ के लिए, यह संख्यात्मक कॉलम के लिए केएस परीक्षण और श्रेणियों के लिए चि-क्वायर परीक्षण का उपयोग करता है। बड़े डेटा के लिए, यह वास्स्टीन दूरी और 0.1 के लिए जेन्सेन-शैनन विचलन का उपयोग करता है। PSI अन्य तरीकों में से एक है जिसे आप चुन सकते हैं।
- **NannyML**यह मॉडल के प्रदर्शन का अनुमान लेबल आने से पहले करता है। इसका आत्मविश्वास आधारित प्रदर्शन अनुमान (सीबीपीई) मॉडल की भविष्यवाणी की गई संभावनाओं का उपयोग करता है, जो अच्छी तरह से मापनी होनी चाहिए। नैननीएमएल दस्तावेज में कहा गया है कि सीबीपीई कोवैरिएट शिफ्ट को संभालता है लेकिन अवधारणा बहाव से निपटता नहीं है। डेमो स्ट्रीम दिखाता है कि क्योंः केवल लेबल ने अवधारणा बहाव का खुलासा किया।
- **TensorFlow Data Validation**यह क्रमशः डेटा की अवधि की तुलना करता है। यह श्रेणीगत विशेषताओं के लिए एल-अनंत दूरी और संख्यात्मक विशेषताओं के लिए अनुमानित जेनसेन-शैनन विचलन का उपयोग करता है। यह प्रशिक्षण डेटा की तुलना सेवा डेटा के साथ भी करता है, जिसे फीचर स्टोर पाठ कवर करता है।

स्क्रैच कोड से पता चलता है कि इन उपकरणों में से प्रत्येक क्या गणना करता है। इन उपकरणों में भंडारण, शेड्यूलिंग, डैशबोर्ड और कई अन्य परीक्षण शामिल हैं।

LLM के लिए आवेदन करने के लिए, [LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md)इस पाठ में दिए गए विचार अभी भी इन सिस्टम के इनपुट और आउटपुट पर लागू होते हैं।

## इसे भेजें

यह सबक हमें फल देता है`outputs/skill-drift-monitoring.md`. कौशल एक नए मॉडल के लिए मॉनिटरों की योजना बनाता है और एक बहाव अलर्ट को क्रमबद्ध करता है। यह पूछता है कि किस परत ने गोली मार दी, सबूतों के अनुरूप किस तरह का बहाव है, और क्या सही कार्रवाई प्रतीक्षा करना है, पुनः मापना, लेबल एकत्र करना, या फिर से प्रशिक्षण।

## व्यायाम

1. 200 और 2000 घटनाओं की खिड़कियों के साथ धारा चलाएं, घटना 3000 से पहले झूठी चेतावनी और अलर्ट देरी रिकॉर्ड करें।
2. सेट `n_tests=1`,`patience=1`और `min_cramers_v=0`. 5000 से 6500 तक साफ अवधि में अलर्ट गिनें।
3. एक विशेषता जोड़ी जिसका औसत प्रति 100 घटनाओं 0.01 से बढ़ता है. पता लगाएं कि संकेत, PSI या KS, सबसे पहले प्रतिक्रिया करता है.
4. एक ही डेसिल डिब्बे पर जेन्सेन-शैनन दूरी लागू करें। प्रत्येक खिड़की पर पीएसआई के साथ इसकी तुलना करें।
5. मॉडल की सकारात्मक भविष्यवाणी की दर के लिए एक मॉनिटर जोड़ें। अवधारणा बहाव के दौरान यह चुप क्यों रहता है, समझाएं।

## प्रमुख शर्तें

| Term | What people say | What it means |
|------|----------------|----------------------|
| Data drift | "The data changed" | A change in the distribution of inputs, predictions, or labels compared with a reference window |
| Covariate drift | "New kinds of users" | `P(x)` changes while `P(y \| x)` stays the same |
| Prior drift | "More positives than before" | `P(y)` changes while `P(x \| y)` stays the same, also called label shift |
| Concept drift | "The rules of the game changed" | `P(y \| x)` changes, so the same input now has a different correct answer |
| Reference window | "The baseline data" | A fixed sample, often the training data, that every current window is compared with |
| PSI | "The stability score" | A symmetric sum over bins of (current share minus reference share) times the log of their ratio |
| KS statistic | "The KS test" | The largest gap between two empirical cumulative distribution functions |
| Cramér's V | "Effect size for categories" | The chi-square statistic scaled to the range 0 to 1 |
| Label delay | "Ground truth comes later" | The time between a prediction and the arrival of its true outcome |
| Alert fatigue | "Too many pages" | People ignore alerts because most of them were false alarms |

## आगे पढ़ना

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation): वास्तविक और आभासी बहाव, बहाव पैटर्न और अनुकूलन विधियां
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): शिफ्ट डिटेक्शन के लिए दो नमूना परीक्षण
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785): बहाव का पता लगाने, समझने और अनुकूलन के तरीके
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/): नमूना आकार और कचरे की संख्या के साथ पीएसआई का व्यवहार कैसे होता है
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html): दो नमूना के एसएस परीक्षण के लिए सटीक और असंबटिक पी-मूल्य पद्धति
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift): स्तंभ प्रकार और डेटा आकार द्वारा डिफ़ॉल्ट परीक्षण चयन
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html): CBPE और उसके अनुमान
