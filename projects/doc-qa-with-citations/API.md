# Public implementation contract

Import query(directory, question, model). A model callback returns JSON {source:chunk_id,quote:exact_text}. --response accepts a recorded response and applies the same gate.

The default answerer is local and extractive. Lexical overlap cannot establish semantic entailment. A valid citation can still be irrelevant or outdated; the content hash lets a reader detect source changes.

### adapter.py

```python
def adapt_splits(doc, parts)
def framework_qa(question, doc, response)
```

### answer.py

```python
def answer(question, chunks, model)
```

### documents.py

```python
def load_documents(root)
def chunk_document(doc, size=200, overlap=30)
```

### retrieval.py

```python
def retrieve(chunks, query, k=3)
```

The stage tests specify ordinary results and rejected inputs. Do not replace the learner imports with reference imports. The final stage also runs the supplied input driver against your cumulative implementation.
