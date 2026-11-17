from collections.abc import Sequence
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import Field


class ToolFake(BaseChatModel):
    """Tool-capable scripted fake, after the capture kit's ScriptedChatModel (fake.py)."""

    script: list[Any] = Field(default_factory=list, exclude=True)
    position: int = Field(default=0, exclude=True)
    cycle: bool = False

    def bind_tools(self, tools: Sequence[Any], *, tool_choice: str | None = None, **kwargs: Any):
        return self

    def _next(self):
        if self.position >= len(self.script):
            if not self.cycle:
                raise IndexError("script exhausted")
            self.position = 0
        item = self.script[self.position]
        self.position += 1
        return item.model_copy() if isinstance(item, AIMessage) else AIMessage(content=item)

    def _generate(self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs: Any) -> ChatResult:
        return ChatResult(generations=[ChatGeneration(message=self._next())])

    @property
    def _llm_type(self) -> str:
        return "tool-fake"
