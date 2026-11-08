# संख्यात्मक स्थिरता

> फ्लोटिंग प्वाइंट एक लीक अमूर्तता है. यह प्रशिक्षण के दौरान आप काट देगा, और आप इसे आने के लिए नहीं देखेंगे.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## सीखने के लक्ष्य

- अधिकतम-घटाव ट्रिक का उपयोग करके संख्यात्मक रूप से स्थिर सॉफ्टमैक्स और लॉग-सम-एक्सप्लेंट को लागू करें
- फ्लोटिंग पॉइंट गणना में ओवरफ्लो, अंडरफ्लो और आपदा रद्द करना पहचानें
- केंद्रीकृत अंतराल अंतर का उपयोग करके संख्यात्मक अंतराल के खिलाफ विश्लेषणात्मक ग्रेडिएंट की जांच करें
- बताएं कि प्रशिक्षण के लिए क्यों bfloat16 को float16 से अधिक पसंद किया जाता है और कैसे हानि स्केलिंग ग्रेडिएंट डाउनफ्लो को रोकती है

## समस्या

आप एक प्रिंट स्टेटमेंट जोड़ते हैं, लॉजिट स्टेप 9,000 पर ठीक है, स्टेप 9,001 पर वे हैं`inf`. चरण 9,002 द्वारा प्रत्येक ग्रेडिएंट है`nan`और प्रशिक्षण मृत है।

याः आपका मॉडल पूरा होने के लिए तैयार है लेकिन सटीकता कागज के दावे से 2% खराब है। आप सब कुछ जांचते हैं। वास्तुकला मेल खाता है। हाइपरपैरामीटर मेल खाते हैं। डेटा मेल खाता है। समस्या यह है कि कागज ने float32 का उपयोग किया और आपने सही स्केलिंग के बिना float16 का उपयोग किया। संचित गोल त्रुटि के 32 बिट चुपचाप आपकी सटीकता को खा लिया।

याः आप क्रॉस-एंट्रोपी हानि को खरोंच से लागू करते हैं। यह छोटे लॉग पर काम करता है। जब लॉग 100 से अधिक है, यह वापस आ जाता है।`inf`. सॉफ्टमैक्स ओवरफ्लो किया क्योंकि`exp(100)`यह एक दो पंक्ति के ट्रिक के साथ संभालता है. आप ट्रिक अस्तित्व में पता नहीं था.

संख्यात्मक स्थिरता एक सैद्धांतिक चिंता नहीं है। यह एक प्रशिक्षण रन के बीच अंतर है जो सफल होता है और एक जो चुपचाप विफल होता है। आप हर गंभीर एमएल बग को डिबग करेंगे अंततः एक फ्लोटिंग पॉइंट तक नीचे आता है।

## अवधारणा

### आईईईई 754: कंप्यूटर वास्तविक संख्याओं को कैसे स्टोर करते हैं

कंप्यूटर IEEE 754 मानक के अनुसार फ्लोटिंग प्वाइंट वैल्यू के रूप में वास्तविक संख्याओं को संग्रहीत करते हैं। एक फ्लोट में तीन भाग होते हैंः एक साइन बिट, एक एक्सपोनेंट और एक मंटिस (सर्गेय और) ।

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

मानटिसा सटीकता (कितने महत्वपूर्ण अंकों) निर्धारित करता है। एक्सपोनेंट रेंज (कितना बड़ा या छोटा एक संख्या हो सकती है) निर्धारित करता है।

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 आपको सटीकता के लगभग 7 दशमलव अंकों देता है। इसका मतलब है कि यह 1.0000001 और 1.0000002 को अलग कर सकता है, लेकिन 1.00000001 और 1.00000002 को नहीं। 7 अंकों के बाद, सब कुछ गोल शोर है।

float16 आपको लगभग 3 अंकों देता है। यह सबसे बड़ी संख्या 65,504 है। यह एमएल के लिए परेशान करने के लिए छोटा है जहां लॉजिट, ग्रेडिएंट और सक्रियण नियमित रूप से इससे अधिक हैं।

bfloat16 float16 की रेंज समस्या का गूगल का जवाब है. इसमें float32 (समान रेंज, 3.4e38) के समान 8-बिट एक्सपोनेंट है, लेकिन केवल 7 mantissa बिट (float16 की तुलना में कम सटीकता) है। प्रशिक्षण तंत्रिका नेटवर्क के लिए, रेंज सटीकता से अधिक मायने रखता है, इसलिए bfloat16 आमतौर पर जीतता है।

