## Why the arguments are a string

The function calling lesson shows that one provider sends `arguments` as a JSON string, and the others send an object. A string lets the provider stream the arguments token by token. The cost is a second `json.loads`, and that call can fail when the model writes bad JSON. A parser that raises `ValueError` lets the agent send the error back to the model.

## Why paths and a fixed order

The tool registry lesson returns JSON pointer paths, because a model fixes `/lines/1/qty: expected integer, got number` faster than a sentence. A fixed error order makes the output the same on each run. Then a test can compare it, and a retry loop can see when the model makes no progress.

## The boolean trap

In Python, `bool` is a subclass of `int`. Without a separate check, `true` passes as an integer and as a number. JSON Schema keeps these types apart, so the validator must too.

## Where this goes next

The registry lesson adds `minLength`, `maxLength` and `pattern`, and suggests `$ref` next. The MCP lessons validate tool input with the same kind of schema before a server runs the tool.
