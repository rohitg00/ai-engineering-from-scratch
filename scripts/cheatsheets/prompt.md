You write one cheat sheet poster for the course AI Engineering from Scratch. The poster is a reference that a learner keeps open while they work. It is not a summary of a lesson.

You get the topic entry from `cheatsheets/topics.yaml`, the source files of the topic, the authoring guide, the quality rubric and three finished example posters, one for each common kind. Write the poster file and its evidence file. Match the example for the kind of the topic in depth, density and block choice.

## Rules for the poster

- Use a `defaults` table only for settings and their default values. Use a `comparison` table to set options side by side.
- Follow the authoring guide exactly: the front matter, the block heading lines, the `key: value` lines and the body shape of each block type.
- Pass every rule of the quality rubric. Write 10 to 13 blocks with at least six block types, a diagram (`architecture` or `flow`), a `troubleshooting` table and a `qa` or `tips` block.
- Fit the kind of the topic:
  - `concept`: definitions, formulas, a diagram of the mechanism, the numbers that matter, and the mistakes people make.
  - `commands`: tasks with the exact code or command, flags, defaults, and fixes for errors.
  - `comparison`: a `comparison` table that sets the options side by side, and a "use X when" block for each option.
  - `debugging`: symptoms, causes, checks and fixes first. Then the tools and the numbers to watch.
  - `manual`: the flags, commands, defaults and incidents of the manual.
  - `project`: what each project builds, how to run it, its inputs and outputs, and the checks that it passes.
- Write only for the learner. Leave out the work of the repository maintainers: the capture kits and their `run.py`, fixture builds, the site and manual build scripts, audit scripts, `manual.json`, CI workflows and environment variables that only the capture uses.
- Make every row complete. A task row has the task, the exact command or code and what it does. A troubleshooting row has the symptom, the cause and the fix. Do not leave a cell empty and do not write "-", "TBD" or "..." in a cell. When the sources do not give a cell, leave out the row.
- Do not write a source line, a "From" line or a lesson path in the body of a block. The page does not show where a block comes from.
- Every block has a `from` line. List only repository paths that you got in the source files. A path can be a lesson folder, a lesson file, a manual section, a project file or a project folder.
- Copy every command, flag, function name, field name, file name and default value exactly as it appears in the `from` files of its block. The build checks each one with a literal text match. When you are not sure of an exact string, leave it out.
- Put code and commands in backticks. Mark each value that the reader replaces with angle brackets, for example `<model>`.
- Keep the poster to two printed pages. Use one line for each table cell, bullet or step. A table has 8 rows at most. A code block has 14 lines at most.
- Write the prose in Simplified Technical English: short sentences, active voice, one idea in each sentence. Do not use dashes, semicolons, the word "may" or figurative words. Do not name products or people that the sources do not name.
- Use the `id`, `title` and `sources` of the topic entry without changes. Write a `subtitle` of 120 characters at most. Pick a `hue` from 0 to 359. The build sets `code` and `source_hash`, so you can leave them out.

## Rules for the evidence file

- Start with `# Evidence: cheatsheets/<id>.md`.
- Give one `##` section for each block, with the block heading and its type.
- Under each section, give one bullet for each row, step, node or bullet of the block. The check counts them: a section with fewer bullets than the block has facts fails. Each bullet names the fact and the `path:line` or `path:line-line` that holds it. Give more lines after a comma: `path:12, 40-42`.
- Each path is a repository path inside one of the topic sources. The file must exist, and each line number must be in the file.
- To shorten long paths, give one line at the top: `Abbreviations: L01 = phases/01-x/01-y, d = docs/en.md, c = code/main.py.` Use one `KEY = path` pair for each key. Do not use lists or ranges of keys. Then write `L01/d:12` for `phases/01-x/01-y/docs/en.md:12`.

## Output

Reply with exactly two parts and nothing else:

<topic>
the complete poster file, starting with the `---` line of the front matter
</topic>
<evidence>
the complete evidence file
</evidence>

When the build reports problems with your poster, reply again with both complete files, fixed. Remove a fact that you cannot find in the `from` files. Do not invent a replacement for it.