### क्यों 0.1 + 0.2 ! = 0.3

0.1 संख्या को बाइनरी फ्लोटिंग प्वाइंट में सटीक रूप से दर्शाया नहीं जा सकता है। आधार 2 में यह एक दोहराव अंश हैः

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float32 इसे 23 बिट्स में छोटा करता है। संग्रहीत मूल्य लगभग 0.100000001490116 है। इसी तरह, 0.2 को लगभग 0.200000002980232 के रूप में संग्रहीत किया जाता है। उनका योग 0.300000004470348 है, 0.3 नहीं।

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

यह एमएल के लिए मायने रखता है क्योंकिः

1. हानि तुलना जैसे `if loss < threshold`गलत उत्तर दे सकता है
2. कई छोटे मानों को जमा करना (हजारों चरणों में क्रमिक अद्यतन) वास्तविक राशि से विचलित होता है
3. चेकसम और पुनरुत्पादन क्षमता परीक्षण विफल होते हैं यदि आप फ्लोट्स की तुलना `==`

फिक्सः कभी भी फ्लोट्स की तुलना न करें`==`उपयोग करें`abs(a - b) < epsilon`या `math.isclose()`. .

### विनाशकारी रद्द

जब आप दो लगभग समान तैरते बिंदु संख्याओं को घटाते हैं, तो महत्वपूर्ण अंक रद्द हो जाते हैं और आपको गोल शोर के साथ अग्रणी अंक में पदोन्नत किया जाता है।

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

यह एक एकल घटाने से 19% सापेक्ष त्रुटि है। ML में, यह हर बार होता है जब आपः

- बड़ी औसत के साथ डेटा की गणना करें: $\mathbb{E}[x^2] - \mathbb{E}[x]^2$कब$\mathbb{E}[x]$बड़ा है
- लगभग समान लॉग-संभाव्यताओं को घटाएं
- बहुत छोटे एप्सिलन के साथ परिमित अंतर ग्रेडिएंट की गणना करें

फिक्सः बड़ी, लगभग समान संख्याओं को घटाए जाने से बचने के लिए सूत्रों को फिर से व्यवस्थित करें। भिन्नता के लिए, पहले वेल्फोर्ड एल्गोरिदम का उपयोग करें या डेटा को केंद्र में रखें। लॉग-संभाव्यता के लिए, लॉग-स्पेस में काम करें।

### ओवरफ्लो और डाउनफ्लो

ओवरफ्लो तब होता है जब एक परिणाम प्रतिनिधित्व करने के लिए बहुत बड़ा होता है। अंडरफ्लो तब होता है जब यह बहुत छोटा होता है (सबसे छोटे प्रतिनिधित्व योग्य सकारात्मक संख्या से शून्य के करीब) ।

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

`exp()`कार्य ML में अतिप्रवाह का प्राथमिक स्रोत हैः

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

`log()`फ़ंक्शन दूसरी दिशा में हिट करता हैः

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

एमएल में, `exp()`softmax, sigmoid और संभावना गणना में दिखाई देता है। `log()`क्रॉस-एंट्रोपी, लॉग-संभाव्यता और KL विचलन में दिखाई देता है।`log(exp(x))`सही ट्रिक्स के बिना एक खदान क्षेत्र है।

### लॉग-सम-एक्सप ट्रिक

कम्प्यूटिंग `log(sum(exp(x_i)))`सीधे संख्यात्मक रूप से खतरनाक है।`x_i`बड़ा है,`exp(x_i)`यदि सभी `x_i`बहुत नकारात्मक हैं, हर `exp(x_i)`शून्य तक नीचे प्रवाह और `log(0)`है `-inf`. .

चालः exponentiating से पहले अधिकतम मान घटाएं।

```math
\log\left(\sum_i \exp(x_i)\right) = \max(x) + \log\left(\sum_i \exp(x_i - \max(x))\right)
```

यह काम क्यों करता हैः घटाने के बाद `max(x)`, सबसे बड़ा एक्सपोनेंट है `exp(0) = 1`. कोई ओवरफ्लो संभव नहीं है. योग में कम से कम एक शब्द 1 है, इसलिए योग कम से कम 1 है, और `log(1) = 0`. कोई निचला प्रवाह नहीं है .`-inf`संभव है।

प्रमाण:

