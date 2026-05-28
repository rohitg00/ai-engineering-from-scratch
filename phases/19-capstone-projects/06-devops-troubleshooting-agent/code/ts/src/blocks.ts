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
          `根拠:\n- ${h.evidence.join("\n- ")}\n` +
          `_対応:_ ${h.remediation}`,
      },
    });
  }
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "最上位 remediation を approve" },
        style: "primary",
        action_id: "approve",
        value: report.incidentId,
      },
      {
        type: "button",
        text: { type: "plain_text", text: "エスカレート" },
        action_id: "escalate",
        value: report.incidentId,
      },
      {
        type: "button",
        text: { type: "plain_text", text: "無視" },
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
    text = `${incidentId} の remediation を approve しました。gated MCP server を呼び出します (mock)。`;
  } else if (actionId === "escalate") {
    text = `${incidentId} を on-call に escalate しました。`;
  } else {
    text = `${incidentId} を ignore しました。`;
  }
  return { response_type: "in_channel", replace_original: false, text };
}
