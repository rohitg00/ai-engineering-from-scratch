import asyncio

from langchain.agents.middleware import AgentMiddleware

from .telemetry import event, tracer


def model_id(model):
    return getattr(model, "label", None) or getattr(model, "model", None) or type(model).__name__


class Tracing(AgentMiddleware):
    async def awrap_model_call(self, request, handler):
        with tracer.start_as_current_span("model.call") as span:
            span.set_attribute("gen_ai.request.model", model_id(request.model))
            span.set_attribute("gen_ai.request.message_count", len(request.messages))
            response = await handler(request)
            message = response.result[-1]
            usage = message.usage_metadata or {}
            span.set_attribute("gen_ai.response.model", message.response_metadata.get("model_name", ""))
            span.set_attribute("gen_ai.usage.input_tokens", usage.get("input_tokens", 0))
            span.set_attribute("gen_ai.usage.output_tokens", usage.get("output_tokens", 0))
            span.set_attribute("gen_ai.response.tool_calls", len(message.tool_calls))
            return response

    async def awrap_tool_call(self, request, handler):
        name = request.tool_call["name"]
        with tracer.start_as_current_span(f"tool.{name}") as span:
            span.set_attribute("gen_ai.tool.name", name)
            span.set_attribute("gen_ai.tool.call.id", request.tool_call["id"])
            result = await handler(request)
            span.set_attribute("tool.status", getattr(result, "status", "success"))
            event("tool.done", tool=name, status=getattr(result, "status", "success"))
            return result


class ToolTimeout(AgentMiddleware):
    def __init__(self, seconds, per_tool=None):
        super().__init__()
        self.seconds = seconds
        self.per_tool = per_tool or {}

    async def awrap_tool_call(self, request, handler):
        limit = self.per_tool.get(request.tool_call["name"], self.seconds)
        return await asyncio.wait_for(handler(request), limit)


def tool_error_message(exc, request):
    event("tool.error", tool=request.tool_call["name"], error=type(exc).__name__)
    if isinstance(exc, TimeoutError):
        return f"{request.tool_call['name']} timed out. Tell the customer and do not guess."
    return f"{request.tool_call['name']} failed with {type(exc).__name__}. Tell the customer and do not guess."
