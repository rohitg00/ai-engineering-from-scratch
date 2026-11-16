import asyncio
import json
import re
import uuid

from langchain_core.messages import AIMessage
from langchain_core.messages.utils import count_tokens_approximately
from langchain_core.outputs import ChatResult
from langchain_core.utils.function_calling import convert_to_openai_tool

from .fake import ScriptedChatModel, call

ORDER_ID = re.compile(r"ORD-[a-z0-9]+-\d+")


def current_turn(messages):
    for index in range(len(messages) - 1, -1, -1):
        if messages[index].type == "human":
            return messages[index].text, [m for m in messages[index + 1:] if m.type == "tool"]
    return "", []


def say(text):
    return AIMessage(content=text)


def ask_tool(name, args, preface="One moment while I check."):
    return call(name, args, call_id=f"call_{uuid.uuid4().hex[:12]}", content=preface)


def decide(messages):
    if messages and "Context Extraction Assistant" in messages[0].text:
        prompt = messages[0].text
        asks = re.findall(r"<message type=\"human\">(.*?)</message>", prompt, re.DOTALL)
        seen = sorted(set(ORDER_ID.findall(prompt)))
        intent = asks[-1] if asks else "none"
        return say(f"## SESSION INTENT\n{intent}\n## SUMMARY\nOrders discussed: {', '.join(seen) or 'none'}.")
    human, results = current_turn(messages)
    text = human.lower()
    done = {m.name: m for m in results}
    orders = ORDER_ID.findall(human)
    if "loop" in text:
        return ask_tool("search_faq", {"query": "shipping times"})
    if "refund" in text and orders:
        return refund_flow(orders[0], done)
    if orders and any(word in text for word in ("where", "status", "track")):
        if "read_order" not in done:
            return ask_tool("read_order", {"order_id": orders[0]})
        if done["read_order"].status == "error":
            return say(f"I couldn't look up order {orders[0]} just now.")
        order = json.loads(done["read_order"].text)
        if "error" in order:
            return say(f"I couldn't find order {orders[0]} on your account.")
        return say(f"Order {order['id']} ({order['item']}) is {order['status']}.")
    if "ticket" in text or "human" in text:
        if "create_ticket" not in done:
            return ask_tool("create_ticket", {"subject": human[:60], "body": human})
        return say(ticket_reply(done["create_ticket"]))
    if text.startswith("remember"):
        if "save_note" not in done:
            return ask_tool("save_note", {"text": human.split(" ", 1)[1]})
        return say("Noted. I will keep that in mind.")
    if "what do you remember" in text:
        if "recall_notes" not in done:
            return ask_tool("recall_notes", {})
        notes = json.loads(done["recall_notes"].text)
        return say("I remember: " + "; ".join(notes) if notes else "I don't have any notes about you yet.")
    if "?" in text:
        if "search_faq" not in done:
            return ask_tool("search_faq", {"query": human})
        if done["search_faq"].status == "error":
            return say("I couldn't search the help center just now.")
        hits = json.loads(done["search_faq"].text)
        return say(hits[0]["answer"] if hits else "I couldn't find that in our help center.")
    return say("I can check orders, refunds, help-center questions, and tickets. What do you need?")


def refund_flow(order_id, done):
    if "read_order" not in done:
        return ask_tool("read_order", {"order_id": order_id})
    if done["read_order"].status == "error":
        return say(f"I couldn't look up order {order_id} just now.")
    order = json.loads(done["read_order"].text)
    if "error" in order:
        return say(f"I couldn't find order {order_id} on your account.")
    remaining = order["total_cents"] - order["refunded_cents"]
    if "refund_order" not in done:
        if remaining <= 0:
            return say(f"Order {order_id} is already fully refunded.")
        args = {"order_id": order_id, "amount_cents": remaining, "reason": "customer request"}
        return ask_tool("refund_order", args, "I can refund that. A teammate needs to approve it.")
    result = done["refund_order"]
    data = json.loads(result.text) if result.status != "error" and result.text.startswith("{") else {}
    if "refund_id" not in data:
        return say(f"I did not refund {order_id}. {data.get('error', result.text)}")
    return say(f"Refunded ${data['amount_cents'] / 100:.2f} on {order_id}. Reference {data['refund_id']}.")


def ticket_reply(message):
    if message.status == "error":
        return "I couldn't open a ticket just now. Please try again."
    return f"I opened ticket {json.loads(message.text)['ticket_id']}. A person will reply by email."


class SupportPolicyModel(ScriptedChatModel):
    label: str = "fake:primary"
    stream_delimiter: str | None = r"(\s+)"
    fail_on: str | None = None
    latency: float = 0.0
    tool_tokens: int = 0

    def bind_tools(self, tools, *, tool_choice=None, **kwargs):
        schemas = json.dumps([convert_to_openai_tool(t) for t in tools])
        return self.model_copy(update={"tool_tokens": len(schemas) // 4})

    def next_reply(self, messages):
        human, _ = current_turn(messages)
        if self.fail_on and self.fail_on in human:
            raise ConnectionError(f"{self.label} is unavailable")
        reply = decide(messages)
        reply.usage_metadata = {
            "input_tokens": (inp := count_tokens_approximately(messages) + self.tool_tokens),
            "output_tokens": (out := count_tokens_approximately([reply])),
            "total_tokens": inp + out,
        }
        return reply

    def _stream(self, messages, stop=None, run_manager=None, **kwargs):
        chunks = list(super()._stream(messages, stop, run_manager, **kwargs))
        chunks[-1].message.response_metadata = {"model_name": self.label}
        yield from chunks

    async def _astream(self, messages, stop=None, run_manager=None, **kwargs):
        await asyncio.sleep(self.latency)
        for chunk in self._stream(messages, stop, None, **kwargs):
            if run_manager:
                await run_manager.on_llm_new_token(chunk.text, chunk=chunk)
            yield chunk

    async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs) -> ChatResult:
        await asyncio.sleep(self.latency)
        result = self._generate(messages, stop, None, **kwargs)
        result.generations[0].message.response_metadata = {"model_name": self.label}
        return result
