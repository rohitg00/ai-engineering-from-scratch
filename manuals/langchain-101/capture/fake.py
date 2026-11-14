import re
from collections.abc import Callable, Sequence
from typing import Any

from langchain_core.decisions import BaseDecisionModel, ClassifierResponse
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from pydantic import Field


def tool_name(item):
    if isinstance(item, dict):
        return item.get("name") or item.get("title") or item.get("function", {}).get("name") or item.get("type")
    return getattr(item, "name", None) or getattr(item, "__name__", None) or type(item).__name__


def call(name, args, call_id="call_1", content=""):
    return AIMessage(content=content, tool_calls=[{"name": name, "args": args, "id": call_id, "type": "tool_call"}])


def calls(*items, content=""):
    return AIMessage(content=content, tool_calls=[{"name": n, "args": a, "id": i, "type": "tool_call"} for n, a, i in items])


class ScriptedChatModel(BaseChatModel):
    script: list[Any] = Field(default_factory=list, exclude=True)
    position: int = Field(default=0, exclude=True)
    label: str = "scripted"
    stream_delimiter: str | None = None
    log: list[dict] = Field(default_factory=list, exclude=True)
    bound: dict = Field(default_factory=dict, exclude=True)

    def bind_tools(self, tools: Sequence[Any], *, tool_choice: str | None = None, **kwargs: Any):
        self.bound = {"tools": [tool_name(t) for t in tools], "tool_choice": tool_choice, "kwargs": sorted(kwargs)}
        return self

    def next_reply(self, messages):
        if self.position >= len(self.script):
            raise IndexError(f"{self.label}: script exhausted after {self.position} replies")
        item = self.script[self.position]
        self.position += 1
        self.log.append({
            "model": self.label,
            "call": self.position,
            "messages": [f"{m.type}: {m.text[:80]}" if m.text else f"{m.type}" for m in messages],
            **({"bound": dict(self.bound)} if self.bound else {}),
        })
        if isinstance(item, BaseException):
            raise item
        if callable(item):
            item = item(messages)
        return AIMessage(content=item) if isinstance(item, str) else item

    def _generate(self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs: Any) -> ChatResult:
        return ChatResult(generations=[ChatGeneration(message=self.next_reply(messages))])

    def _stream(self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs: Any):
        message = self.next_reply(messages)
        content = message.content
        tool_calls = message.tool_calls
        if content:
            if not isinstance(content, str):
                raise ValueError("Expected content to be a string.")
            pieces = [content] if self.stream_delimiter is None else [p for p in re.split(self.stream_delimiter, content) if p]
            for index, token in enumerate(pieces):
                last = index == len(pieces) - 1
                chunk = ChatGenerationChunk(message=AIMessageChunk(
                    content=token,
                    id=message.id,
                    tool_calls=tool_calls if last else [],
                    usage_metadata=message.usage_metadata if last else None,
                ))
                if last:
                    chunk.message.chunk_position = "last"
                if run_manager:
                    run_manager.on_llm_new_token(token, chunk=chunk)
                yield chunk
        elif tool_calls:
            chunk = ChatGenerationChunk(message=AIMessageChunk(
                content="",
                id=message.id,
                tool_calls=tool_calls,
                usage_metadata=message.usage_metadata,
                chunk_position="last",
            ))
            if run_manager:
                run_manager.on_llm_new_token("", chunk=chunk)
            yield chunk

    @property
    def _llm_type(self) -> str:
        return "scripted-fake-chat-model"

    @property
    def _identifying_params(self) -> dict[str, Any]:
        return {"label": self.label}


class ScriptedDecisionModel(BaseDecisionModel):
    model: str = "scripted-decision-model"
    answer: Callable[[Any, dict], dict] = Field(exclude=True)
    log: list[dict] = Field(default_factory=list, exclude=True)

    @property
    def _provider(self) -> str:
        return "fake"

    def _classify(self, state, questions):
        self.log.append({"questions": {key: q.model_dump(mode="json") for key, q in questions.items()}})
        return ClassifierResponse(model=self.model, answers=self.answer(state, questions))
