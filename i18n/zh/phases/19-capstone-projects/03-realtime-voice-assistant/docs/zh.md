# 卡普斯通03 实时语音助理 (ASR到LLM到TTS)

> 听到声音的代理人可以使用800ms以下的端到端延迟,知道你何时停止说话,处理入, 雷特尔,瓦皮,莱维基特代理和皮皮卡特都在2026年进入这个酒吧. 它们用相同的形式进行: 流媒体ASR,转变检测器,流媒体LLM, 建立一个,测量WER和MOS和错误切断率,然后运行在输入输入下.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client, scheduler scaffold)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:**子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子子
**Time:** 30 hours

## 问题

语音是2025-2026年最快发展的AI UX类别. 技术上限每季度都下降. 开放AI实时API,双子 2.5 现场,卡特西亚索尼克-2,ElevenLabs Flash v3,LiveKit Agents 1.0和皮皮卡特 0.0.70都能实现800ms下载. 酒吧不是一个人的延迟. 互动感觉:不切断用户,不切断,从句子中断中恢复,在谈话中调用工具,

构建它,故障模式就会显现:为背景电视打响电话的音频调节的VAD,一个等待永远不会出现的分分区的轮检测器,一个TTS在发射之前缓冲400ms. 最重要的是在负载下一次修复这些并发布延迟和质量报告.

## 概念

管道有五个流程:**audio in**(WebRTC来自浏览器或PSTN),**ASR**(从 Deepgram Nova-3 或更快的语中流动部分转录),**turn detection**(VAD加上一个小的转变检测器模型,**LLM**(随着轮回完成, 流通令牌),**TTS**(在第一次LLM代币后,在200ms内播放音频).

两者之间存在三种问题.**Barge-in**随着使用者在代理人在说话时,TTS会取消,ASR会立即接听. **Tool use**: 交谈函数中调 (天气,日历) 必须在侧通道上运行,而不阻碍音频;如果延迟超过300ms,代理预先填充确认令牌 ("一秒..."). **Backpressure**:在数据包丢失下,部分转录被保留,VAD提高了语音门门门值,代理人避免在未被承认的消息上说话.

测量是量化.Hamming VAD基准15 dB SNR上的WER低于8%.测量调用100次的第一次音频输出 p50低于800ms.测量调用率低于3%.TTS上的MOS高于4.2.50次.单个g5.xlarge上的50次同步调用.这些数字是可交付的.

## 建筑

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

## 堆

- 运输:LiveKit Agents 1.0 (WebRTC) 加上Twilio PSTN门户;作为替代框架,Pipecat 0.0.70
- 亚斯拉:深度格式诺瓦-3 (流动,第一个部分次300ms以下) 或更快的语Whisper-v3-turbo自主托管
- 维亚:Silero VAD v5加上LiveKit转换探测器 (读取部分转录的小型变压器)
- 专业:OpenAI GPT-4o实时集成,双子 2.5 闪存直播,或化Claude Haiku 4.5 (流媒体完成,独立音频路径)
- 卡特西亚索尼克-2 (最低的第一字节),ElevenLabs Flash v3,或自主主主机的开源Orpheus
- 工具:FastMCP侧通道用于天气/日历/预订;如果工具需要300ms以上的时间,代理预发填充器
- 可观察性:OpenTelemetry语音跨度,Langfuse语音跟音频重播
- 部署:单个g5.xlarge (24GBVRAM) 用于自主托管的Whisper + Orpheus;托管的API以最低延迟

```figure
ce-voice-latency
```

## 建立它

1. **WebRTC session.**在服务器上,连接一个代理工作者,加入房间.

2. **ASR streaming.**输送20ms的PCM框架到Deepgram Nova-3 (或 GPU上更快的语).订阅部分和最终的转录.每部分延迟记录.

3. **VAD and turn detector.**在语音结束时,将LiveKit转换探测器启动与最新部分转录.只有当VAD说沉默500ms时,只会承诺"完成",转换探测器得分完成>0.6.

4. **LLM stream.**在完成时,开始与正在进行的对话加上最终的转录. 流出代币. 在第一个代币,交给TTS.

5. **TTS stream.**卡特西亚 Sonic-2 将音频块回放.第一块必须在第一个LLM代币200ms内离开服务器. 发送块到LiveKit室;客户端通过WebRTC节缓冲器播放.

6. **Barge-in.**当VAD在播放TTS时检测到新用户语音时,立即取消TTS流,放弃剩余的LLM输出,重新装备ASR.`tts_canceled`度.

7. **Tool side channel.**记录天气和日历作为调用函数工具.当调用时,同时打开调用;如果它在300ms内没有解决,请LLM发出"一秒钟,让我检查"作为填充器;一旦工具返回,再恢复.

8. **Eval harness.**记录100次电话.计算WER (对待延期转录),错误截止率 (用户在句子中中时取消TTS),首次音频输出p50,TTS MOS (人或NISQA),以及丧测试 (减少3%的包).

9. **Load test.**通过一个g5.xlarge和合成调用器进行50次同时调用.

## 用它

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

## 运送它

`outputs/skill-voice-agent.md`由于一个域名 (客户支持,安排或亭子),它会出现一个LiveKit代理,ASR/VAD/LLM/TTS管道调整到测量.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## 运动

1. 换 Deepgram Nova-3 换g5.xlarge 上的更快的语 v3 轮机. 测量延迟和 WER 差距. 确定CPUvsGPU决策在哪里重要.

2. 加入一个中断-仲裁政策:当用户在工具调用中入时,代理会做什么?比较三个政策 (硬取消,完成工具,然后停止,排队下一轮).

3. 执行反向转换检测器测试:在句子中给用户长时间停顿. 调整VAD沉默门和转换检测器得分门以实现最低的假切断,而不需要超过900ms.

4. 通过Twilio在PSTN上部署相同的代理.将PSTN首次音频输出与WebRTC进行比较.解释器缓冲器和编码区别.

5. 添加非英语语言 (日本语,西班牙语) 的语音活动检测. 测量Silero VAD v5错误触发率与语言特定的细节调节.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## 进一步阅读

- [LiveKit Agents 1.0](https://github.com/livekit/agents)参考WebRTC代理框架
- [Pipecat](https://github.com/pipecat-ai/pipecat)替代Python-第一流媒体代理框架
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) 关于集成语音模型的参考
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs)流媒体ASR引用
- [Silero VAD v5](https://github.com/snakers4/silero-vad) VAD 参考模型
- [Cartesia Sonic-2](https://docs.cartesia.ai)低延迟TTS参考
- [Retell AI architecture](https://docs.retellai.com)生产语音代理架构
- [Vapi.ai production stack](https://docs.vapi.ai)替代生产参考