```math
\begin{aligned}
& \log\left(\sum_i \exp(x_i)\right) \\
&= \log\left(\sum_i \exp(x_i - c + c)\right) && \text{(add and subtract } c\text{)} \\
&= \log\left(\sum_i \exp(x_i - c) \cdot \exp(c)\right) && (\exp(a+b) = \exp(a) \cdot \exp(b)) \\
&= \log\left(\exp(c) \cdot \sum_i \exp(x_i - c)\right) && \text{(factor out } \exp(c)\text{)} \\
&= c + \log\left(\sum_i \exp(x_i - c)\right) && (\log(a \cdot b) = \log(a) + \log(b))
\end{aligned}
```

सेट `c = max(x)`और अतिप्रवाह समाप्त हो जाता है।

यह चाल ML में हर जगह दिखाई देती हैः
- सॉफ्टमैक्स सामान्यीकरण
- क्रॉस-एंट्रोपी हानि गणना
- अनुक्रम मॉडल में लॉग-संभाव्यता योग
- गौसीयन का मिश्रण
- भिन्नता का निष्कर्ष

### सॉफ्टमैक्स को मैक्स-घटाव की आवश्यकता क्यों है

Softmax संभावनाओं में लॉगिट परिवर्तित करता हैः

```math
\mathop{\mathrm{softmax}}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
```

बिना चाल के, [100, 101, 102] के लॉजिटों से अतिप्रवाह होता हैः

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

2.69e43 > 3.4e38, the float32 maximum, so every term overflows.
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

इस चाल के साथ, अधिकतम निकालें x = 102:

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

संभावनाएं समान हैं. गणना सुरक्षित है. यह एक अनुकूलन नहीं है. यह सटीकता के लिए एक आवश्यकता है.

### एनएएन और इन्फः पता लगाना और रोकथाम

`nan`(नहीं एक संख्या) और `inf`(अनंत) वायरस के माध्यम से प्रसारण गणना.`nan`एक ग्रेडिएंट अद्यतन में वजन बनाता है `nan`, जो प्रत्येक बाद में उत्पादन करता है `nan`प्रशिक्षण एक कदम के भीतर मृत है.

कैसे ?`inf`प्रकट होता हैः
- `exp()`बड़ी सकारात्मक संख्या के
- शून्य से विभाजनः `1.0 / 0.0`
- `float32`जमावों में अतिप्रवाह

कैसे ?`nan`प्रकट होता हैः
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- `sqrt()`एक नकारात्मक संख्या का
- `log()`एक नकारात्मक संख्या का
- किसी भी अंकगणित में एक मौजूदा शामिल `nan`

पता लगानाः

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

रोकथाम रणनीतियाँः

1.  तक क्लैंप इनपुट`exp()``exp(clamp(x, -80, 80))`
2. नामकरणों में एप्सिलन जोड़ेंः `x / (y + 1e-8)`
3. अंदर एप्सिलन जोड़ें `log()``log(x + 1e-8)`
4. स्थिर कार्यान्वयन का उपयोग करें (लॉग-सम-एक्सप, स्थिर सॉफ्टमैक्स)
5. वजन विस्फोट को रोकने के लिए ग्रेडिएंट क्लिपिंग
6. जाँचें `nan`/`inf`डिबगिंग के दौरान प्रत्येक आगे की पास के बाद

### संख्यात्मक ग्रेडिएंट जांच

विश्लेषणात्मक ग्रेडिएंट (बैकप्रॉपेगरेशन से) में बग हो सकते हैं। संख्यात्मक ग्रेडिएंट जांच उन्हें अंतहीन अंतर वाले ग्रेडिएंट की गणना करके सत्यापित करती है।

केन्द्रित अंतर सूत्रः

```math
\frac{df}{dx} \approx \frac{f(x + h) - f(x - h)}{2h}
```

यह है$O(h^2)$सटीक, आगे की अंतर से बहुत बेहतर $(f(x+h) - f(x)) / h$जो केवल है $O(h)$. .

चुनना $h$बहुत छोटा और विनाशकारी रद्द करने से उत्तर नष्ट हो जाता है। `h = 1e-5``1e-7`यह आम है।

जांचः विश्लेषणात्मक और संख्यात्मक ग्रेडिएंट के बीच सापेक्ष अंतर की गणना करें।

