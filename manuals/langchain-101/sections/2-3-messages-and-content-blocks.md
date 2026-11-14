# Messages and content blocks

> Every model input and output is a list of four message types, and `content_blocks` reads any provider's content as the same typed blocks.

You switch an agent from one provider to another, and the code that read the reasoning text of the model breaks. One provider puts it in a `thinking` block and the other in a `reasoning` block. Both are still the `content` of an `AIMessage`, in two shapes.

When you finish this section, you can build each message type and read a tool call from an `AIMessage`. You can also read content through standard blocks that stay the same across providers.

## The four message types

**Message:** one entry in the conversation, with a type, a `content`, and an optional `id`.

`SystemMessage` holds instructions, `HumanMessage` holds the user turn, `AIMessage` holds the model output, and `ToolMessage` holds a tool result. This is one conversation in their dict form:

```listing
title: one conversation as message objects
source: capture/out/02-messages.txt
lang: json
note: The first section of the file. The SystemMessage is cut.
---
  {
    "type": "HumanMessage",
    "content": "What is 2 + 3?"
  },
  {
    "type": "AIMessage",
    "content": "",
    "tool_calls": [
      {
        "name": "add",
        "args": {
          "a": 2,
          "b": 3
        },
        "id": "call_1",
        "type": "tool_call"
      }
    ]
  },
  {
    "type": "ToolMessage",
    "content": "5",
    "name": "add",
    "tool_call_id": "call_1",
    "status": "success"
  },
  {
    "type": "AIMessage",
    "content": "The sum is 5.",
    "usage_metadata": {
      "input_tokens": 12,
      "output_tokens": 6,
      "total_tokens": 18
    }
  }
```

**Tool call:** an entry in `AIMessage.tool_calls` with a `name`, parsed `args`, and an `id`. The `ToolMessage` that answers it carries the same id in `tool_call_id`.

The `AIMessage` that asks for a tool has empty `content`. Its request is in `tool_calls`, already parsed from the JSON text of the provider. `usage_metadata` holds the token counts when the provider reports them. [Figure 2.3](#fig-2-3) shows where each field is.

```figure
id: fig-2-3
kind: structure
title: the fields of an AIMessage and its ToolMessage
claim: A tool call lives in AIMessage.tool_calls, not in content, and the ToolMessage that answers it repeats its id in tool_call_id.
caption: The left card is the AIMessage that asks for add, and the right card is the ToolMessage that answers it. The line joins the two fields that hold call_1. From capture/out/02-messages.txt and capture/out/06-agent-run.txt.
```

You can also pass plain dicts and tuples. `create_agent` and every chat model turn `{"role": "user", "content": "hi"}` into a `HumanMessage`, and `("assistant", "hello")` into an `AIMessage`:

```listing
title: dicts and tuples after convert_to_messages
source: capture/out/02-messages.txt
lang: json
---
  {
    "type": "HumanMessage",
    "content": "hi"
  },
  {
    "type": "AIMessage",
    "content": "hello"
  },
  {
    "type": "SystemMessage",
    "content": "be brief"
  }
```

## Content blocks

**Content block:** one typed part of a message, a dict with a `type` such as `text`, `reasoning`, `image`, `file`, or `tool_call`.

The documentation says that every message has a `content_blocks` property, which parses `content` into standard typed blocks when you read it {{docs oss/python/langchain/messages}}. The same page says that content blocks add to `content` and do not replace it {{docs oss/python/langchain/messages}}. So `content` keeps the shape of the provider, and `content_blocks` gives you the standard shape.

The kit builds an `AIMessage` with content in the Anthropic shape: a `thinking` block with a signature, then a text block. `content_blocks` reads it as standard blocks:

```listing
title: provider content read as standard blocks
source: capture/out/02-messages.txt
lang: json
---
  {
    "type": "reasoning",
    "reasoning": "Add the numbers.",
    "extras": {
      "signature": "sig"
    }
  },
  {
    "type": "text",
    "text": "The sum is 5."
  }
]

.text -> 'The sum is 5.'
```

The `thinking` block became `reasoning`, and the field of the provider that has no standard name went to `extras`. `.text` joins the text blocks into one string. It is a property at the pin. Code that calls `.text()` still works, and it warns.

On an `AIMessage` with tool calls and empty content, `content_blocks` has one `tool_call` block for each call. So one loop over `content_blocks` reads text, reasoning, and tool calls in their order.

## Multimodal input

A `HumanMessage` can hold a list of standard blocks in `content`. The kit sends a text block, an image by URL, and a PDF as base64:

```listing
title: a multimodal human message
source: capture/out/02-messages.txt
lang: json
note: The content list of the message.
---
      {
        "type": "text",
        "text": "Describe this image."
      },
      {
        "type": "image",
        "url": "https://example.com/cat.png"
      },
      {
        "type": "file",
        "base64": "JVBERi0=",
        "mime_type": "application/pdf"
      }
```

Each provider package converts these blocks to its own request format. The model profile says which inputs a model accepts, such as `image_inputs` and `pdf_inputs`. [Section 2.2](#s-init-chat-model-and-model-profiles) shows one profile.

## Chunks

**Chunk:** a part of a message that a model streams, such as `AIMessageChunk`. Chunks add with `+` into one message.

Tool calls also stream in parts. Each `tool_call_chunk` holds a piece of the arguments as text. When the chunks are added, the parts join, and the parsed call appears in `tool_calls`:

```listing
title: tool call chunks after they are added
source: capture/out/02-messages.txt
lang: json
---
{
  "tool_call_chunks": [
    {
      "name": "add",
      "args": "{\"a\": 2, \"b\": 3}",
      "id": "call_1",
      "index": 0,
      "type": "tool_call_chunk"
    }
  ],
  "tool_calls": [
    {
      "name": "add",
      "args": {
        "a": 2,
        "b": 3
      },
      "id": "call_1",
      "type": "tool_call"
    }
  ]
}
```

`langchain-core` 1.7.0 changed how a stream reports the arguments of a tool call while they arrive. Part 4 shows the stream events of the pin.

## Trimming

`trim_messages` keeps the last messages that fit a token budget. With `max_tokens=3` and a counter that counts one per message, it kept the system message and the last two messages. With `start_on="human"` it kept only the system message, because no kept slice started on a human message:

```listing
title: trim_messages with start_on human
source: capture/out/02-messages.txt
lang: json
---
the same with start_on='human':
[
  {
    "type": "SystemMessage",
    "content": "You are terse."
  }
]
```

The first result starts with a `ToolMessage` whose `AIMessage` was cut. Most providers reject a tool result without its call. So trim on a turn boundary, and test what your trim returns.

```takeaways
- Read tool calls from AIMessage.tool_calls, not from content.
- Read content through content_blocks when the code must work with more than one provider.
- Keep each ToolMessage with the AIMessage whose tool call it answers.
- Use .text as a property, without parentheses.
- Check the model profile before you send an image or a file.
```

Sources: capture/out/02-messages.txt, capture/out/06-agent-run.txt; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/messages, oss/python/releases/changelog); libs/core/langchain_core/messages at langchain==1.5.0.
