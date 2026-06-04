import type { MerClawConfig } from "merclaw/plugin-sdk/config-contracts";
import {
  resolveRealtimeVoiceFastContextConsult,
  type RealtimeVoiceFastContextConsultResult,
  type RealtimeVoiceFastContextConfig,
} from "merclaw/plugin-sdk/realtime-voice";

type Logger = {
  debug?: (message: string) => void;
};

export async function resolveRealtimeFastContextConsult(params: {
  cfg: MerClawConfig;
  agentId: string;
  sessionKey: string;
  config: RealtimeVoiceFastContextConfig;
  args: unknown;
  logger: Logger;
}): Promise<RealtimeVoiceFastContextConsultResult> {
  return await resolveRealtimeVoiceFastContextConsult({
    ...params,
    labels: {
      audienceLabel: "caller",
      contextName: "MerClaw memory or session context",
    },
  });
}
