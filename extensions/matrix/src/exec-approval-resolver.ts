import { resolveApprovalOverGateway } from "merclaw/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "merclaw/plugin-sdk/approval-runtime";
import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import { isApprovalNotFoundError } from "merclaw/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveMatrixApproval(params: {
  cfg: MerClawConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  gatewayUrl?: string;
}): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: `Matrix approval (${params.senderId?.trim() || "unknown"})`,
  });
}
