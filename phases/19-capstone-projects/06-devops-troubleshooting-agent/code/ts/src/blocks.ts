import type { AgentReport, Block, SlackResponse } from "./types.js";

export function buildSlackResponse(report: AgentReport): SlackResponse {
  const blocks: Block[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `Incident ${report.incidentId}` },
    },
  ];
  for (const h of report.topHypotheses) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*#${h.rank}.* ${h.summary}\n` +
          `Evidence:\n- ${h.evidence.join("\n- ")}\n` +
          `_Remediation:_ ${h.remediation}`,
      },
    });
  }
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Approve top remediation" },
        style: "primary",
        action_id: "approve",
        value: report.incidentId,
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Escalate" },
        action_id: "escalate",
        value: report.incidentId,
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Ignore" },
        style: "danger",
        action_id: "ignore",
        value: report.incidentId,
      },
    ],
  });
  return { response_type: "in_channel", blocks };
}

export function actionReply(actionId: string, incidentId: string): SlackResponse {
  let text: string;
  if (actionId === "approve") {
    text = `Approved remediation for ${incidentId}. Calling gated MCP server (mocked).`;
  } else if (actionId === "escalate") {
    text = `Escalated ${incidentId} to on-call.`;
  } else {
    text = `Ignored ${incidentId}.`;
  }
  return { response_type: "in_channel", replace_original: false, text };
}
