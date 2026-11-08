## Off policy and on policy

Q-learning uses the max over the next actions. So it learns the values of the greedy policy, while the agent explores with another policy. This is an off policy method. SARSA uses the next action of the policy that runs. So it learns the values of the epsilon-greedy policy itself. On cliff walking, SARSA learns a safer path because its values include the cost of the random steps.

## Why the terminal rule matters

A terminal state has no future. If the target adds $\gamma \max Q[s']$ at a terminal step, the values near the goal take the values of a state that the agent never leaves. The values then grow or drift and the policy can loop.

## Why the order of the random draws matters

A seeded run gives the same result only when every call uses the generator in the same order. A second draw in each call changes every later action. The checks compare your actions with the actions of the stated order.

## Where this goes next

DQN replaces the table with a network and uses the same Q-learning target. It adds a target network and a replay buffer to keep the target stable.
