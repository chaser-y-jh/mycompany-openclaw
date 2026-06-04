import Foundation

public enum MerClawDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum MerClawBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum MerClawThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum MerClawNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum MerClawNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct MerClawBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: MerClawBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: MerClawBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct MerClawThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: MerClawThermalState

    public init(state: MerClawThermalState) {
        self.state = state
    }
}

public struct MerClawStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct MerClawNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: MerClawNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [MerClawNetworkInterfaceType]

    public init(
        status: MerClawNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [MerClawNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct MerClawDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: MerClawBatteryStatusPayload
    public var thermal: MerClawThermalStatusPayload
    public var storage: MerClawStorageStatusPayload
    public var network: MerClawNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: MerClawBatteryStatusPayload,
        thermal: MerClawThermalStatusPayload,
        storage: MerClawStorageStatusPayload,
        network: MerClawNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct MerClawDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
