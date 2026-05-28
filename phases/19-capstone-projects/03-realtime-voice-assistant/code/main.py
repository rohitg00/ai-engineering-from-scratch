"""Real-time voice pipeline — VAD + turn-detection + barge-in scheduler。

2026年の voice agent で難しい architectural primitive は ASR や TTS では
ありません。bounded latency の中で VAD event、ASR partial、turn-completion
score、LLM streaming、TTS streaming、user barge-in を調停する streaming
scheduler です。この scaffold は audio frame を simulate し、state machine、
barge-in cancellation、filler injection 付き tool side-channel、latency
accounting を含む scheduler 全体を実装します。

Run:  python main.py
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from enum import Enum, auto


# ---------------------------------------------------------------------------
# frame stream  --  20ms audio frame の simulation
# ---------------------------------------------------------------------------

@dataclass
class Frame:
    t_ms: int              # session start からの timestamp ms
    is_speech: bool        # VAD verdict (Silero v5 の代役)
    partial: str = ""      # ASR cumulative partial (Deepgram Nova-3 の代役)


def synth_call(script: str, start_ms: int = 0, noise: float = 0.0) -> list[Frame]:
    """simulated caller utterance 用の frame stream を生成する。"""
    words = script.split()
    frames: list[Frame] = []
    t = start_ms
    # speech 前の 120ms silence
    for _ in range(6):
        frames.append(Frame(t_ms=t, is_speech=random.random() < noise))
        t += 20
    partial = ""
    for w in words:
        partial = (partial + " " + w).strip()
        # 各 word は約 320ms の speech
        for _ in range(16):
            frames.append(Frame(t_ms=t, is_speech=True, partial=partial))
            t += 20
    # trailing silence 2200ms (tool + LLM + TTS を覆うのに十分)
    for _ in range(110):
        frames.append(Frame(t_ms=t, is_speech=False, partial=partial))
        t += 20
    return frames


# ---------------------------------------------------------------------------
# turn detector  --  VAD silence duration と completion score を組み合わせる
# ---------------------------------------------------------------------------

def turn_completion_score(partial: str) -> float:
    """LiveKit turn-detector model の小さな代役。"""
    if not partial:
        return 0.0
    if partial.rstrip().endswith(("?", ".", "!")):
        return 0.95
    # heuristic: word が多いほど turn 完了の confidence が高い
    n = len(partial.split())
    if n < 3:
        return 0.2
    if n < 6:
        return 0.55
    return 0.75


# ---------------------------------------------------------------------------
# state machine  --  IDLE -> LISTENING -> THINKING -> SPEAKING -> (barge-in)
# ---------------------------------------------------------------------------

class State(Enum):
    IDLE = auto()
    LISTENING = auto()   # user が発話中
    WAITING = auto()     # VAD は silence、turn score を確認中
    THINKING = auto()    # LLM streaming 中だが TTS はまだ
    SPEAKING = auto()    # TTS streaming 中
    TOOL = auto()        # side-channel tool が実行中


@dataclass
class Metrics:
    events: list[str] = field(default_factory=list)
    turn_complete_ms: int = 0
    first_llm_token_ms: int = 0
    first_audio_out_ms: int = 0
    false_cutoffs: int = 0
    barge_ins: int = 0

    def log(self, msg: str) -> None:
        self.events.append(msg)

    def latency_ms(self) -> int:
        if self.turn_complete_ms and self.first_audio_out_ms:
            return self.first_audio_out_ms - self.turn_complete_ms
        return -1


# ---------------------------------------------------------------------------
# tool side channel  --  filler injection 付き async weather/calendar
# ---------------------------------------------------------------------------

@dataclass
class Tool:
    name: str
    latency_ms: int
    result: str


WEATHER = Tool("weather.tokyo_tomorrow", latency_ms=420, result="68/52、一部曇り")


# ---------------------------------------------------------------------------
# scheduler  --  frame ごとに stream される full pipeline
# ---------------------------------------------------------------------------

def run_session(frames: list[Frame], use_tool: bool = True,
                barge_in_at_ms: int | None = None) -> Metrics:
    m = Metrics()
    state = State.IDLE
    silence_run_ms = 0
    final_partial = ""
    llm_stream_started_at = -1
    tts_stream_started_at = -1
    tool_started_at = -1
    tool_done_at = -1
    filler_emitted = False

    for f in frames:
        # barge-in: SPEAKING または THINKING 中に user が話し始める
        if (barge_in_at_ms is not None and f.t_ms >= barge_in_at_ms
                and state in (State.SPEAKING, State.THINKING)
                and f.is_speech):
            m.barge_ins += 1
            m.log(f"{f.t_ms}ms BARGE-IN: TTS を cancel し、ASR を再 arm")
            state = State.LISTENING
            tts_stream_started_at = -1
            llm_stream_started_at = -1
            continue

        if state == State.IDLE:
            if f.is_speech:
                state = State.LISTENING
                m.log(f"{f.t_ms}ms LISTENING")

        elif state == State.LISTENING:
            if f.is_speech:
                silence_run_ms = 0
                final_partial = f.partial or final_partial
            else:
                silence_run_ms += 20
                if silence_run_ms >= 500:
                    score = turn_completion_score(final_partial)
                    if score >= 0.6:
                        state = State.WAITING
                        m.turn_complete_ms = f.t_ms
                        m.log(f"{f.t_ms}ms TURN COMPLETE (score={score:.2f})"
                              f" partial='{final_partial}'")
                    else:
                        m.log(f"{f.t_ms}ms SILENCE だが score={score:.2f}、待機")

        if state == State.WAITING:
            # LLM を開始する
            llm_stream_started_at = f.t_ms + 140  # simulated time-to-first-token
            state = State.THINKING
            m.log(f"{f.t_ms}ms LLM call を発火")
            if use_tool:
                tool_started_at = f.t_ms
                state = State.TOOL

        elif state == State.TOOL:
            if tool_started_at >= 0 and not filler_emitted:
                if f.t_ms - tool_started_at >= 300:
                    filler_emitted = True
                    m.log(f"{f.t_ms}ms filler '少々お待ちください。確認します'")
            if tool_started_at >= 0 and f.t_ms - tool_started_at >= WEATHER.latency_ms:
                tool_done_at = f.t_ms
                m.log(f"{f.t_ms}ms tool result: {WEATHER.result}")
                llm_stream_started_at = f.t_ms + 140
                state = State.THINKING

        elif state == State.THINKING:
            if llm_stream_started_at > 0 and f.t_ms >= llm_stream_started_at:
                if m.first_llm_token_ms == 0:
                    m.first_llm_token_ms = f.t_ms
                    m.log(f"{f.t_ms}ms LLM first token")
                tts_stream_started_at = f.t_ms + 180
                state = State.SPEAKING

        elif state == State.SPEAKING:
            if tts_stream_started_at > 0 and f.t_ms >= tts_stream_started_at:
                if m.first_audio_out_ms == 0:
                    m.first_audio_out_ms = f.t_ms
                    m.log(f"{f.t_ms}ms TTS first audio-out")

    return m


# ---------------------------------------------------------------------------
# demo  --  clean session と barge-in session を1つずつ実行する
# ---------------------------------------------------------------------------

def main() -> None:
    random.seed(0)
    print("=== session 1: tool (weather) 付きの正常 call ===")
    frames = synth_call("what is the weather in tokyo tomorrow", start_ms=0)
    m = run_session(frames, use_tool=True, barge_in_at_ms=None)
    for line in m.events:
        print(" ", line)
    print(f"  turn_complete   @ {m.turn_complete_ms}ms")
    print(f"  first_llm_tok   @ {m.first_llm_token_ms}ms")
    print(f"  first_audio_out @ {m.first_audio_out_ms}ms")
    print(f"  turn latency    = {m.latency_ms()}ms")

    print()
    print("=== session 2: user が応答途中に barge in ===")
    frames = synth_call("tell me a long story about", start_ms=0)
    # trailing silence の終盤に synthetic speech frame を少し追加する
    for i in range(8):
        idx = len(frames) - 20 + i
        if 0 <= idx < len(frames):
            frames[idx] = Frame(t_ms=frames[idx].t_ms, is_speech=True,
                                partial=frames[idx].partial)
    m = run_session(frames, use_tool=False,
                    barge_in_at_ms=frames[-20].t_ms - 60)
    for line in m.events:
        print(" ", line)
    print(f"  barge_ins = {m.barge_ins}")


if __name__ == "__main__":
    main()
