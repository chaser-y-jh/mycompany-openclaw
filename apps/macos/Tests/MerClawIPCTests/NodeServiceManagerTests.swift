import Foundation
import Testing
@testable import MerClaw

@Suite(.serialized) struct NodeServiceManagerTests {
    @Test func `builds node service commands with current CLI shape`() async throws {
        try await TestIsolation.withUserDefaultsValues(["merclaw.gatewayProjectRootPath": nil]) {
            let tmp = try makeTempDirForTests()
            CommandResolver.setProjectRoot(tmp.path)

            let merclawPath = tmp.appendingPathComponent("node_modules/.bin/merclaw")
            try makeExecutableForTests(at: merclawPath)

            let start = NodeServiceManager._testServiceCommand(["start"])
            #expect(start == [merclawPath.path, "node", "start", "--json"])

            let stop = NodeServiceManager._testServiceCommand(["stop"])
            #expect(stop == [merclawPath.path, "node", "stop", "--json"])
        }
    }
}
