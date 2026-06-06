---
name: check-understanding
version: 1.0.0
description: Phase quiz for AI Engineering from Scratch. Trigger with "quiz me", "test phase", "check my understanding", "do I know phase 3", or `/check-understanding <phase>`.
---

# Check Understanding

Test your knowledge of a completed phase from the AI Engineering from Scratch course.

## Activation

This skill activates when the user says things like:
- `/check-understanding 3` or `/check-understanding deep-learning`
- "quiz me on phase 2"
- "test phase 1"
- "check my understanding of transformers"
- "do I know phase 3"
- "am I ready for the next phase"

## Input

Accepts a phase number (0-19) or a phase name as argument. If no argument is provided, ask the user which phase they want to be tested on by listing all 20 phases.

## Phase Map

Map the argument to the correct phase directory under `phases/`:

| Input | Directory | Phase Name |
|-------|-----------|------------|
| 0, setup, tooling | `00-setup-and-tooling` | Setup & Tooling |
| 1, math, math-foundations | `01-math-foundations` | Math Foundations |
| 2, ml, ml-fundamentals | `02-ml-fundamentals` | ML Fundamentals |
| 3, deep-learning, dl | `03-deep-learning-core` | Deep Learning Core |
| 4, cv, computer-vision, vision | `04-computer-vision` | Computer Vision |
| 5, nlp | `05-nlp-foundations-to-advanced` | NLP -- Foundations to Advanced |
| 6, speech, audio | `06-speech-and-audio` | Speech & Audio |
| 7, transformers | `07-transformers-deep-dive` | Transformers Deep Dive |
| 8, generative, gen-ai, genai | `08-generative-ai` | Generative AI |
| 9, rl, reinforcement-learning | `09-reinforcement-learning` | Reinforcement Learning |
| 10, llms, llm, llms-from-scratch | `10-llms-from-scratch` | LLMs from Scratch |
| 11, llm-engineering, llm-eng | `11-llm-engineering` | LLM Engineering |
| 12, multimodal | `12-multimodal-ai` | Multimodal AI |
| 13, tools, protocols, mcp | `13-tools-and-protocols` | Tools & Protocols |
| 14, agents, agent-engineering | `14-agent-engineering` | Agent Engineering |
| 15, autonomous | `15-autonomous-systems` | Autonomous Systems |
| 16, multi-agent, swarms | `16-multi-agent-and-swarms` | Multi-Agent & Swarms |
| 17, infrastructure, production, infra | `17-infrastructure-and-production` | Infrastructure & Production |
| 18, ethics, safety, alignment | `18-ethics-safety-alignment` | Ethics, Safety & Alignment |
| 19, capstone, projects | `19-capstone-projects` | Capstone Projects |

## Procedure

### Step 1: Resolve the Phase

Parse the argument. If it is a number, validate it is between 0 and 19 inclusive. If the number is out of range, tell the user: "Phase [N] does not exist. Valid phases are 0-19." and show the full list for them to pick from. If it is a name or keyword, look it up in the Phase Map above. If the keyword does not match any entry in the map, tell the user: "Unknown phase '[keyword]'. Pick from the list below:" and present all 20 phases. If no argument is provided, ask the user to pick from the full list.

### Step 2: Read the Phase Content

Use Glob to find all lesson directories under `phases/<phase-dir>/`. For each lesson, read the `docs/en.md` file. These documents contain the teaching material you will generate questions from.

Read as many lesson docs as needed to cover the full breadth of the phase. If a phase has many lessons (15+), prioritize reading a representative spread: first few, middle, and last few.

### Step 3: Generate 8 Questions

Create exactly 8 multiple-choice questions drawn from the lesson content you just read:

**Questions 1-4: Conceptual (What/Why)**
These test understanding of ideas, definitions, and reasoning. Examples:
- "What is the purpose of X?"
- "Why does Y happen when Z?"
- "Which statement best describes the relationship between A and B?"
- "What problem does X solve?"

**Questions 5-8: Practical (How/Build)**
These test applied knowledge and implementation awareness. Examples:
- "How would you implement X?"
- "Which approach correctly solves Y?"
- "What is the correct order of steps to build Z?"
- "If you observe X during training, what should you do?"

Each question must have 3 or 4 answer options labeled A, B, C (and optionally D). Exactly one option is correct. The wrong options should be plausible but clearly incorrect to someone who studied the material.

Tag each question with the specific lesson it draws from (e.g., "Lesson 03: Matrix Transformations").

### Step 4: Present Questions One at a Time

Use the AskUserQuestion tool (or equivalent interactive prompt) to present each question individually. Format:

```
Question 1/8 (Conceptual) -- from Lesson 03: Matrix Transformations

What is the geometric interpretation of an eigenvalue?

A) The angle of rotation applied by the matrix
B) The factor by which the eigenvector is scaled during transformation
C) The determinant of the transformation matrix
D) The rank of the matrix after transformation
```

Wait for the user's answer before moving to the next question.

### Step 5: Track and Score

Keep a running tally:
- Total correct out of 8
- For each wrong answer, record: the question number, the user's answer, the correct answer, and which lesson it came from

### Step 6: Show Results

After all 8 questions, display the score and grade:

**7-8 correct: Mastered**
If the phase is 19 (Capstone Projects): "You have mastered the final phase. Congratulations, you have completed the entire curriculum."
Otherwise: "You have a strong grasp of Phase N. You are ready to move on to Phase N+1: [next phase name]."

**5-6 correct: Almost**
"Solid foundation. Review these specific areas before moving on:"
Then list the lessons tied to the missed questions.

**3-4 correct: Developing**
"You are building understanding but need to revisit some lessons:"
Then list each missed question with the lesson to re-read.

**0-2 correct: Start Over**
"This phase needs more time. Work through the lessons again from the beginning, focusing on:"
Then list all missed topics.

### Step 7: Wrong Answer Breakdown

For every question the user got wrong, show:

```
Question N: [question text, abbreviated]
Your answer: B
Correct answer: C -- [the correct option text]
Why: [1-2 sentence explanation of why C is correct]
Review: Lesson NN -- [lesson name] (phases/<phase-dir>/NN-<lesson-slug>/docs/en.md)
```

### Step 8: What Next?

End by offering three choices:

1. **Retake this quiz** -- generate a fresh set of 8 questions from the same phase
2. **Try another phase** -- pick a different phase to test
3. **Explain a topic** -- ask about any concept from the questions you missed

Wait for the user's choice and act accordingly.

## Rules

- Avoid repeating questions on retakes until the question pool is exhausted. Once exhausted, reshuffle or rephrase questions for subsequent retakes.
- Questions must be directly grounded in the lesson docs, not general knowledge.
- Do not show the correct answer until after the user responds.
- Keep question text concise. One or two sentences max.
- Wrong options must be plausible. No joke answers.
- If a phase has no lesson docs written yet (no `en.md` files found), tell the user: "Phase N does not have lesson content yet. Pick a completed phase to quiz on."
