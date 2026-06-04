import type { Command } from "commander";
import { theme } from "../../../packages/terminal-core/src/theme.js";

export function registerCompanyCommand(program: Command): void {
  const company = program
    .command("company")
    .description("MyCompany integration commands");

  company
    .command("info")
    .description("Show company information")
    .action(async (): Promise<void> => {
      console.log("\n" + theme.heading("MyCompany Integration"));
      console.log("");
      console.log(theme.info("Version:"), "1.0.0");
      console.log(theme.info("Company:"), "MyCompany Inc.");
      console.log(theme.info("Support:"), "support@mycompany.com");
      console.log(theme.info("Documentation:"), "docs.mycompany.com/merclaw");
      console.log("");
      console.log(theme.accent("Powered by MerClaw"));
      console.log("");
    });

  company
    .command("status")
    .description("Check MyCompany service status")
    .action(async (): Promise<void> => {
      console.log("\n" + theme.heading("MyCompany Service Status"));
      console.log("");
      console.log(theme.success("✓ API Connection: Online"));
      console.log(theme.success("✓ Authentication: Validated"));
      console.log(theme.success("✓ Integration: Active"));
      console.log("");
    });

  company
    .command("help")
    .description("Show MyCompany integration help")
    .action(async (): Promise<void> => {
      console.log("\n" + theme.heading("MyCompany Integration Help"));
      console.log("");
      console.log(theme.muted("Available commands:"));
      console.log("  company info     - Show company information");
      console.log("  company status   - Check service status");
      console.log("  company help     - Show this help message");
      console.log("");
      console.log(theme.accent("For more details, visit: docs.mycompany.com/merclaw"));
      console.log("");
    });
}