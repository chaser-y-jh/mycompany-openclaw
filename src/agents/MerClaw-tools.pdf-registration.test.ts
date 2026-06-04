import { describe, expect, it } from "vitest";
import { collectPresentMerClawTools } from "./merclaw-tools.registration.js";
import { createPdfTool } from "./tools/pdf-tool.js";

describe("createMerClawTools PDF registration", () => {
  it("includes the pdf tool when the pdf factory returns a tool", () => {
    const pdfTool = createPdfTool({
      agentDir: "/tmp/merclaw-agent-main",
      config: {
        agents: {
          defaults: {
            pdfModel: { primary: "openai/gpt-5.4-mini" },
          },
        },
      },
    });

    expect(pdfTool?.name).toBe("pdf");
    expect(collectPresentMerClawTools([pdfTool]).map((tool) => tool.name)).toEqual(["pdf"]);
  });
});
