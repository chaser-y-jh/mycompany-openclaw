import { configureAcpErrorRedactor } from "@merclaw/acp-core";
import { redactSensitiveText } from "../../logging/redact.js";

configureAcpErrorRedactor(redactSensitiveText);

export * from "@merclaw/acp-core/runtime/errors";
