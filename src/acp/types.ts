export type { AcpProvenanceMode, AcpServerOptions, AcpSession } from "@merclaw/acp-core/types";
export { normalizeAcpProvenanceMode } from "@merclaw/acp-core/types";
import { VERSION } from "../version.js";

export const ACP_AGENT_INFO = {
  name: "merclaw-acp",
  title: "MerClaw ACP Gateway",
  version: VERSION,
};
