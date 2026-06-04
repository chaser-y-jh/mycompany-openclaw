import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getCommandPositionalsWithRootOptions,
  getCommandPathWithRootOptions,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  isHelpOrVersionInvocation,
  isRootHelpInvocation,
  isRootVersionInvocation,
  normalizeGeneratedHelpCommandArgv,
  normalizeRootHelpTargetArgv,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "merclaw", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "merclaw", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "merclaw", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "merclaw", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "merclaw", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "merclaw", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "merclaw", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "merclaw", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "merclaw", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "known command group help command help flag",
      argv: ["node", "merclaw", "backup", "help", "--help"],
      expected: ["node", "merclaw", "backup", "help"],
    },
    {
      name: "known command group help command short help flag",
      argv: ["node", "merclaw", "--profile", "work", "backup", "help", "-h"],
      expected: ["node", "merclaw", "--profile", "work", "backup", "help"],
    },
    {
      name: "leaf positional help remains untouched",
      argv: ["node", "merclaw", "docs", "help", "--help"],
      expected: ["node", "merclaw", "docs", "help", "--help"],
    },
    {
      name: "known command group help target",
      argv: ["node", "merclaw", "plugins", "help", "list"],
      expected: ["node", "merclaw", "plugins", "list", "--help"],
    },
    {
      name: "known command group help target help flag",
      argv: ["node", "merclaw", "plugins", "help", "list", "--help"],
      expected: ["node", "merclaw", "plugins", "list", "--help"],
    },
    {
      name: "unknown plugin command group help target",
      argv: ["node", "merclaw", "external-plugin", "help", "inspect"],
      expected: ["node", "merclaw", "external-plugin", "inspect", "--help"],
    },
    {
      name: "unknown plugin command group help target help flag",
      argv: ["node", "merclaw", "external-plugin", "help", "inspect", "--help"],
      expected: ["node", "merclaw", "external-plugin", "inspect", "--help"],
    },
    {
      name: "generated help target with trailing root option",
      argv: ["node", "merclaw", "memory", "help", "status", "--no-color"],
      expected: ["node", "merclaw", "--no-color", "memory", "status", "--help"],
    },
    {
      name: "extra help positionals remain untouched",
      argv: ["node", "merclaw", "backup", "help", "missing", "extra", "--help"],
      expected: ["node", "merclaw", "backup", "help", "missing", "extra", "--help"],
    },
    {
      name: "terminator help flag remains untouched",
      argv: ["node", "merclaw", "backup", "help", "--", "--help"],
      expected: ["node", "merclaw", "backup", "help", "--", "--help"],
    },
  ])("normalizes generated help commands: $name", ({ argv, expected }) => {
    expect(normalizeGeneratedHelpCommandArgv(argv)).toEqual(expected);
  });

  it.each([
    {
      name: "root help target",
      argv: ["node", "merclaw", "help", "plugins"],
      expected: ["node", "merclaw", "plugins", "--help"],
    },
    {
      name: "root help target with help flag",
      argv: ["node", "merclaw", "help", "plugins", "--help"],
      expected: ["node", "merclaw", "plugins", "--help"],
    },
    {
      name: "root option before help target",
      argv: ["node", "merclaw", "--profile", "work", "help", "memory"],
      expected: ["node", "merclaw", "--profile", "work", "memory", "--help"],
    },
    {
      name: "bare root help remains untouched",
      argv: ["node", "merclaw", "help"],
      expected: ["node", "merclaw", "help"],
    },
    {
      name: "root help self-help remains untouched",
      argv: ["node", "merclaw", "help", "--help"],
      expected: ["node", "merclaw", "help", "--help"],
    },
    {
      name: "nested root help target",
      argv: ["node", "merclaw", "help", "plugins", "list"],
      expected: ["node", "merclaw", "plugins", "list", "--help"],
    },
    {
      name: "nested root help target with help flag",
      argv: ["node", "merclaw", "help", "plugins", "list", "--help"],
      expected: ["node", "merclaw", "plugins", "list", "--help"],
    },
    {
      name: "nested root help target with trailing root option",
      argv: ["node", "merclaw", "help", "memory", "status", "--no-color"],
      expected: ["node", "merclaw", "--no-color", "memory", "status", "--help"],
    },
  ])("normalizes root help targets: $name", ({ argv, expected }) => {
    expect(normalizeRootHelpTargetArgv(argv)).toEqual(expected);
  });

  it.each([
    {
      name: "root help command",
      argv: ["node", "merclaw", "help"],
      expected: true,
    },
    {
      name: "root help command with target",
      argv: ["node", "merclaw", "help", "matrix"],
      expected: true,
    },
    {
      name: "nested help command",
      argv: ["node", "merclaw", "matrix", "encryption", "help"],
      expected: true,
    },
    {
      name: "known subcommand root help command",
      argv: ["node", "merclaw", "config", "help"],
      expected: true,
    },
    {
      name: "known leaf command positional help",
      argv: ["node", "merclaw", "docs", "help"],
      expected: false,
    },
    {
      name: "known subcommand leaf positional help",
      argv: ["node", "merclaw", "config", "set", "some.path", "help"],
      expected: false,
    },
    {
      name: "unknown plugin command help",
      argv: ["node", "merclaw", "external-plugin", "tools", "help"],
      expected: true,
    },
    {
      name: "help flag",
      argv: ["node", "merclaw", "matrix", "encryption", "--help"],
      expected: true,
    },
    {
      name: "help as option value",
      argv: ["node", "merclaw", "agent", "--message", "help"],
      expected: false,
    },
    {
      name: "help after terminator",
      argv: ["node", "merclaw", "nodes", "invoke", "--", "help"],
      expected: false,
    },
    {
      name: "help flag after terminator",
      argv: ["node", "merclaw", "nodes", "invoke", "--", "--help"],
      expected: false,
    },
    {
      name: "version flag after terminator",
      argv: ["node", "merclaw", "nodes", "invoke", "--", "--version"],
      expected: false,
    },
  ])("detects help/version invocations: $name", ({ argv, expected }) => {
    expect(isHelpOrVersionInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --version",
      argv: ["node", "merclaw", "--version"],
      expected: true,
    },
    {
      name: "root -V",
      argv: ["node", "merclaw", "-V"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "merclaw", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "subcommand version flag",
      argv: ["node", "merclaw", "status", "--version"],
      expected: false,
    },
    {
      name: "unknown root flag with version",
      argv: ["node", "merclaw", "--unknown", "--version"],
      expected: false,
    },
  ])("detects root-only version invocations: $name", ({ argv, expected }) => {
    expect(isRootVersionInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --help",
      argv: ["node", "merclaw", "--help"],
      expected: true,
    },
    {
      name: "root -h",
      argv: ["node", "merclaw", "-h"],
      expected: true,
    },
    {
      name: "root --help with profile",
      argv: ["node", "merclaw", "--profile", "work", "--help"],
      expected: true,
    },
    {
      name: "subcommand --help",
      argv: ["node", "merclaw", "status", "--help"],
      expected: false,
    },
    {
      name: "help before subcommand token",
      argv: ["node", "merclaw", "--help", "status"],
      expected: false,
    },
    {
      name: "help after -- terminator",
      argv: ["node", "merclaw", "nodes", "invoke", "--", "device.status", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag before help",
      argv: ["node", "merclaw", "--unknown", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag after help",
      argv: ["node", "merclaw", "--help", "--unknown"],
      expected: false,
    },
  ])("detects root-only help invocations: $name", ({ argv, expected }) => {
    expect(isRootHelpInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "merclaw", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "merclaw", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "merclaw", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it("extracts command path while skipping known root option values", () => {
    expect(
      getCommandPathWithRootOptions(
        [
          "node",
          "merclaw",
          "--profile",
          "work",
          "--container",
          "demo",
          "--no-color",
          "config",
          "validate",
        ],
        2,
      ),
    ).toEqual(["config", "validate"]);
  });

  it("extracts routed config get positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "merclaw", "config", "get", "--log-level", "debug", "update.channel", "--json"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("extracts routed config unset positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "merclaw", "config", "unset", "--profile", "work", "update.channel"],
        {
          commandPath: ["config", "unset"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("returns null when routed command sees unknown options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "merclaw", "config", "get", "--mystery", "value", "update.channel"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toBeNull();
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "merclaw", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "merclaw"],
      expected: null,
    },
    {
      name: "skips known root option values",
      argv: ["node", "merclaw", "--log-level", "debug", "status"],
      expected: "status",
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "merclaw", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "merclaw", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "merclaw", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "merclaw", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "merclaw", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "merclaw", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "merclaw", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "merclaw", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "merclaw", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "merclaw", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "merclaw", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "merclaw", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "merclaw", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "valid signed decimal positive integer",
      argv: ["node", "merclaw", "status", "--timeout", "+5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "merclaw", "status", "--timeout", "nope"],
      expected: undefined,
    },
    {
      name: "non-decimal integer",
      argv: ["node", "merclaw", "status", "--timeout", "0x10"],
      expected: undefined,
    },
    {
      name: "partial integer",
      argv: ["node", "merclaw", "status", "--timeout", "5s"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it.each([
    {
      name: "keeps plain node argv",
      rawArgs: ["node", "merclaw", "status"],
      expected: ["node", "merclaw", "status"],
    },
    {
      name: "keeps version-suffixed node binary",
      rawArgs: ["node-22", "merclaw", "status"],
      expected: ["node-22", "merclaw", "status"],
    },
    {
      name: "keeps windows versioned node exe",
      rawArgs: ["node-22.2.0.exe", "merclaw", "status"],
      expected: ["node-22.2.0.exe", "merclaw", "status"],
    },
    {
      name: "keeps dotted node binary",
      rawArgs: ["node-22.2", "merclaw", "status"],
      expected: ["node-22.2", "merclaw", "status"],
    },
    {
      name: "keeps dotted node exe",
      rawArgs: ["node-22.2.exe", "merclaw", "status"],
      expected: ["node-22.2.exe", "merclaw", "status"],
    },
    {
      name: "keeps absolute versioned node path",
      rawArgs: ["/usr/bin/node-22.2.0", "merclaw", "status"],
      expected: ["/usr/bin/node-22.2.0", "merclaw", "status"],
    },
    {
      name: "keeps node24 shorthand",
      rawArgs: ["node24", "merclaw", "status"],
      expected: ["node24", "merclaw", "status"],
    },
    {
      name: "keeps absolute node24 shorthand",
      rawArgs: ["/usr/bin/node24", "merclaw", "status"],
      expected: ["/usr/bin/node24", "merclaw", "status"],
    },
    {
      name: "keeps windows node24 exe",
      rawArgs: ["node24.exe", "merclaw", "status"],
      expected: ["node24.exe", "merclaw", "status"],
    },
    {
      name: "keeps nodejs binary",
      rawArgs: ["nodejs", "merclaw", "status"],
      expected: ["nodejs", "merclaw", "status"],
    },
    {
      name: "prefixes fallback when first arg is not a node launcher",
      rawArgs: ["node-dev", "merclaw", "status"],
      expected: ["node", "merclaw", "node-dev", "merclaw", "status"],
    },
    {
      name: "prefixes fallback when raw args start at program name",
      rawArgs: ["merclaw", "status"],
      expected: ["node", "merclaw", "status"],
    },
    {
      name: "keeps bun execution argv",
      rawArgs: ["bun", "src/entry.ts", "status"],
      expected: ["bun", "src/entry.ts", "status"],
    },
  ] as const)("builds parse argv from raw args: $name", ({ rawArgs, expected }) => {
    const parsed = buildParseArgv({
      programName: "merclaw",
      rawArgs: [...rawArgs],
    });
    expect(parsed).toEqual([...expected]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "merclaw",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "merclaw", "status"]);
  });

  it.each([
    { argv: ["node", "merclaw", "status"], expected: true },
    { argv: ["node", "merclaw", "health"], expected: false },
    { argv: ["node", "merclaw", "sessions"], expected: false },
    { argv: ["node", "merclaw", "--profile", "work", "status"], expected: true },
    { argv: ["node", "merclaw", "--log-level=debug", "models", "list"], expected: false },
    { argv: ["node", "merclaw", "config", "get", "update"], expected: false },
    { argv: ["node", "merclaw", "config", "unset", "update"], expected: false },
    { argv: ["node", "merclaw", "models", "list"], expected: false },
    { argv: ["node", "merclaw", "models", "status"], expected: false },
    { argv: ["node", "merclaw", "update", "status", "--json"], expected: false },
    { argv: ["node", "merclaw", "agent", "--message", "hi"], expected: false },
    { argv: ["node", "merclaw", "agents", "list"], expected: true },
    { argv: ["node", "merclaw", "message", "send"], expected: true },
  ] as const)("decides when to migrate state: $argv", ({ argv, expected }) => {
    expect(shouldMigrateState([...argv])).toBe(expected);
  });

  it.each([
    { path: ["status"], expected: true },
    { path: ["update", "status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
