# नमूना लेने की विधि

> नमूनाकरण यह है कि कैसे AI संभावनाओं के अंतरिक्ष की खोज करता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## सीखने के लक्ष्य

- केवल समान यादृच्छिक संख्याओं का उपयोग करके शून्य से उल्टा सीडीएफ, अस्वीकृति और महत्व नमूनाकरण लागू करें
- भाषा मॉडल टोकन जनरेशन के लिए तापमान, शीर्ष-के और शीर्ष-पी (नक्लस) नमूनाकरण का निर्माण करें
- पुनरावर्तन चाल की व्याख्या करें और यह वीएई में नमूना लेने के माध्यम से बैकप्रॉपेगमेंट को क्यों सक्षम बनाता है
- एक अनियमित लक्ष्य वितरण से नमूना लेने के लिए मेट्रोपोलिस-हस्टिंग्स MCMC चलाएं

## समस्या

एक भाषा मॉडल आपके प्रॉम्प्ट को प्रोसेस कर पूरा कर लेता है और 50,000 लॉजिट का वेक्टर उत्पन्न करता है. उसके शब्दावली में प्रत्येक टोकन के लिए एक। अब उसे एक चुनना होगा। कैसे?

यदि यह हमेशा उच्चतम संभावना टोकन का चयन करता है, तो प्रत्येक प्रतिक्रिया समान है। निर्धारक। उबाऊ। यदि यह समान रूप से यादृच्छिक रूप से चुनता है, तो आउटपुट गबरेज है। उत्तर इन चरम के बीच कहीं रहता है, और यह कहीं न कहीं नमूना लेने से नियंत्रित है।

नमूनाकरण केवल पाठ उत्पन्न करने तक सीमित नहीं है। प्रवर्धन सीखने ने नमूना लेने के मार्गों के माध्यम से नीति ग्रेडिएंट का अनुमान लगाया है। एवीए सीखने वाले वितरण से नमूना लेकर और यादृच्छिकता के माध्यम से वापस फैलकर लटेंट प्रतिनिधित्व सीखते हैं। विसारण मॉडल शोर के नमूने और पुनरावृत्त रूप से निरूपण करके छवियां उत्पन्न करते हैं। मोंटे कार्लो विधियों से उन पूर्णांक का अनुमान लगाया जाता है जिनके पास कोई बंद-रूप समाधान नहीं होता है। MCMC एल्गोरिदम उच्च आयामी पिछली वितरण की खोज करते हैं जिन्हें सूचीबद्ध करना असंभव है।

प्रत्येक जनरेटिव एआई सिस्टम एक नमूना प्रणाली है। नमूना रणनीति आउटपुट की गुणवत्ता, विविधता और नियंत्रण को निर्धारित करती है। यह सबक खरोंच से हर प्रमुख नमूना विधि का निर्माण करता है, समान यादृच्छिक संख्याओं से शुरू होकर आधुनिक एलएलएम और जनरेटिव मॉडल को संचालित करने वाली तकनीकों के साथ समाप्त होता है।

## अवधारणा

### नमूना लेने का महत्व क्यों है

एआई और मशीन लर्निंग में नमूने लेने की चार बुनियादी भूमिकाएं हैंः

**Generation.**भाषा मॉडल, विसारण मॉडल और जीएएन सभी नमूनाकरण द्वारा आउटपुट का उत्पादन करते हैं। नमूनाकरण एल्गोरिदम रचनात्मकता, सुसंगतता और विविधता को सीधे नियंत्रित करता है। तापमान, शीर्ष-के और नाभिक नमूनाकरण कुंजी हैं जो इंजीनियर दैनिक रूप से बदलते हैं।

**Training.**स्टोकास्टिक ग्रेडिएंट अवतरण नमूने मिनी बैच। निष्क्रिय करने के लिए न्यूरॉन नमूने छोड़ दें। डेटा वृद्धि नमूने यादृच्छिक परिवर्तन। महत्व नमूने प्रवर्धन सीखने में ग्रेडिएंट भिन्नता को कम करने के लिए नमूने फिर से वजन करते हैं (पीपीओ, टीआरपीओ) ।

**Estimation.**एमएल में कई मात्राओं में कोई बंद-रूप समाधान नहीं है। डेटा वितरण पर अपेक्षित हानि, ऊर्जा आधारित मॉडल के विभाजन समारोह, बेयसियन निष्कर्ष में सबूत। मोन्टे कार्लो अनुमान नमूनों पर औसत करके इन सभी का अनुमान लगाता है।

**Exploration.**एमसीएमसी एल्गोरिदम बेयसियन इन्फेरेंस में पिछली वितरण का पता लगाते हैं। विकासवादी रणनीतियाँ पैरामीटर व्यवधानों का नमूना देती हैं। थॉम्पसन नमूनाकरण बांडियों में खोज और शोषण को संतुलित करता है।

