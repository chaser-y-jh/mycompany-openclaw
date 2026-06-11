// swift-tools-version: 6.2
// Package manifest for the MerClaw macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "MerClaw",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "MerClawIPC", targets: ["MerClawIPC"]),
        .library(name: "MerClawDiscovery", targets: ["MerClawDiscovery"]),
        .executable(name: "MerClaw", targets: ["MerClaw"]),
        .executable(name: "merclaw-mac", targets: ["MerClawMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.10.1"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", exact: "3.4.1"),
        .package(path: "../shared/MerClawKit"),
        .package(path: "../swabble"),
    ],
    targets: [
        .target(
            name: "MerClawIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "MerClawDiscovery",
            dependencies: [
                .product(name: "MerClawKit", package: "MerClawKit"),
            ],
            path: "Sources/MerClawDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MerClaw",
            dependencies: [
                "MerClawIPC",
                "MerClawDiscovery",
                .product(name: "MerClawKit", package: "MerClawKit"),
                .product(name: "MerClawChatUI", package: "MerClawKit"),
                .product(name: "MerClawProtocol", package: "MerClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/MerClaw.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "MerClawMacCLI",
            dependencies: [
                "MerClawDiscovery",
                .product(name: "MerClawKit", package: "MerClawKit"),
                .product(name: "MerClawProtocol", package: "MerClawKit"),
            ],
            path: "Sources/MerClawMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "MerClawIPCTests",
            dependencies: [
                "MerClawIPC",
                "MerClaw",
                "MerClawMacCLI",
                "MerClawDiscovery",
                .product(name: "MerClawProtocol", package: "MerClawKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