```math
\text{relative\_error} = \frac{\lvert \text{grad}_{\text{analytical}} - \text{grad}_{\text{numerical}} \rvert}{\max(\lvert \text{grad}_{\text{analytical}} \rvert, \lvert \text{grad}_{\text{numerical}} \rvert, 10^{-8})}
```

अंगूठे के नियमः
- relative_error < 1e-7: सही, ग्रेडिएंट सही है
- relative_error < 1e-5: स्वीकार्य, संभवतः सही
- relative_error > 1e-3: कुछ गलत है
- relative_error > 1: ग्रेडिएंट पूरी तरह से गलत है

एक नई परत या हानि समारोह को लागू करते समय हमेशा ग्रेडिएंट की जांच करें। PyTorch प्रदान करता है `torch.autograd.gradcheck()`इस के लिए.

### मिश्रित सटीकता प्रशिक्षण

आधुनिक जीपीयू में विशेष हार्डवेयर (टेन्सर कोर) है जो फ्लोट16 मैट्रिक्स गुणन को फ्लोट32 की तुलना में 2-8 गुना तेज़ गणना करता है। मिश्रित परिशुद्धता प्रशिक्षण इसका लाभ उठाता हैः

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

शुद्ध फ्लोट16 प्रशिक्षण की समस्याः ग्रेडिएंट अक्सर बहुत छोटे होते हैं (1e-8 या उससे कम) । फ्लोट16 ~ 6e-8 से नीचे की किसी भी चीज़ को शून्य तक नीचे बहता है। आपका मॉडल सीखना बंद कर देता है क्योंकि सभी ग्रेडिएंट अपडेट शून्य होते हैं।

समाधान नुकसान स्केल है:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

गतिशील हानि स्केलिंग स्वचालित रूप से पैमाने कारक समायोजित करता है। एक बड़े मूल्य (65536) के साथ शुरू करें। यदि gradients ओवरफ्लो करने के लिए `inf`, इसे आधा करो.$N$कदम बिना ओवरफ्लो के गुजरते हैं, इसे दोगुना करें।

### bfloat16 vs float16: क्यों bfloat16 ट्रेनिंग के लिए जीतता है

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16 में अधिक सटीकता है (10 mantissa bits vs 7) लेकिन सीमित रेंज (max ~65,504). bfloat16 में कम सटीकता है लेकिन फ्लोट32 (max ~3.4e38) के समान रेंज है।

तंत्रिका नेटवर्क के प्रशिक्षण के लिएः

- प्रशिक्षण के दौरान सक्रियण और लॉजिट नियमित रूप से 65,504 से अधिक होते हैं।
- फ्लॉट16 के साथ नुकसान स्केलिंग की आवश्यकता होती है लेकिन आमतौर पर bfloat16 के साथ अनावश्यक होती है क्योंकि इसकी सीमा ग्रेडिएंट मैग्निटी स्पेक्ट्रम को कवर करती है।
- bfloat16 float32 का एक सरल ट्रंक है: mantissa के निचले 16 बिट्स को छोड़ दें। रूपांतरण क्षुल्लक है और एक्सपोनेंट में हानि रहित है।

फ्लोट16 को उन स्थानों पर प्रशिक्षण के लिए पसंद किया जाता है जहां रेंज अधिक मायने रखता है। यही कारण है कि टीपीयू और आधुनिक एनवीआईडीआईए जीपीयू (ए 100, एच 100) में बीफ्लोट16 का समर्थन होता है।

### ग्रेडिएंट क्लिपिंग

विस्फोटक ग्रेडिएंट तब होते हैं जब ग्रेडिएंट कई परतों के माध्यम से तेजी से बढ़ते हैं (आरएनएन, गहरे नेटवर्क और ट्रांसफार्मर में आम) । एक एकल बड़ा ग्रेडिएंट एक चरण में सभी वजन को खराब कर सकता है।

दो प्रकार के क्लिपिंगः

**Clip by value:**प्रत्येक ग्रेडिएंट तत्व को स्वतंत्र रूप से दबाएं।

```
grad = clamp(grad, -max_val, max_val)
```

सरल लेकिन ग्रेडिएंट वेक्टर की दिशा बदल सकता है।

**Clip by norm:**पूरे ग्रेडिएंट वेक्टर को मापें ताकि इसका मान एक सीमा से अधिक न हो।

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

यह ग्रिडिएंट की दिशा को बनाए रखता है।`torch.nn.utils.clip_grad_norm_()`यह मानक विकल्प है।