मुख्य चुनौतीः आप केवल सरल वितरण से सीधे नमूना ले सकते हैं (समान, सामान्य) । बाकी सब कुछ के लिए, आपको अपने लक्ष्य वितरण से सरल नमूनों को नमूनों में परिवर्तित करने के लिए एक विधि की आवश्यकता है।

### समान यादृच्छिक नमूनाकरण

प्रत्येक नमूनाकरण विधि यहाँ से शुरू होती है। एक समान यादृच्छिक संख्या जनरेटर में मान उत्पन्न करता है$[0, 1)$जहां समान लंबाई के प्रत्येक उप-अंतर में समान संभावना होती है।

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

एक अलग सेट से समान रूप से नमूना करने के लिए $n$वस्तुओं, उत्पन्न $U$और लौटें$\lfloor n U \rfloor$. निरंतर रेंज से नमूना लेने के लिए $[a, b]$, गणना $a + (b - a) U$. .

मुख्य अंतर्दृष्टिः एक एकल समान यादृच्छिक संख्या में किसी भी वितरण से एक नमूना उत्पन्न करने के लिए सही मात्रा में यादृच्छिकता होती है। ट्रिक सही परिवर्तन खोजने में है।

### उल्टा सीडीएफ विधि (उपवर्ती परिवर्तन नमूनाकरण)

संचयी वितरण फ़ंक्शन (CDF) मानों को संभावनाओं के लिए मानचित्रित करता हैः

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

उल्टा सीडीएफ मानकों के लिए संभावनाओं को वापस नक्शे।$U \sim \text{Uniform}(0, 1)$, तो $X = F^{-1}(U)$लक्ष्य वितरण का पालन करता है।

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**Exponential distribution example:**

```
PDF: f(x) = lambda * exp(-lambda * x),   x >= 0
CDF: F(x) = 1 - exp(-lambda * x)

Solve F(x) = u for x:
  u = 1 - exp(-lambda * x)
  exp(-lambda * x) = 1 - u
  x = -ln(1 - u) / lambda

Since (1 - U) and U have the same distribution:
  x = -ln(u) / lambda
```

यह सही काम करता है जब आप लिख सकते हैं$F^{-1}$सामान्य वितरण के लिए, कोई बंद-रूप उलटा सीडीएफ नहीं है, इसलिए हम अन्य तरीकों का उपयोग करते हैं (बॉक्स-मुलर, या संख्यात्मक अनुमान) ।

**Discrete version:**डिस्क्रिट वितरण के लिए, सीडीएफ को एक संचयी राशि के रूप में बनाएं, उत्पन्न करें $U$, और पहला सूचकांक ढूंढें जहां संचयी राशि से अधिक हो $U$. . . इस तरह से कैसे`sample_categorical`पाठ 06 में काम करता है।

### अस्वीकार नमूनाकरण

जब आप CDF को उल्टा नहीं कर सकते हैं लेकिन लक्ष्य PDF को एक स्थिर तक मूल्यांकन कर सकते हैं, तो अस्वीकृति नमूना कार्य करता है।

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = Z/M, where Z is the integral of p(x)
                (Z = 1, so the rate is 1/M, when p is normalized)
