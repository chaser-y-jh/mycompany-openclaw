import Foundation

public enum MerClawCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum MerClawCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum MerClawCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum MerClawCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct MerClawCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: MerClawCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: MerClawCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: MerClawCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: MerClawCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct MerClawCameraClipParams: Codable, Sendable, Equatable {
    public var facing: MerClawCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: MerClawCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: MerClawCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: MerClawCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
