import Testing
@testable import MerClaw

@Suite(.serialized) struct MerClawAppDelegateTests {
    @Test @MainActor func resolvesRegistryModelBeforeViewTaskAssignsDelegateModel() {
        let registryModel = NodeAppModel()
        MerClawAppModelRegistry.appModel = registryModel
        defer { MerClawAppModelRegistry.appModel = nil }

        let delegate = MerClawAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func prefersExplicitDelegateModelOverRegistryFallback() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        MerClawAppModelRegistry.appModel = registryModel
        defer { MerClawAppModelRegistry.appModel = nil }

        let delegate = MerClawAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }
}