विशिष्ट मान: `max_norm=1.0`ट्रांसफार्मर के लिए, `max_norm=0.5`आरएल के लिए, `max_norm=5.0`सरल नेटवर्क के लिए।

ग्रेडिएंट क्लिपिंग कोई हैक नहीं है, यह एक सुरक्षा तंत्र है। इसके बिना, एक ही आउटलियर बैच एक ग्रेडिएंट को काफी बड़ा बना सकता है जिससे प्रशिक्षण के हफ्तों को बर्बाद कर दिया जा सकता है।

### संख्यात्मक स्थिरता के रूप में सामान्यीकरण परतें

बैच नॉर्मलाइजेशन, लेयर नॉर्मलाइजेशन और आरएमएस नॉर्मलाइजेशन आमतौर पर नियमित करने वाले के रूप में प्रस्तुत किए जाते हैं जो प्रशिक्षण को अभिसरण में मदद करते हैं। वे संख्यात्मक स्थिरकर्ता भी हैं।

सामान्यीकरण के बिना, सक्रियण परतों के माध्यम से तेजी से बढ़ सकते हैं या सिकुड़ सकते हैंः

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

सामान्यीकरण प्रत्येक परत पर हालिया और पुनः सक्रियण सक्रियणः

```math
\mathop{\mathrm{LayerNorm}}(x) = \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x) + \epsilon} \cdot \gamma + \beta
```

`epsilon`(आमतौर पर 1e-5) शून्य से विभाजन को रोकता है जब सभी सक्रियण समान होते हैं।`gamma`और `beta`नेटवर्क को किसी भी पैमाने को बहाल करने की अनुमति दें जो उसे चाहिए।

इससे नेटवर्क में मान संख्यात्मक रूप से सुरक्षित रेंज में रहते हैं, जिससे आगे के पास में ओवरफ्लो और पीछे के पास में ग्रेडिएंट विस्फोट दोनों को रोका जाता है।

### आम एमएल संख्यात्मक कीड़े

**Bug: Loss is NaN after a few epochs.**
कारणः लॉजिट बहुत बड़ा हो गया, सॉफ्टमैक्स ओवरफ्लो हो गया या सीखने की दर बहुत अधिक है और वजन भिन्न हो गया है।
फिक्सः स्थिर सॉफ्टमैक्स (मैक्स घटाव) का उपयोग करें, सीखने की दर को कम करें, ग्रेडिएंट क्लिपिंग जोड़ें।

**Bug: Loss is stuck at log(num_classes).**
कारणः मॉडल आउटपुट लगभग समान संभावनाएं हैं। अक्सर इसका मतलब है कि ग्रेडिएंट गायब हो रहे हैं या मॉडल बिल्कुल भी सीख नहीं रहा है।
ठीक करेंः जांचें कि डेटा लेबल सही हैं, खोने के फ़ंक्शन की जांच करें, मृत रिलू की जांच करें।

**Bug: Validation accuracy is lower than expected by 1-3%.**
कारणः उचित हानि स्केलिंग के बिना मिश्रित परिशुद्धता। ग्रेडिएंट डाउनफ्लो चुपचाप छोटे अपडेट को शून्य कर देता है।
फिक्सः गतिशील हानि स्केलिंग सक्षम करें, या bfloat16 पर स्विच करें।

**Bug: Gradient norms are 0.0 for some layers.**
कारणः मृत ReLU न्यूरॉन्स (सभी इनपुट नकारात्मक), या float16 underflow।
फिक्सः लीकीरेलू या जीईएलयू का उपयोग करें, ग्रेडिएंट स्केलिंग का उपयोग करें, वजन आरंभिकता की जांच करें।

**Bug: Model works on one GPU but gives different results on another.**
कारणः गैर-निर्धारक फ्लोटिंग प्वाइंट संचय क्रम। GPU समानांतर घटाव विभिन्न हार्डवेयर पर विभिन्न आदेशों में योग है, और फ्लोटिंग प्वाइंट जोड़ संबद्ध नहीं है।
फिक्सः छोटे अंतरों को स्वीकार करें (1e-6), या सेट `torch.use_deterministic_algorithms(True)`और गति दंड स्वीकार करें।

**Bug: `exp()` returns `inf` in loss computation.**
कारणः कच्चे लॉग को पारित किया गया`exp()`अधिकतम घटाने की चाल के बिना।
ठीक करेंः उपयोग `torch.nn.functional.log_softmax()`जो आंतरिक रूप से लॉग-सॉम-एक्सप्लेंट करता है।