```

जितना अधिक कसकर सीमा $M$, स्वीकृति दर जितनी अधिक है। कम आयामों (1-3) में, अस्वीकृति नमूना लेने का काम अच्छी तरह से होता है। उच्च आयामों में, स्वीकृति दर तेजी से गिरती है क्योंकि अधिकांश प्रस्ताव मात्रा अस्वीकार हो जाती है। यह अस्वीकृति नमूना लेने के लिए आयामता का अभिशाप है।

**Example: sampling from a truncated normal.**संकुचित सीमा पर एक समान प्रस्ताव का उपयोग करें।$M$उस सीमा में सामान्य पीडीएफ की अधिकतम मात्रा है।

**Example: sampling from a semicircle.**समानांतर आयताकार में समान रूप से प्रस्ताव करें। यदि बिंदु अर्ध वृत्त के अंदर गिरता है तो स्वीकार करें। यह Monte Carlo गणना का तरीका है।$\pi$: स्वीकृति दर क्षेत्र अनुपात के बराबर है $\pi/4$. .

### महत्व का नमूनाकरण

कभी-कभी आपको लक्ष्य वितरण से नमूनों की आवश्यकता नहीं होती है $p(x)$आपको एक अनुमान लगाने की आवश्यकता है कि क्या उम्मीद है$p(x)$, और आप अलग वितरण से नमूने हैं $q(x)$. .

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

यह प्रवर्धन सीखने में महत्वपूर्ण है। पीपीओ (अंतरिक नीति अनुकूलन) में, आप एक पुरानी नीति के तहत पटरियों को इकट्ठा करते हैं $\pi_{\text{old}}$लेकिन एक नई नीति को अनुकूलित करना चाहते हैं $\pi_{\text{new}}$. महत्व वजन है $\pi_{\text{new}}(a \mid s) / \pi_{\text{old}}(a \mid s)$पीपीओ इन भारों को काटता है ताकि नई नीति को पुरानी से बहुत दूर नहीं जाना पड़े।

महत्व के नमूना अनुमानक की भिन्नता इस बात पर निर्भर करती है कि यह कितना समान है $q$है $p$. अगर .$q$बहुत अलग है $p$स्व-सामान्य महत्व नमूनाकरण इस समस्या को कम करने के लिए भारों के योग से विभाजित करता हैः

```math
\mathbb{E}_p[f(x)] \approx \frac{\sum_i w_i \, f(x_i)}{\sum_i w_i}
```

### मोन्टे कार्लो अनुमान

मोन्टे कार्लो अनुमान यादृच्छिक नमूनों के औसत के माध्यम से पूर्णांक का अनुमान लगाता है। बड़ी संख्याओं का कानून अभिसरण की गारंटी देता है।

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

त्रुटि दर आयाम-स्वतंत्र है। यही कारण है कि मोन्टे कार्लो विधियां उच्च आयामों में प्रभुत्व करती हैं जहां ग्रिड-आधारित एकीकरण असंभव है।

**Estimating pi:**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**Estimating expectations:**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### मार्कोव चेन मोंटे कार्लो (एमसीएमसी): मेट्रोपोलिस-हस्टिंग्स

MCMC एक मार्कोव श्रृंखला का निर्माण करता है जिसका स्थिर वितरण लक्ष्य वितरण है $p(x)$. पर्याप्त चरणों के बाद, श्रृंखला से नमूने (लगभग) नमूने हैं $p(x)$. .

```
Target: p(x)  (known up to a normalizing constant)
Proposal: q(x'|x)  (how to propose the next state given the current state)

Metropolis-Hastings algorithm:
  1. Start at some x_0
  2. For t = 1, 2, ..., T:
     a. Propose x' ~ q(x'|x_t)
     b. Compute acceptance ratio:
        alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
     c. Accept with probability min(1, alpha):
        - If u < alpha (u ~ Uniform(0,1)): x_{t+1} = x'
        - Otherwise: x_{t+1} = x_t
  3. Discard first B samples (burn-in)
  4. Return remaining samples
