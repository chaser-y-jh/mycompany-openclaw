package ai.merclaw.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class MerClawProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", MerClawCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", MerClawCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", MerClawCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", MerClawCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", MerClawCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", MerClawCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", MerClawCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", MerClawCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", MerClawCapability.Canvas.rawValue)
    assertEquals("camera", MerClawCapability.Camera.rawValue)
    assertEquals("voiceWake", MerClawCapability.VoiceWake.rawValue)
    assertEquals("talk", MerClawCapability.Talk.rawValue)
    assertEquals("location", MerClawCapability.Location.rawValue)
    assertEquals("sms", MerClawCapability.Sms.rawValue)
    assertEquals("device", MerClawCapability.Device.rawValue)
    assertEquals("notifications", MerClawCapability.Notifications.rawValue)
    assertEquals("system", MerClawCapability.System.rawValue)
    assertEquals("photos", MerClawCapability.Photos.rawValue)
    assertEquals("contacts", MerClawCapability.Contacts.rawValue)
    assertEquals("calendar", MerClawCapability.Calendar.rawValue)
    assertEquals("motion", MerClawCapability.Motion.rawValue)
    assertEquals("callLog", MerClawCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", MerClawCameraCommand.List.rawValue)
    assertEquals("camera.snap", MerClawCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", MerClawCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", MerClawNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", MerClawNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", MerClawDeviceCommand.Status.rawValue)
    assertEquals("device.info", MerClawDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", MerClawDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", MerClawDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", MerClawSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", MerClawPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", MerClawContactsCommand.Search.rawValue)
    assertEquals("contacts.add", MerClawContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", MerClawCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", MerClawCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", MerClawMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", MerClawMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.send", MerClawSmsCommand.Send.rawValue)
    assertEquals("sms.search", MerClawSmsCommand.Search.rawValue)
  }

  @Test
  fun talkCommandsUseStableStrings() {
    assertEquals("talk.ptt.start", MerClawTalkCommand.PttStart.rawValue)
    assertEquals("talk.ptt.stop", MerClawTalkCommand.PttStop.rawValue)
    assertEquals("talk.ptt.cancel", MerClawTalkCommand.PttCancel.rawValue)
    assertEquals("talk.ptt.once", MerClawTalkCommand.PttOnce.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", MerClawCallLogCommand.Search.rawValue)
  }
}
