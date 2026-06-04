import { listSkillCommandsForAgents as listSkillCommandsForAgentsImpl } from "merclaw/plugin-sdk/command-auth-native";

type ListSkillCommandsForAgents =
  typeof import("merclaw/plugin-sdk/command-auth-native").listSkillCommandsForAgents;

export function listSkillCommandsForAgents(
  ...args: Parameters<ListSkillCommandsForAgents>
): ReturnType<ListSkillCommandsForAgents> {
  return listSkillCommandsForAgentsImpl(...args);
}