```

सममित प्रस्तावों के लिए $(q(x' \mid x) = q(x \mid x'))$, अनुपात सरल हो जाता है $p(x')/p(x)$यह मूल मेट्रोपॉलिस एल्गोरिथ्म है।

**Why it works.**स्वीकार करने के नियम के अनुसार, विस्तृत संतुलन सुनिश्चित किया जाता हैः$x$और स्थानांतरित करने के लिए$x'$ पर होने की संभावना के बराबर है$x'$और स्थानांतरित करने के लिए$x$. विस्तृत संतुलन से यह पता चलता है कि$p(x)$यह श्रृंखला का स्थिर वितरण है।

**Practical considerations:**
- जल-इनः श्रृंखला संतुलन तक पहुंचने से पहले प्रारंभिक नमूनों को फेंक दें
- पतलाः हर एक को रखें $k$-स्वतः संयोग को कम करने के लिए
- प्रस्तावों का पैमानाः बहुत छोटा और श्रृंखला धीमी गति से आगे बढ़ती है (उच्च स्वीकृति, धीमी खोज); बहुत बड़ा और अधिकांश प्रस्ताव अस्वीकार कर दिए जाते हैं (कम स्वीकृति, जगह पर अटक गया)
- उच्च आयामों में गौसी प्रस्ताव के लिए इष्टतम स्वीकृति दर लगभग 0.234 है

### गिब्स नमूना

गिब्स नमूनाकरण बहु-विभाज्य वितरण के लिए एमसीएमसी का एक विशेष मामला है। यह एक बार में सभी आयामों में एक कदम का प्रस्ताव देने के बजाय, अपने सशर्त वितरण से एक चर को एक समय में अपडेट करता है।

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

गिब्स नमूना लेने के लिए आवश्यक है कि आप प्रत्येक सशर्त वितरण से नमूना कर सकते हैं $p(x_i \mid x_{-i})$यह कई मॉडल के लिए सीधा हैः
- बेयसियन नेटवर्कः ग्राफ संरचना से सशर्त परिणाम
- गौसी मिश्रण: सशर्त गौसी हैं
- इज़िंग मॉडलः प्रत्येक स्पिन की सशर्तता केवल उसके पड़ोसियों पर निर्भर करती है

स्वीकृति दर हमेशा 1 होती है (हर प्रस्ताव स्वीकार किया जाता है) क्योंकि सटीक शर्त से नमूना लेने से स्वचालित रूप से विस्तृत संतुलन पूरा होता है।

**Limitation.**जब चर अत्यधिक संबद्ध होते हैं, तो गिब्स नमूनाकरण धीरे-धीरे मिश्रित होता है क्योंकि एक समय में एक चर को अपडेट करने से वितरण के माध्यम से बड़े विकर्ण आंदोलन नहीं हो सकते हैं।

### तापमान नमूनाकरण (एलएलएम में प्रयोग किया जाता है)

भाषा मॉडल आउटपुट लॉग $z_1, \ldots, z_V$शब्द संग्रह में प्रत्येक टोकन के लिए। Softmax संभावनाओं में परिवर्तित करता है। तापमान softmax से पहले लॉजिट को फिर से स्केल करता हैः

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**Why it works.** द्वारा लॉग्स को विभाजित करना$T < 1$यदि $z_1 = 2$और $z_2 = 1$, द्वारा विभाजित $T = 0.5$देता है$z_1/T = 4$और $z_2/T = 2$softmax के बाद, उच्चतम लॉजिट टोकन एक बहुत अधिक हिस्सा प्राप्त करता है।

**In practice:**
- $T = 0.0$: लालची डिकोडिंग, तथ्यों के लिए सबसे अच्छा प्रश्न और उत्तर
- $T = 0.3\text{-}0.7$: थोड़ा रचनात्मक, कोड पीढ़ी के लिए अच्छा
- $T = 0.7\text{-}1.0$: संतुलित, सामान्य बातचीत के लिए अच्छा
- $T = 1.0\text{-}1.5$: रचनात्मक लेखन, ब्रेनस्टॉर्मिंग
- $T > 1.5$: तेजी से यादृच्छिक, शायद ही कभी उपयोगी

तापमान यह नहीं बदलता कि कौन से टोकन संभव हैं, यह प्रत्येक टोकन के लिए आवंटित होने की संभावना द्रव्यमान को बदलता है।

### शीर्ष-क नमूना

शीर्ष-के नमूनाकरण उम्मीदवार को निर्धारित करने के लिए सीमित करता है $k$उच्चतम संभावनाओं के साथ टोकन, फिर पुनर्मिलन और उस प्रतिबंधित सेट से नमूने.

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Keep only the top k tokens
  4. Renormalize: p_i' = p_i / sum(p_j for j in top-k)
  5. Sample from the renormalized distribution

k = 1:  greedy decoding
k = V:  no filtering (standard sampling)
k = 40: typical setting, removes long tail of unlikely tokens
```

टॉप-के मॉडल को शब्द संग्रह वितरण के लंबे पूंछ में मौजूद बेहद असंभव टोकन (टाइपो, बकवास) का चयन करने से रोकता है। समस्याः $k$जब मॉडल आत्मविश्वास (एक टोकन 95% संभावना है) है, $k = 40$अभी भी 39 विकल्पों की अनुमति देता है। जब मॉडल अनिश्चित है (संभावना 1000 टोकन में फैली हुई है), $k = 40$व्यवहार्य विकल्पों को काटता है।

### शीर्ष-पी (नक्लियस) नमूनाकरण

टॉप-पी नमूनाकरण गतिशील रूप से उम्मीदवार सेट आकार समायोजित करता है। यह टोकन की एक निश्चित संख्या रखने के बजाय, टोकन के सबसे छोटे सेट को रखता है जिसकी संचयी संभावना से अधिक है $p$. .

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Find smallest k such that sum of top-k probabilities >= p
  4. Keep only those k tokens
  5. Renormalize and sample

