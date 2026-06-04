import type { MerClawConfig } from "../config/types.merclaw.js";

export function isGatewayModelPricingEnabled(config: MerClawConfig): boolean {
  return config.models?.pricing?.enabled !== false;
}
