# ध्यान तंत्र  सफलता

> डिकोडर एक संपीड़ित सारांश पर आँख बंद करना बंद कर देता है और पूरे स्रोत को देखना शुरू कर देता है। इसके बाद सब कुछ ध्यान और इंजीनियरिंग है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## समस्या

पाठ 09 मापने की विफलता पर समाप्त हुआ। एक खिलौना कॉपी कार्य पर प्रशिक्षित एक GRU एन्कोडर-डेकोडर लंबाई 5 पर 89% सटीकता से लगभग भाग्य लंबाई 80 तक जाता है। कारण संरचनात्मक है, प्रशिक्षण की त्रुटि नहीं हैः एन्कोडर द्वारा एकत्र की गई प्रत्येक जानकारी को एक निश्चित आकार के छिपे हुए राज्य में फिट होना चाहिए, और डेकोडर कभी भी कुछ और नहीं देखता है।

बाहदानु, चो और बेंगियो ने 2014 में एक तीन पंक्ति का फिक्स प्रकाशित किया। डिकोडर को केवल अंतिम एन्कोडर राज्य देने के बजाय, प्रत्येक एन्कोडर राज्य को बनाए रखें। प्रत्येक डिकोडर चरण में, एन्कोडर राज्यों का एक भारित औसत गणना करें जहां वजन कहते हैं "डेकोडर को एन्कोडर स्थिति को देखने के लिए कितना चाहिए।`i`यह संदर्भ है, और यह हर डेकोडर कदम को बदलता है।

यह सारा विचार है. ट्रांसफार्मर इसे बढ़ाया. आत्म-विचार इसे एक ही अनुक्रम पर लागू किया. मल्टी-हेड ध्यान इसे समानांतर में चलाया. लेकिन 2014 संस्करण पहले ही बोतल के गले को तोड़ दिया, और एक बार जब आप इसे प्राप्त करते हैं, ट्रांसफार्मर के लिए पिव्वट इंजीनियरिंग है, अवधारणा नहीं।

## अवधारणा

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

प्रत्येक डिकोडर कदम पर `t`:

1. पिछले डिकोडर छिपे हुए राज्य का उपयोग करें `s_{t-1}`एक के रूप में **query**. .
2. प्रत्येक एन्कोडर छिपे हुए राज्य के खिलाफ इसे स्कोर करें`h_1, ..., h_T`. एक स्केलर प्रति एन्कोडर स्थिति.
3. ध्यान वजन प्राप्त करने के लिए स्कोर को नरम करें `α_{t,1}, ..., α_{t,T}`यह राशि 1 तक है।
4. संदर्भ वेक्टर `c_t = Σ α_{t,i} * h_i`. एन्कोडर राज्यों का वजन किया गया औसत.
5. डेकोडर लेता है `c_t`पहले के आउटपुट टोकन के साथ, अगले टोकन का उत्पादन करता है।

वजन औसत बिंदु है। जब डिकोडर को "जे" को "आई" में अनुवाद करने की आवश्यकता होती है, तो यह "जे" उच्च और अन्य कम को "जे" उच्च से ऊपर कोडिंग राज्य का वजन करता है। जब इसे "नहीं" की आवश्यकता होती है, तो यह "पास" उच्च का वजन करता है। संदर्भ वेक्टर प्रत्येक चरण को फिर से आकार देता है।

## आकार (वह चीज जो सभी को काटती है)