p = 0.9:  keeps tokens covering 90% of probability mass
p = 1.0:  no filtering
p = 0.1:  very restrictive, nearly greedy
```

जब मॉडल आत्मविश्वासपूर्ण होता है, तो न्यूक्लियस सैंपलिंग कुछ टोकन (शायद 2-3) रखता है। जब मॉडल अनिश्चित होता है, तो यह कई (शायद 200) रखता है। यह अनुकूलन व्यवहार इस कारण से है कि न्यूक्लियस सैंपलिंग आमतौर पर शीर्ष-के की तुलना में बेहतर पाठ का उत्पादन करता है।

**Common combinations:**
- तापमान 0.7 + शीर्ष-पी 0.9: सामान्य प्रयोजन के लिए अच्छा सेटिंग
- तापमान 0.0 (लाभकारी): निर्धारक कार्यों के लिए सबसे अच्छा
- तापमान 1.0 + शीर्ष-के 50: फैन एट अल. (2018) मूल कागज सेटिंग

शीर्ष-के और शीर्ष-पी को संयुक्त किया जा सकता है। शीर्ष-के पहले लागू करें, फिर शेष सेट पर शीर्ष-पी।

### रिपारामेटरीकरण ट्रिक (वीएई में प्रयोग किया जाता है)

वैरिएशनल ऑटोकोडर (VAE) लटेंट स्पेस में एक वितरण में इनपुट को एन्कोडिंग करके सीखते हैं, उस वितरण से नमूना लेते हैं, और नमूना को वापस डिकोड करते हैं। समस्याः आप नमूना लेने के संचालन के माध्यम से वापस प्रसार नहीं कर सकते।

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

पुनरावर्तन चाल पैरामीटर से यादृच्छिकता को अलग करता हैः

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

यह काम करता है क्योंकि $\mathcal{N}(\mu, \sigma^2)$$\mu + \sigma \cdot \mathcal{N}(0, 1)$. मुख्य अंतर्दृष्टिः यादृच्छिकता को पैरामीटर मुक्त स्रोत में स्थानांतरित करें ($\epsilon$) के बाद नमूना को पैरामीटर के एक अंतरणीय परिवर्तन के रूप में व्यक्त किया जाए।

**In the VAE training loop:**
1. एन्कोडर आउटपुट $\mu$और $\log(\sigma^2)$प्रत्येक इनपुट के लिए
2. नमूना $\epsilon \sim \mathcal{N}(0, 1)$
3. गणना $z = \mu + \sigma \epsilon$
4. डिकोड $z$इनपुट को पुनः निर्माण करने के लिए
5. चरण 4, 3, 2, 1 के माध्यम से पीछे-पीछे फैलाना (संभव है क्योंकि चरण 3 अंतर योग्य है)

पुनरावर्तन युक्तियाँ के बिना, मानक बैकप्रॉपेग के साथ VAEs को प्रशिक्षित नहीं किया जा सकता है। इस एकल अंतर्दृष्टि ने VAEs को व्यावहारिक बना दिया।

### गुम्बल-सॉफ्टमैक्स (विभेदक श्रेणीगत नमूनाकरण)

पुनरावर्तन चाल निरंतर वितरण (गॉसियन) के लिए काम करती है। विवश श्रेणी वितरण के लिए, हमें एक अलग दृष्टिकोण की आवश्यकता होती है। गुम्बल-सॉफ्टमैक्स श्रेणीगत नमूनाकरण के लिए एक अंतर योग्य अनुमान प्रदान करता है।

**The Gumbel-Max trick (non-differentiable):**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax (differentiable approximation):**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

गुंबल-सॉफ्टमैक्स एक अलग नमूना का निरंतर ढील देता है। आउटपुट एक कठिन एक गर्म के बजाय एक संभावना वेक्टर (नरम एक गर्म) है। ग्रेडिएंट्स सॉफ्टमैक्स के माध्यम से बहते हैं। प्रशिक्षण में आगे के पास के दौरान, आप "सीधे से" अनुमानक का उपयोग कर सकते हैंः आगे के पास के लिए हार्ड एर्गेमैक्स का उपयोग करें लेकिन पीछे के पास के लिए नरम गुंबल-सॉफ्टमैक्स ग्रेडिएंट्स का उपयोग करें।

**Applications:**
- VAEs में गुप्त लटेंट चर
- तंत्रिका वास्तुकला खोज (विशिष्ट संचालन चुनना)
- कठोर ध्यान तंत्र
- अलग-अलग कार्यों के साथ सुदृढीकरण सीखने

### स्तरीकृत नमूनाकरण

मानक मोंटे कार्लो नमूनाकरण नमूना स्थान में गलती से अंतराल छोड़ सकता है। स्तरीकृत नमूनाकरण प्रत्येक से स्थान को स्तरीकरण और नमूनाकरण में विभाजित करके कवर को भी कवर करता है।

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

मानक मोंटे कार्लो की तुलना में स्तरीकृत नमूनाकरण में हमेशा कम या बराबर भिन्नता होती हैः

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**Applications:**
- संख्यात्मक एकीकरण (क्वासी-मोंटे कार्लो)
- प्रशिक्षण डेटा विभाजन (प्रत्येक तह में वर्ग संतुलन सुनिश्चित करना)
- स्तरीकरण के साथ महत्व का नमूनाकरण (दोनों तकनीकों को मिलाकर)
- NeRF (Neural Radiance Fields) कैमरा किरणों के साथ स्तरीकृत नमूनाकरण का उपयोग करता है

### विसारण मॉडल से संबंध

विसारण मॉडल एक नमूना प्रक्रिया के माध्यम से छवियों का उत्पादन करते हैं। आगे की प्रक्रिया एक छवि पर गौशियन शोर जोड़ती है।$T$यह प्रक्रिया मूल छवि को चरण दर चरण पुनर्प्राप्त करने के लिए, निरूपण करना सीखती है।

```
Forward process (known):
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon
  where epsilon ~ N(0, I)

  After T steps: x_T ~ N(0, I)  (pure noise)

