"""Fill in the stage interfaces in your own workspace."""


def safe_path(workspace, relative):
    raise NotImplementedError("safe_path")


def apply_patch(workspace, relative, old, new):
    raise NotImplementedError("apply_patch")


def run_tests(workspace, timeout=5):
    raise NotImplementedError("run_tests")


def agent_loop(workspace, actions, max_steps=6):
    raise NotImplementedError("agent_loop")


def drive(workspace, planner, max_steps=6):
    raise NotImplementedError("drive: feed each observation to the planner")


def proposal_planner(proposals):
    raise NotImplementedError("proposal_planner: select repairs from observed failures")
