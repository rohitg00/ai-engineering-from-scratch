# Урок 11.01 — Prompt Engineering: техники и паттерны

Русский конспект параллельно с `en.md`. Заполняется по ходу прохождения.

## План разбора

Урок разбит на 7 содержательных блоков теории. После каждого — пауза, в
конце некоторых — мини-упражнение (написать промпт руками в чате или в
`my/`-файле).

1. **Зачем prompt engineering существует.** Vague vs engineered prompt.
   Почему «попросил как другу» даёт мусор.
2. **Anatomy of a prompt.** Три роли в API: system / user / assistant
   (+ prefill как фишка Anthropic).
3. **Role prompting.** «You are an expert X» — не магия, а activation
   function в распределении обучающих данных.
4. **Instruction clarity + output format control.** Конкретное побеждает
   расплывчатое. JSON / XML / Markdown / numbered list / delimiters.
5. **Constraints.** Negative («не делай»), positive («всегда делай»),
   conditional («если X то Y»).
6. **Temperature, sampling, context window.** Применимость к практике
   (мост-блок 6 — фундамент, тут — рецепты).
7. **10 prompt patterns + anti-patterns + cross-model design.** Каталог
   шаблонов + что НЕ делать + как писать промпты, переносимые между
   моделями.

## Упражнения

По плану `feedback-user-writes-llm-code` — упражнения Pavel делает сам в
`my/`. Большинство упражнений этого урока — **не на Python**, а на
**переписывание промптов**: берёшь плохой промпт, превращаешь в хороший
по чек-листу.

Финальное упражнение — реальный API-вызов к Claude Sonnet 4.6 с разными
температурами и паттернами, сравнение результатов.

(Содержательные блоки конспекта добавляются по ходу разбора.)