Reverse process (learned):
  x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (1 - alpha_t)/sqrt(1 - alpha_bar_t) * epsilon_theta(x_t, t)) + sigma_t * z
  where z ~ N(0, I)

  Each denoising step is a sampling step.
```

इस पाठ में विधियों से संबंधः
- प्रत्येक निरूपण चरण में पुनरावर्तन चाल का उपयोग किया जाता है (सैम्पल शोर, निर्धारात्मक परिवर्तन लागू करें)
- शोर कार्यक्रम $\lbrace \alpha_t \rbrace$तापमान को घुमावदार बनाने का एक प्रकार नियंत्रित करता है
- प्रशिक्षण ELBO (सबूत नीचे सीमा) के करीब करने के लिए मोंटे कार्लो अनुमान का उपयोग करता है
- विसारण मॉडल में पूर्वजों के नमूने लेने के लिए मार्कोव श्रृंखला है (प्रत्येक चरण केवल वर्तमान स्थिति पर निर्भर करता है)

पूरी छवि निर्माण प्रक्रिया पुनरावर्ती नमूनाकरण हैः शोर से शुरू करें, और प्रत्येक चरण में, सीखे गए डीनोइज़िंग मॉडल पर संचालित थोड़ा कम शोर वाला संस्करण का नमूना लें।

```figure
monte-carlo-pi
```

## इसे बनाओ

### चरण 1: समान और उल्टा सीडीएफ नमूनाकरण

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

10,000 घातीय नमूने उत्पन्न करें और औसत सत्यापित करें $1/\lambda$. .

### चरण 2: अस्वीकार नमूना

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

एक छोटा सामान्य वितरण से निकालने के लिए अस्वीकार नमूना का उपयोग करें। नमूना हिस्टोग्रामिंग करके आकार की जांच करें।

### चरण 3: महत्व का नमूना

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

अनुमानित $\mathbb{E}[X^2]$एक समान प्रस्ताव के साथ सामान्य वितरण के तहत। ज्ञात उत्तर की तुलना करें ($\mu^2 + \sigma^2$) ।

### चरण 4: मोन्टे कार्लो अनुमान

```python
def monte_carlo_pi(n):
    inside = 0
    for _ in range(n):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        if x*x + y*y <= 1:
            inside += 1
    return 4 * inside / n
```

### चरण 5: मेट्रोपोलिस-हस्टिंग्स एमसीएमसी

```python
def metropolis_hastings(target_log_pdf, proposal_sample, proposal_log_pdf, x0, n_samples, burn_in):
    samples = []
    x = x0
    for i in range(n_samples + burn_in):
        x_new = proposal_sample(x)
        log_alpha = (target_log_pdf(x_new) + proposal_log_pdf(x, x_new)
                     - target_log_pdf(x) - proposal_log_pdf(x_new, x))
        if math.log(random.random()) < log_alpha:
            x = x_new
        if i >= burn_in:
            samples.append(x)
    return samples
```

द्वि-आयामी वितरण (दो गौसी के मिश्रण) से नमूना। श्रृंखला की पटरियों को कल्पना करें।

### चरण 6: गिब्स नमूना

```python
def gibbs_sampling_2d(conditional_x_given_y, conditional_y_given_x, x0, y0, n_samples, burn_in):
    x, y = x0, y0
    samples = []
    for i in range(n_samples + burn_in):
        x = conditional_x_given_y(y)
        y = conditional_y_given_x(x)
        if i >= burn_in:
            samples.append((x, y))
    return samples