**Bug: Training diverges after switching from float32 to float16.**
कारणः float16 6e-8 से नीचे ग्रेडिएंट magnitudes या 65,504 से ऊपर सक्रियण का प्रतिनिधित्व नहीं कर सकता है।
फिक्सः हानि स्केलिंग (एएमपी) के साथ मिश्रित परिशुद्धता का उपयोग करें, या इसके बजाय bfloat16 का उपयोग करें।

```figure
logsumexp-stability
```

## इसे बनाओ

### चरण 1: फ्लोटिंग प्वाइंट सटीकता सीमाओं का प्रदर्शन करें

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### चरण 2: निष्पक्ष बनाम स्थिर सॉफ्टमैक्स लागू करें

```python
import math

def softmax_naive(logits):
    exps = [math.exp(z) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

safe_logits = [2.0, 1.0, 0.1]
print(f"Naive:  {softmax_naive(safe_logits)}")
print(f"Stable: {softmax_stable(safe_logits)}")

dangerous_logits = [100.0, 101.0, 102.0]
print(f"Stable: {softmax_stable(dangerous_logits)}")
# softmax_naive(dangerous_logits) would return [nan, nan, nan]
```

### चरण 3: स्थिर लॉग-सम-एक्सप्ल को लागू करें

```python
def logsumexp_naive(values):
    return math.log(sum(math.exp(v) for v in values))

def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))

safe = [1.0, 2.0, 3.0]
print(f"Naive:  {logsumexp_naive(safe):.6f}")
print(f"Stable: {logsumexp_stable(safe):.6f}")

large = [500.0, 501.0, 502.0]
print(f"Stable: {logsumexp_stable(large):.6f}")
# logsumexp_naive(large) returns inf
```

### चरण 4: स्थिर क्रॉस-एंट्रोपी लागू करें

```python
def cross_entropy_naive(true_class, logits):
    probs = softmax_naive(logits)
    return -math.log(probs[true_class])

def cross_entropy_stable(true_class, logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = math.log(sum(math.exp(s) for s in shifted))
    log_prob = shifted[true_class] - log_sum_exp
    return -log_prob

logits = [2.0, 5.0, 1.0]
true_class = 1
print(f"Naive:  {cross_entropy_naive(true_class, logits):.6f}")
print(f"Stable: {cross_entropy_stable(true_class, logits):.6f}")
```

### चरण 5: ग्रेडिएंट जांच

```python
def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad

def check_gradient(analytical, numerical, tolerance=1e-5):
    for i, (a, n) in enumerate(zip(analytical, numerical)):
        denom = max(abs(a), abs(n), 1e-8)
        rel_error = abs(a - n) / denom
        status = "OK" if rel_error < tolerance else "FAIL"
        print(f"  param {i}: analytical={a:.8f} numerical={n:.8f} "
              f"rel_error={rel_error:.2e} [{status}]")

def f(params):
    x, y = params
    return x**2 + 3*x*y + y**3

def f_grad(params):
    x, y = params
    return [2*x + 3*y, 3*x + 3*y**2]

point = [2.0, 1.0]
analytical = f_grad(point)
numerical = numerical_gradient(f, point)
check_gradient(analytical, numerical)
```

## इसका प्रयोग करें

### मिश्रित परिशुद्धता सिमुलेशन

```python
import struct

def float32_to_float16_round(x):
    packed = struct.pack('f', x)
    f32 = struct.unpack('f', packed)[0]
    packed16 = struct.pack('e', f32)
    return struct.unpack('e', packed16)[0]

def simulate_bfloat16(x):
    packed = struct.pack('f', x)
    as_int = int.from_bytes(packed, 'little')
    truncated = as_int & 0xFFFF0000
    repacked = truncated.to_bytes(4, 'little')
    return struct.unpack('f', repacked)[0]
```

### ग्रिडिएंट क्लिपिंग

```python
def clip_by_norm(gradients, max_norm):
    total_norm = math.sqrt(sum(g**2 for g in gradients))
    if total_norm > max_norm:
        scale = max_norm / total_norm
        return [g * scale for g in gradients]
    return gradients

grads = [10.0, 20.0, 30.0]
clipped = clip_by_norm(grads, max_norm=5.0)
print(f"Original norm: {math.sqrt(sum(g**2 for g in grads)):.2f}")
print(f"Clipped norm:  {math.sqrt(sum(g**2 for g in clipped)):.2f}")
print(f"Direction preserved: {[c/clipped[0] for c in clipped]} == {[g/grads[0] for g in grads]}")
```