यह वह जगह है जहाँ ध्यान को लागू करने में पहली बार गलत होता है. धीरे-धीरे पढ़ें.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`. .

- `s_{t-1}`आकार है`(d_s,)`,`h_i`आकार है`(d_h,)`. .
- `W_a`आकार है`(d_attn, d_s)`. .`U_a`आकार है`(d_attn, d_h)`. .
- उनके अंदर राशि का आकार है`(d_attn,)`. .
- `v_α`आकार है`(d_attn,)`. आंतरिक उत्पाद के साथ `v_α`एक स्केलर में गिर जाता है।**This is what `v_α` does.**यह जादू नहीं है, यह प्रक्षेपण है जो ध्यान-अवकाश वेक्टर को स्कारर स्कोर में बदल देता है।

**Luong (multiplicative) score.**तीन प्रकारः

- `dot``e_{t,i} = s_t^T * h_i`. आवश्यकताएँ `d_s == d_h`. कड़ी प्रतिबंध. अगर आपका एन्कोडर द्वि-दिशात्मक है तो छोड़ दें.
- `general``e_{t,i} = s_t^T * W * h_i`के साथ`W`आकार`(d_s, d_h)`. समान-अंधेपन की बाधा को हटा देता है.
- `concat`यह अक्सर नहीं प्रयोग किया जाता है क्योंकि पहले दो सस्ते हैं।

**One Bahdanau / Luong gotcha worth naming.**बहनाऊ उपयोग करता है `s_{t-1}`(वर्तमान शब्द उत्पन्न करने से पहले *decoder state) । Luong का उपयोग करता है `s_t`(अंतर स्थिति **) उन्हें मिलाकर सूक्ष्म रूप से गलत ग्रेडिएंट उत्पन्न होता है जो डिबग करने के लिए बेहद मुश्किल है। एक कागज चुनें और इसके सम्मेलन पर चिपके रहें।

```figure
attention-heatmap
```

## इसे बनाओ

### चरण 1: योजक (बहदानाऊ) ध्यान

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

ऊपर दी गई तालिका के साथ अपने आकार की जाँच करें।`encoder_states`आकार है`(T_enc, d_h)`. .`projected_enc`आकार है`(T_enc, d_attn)`. .`projected_dec`आकार है`(d_attn,)`और प्रसारण। `combined`आकार है`(T_enc, d_attn)`. .`scores`आकार है`(T_enc,)`. .`weights`आकार है`(T_enc,)`. .`context`आकार है`(d_h,)`- इसे भेजें।

### चरण 2: लोंग डॉट और जनरल

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

तीन पंक्तियों में से प्रत्येक. यही कारण है कि लूंग के पेपर में उतरा. अधिकांश कार्यों पर एक ही सटीकता, बहुत कम कोड.

### चरण 3: एक काम किया संख्यात्मक उदाहरण

तीन एन्कोडर राज्यों (लगभग "cat", "sat", "mat") और एक डेकोडर राज्य को देखते हुए जो पहले के साथ सबसे अधिक संरेखित होता है, ध्यान वितरण स्थिति 0 पर केंद्रित होता है। यदि डेकोडर राज्य अंतिम के साथ संरेखित करने के लिए स्थानांतरित होता है, तो ध्यान स्थिति 2 पर जाता है। संदर्भ वेक्टर ट्रैक करता है।

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

पहले पंक्ति जीतता है. फिर डिकोडर राज्य को तीसरे कोडर राज्य के करीब ले जाएं और वजन के बदलाव को देखें. यही है. ध्यान स्पष्ट संरेखण है.

### चरण 4: यह ट्रांसफार्मर का पुल क्यों है

उपरोक्त भाषा का Q/K/V में अनुवाद करेंः

- **Query**= डिकोडर स्थिति `s_{t-1}`
- **Key**= एन्कोडर राज्यों (हम क्या के खिलाफ स्कोर)
- **Value**= एन्कोडर राज्यों (हम क्या वजन और योग)

क्लासिकल ध्यान में, कुंजी और मूल्य एक ही बात हैं। स्व-ध्यान उन्हें अलग करता हैः आप एक अनुक्रम को स्वयं के खिलाफ क्वेरी कर सकते हैं, K और V के लिए विभिन्न सीखे गए अनुमानों के साथ। मल्टी-हेड ध्यान इसे विभिन्न सीखे गए अनुमानों के समानांतर चलाता है। ट्रांसफार्मर पूरे चरण को कई बार ढेर करते हैं और RNNs छोड़ देते हैं।

गणित एक ही है. आकार एक ही हैं. पैडगामिक कूद Bahdanau ध्यान से स्केल बिंदु उत्पाद ध्यान ज्यादातर संकेतन है.

## इसका प्रयोग करें

PyTorch और TensorFlow सीधे ध्यान भेजने.

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

यह एक ट्रांसफार्मर ध्यान परत है. 5 पदों के क्वेरी बैच, 10 पदों के कुंजी / मूल्य बैच, 128-dim प्रत्येक, 8 सिर। `output`यह नया संदर्भ-वर्धित प्रश्न है। `weights`5x10 संरेखण मैट्रिक्स आप कल्पना कर सकते हैं।

### जब क्लासिकल ध्यान अभी भी मायने रखता है

- सिंगल हेड, सिंगल लेयर, आरएनएन आधारित संस्करण हर अवधारणा को दृश्यमान बनाता है।
- डिवाइस पर अनुक्रम कार्य जहां ट्रांसफार्मर फिट नहीं होते हैं।
- 2014 से 2017 तक के किसी भी पेपर को आप बगैर बहदानाऊ के सम्मेलन को जानकर गलत पढ़ेंगे।
- एमटी में बारीक-खरेबी संरेखण विश्लेषण। कच्चे ध्यान वजन ट्रांसफार्मर मॉडल पर भी व्याख्यात्मकता का एक उपकरण हैं, और उन्हें पढ़ने के लिए यह जानना आवश्यक है कि वे क्या हैं।

### ध्यान-वजन-जैसा-विवरण जाल

ध्यान के वजन को समझना संभव है. ये वजन हैं जो एक से दूसरे की स्थिति में जोड़ते हैं; आप उन्हें रेखांकित कर सकते हैं; उच्च का अर्थ है "इस पर नज़र डालें।" समीक्षकों को ये पसंद हैं।

वे उतने व्याख्या योग्य नहीं हैं जितना वे दिखते हैं। जैन और वालेस (2019) ने दिखाया कि ध्यान वितरण को कुछ कार्यों के लिए मॉडल भविष्यवाणियों को बदलने के बिना मनमाने ढंग से विकल्पों द्वारा प्रतिस्थापित और प्रतिस्थापित किया जा सकता है। कभी भी ध्यान के वजन को बिना एक अपवर्तन या विरोधाभासी जांच के तर्क के प्रमाण के रूप में रिपोर्ट न करें।

## इसे भेजें

`outputs/prompt-attention-shapes.md`:

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## व्यायाम

1. **Easy.**कार्यान्वयन`softmax`कोडर में पैडिंग टोकन ध्यान वजन शून्य प्राप्त करने के लिए छिपाई। चर लंबाई अनुक्रमों के साथ एक बैच पर परीक्षण।
2. **Medium.**लुओंग के लिए बहु-मुख्य ध्यान जोड़ें `general`फार्म। विभाजित`d_h`में`n_heads`समूहों, प्रति सिर ध्यान चलाओ, concatenate. सत्यापित करें कि एकल सिर मामले आपके पहले कार्यान्वयन से मेल खाता है.
3. **Hard.**9. पाठ 09 से खिलौना कॉपी करने के कार्य पर बहदाऊ ध्यान के साथ एक GRU एन्कोडर-डेकोडर को प्रशिक्षित करें। प्लॉट सटीकता बनाम अनुक्रम लंबाई। ध्यान नहीं देने की मूल रेखा के साथ तुलना करें। आपको लंबाई बढ़ने के साथ अंतर का विस्तार देखना चाहिए, ध्यान की पुष्टि करते हुए बोतल की खाई को उठाता है।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## आगे पढ़ना

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) अखबार।
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) तीन स्कोर वेरिएंट और उनकी तुलना।
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) व्याख्यात्मकता चेतावनी।
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) PyTorch के साथ चलना योग्य पैदल।