```

### चरण 7: तापमान का नमूनाकरण

```python
def softmax(logits):
    max_l = max(logits)
    exps = [math.exp(z - max_l) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def temperature_sample(logits, temperature):
    scaled = [z / temperature for z in logits]
    probs = softmax(scaled)
    return sample_from_probs(probs)
```

टोकन लॉजिट के सेट के लिए तापमान आउटपुट वितरण को कैसे बदलता है, दिखाएं।

### चरण 8: शीर्ष-के और शीर्ष-पी नमूनाकरण

```python
def top_k_sample(logits, k):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    top = indexed[:k]
    top_logits = [l for _, l in top]
    probs = softmax(top_logits)
    idx = sample_from_probs(probs)
    return top[idx][0]

def top_p_sample(logits, p):
    probs = softmax(logits)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cumsum = 0
    selected = []
    for token_idx, prob in indexed:
        cumsum += prob
        selected.append((token_idx, prob))
        if cumsum >= p:
            break
    sel_probs = [pr for _, pr in selected]
    total = sum(sel_probs)
    sel_probs = [pr / total for pr in sel_probs]
    idx = sample_from_probs(sel_probs)
    return selected[idx][0]
```

### चरण 9: रिपारामेटरीकरण ट्रिक

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

यह प्रदर्शित करें कि ग्रेडिएंट्स रिपेमेटरीज़ेड नमूने के माध्यम से बहते हैं लेकिन प्रत्यक्ष नमूने के माध्यम से नहीं।

### चरण 10: गुम्बेल- सॉफ्टमैक्स

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

तापमान में कमी से आउटपुट एक ही गर्म वेक्टर के करीब कैसे पहुंचता है, इसका प्रदर्शन करें।

सभी दृश्यों के साथ पूर्ण कार्यान्वयन में हैं `code/sampling.py`. .

टाइपस्क्रिप्ट पोर्ट में है `code/sampling.ts`यह अपने स्वयं के बीज यादृच्छिक जनरेटर का उपयोग करता है, इसलिए इसके यादृच्छिक संख्या पायथन आउटपुट से अलग है.

## इसका प्रयोग करें

NumPy और SciPy के साथ, उत्पादन संस्करणः

```python
import numpy as np

rng = np.random.default_rng(42)

exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")

from scipy import stats
normal = stats.norm(loc=0, scale=1)
print(f"CDF at 1.96: {normal.cdf(1.96):.4f}")
print(f"Inverse CDF at 0.975: {normal.ppf(0.975):.4f}")

logits = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
temperature = 0.7
scaled = logits / temperature
probs = np.exp(scaled - scaled.max()) / np.exp(scaled - scaled.max()).sum()
token = rng.choice(len(logits), p=probs)
print(f"Sampled token index: {token}")
```

MCMC के लिए पैमाने पर, समर्पित पुस्तकालयों का उपयोग करेंः
- PyMC: NUTS (अनुकूली HMC) के साथ पूर्ण बेयिसियन मॉडलिंग
- emcee: एंसिबल MCMC नमूना
- NumPyro/JAX: GPU-एक्सेलेरेटेड MCMC

आप इन को खरोंच से बनाया है. अब आप जानते हैं कि पुस्तकालय कॉल क्या कर रहे हैं.

## व्यायाम

1. कॉची वितरण के लिए उल्टा सीडीएफ नमूनाकरण लागू करें।$F(x) = 0.5 + \arctan(x)/\pi$. 10,000 नमूने उत्पन्न करें और वास्तविक पीडीएफ के साथ हिस्टोग्राम का चित्रण करें. भारी पूंछों (केंद्र से दूर चरम मान) को ध्यान में रखें।

2. एक Uniform(0, 1) प्रस्ताव का उपयोग करके एक बीटा ((2, 5) वितरण से नमूने उत्पन्न करने के लिए अस्वीकृति नमूना का उपयोग करें। वास्तविक बीटा पीडीएफ के खिलाफ स्वीकार किए गए नमूने को रेखांकित करें। सैद्धांतिक स्वीकृति दर क्या है?

3.  के समावेशी का अनुमान लगाएं$\sin(x)$0 से $\pi$मोन्टे कार्लो के साथ 1,000, 10,000, और 100,000 नमूने. प्रत्येक स्तर पर त्रुटि की तुलना करें. जांचें कि त्रुटि के पैमाने के रूप में$O(1/\sqrt{N})$. .

4. 2D वितरण से नमूना लेने के लिए मेट्रोपोलिस-हस्टिंग्स को लागू करें $p(x, y)$$\exp(-(x^2 y^2 + x^2 + y^2 - 8x - 8y) / 2)$. नमूने और श्रृंखला की प्रक्षेपवक्र का पता लगाएं. विभिन्न प्रस्ताव मानक विचलन के साथ प्रयोग करें.

5. एक पूर्ण पाठ पीढ़ी डेमो बनाएंः लॉजिट के साथ 10 शब्दों की शब्दावली को देखते हुए, (ए) लालची, (बी) तापमान=0.7, (सी) शीर्ष-के=3, (डी) शीर्ष-पी=0.9 का उपयोग करके 20 टोकन के अनुक्रम उत्पन्न करें। 5 रन में आउटपुट की विविधता की तुलना करें।

### संकेत

**Exercise 1.**हल करें$u = F(x)$के लिए$x$, जो देता है $x = \tan(\pi(u - 0.5))$. जांचें कि नमूना मध्य 0 के करीब है और कि लगभग 6% नमूनों में$\lvert x \rvert > 10$, जो है $1 - (2/\pi)\arctan(10)$. .

**Exercise 2.**बीटा ((2, 5) घनत्व है $30x(1-x)^4$. मोड पर इसका सबसे बड़ा मान खोजें $x = 1/5$और उस मूल्य का उपयोग $M$में `rejection_sample`. सैद्धांतिक स्वीकृति दर $1/M$, तो आप स्वीकार प्रस्तावों के अंश के साथ तुलना करें.

**Exercise 3.**सटीक मूल्य 2 है।`monte_carlo_integral(math.sin, 0, math.pi, n)`प्रत्येक के लिए $n$और कई बीज के साथ प्रत्येक रन दोहराएं।$n$10 गुना बढ़ता है, औसत त्रुटि लगभग घटती है $\sqrt{10} \approx 3.2$. .

**Exercise 4.**लक्ष्य का लॉग लिखें, जो है $-(x^2 y^2 + x^2 + y^2 - 8x - 8y)/2$, और इसे पारित करने के लिए `metropolis_hastings_2d`. प्रत्येक प्रस्ताव के लिए मानक विचलन के लिए स्वीकृति दर दर्ज करेंः एक बहुत ही छोटा मूल्य लगभग हर कदम को स्वीकार करता है लेकिन धीरे-धीरे चलता है, और एक बहुत बड़ा मूल्य लगभग हर कदम को अस्वीकार करता है।

**Exercise 5.**लालची डिकोडिंग प्रत्येक चरण में सबसे बड़ी लॉजिट का सूचकांक लेता है।`temperature_sample`,`top_k_sample`और `top_p_sample`अन्य तीन तरीकों के लिए. लालच सभी 5 रन में एक ही अनुक्रम देना चाहिए, तो विविधता को मापने के लिए प्रत्येक विधि के लिए अलग अनुक्रमों की गणना करें.

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Sampling | "Drawing random values" | Generating values according to a probability distribution. The mechanism behind all generative AI |
| Uniform distribution | "All equally likely" | Every value in $[a, b]$ has equal probability density $1/(b-a)$. The starting point for all sampling methods |
| Inverse CDF | "Probability transform" | $F^{-1}(U)$ converts a uniform sample into a sample from any distribution with known CDF. Exact and efficient |
| Rejection sampling | "Propose and accept/reject" | Generate from a simple proposal, accept with probability proportional to target/proposal ratio. Exact but wastes samples |
| Importance sampling | "Reweight samples" | Estimate expectations under $p(x)$ using samples from $q(x)$ by weighting each sample by $p(x)/q(x)$. Core to PPO in RL |
| Monte Carlo | "Average random samples" | Approximate integrals as sample averages. Error $O(1/\sqrt{N})$ regardless of dimension |
| MCMC | "Random walk that converges" | Construct a Markov chain whose stationary distribution is the target. Metropolis-Hastings is the foundational algorithm |
| Metropolis-Hastings | "Accept uphill, sometimes downhill" | Propose moves, accept based on density ratio. Detailed balance ensures convergence to target distribution |
| Gibbs sampling | "One variable at a time" | Update each variable from its conditional distribution holding others fixed. 100% acceptance rate |
| Temperature | "Confidence knob" | Divides logits by $T$ before softmax. $T<1$ sharpens (more confident), $T>1$ flattens (more diverse) |
| Top-k sampling | "Keep the k best" | Zero out all but the $k$ highest-probability tokens, renormalize, sample. Fixed candidate set size |
| Nucleus sampling (top-p) | "Keep the probable ones" | Keep the smallest set of tokens whose cumulative probability exceeds $p$. Adaptive candidate set size |
| Reparameterization trick | "Move randomness outside" | Write $z = \mu + \sigma \epsilon$ where $\epsilon \sim \mathcal{N}(0,1)$. Makes sampling differentiable. Essential for VAE training |
| Gumbel-Softmax | "Soft categorical sampling" | Differentiable approximation to categorical sampling using Gumbel noise + softmax with temperature |
| Stratified sampling | "Forced coverage" | Divide sample space into strata, sample from each. Always lower variance than naive Monte Carlo |
| Burn-in | "Warm-up period" | Initial MCMC samples discarded before the chain reaches its stationary distribution |
| Detailed balance | "Reversibility condition" | $p(x) T(x \to y) = p(y) T(y \to x)$. Sufficient condition for $p$ to be the stationary distribution of a Markov chain |
| Diffusion sampling | "Iterative denoising" | Generate data by starting from noise and applying learned denoising steps. Each step is a conditional sampling operation |

## आगे पढ़ना

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010)- एमसीएमसी की नींव पर विस्तृत ट्यूटोरियल
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144)- मूल Gumbel-Softmax कागज
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)- नाभिक (शीर्ष-पी) नमूना कागज
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)- रिपरमेटरीकरण की चाल की शुरुआत करने वाला वीएई पेपर
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)- डीडीपीएम नमूनाकरण को छवि उत्पादन से जोड़ता है
