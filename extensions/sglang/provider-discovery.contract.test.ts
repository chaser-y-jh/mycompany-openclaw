import { fileURLToPath } from "node:url";
import { describeSglangProviderDiscoveryContract } from "merclaw/plugin-sdk/provider-test-contracts";

describeSglangProviderDiscoveryContract({
  load: () => import("./index.js"),
  apiModuleId: fileURLToPath(new URL("./api.js", import.meta.url)),
});
