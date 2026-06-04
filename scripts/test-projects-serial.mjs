process.env.MERCLAW_TEST_PROJECTS_SERIAL = "1";
process.env.MERCLAW_VITEST_MAX_WORKERS = "1";

await import("./test-projects.mjs");