### NaN/Inf का पता लगाना

```python
def check_tensor(name, values):
    has_nan = any(math.isnan(v) for v in values)
    has_inf = any(math.isinf(v) for v in values)
    if has_nan or has_inf:
        print(f"WARNING {name}: nan={has_nan} inf={has_inf}")
        return False
    return True

check_tensor("good", [1.0, 2.0, 3.0])
check_tensor("bad",  [1.0, float('nan'), 3.0])
check_tensor("ugly", [1.0, float('inf'), 3.0])
```

देखो`code/numerical.py`सभी एज केस के साथ पूर्ण कार्यान्वयन के लिए प्रदर्शित किया गया।`code/numerical.ts`एक प्रकार के स्क्रिप्ट पोर्ट के साथ एक ही कार्यों और डेमो है।

## इसे भेजें

इस पाठ से उत्पन्न होता हैः
- `code/numerical.py`स्थिर softmax, log-sum-exp, क्रॉस-एंट्रोपी, ग्रेडिएंट जांच और मिश्रित परिशुद्धता सिमुलेशन के साथ
- `outputs/prompt-numerical-debugger.md`प्रशिक्षण में एनएएन/इन्फ और संख्यात्मक मुद्दों का निदान करने के लिए

प्रशिक्षण चक्र के निर्माण के दौरान चरण 3 में और ध्यान तंत्र के कार्यान्वयन के दौरान चरण 4 में ये स्थिर कार्यान्वयन फिर से दिखाई देते हैं।

## व्यायाम

1. **Catastrophic cancellation.**[1000000.0, 1000001.0, 1000002.0] के विचलन को सरल सूत्र का उपयोग करके गणना करें $\mathbb{E}[x^2] - \mathbb{E}[x]^2$फिर वेल्फोर्ड के ऑनलाइन एल्गोरिथ्म का उपयोग करके गणना करें। वास्तविक भिन्नता (0.6667) के साथ त्रुटियों की तुलना करें।

2. **Precision hunt.**सबसे छोटी सकारात्मक float32 मान खोजें `x`इस तरह की`1.0 + x == 1.0`यह मशीन epsilon है. यह मेल खाता है कि यह सत्यापित करें.`numpy.finfo(numpy.float32).eps`. .

3. **Log-sum-exp edge cases.**अपनी जाँच करें`logsumexp_stable`(क) सभी मान समान हैं, (ख) एक मान बाकी से बहुत बड़ा है, (ग) सभी मान बहुत नकारात्मक हैं (-1000) सत्यापित करें कि यह सही परिणाम देता है जहां साफ़ संस्करण विफल रहता है।

4. **Gradient checking a neural network layer.**एक ही रैखिक परत को लागू करें `y = Wx + b`और इसका विश्लेषणात्मक पीछे की ओर पास।`numerical_gradient`3x2 वजन मैट्रिक्स के लिए सटीकता की जांच करने के लिए।

5. **Loss scaling experiment.**फ्लोट16 के साथ प्रशिक्षण का अनुकरण करेंः [1e-9, 1e-3] रेंज में यादृच्छिक ग्रेडिएंट बनाएं, फ्लोट16 में परिवर्तित करें, और मापें कि किस अंश को शून्य बना दिया जाता है। फिर हानि स्केलिंग (1024 से गुणा करें) लागू करें, फ्लोट16 में परिवर्तित करें, स्केल वापस करें, और शून्य अंश को फिर से मापें।

### संकेत

**Exercise 1.**तीनों मानों को परिवर्तित करें `np.float32`इससे पहले कि आप उन्हें वर्ग, फिर कॉल `variance_naive`और `welford_variance`. एक मूल्य करीब $10^{12}$फ्लोट 32 में एक अंतर 1 से बहुत अधिक है, तो आशा है कि साफ़ परिणाम 0.6667 से दूर है और वेल्फोर्ड परिणाम करीब है।

**Exercise 2.** से शुरू करें`x = np.float32(1.0)`और इसे आधा जबकि `np.float32(1.0) + x != np.float32(1.0)`. प्रत्येक मान को float32 में रखें, फिर अंतिम मान की तुलना करें जो अभी भी राशि को बदल दिया है`numpy.finfo(numpy.float32).eps`, जो है $2^{-23}$. .

