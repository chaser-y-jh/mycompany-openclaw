export type MerClawAgentSessionSkillSourceAugmentation = never;

declare module "merclaw/plugin-sdk/agent-sessions" {
  interface Skill {
    // MerClaw relies on the source identifier returned by skill loaders.
    source: string;
  }
}
