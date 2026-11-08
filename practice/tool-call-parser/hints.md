## Hint 1

The reply is JSON text, and each `arguments` field inside it is JSON text too. Call `json.loads` on the body, then call it again on each `arguments` string.

## Hint 2

Write one recursive function that takes a schema, a value, a path and the list of errors. It appends to the list and returns nothing. `validate_args` starts it at the empty path and shows the empty path as `/`.

## Hint 3

Test `bool` before `int` when you name the JSON type of a value. In Python, `isinstance(True, int)` is true.

## Hint 4

Return right after a type error or an enum error. For an object, finish the `required` loop before you walk the keys of the value. Escape `~` before `/` in a path segment, or the `~` of `~1` changes again.
