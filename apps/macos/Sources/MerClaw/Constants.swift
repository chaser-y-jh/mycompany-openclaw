import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-merclaw writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.merclaw.mac"
let gatewayLaunchdLabel = "ai.merclaw.gateway"
let onboardingVersionKey = "merclaw.onboardingVersion"
let onboardingSeenKey = "merclaw.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "merclaw.pauseEnabled"
let iconAnimationsEnabledKey = "merclaw.iconAnimationsEnabled"
let swabbleEnabledKey = "merclaw.swabbleEnabled"
let swabbleTriggersKey = "merclaw.swabbleTriggers"
let voiceWakeTriggerChimeKey = "merclaw.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "merclaw.voiceWakeSendChime"
let showDockIconKey = "merclaw.showDockIcon"
let defaultVoiceWakeTriggers = ["merclaw"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "merclaw.voiceWakeMicID"
let voiceWakeMicNameKey = "merclaw.voiceWakeMicName"
let voiceWakeLocaleKey = "merclaw.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "merclaw.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "merclaw.voicePushToTalkEnabled"
let voiceWakeTriggersTalkModeKey = "merclaw.voiceWakeTriggersTalkMode"
let talkEnabledKey = "merclaw.talkEnabled"
let talkPhaseSoundsEnabledKey = "merclaw.talkPhaseSoundsEnabled"
let talkShiftToStopEnabledKey = "merclaw.talkShiftToStopEnabled"
let iconOverrideKey = "merclaw.iconOverride"
let connectionModeKey = "merclaw.connectionMode"
let remoteTargetKey = "merclaw.remoteTarget"
let remoteIdentityKey = "merclaw.remoteIdentity"
let remoteProjectRootKey = "merclaw.remoteProjectRoot"
let remoteCliPathKey = "merclaw.remoteCliPath"
let canvasEnabledKey = "merclaw.canvasEnabled"
let cameraEnabledKey = "merclaw.cameraEnabled"
let systemRunPolicyKey = "merclaw.systemRunPolicy"
let systemRunAllowlistKey = "merclaw.systemRunAllowlist"
let systemRunEnabledKey = "merclaw.systemRunEnabled"
let locationModeKey = "merclaw.locationMode"
let locationPreciseKey = "merclaw.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "merclaw.peekabooBridgeEnabled"
let deepLinkKeyKey = "merclaw.deepLinkKey"
let cliInstallPromptedVersionKey = "merclaw.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "merclaw.heartbeatsEnabled"
let debugPaneEnabledKey = "merclaw.debugPaneEnabled"
let debugFileLogEnabledKey = "merclaw.debug.fileLogEnabled"
let appLogLevelKey = "merclaw.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
