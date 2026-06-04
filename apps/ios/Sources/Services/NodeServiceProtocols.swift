import CoreLocation
import Foundation
import MerClawKit
import UIKit

typealias MerClawCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias MerClawCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: MerClawCameraSnapParams) async throws -> MerClawCameraSnapResult
    func clip(params: MerClawCameraClipParams) async throws -> MerClawCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: MerClawLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: MerClawLocationGetParams,
        desiredAccuracy: MerClawLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: MerClawLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> MerClawDeviceStatusPayload
    func info() -> MerClawDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: MerClawPhotosLatestParams) async throws -> MerClawPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: MerClawContactsSearchParams) async throws -> MerClawContactsSearchPayload
    func add(params: MerClawContactsAddParams) async throws -> MerClawContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: MerClawCalendarEventsParams) async throws -> MerClawCalendarEventsPayload
    func add(params: MerClawCalendarAddParams) async throws -> MerClawCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: MerClawRemindersListParams) async throws -> MerClawRemindersListPayload
    func add(params: MerClawRemindersAddParams) async throws -> MerClawRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: MerClawMotionActivityParams) async throws -> MerClawMotionActivityPayload
    func pedometer(params: MerClawPedometerParams) async throws -> MerClawPedometerPayload
}

struct WatchMessagingStatus: Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalResolveEvent: Equatable {
    var replyId: String
    var approvalId: String
    var decision: MerClawWatchExecApprovalDecision
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)?)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)?)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: MerClawWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: MerClawWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: MerClawWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: MerClawWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: MerClawWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
