import ActivityKit
import Foundation

/// Shared schema used by iOS app + Live Activity widget extension.
struct MerClawActivityAttributes: ActivityAttributes {
    var agentName: String
    var sessionKey: String

    struct ContentState: Codable, Hashable {
        var statusText: String
        var isIdle: Bool
        var isDisconnected: Bool
        var isConnecting: Bool
        var startedAt: Date
    }
}

#if DEBUG
extension MerClawActivityAttributes {
    static let preview = MerClawActivityAttributes(agentName: "main", sessionKey: "main")
}

extension MerClawActivityAttributes.ContentState {
    static let connecting = MerClawActivityAttributes.ContentState(
        statusText: "Connecting...",
        isIdle: false,
        isDisconnected: false,
        isConnecting: true,
        startedAt: .now)

    static let idle = MerClawActivityAttributes.ContentState(
        statusText: "Idle",
        isIdle: true,
        isDisconnected: false,
        isConnecting: false,
        startedAt: .now)

    static let disconnected = MerClawActivityAttributes.ContentState(
        statusText: "Disconnected",
        isIdle: false,
        isDisconnected: true,
        isConnecting: false,
        startedAt: .now)

    static let attention = MerClawActivityAttributes.ContentState(
        statusText: "Approval needed",
        isIdle: false,
        isDisconnected: false,
        isConnecting: false,
        startedAt: .now)
}
#endif
