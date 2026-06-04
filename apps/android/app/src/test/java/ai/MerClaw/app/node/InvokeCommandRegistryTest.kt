package ai.merclaw.app.node

import ai.merclaw.app.protocol.MerClawCalendarCommand
import ai.merclaw.app.protocol.MerClawCallLogCommand
import ai.merclaw.app.protocol.MerClawCameraCommand
import ai.merclaw.app.protocol.MerClawCapability
import ai.merclaw.app.protocol.MerClawContactsCommand
import ai.merclaw.app.protocol.MerClawDeviceCommand
import ai.merclaw.app.protocol.MerClawLocationCommand
import ai.merclaw.app.protocol.MerClawMotionCommand
import ai.merclaw.app.protocol.MerClawNotificationsCommand
import ai.merclaw.app.protocol.MerClawPhotosCommand
import ai.merclaw.app.protocol.MerClawSmsCommand
import ai.merclaw.app.protocol.MerClawSystemCommand
import ai.merclaw.app.protocol.MerClawTalkCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      MerClawCapability.Canvas.rawValue,
      MerClawCapability.Device.rawValue,
      MerClawCapability.Notifications.rawValue,
      MerClawCapability.System.rawValue,
      MerClawCapability.Talk.rawValue,
      MerClawCapability.Contacts.rawValue,
      MerClawCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      MerClawCapability.Camera.rawValue,
      MerClawCapability.Location.rawValue,
      MerClawCapability.Sms.rawValue,
      MerClawCapability.CallLog.rawValue,
      MerClawCapability.VoiceWake.rawValue,
      MerClawCapability.Motion.rawValue,
      MerClawCapability.Photos.rawValue,
    )

  private val coreCommands =
    setOf(
      MerClawDeviceCommand.Status.rawValue,
      MerClawDeviceCommand.Info.rawValue,
      MerClawDeviceCommand.Permissions.rawValue,
      MerClawDeviceCommand.Health.rawValue,
      MerClawNotificationsCommand.List.rawValue,
      MerClawNotificationsCommand.Actions.rawValue,
      MerClawSystemCommand.Notify.rawValue,
      MerClawTalkCommand.PttStart.rawValue,
      MerClawTalkCommand.PttStop.rawValue,
      MerClawTalkCommand.PttCancel.rawValue,
      MerClawTalkCommand.PttOnce.rawValue,
      MerClawContactsCommand.Search.rawValue,
      MerClawContactsCommand.Add.rawValue,
      MerClawCalendarCommand.Events.rawValue,
      MerClawCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      MerClawCameraCommand.Snap.rawValue,
      MerClawCameraCommand.Clip.rawValue,
      MerClawCameraCommand.List.rawValue,
      MerClawLocationCommand.Get.rawValue,
      MerClawMotionCommand.Activity.rawValue,
      MerClawMotionCommand.Pedometer.rawValue,
      MerClawSmsCommand.Send.rawValue,
      MerClawSmsCommand.Search.rawValue,
      MerClawCallLogCommand.Search.rawValue,
      MerClawPhotosCommand.Latest.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          smsSearchPossible = false,
          callLogAvailable = false,
          photosAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(MerClawMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(MerClawMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true, smsSearchPossible = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCommands.contains(MerClawSmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(MerClawSmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(MerClawSmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(MerClawSmsCommand.Search.rawValue))
    assertTrue(requestableSearchCommands.contains(MerClawSmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCapabilities.contains(MerClawCapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(MerClawCapability.Sms.rawValue))
    assertFalse(requestableSearchCapabilities.contains(MerClawCapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(MerClawCallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(MerClawCapability.CallLog.rawValue))
  }

  @Test
  fun advertisedPhotosSurface_respectsFeatureAvailability() {
    val disabledFlags = defaultFlags(photosAvailable = false)
    val enabledFlags = defaultFlags(photosAvailable = true)

    assertFalse(InvokeCommandRegistry.advertisedCapabilities(disabledFlags).contains(MerClawCapability.Photos.rawValue))
    assertFalse(InvokeCommandRegistry.advertisedCommands(disabledFlags).contains(MerClawPhotosCommand.Latest.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCapabilities(enabledFlags).contains(MerClawCapability.Photos.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCommands(enabledFlags).contains(MerClawPhotosCommand.Latest.rawValue))
  }

  @Test
  fun advertisedCapabilities_includesVoiceWakeWithoutAdvertisingCommands() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(voiceWakeEnabled = true))
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(voiceWakeEnabled = true))

    assertTrue(capabilities.contains(MerClawCapability.VoiceWake.rawValue))
    assertFalse(commands.any { it.contains("voice", ignoreCase = true) })
  }

  @Test
  fun find_returnsForegroundMetadataForCameraCommands() {
    val list = InvokeCommandRegistry.find(MerClawCameraCommand.List.rawValue)
    val location = InvokeCommandRegistry.find(MerClawLocationCommand.Get.rawValue)

    assertNotNull(list)
    assertEquals(true, list?.requiresForeground)
    assertNotNull(location)
    assertEquals(false, location?.requiresForeground)
  }

  @Test
  fun find_returnsNullForUnknownCommand() {
    assertNull(InvokeCommandRegistry.find("not.real"))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    photosAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      smsSearchPossible = smsSearchPossible,
      callLogAvailable = callLogAvailable,
      photosAvailable = photosAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(
    actual: List<String>,
    expected: Set<String>,
  ) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(
    actual: List<String>,
    forbidden: Set<String>,
  ) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
