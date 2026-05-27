"""Real-time voice pipeline — VAD + turn-detection + barge-in scheduler.

The hard architectural primitive in a 2026 voice agent is not the ASR or the
TTS. It is the streaming scheduler that arbitrates between VAD events, ASR
partials, turn-completion scores, LLM streaming, TTS streaming, and user
barge-in, all with bounded latency. This scaffold simulates audio frames and
implements the scheduler in full: state machine, barge-in cancellation, tool
side-channel with filler injection, latency accounting.

Run:  python main.py
"""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from enum import Enum, auto


# ---------------------------------------------------------------------------
# frame stream  --  simulated 20ms audio frames
# ---------------------------------------------------------------------------

@dataclass
class Frame:
    t_ms: int              # timestamp ms since session start
    is_speech: bool        # VAD verdict (Silero v5 stand-in)
    partial: str = ""      # ASR cumulative partial (Deepgram Nova-3 stand-in)


def synth_call(script: str, start_ms: int = 0, noise: float = 0.0) -> list[Frame]:
    """Generate a frame stream for a simulated caller utterance."""
    words = script.split()
    frames: list[Frame] = []
    t = start_ms
    # 120ms silence before speech
    for _ in range(6):
        frames.append(Frame(t_ms=t, is_speech=random.random() < noise))
        t += 20
    partial = ""
    for w in words:
        partial = (partial + " " + w).strip()
        # each word ~320ms of speech
        for _ in range(16):
            frames.append(Frame(t_ms=t, is_speech=True, partial=partial))
            t += 20
    # trailing silence, 2200ms (enough to cover tool + LLM + TTS)
    for _ in range(110):
        frames.append(Frame(t_ms=t, is_speech=False, partial=partial))
        t += 20
    return frames


# ---------------------------------------------------------------------------
# turn detector  --  combines VAD silence duration and completion score
# ---------------------------------------------------------------------------

def turn_completion_score(partial: str) -> float:
    """Tiny stand-in for the LiveKit turn-detector model."""
    if not partial:
        return 0.0
    if partial.rstrip().endswith(("?", ".", "!")):
        return 0.95
    # heuristic: more words, more confidence the turn is done
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
    LISTENING = auto()   # user is mid-utterance
    WAITING = auto()     # VAD says silence, checking turn score
    THINKING = auto()    # LLM streaming but no TTS yet
    SPEAKING = auto()    # TTS streaming out
    TOOL = auto()        # side-channel tool in flight


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
# tool side channel  --  async weather/calendar with filler injection
# ---------------------------------------------------------------------------

@dataclass
class Tool:
    name: str
    latency_ms: int
    result: str


WEATHER = Tool("weather.tokyo_tomorrow", latency_ms=420, result="68/52 partly cloudy")


# ---------------------------------------------------------------------------
# scheduler  --  the full pipeline, streamed frame by frame
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
        # barge-in: user starts speaking while we are SPEAKING or THINKING
        if (barge_in_at_ms is not None and f.t_ms >= barge_in_at_ms
                and state in (State.SPEAKING, State.THINKING)
                and f.is_speech):
            m.barge_ins += 1
            m.log(f"{f.t_ms}ms BARGE-IN: cancel TTS, re-arm ASR")
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
                        m.log(f"{f.t_ms}ms SILENCE but score={score:.2f}, waiting")

        if state == State.WAITING:
            # kick off LLM
            llm_stream_started_at = f.t_ms + 140  # simulated time-to-first-token
            state = State.THINKING
            m.log(f"{f.t_ms}ms LLM call fired")
            if use_tool:
                tool_started_at = f.t_ms
                state = State.TOOL

        elif state == State.TOOL:
            if tool_started_at >= 0 and not filler_emitted:
                if f.t_ms - tool_started_at >= 300:
                    filler_emitted = True
                    m.log(f"{f.t_ms}ms filler 'one second, let me check'")
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
# demo  --  runs two sessions, one clean, one with a barge-in
# ---------------------------------------------------------------------------

def main() -> None:
    random.seed(0)
    print("=== session 1: clean call with tool (weather) ===")
    frames = synth_call("what is the weather in tokyo tomorrow", start_ms=0)
    m = run_session(frames, use_tool=True, barge_in_at_ms=None)
    for line in m.events:
        print(" ", line)
    print(f"  turn_complete  @ {m.turn_complete_ms}ms")
    print(f"  first_llm_tok  @ {m.first_llm_token_ms}ms")
    print(f"  first_audio_out @ {m.first_audio_out_ms}ms")
    print(f"  turn latency   = {m.latency_ms()}ms")

    print()
    print("=== session 2: user barges in mid-response ===")
    frames = synth_call("tell me a long story about", start_ms=0)
    # add a few synthetic speech frames late in the trailing silence
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