**Exercise 3.**पहले प्रत्येक उत्तर का अनुमान लगाओ।$n$बराबर मूल्य $c$, परिणाम है $c + \ln n$. एक बड़े मूल्य के लिए, परिणाम उस मूल्य के करीब है. -1000 के करीब के लिए, परिणाम निकट है $-1000 + \ln n$, जबकि `logsumexp_naive`रिटर्न `-inf`क्योंकि प्रत्येक घातीय 0 तक नीचे बहता है।

**Exercise 4.**के लिए$y = Wx + b$हानि के साथ $L$,  के लिए ग्रेडिएंट$W$उपधारा के उतार का बाहरी उत्पाद है और $x$. क्षैतिज के कार्य के रूप में हानि को लपेटें $W$, कॉल `numerical_gradient`, और दोनों परिणामों को पारित करने के लिए `check_gradient`. .

**Exercise 5.** के साथ लॉग पैमाने पर आयामों का नमूना`10 ** np.random.uniform(-9, -3, n)`और परिवर्तित करने के लिए `np.float16`. फ्लोट16 लगभग $6 \times 10^{-8}$, तो अनुमान लगाएं कि लगभग एक चौथाई मानों को शून्य करने से पहले पैमाने और लगभग कोई भी जब आप 1024 द्वारा गुणा करने के लिए हो जाएगा।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| IEEE 754 | "The float standard" | International standard defining binary floating point formats, rounding rules, and special values (inf, nan). Every modern CPU and GPU implements it. |
| Machine epsilon | "The precision limit" | The smallest value $e$ such that $1.0 + e \ne 1.0$ in a given float format. For float32, it is about 1.19e-7. |
| Catastrophic cancellation | "Precision loss from subtraction" | When subtracting nearly equal floating point numbers, significant digits cancel and rounding noise dominates the result. |
| Overflow | "Number too big" | A result exceeds the maximum representable value and becomes inf. exp(89) overflows float32. |
| Underflow | "Number too small" | A result is closer to zero than the smallest representable positive number and becomes 0.0. exp(-104) underflows float32. |
| Log-sum-exp trick | "Subtract the max first" | Computing $\log(\sum \exp(x))$ by factoring out $\exp(\max(x))$ to prevent overflow and underflow. Used in softmax, cross-entropy, and log-probability math. |
| Stable softmax | "Softmax that does not explode" | Subtracting $\max(\text{logits})$ before exponentiating. Numerically identical result, no overflow possible. |
| Gradient checking | "Verify your backprop" | Comparing analytical gradients from backpropagation against numerical gradients from finite differences to catch implementation bugs. |
| Mixed precision | "Float16 forward, float32 backward" | Using lower-precision floats for speed-critical operations and higher-precision floats for numerically sensitive operations. Typical speedup is 2-3x. |
| Loss scaling | "Prevent gradient underflow" | Multiplying the loss by a large constant before backprop so gradients stay in float16's representable range, then dividing by the same constant before weight updates. |
| bfloat16 | "Brain floating point" | Google's 16-bit format with 8 exponent bits (same range as float32) and 7 mantissa bits (less precision than float16). Preferred for training. |
| Gradient clipping | "Cap the gradient norm" | Scaling the gradient vector so its norm does not exceed a threshold. Prevents exploding gradients from ruining weights. |
| NaN | "Not a Number" | Special float value from undefined operations (0/0, inf-inf, sqrt(-1)). Propagates through all subsequent arithmetic. |
| Inf | "Infinity" | Special float value from overflow or division by zero. Can combine to produce NaN (inf - inf, inf * 0). |
| Numerical gradient | "Brute force derivative" | Approximating a derivative by evaluating $f(x+h)$ and $f(x-h)$ and dividing by $2h$. Slow but reliable for verification. |

## आगे पढ़ना

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)-- अंतिम संदर्भ, घने लेकिन पूर्ण
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740)-- एनवीआईडीए पेपर जो float16 प्रशिक्षण के लिए हानि स्केलिंग शुरू की
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html)-- PyTorch में मिश्रित परिशुद्धता के लिए व्यावहारिक मार्गदर्शिका
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16)-- Google ने TPU के लिए इस प्रारूप का चयन क्यों किया
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm)-- फ्लोटिंग प्वाइंट योगों में गोल त्रुटि को कम करने के लिए एल्गोरिथ्म
