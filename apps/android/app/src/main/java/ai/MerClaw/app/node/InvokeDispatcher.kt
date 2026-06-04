package ai.merclaw.app.node

import ai.merclaw.app.gateway.GatewaySession
import ai.merclaw.app.protocol.MerClawCalendarCommand
import ai.merclaw.app.protocol.MerClawCallLogCommand
import ai.merclaw.app.protocol.MerClawCameraCommand
import ai.merclaw.app.protocol.MerClawCanvasA2UICommand
import ai.merclaw.app.protocol.MerClawCanvasCommand
import ai.merclaw.app.protocol.MerClawContactsCommand
import ai.merclaw.app.protocol.MerClawDeviceCommand
import ai.merclaw.app.protocol.MerClawLocationCommand
import ai.merclaw.app.protocol.MerClawMotionCommand
import ai.merclaw.app.protocol.MerClawNotificationsCommand
import ai.merclaw.app.protocol.MerClawSmsCommand
import ai.merclaw.app.protocol.MerClawSystemCommand
import ai.merclaw.app.protocol.MerClawTalkCommand

/** Runtime state for SMS search, split so permission prompts are not reported as hard unavailability. */
internal enum class SmsSearchAvailabilityReason {
  Available,
  PermissionRequired,
  Unavailable,
}

/**
 * Distinguish permanent SMS search unavailability from permission-gated search.
 */
internal fun classifySmsSearchAvailability(
  readSmsAvailable: Boolean,
  smsFeatureEnabled: Boolean,
  smsTelephonyAvailable: Boolean,
): SmsSearchAvailabilityReason {
  if (readSmsAvailable) return SmsSearchAvailabilityReason.Available
  if (!smsFeatureEnabled || !smsTelephonyAvailable) return SmsSearchAvailabilityReason.Unavailable
  return SmsSearchAvailabilityReason.PermissionRequired
}

internal fun smsSearchAvailabilityError(
  readSmsAvailable: Boolean,
  smsFeatureEnabled: Boolean,
  smsTelephonyAvailable: Boolean,
): GatewaySession.InvokeResult? =
  when (
    classifySmsSearchAvailability(
      readSmsAvailable = readSmsAvailable,
      smsFeatureEnabled = smsFeatureEnabled,
      smsTelephonyAvailable = smsTelephonyAvailable,
    )
  ) {
    SmsSearchAvailabilityReason.Available,
    SmsSearchAvailabilityReason.PermissionRequired,
    -> null
    SmsSearchAvailabilityReason.Unavailable ->
      GatewaySession.InvokeResult.error(
        code = "SMS_UNAVAILABLE",
        message = "SMS_UNAVAILABLE: SMS not available on this device",
      )
  }

/**
 * Gateway node.invoke command router for Android-owned capabilities.
 */
class InvokeDispatcher(
  private val canvas: CanvasController,
  private val cameraHandler: CameraHandler,
  private val locationHandler: LocationHandler,
  private val deviceHandler: DeviceHandler,
  private val notificationsHandler: NotificationsHandler,
  private val systemHandler: SystemHandler,
  private val talkHandler: TalkHandler,
  private val photosHandler: PhotosHandler,
  private val contactsHandler: ContactsHandler,
  private val calendarHandler: CalendarHandler,
  private val motionHandler: MotionHandler,
  private val smsHandler: SmsHandler,
  private val a2uiHandler: A2UIHandler,
  private val debugHandler: DebugHandler,
  private val callLogHandler: CallLogHandler,
  private val isForeground: () -> Boolean,
  private val cameraEnabled: () -> Boolean,
  private val locationEnabled: () -> Boolean,
  private val sendSmsAvailable: () -> Boolean,
  private val readSmsAvailable: () -> Boolean,
  private val smsFeatureEnabled: () -> Boolean,
  private val smsTelephonyAvailable: () -> Boolean,
  private val callLogAvailable: () -> Boolean,
  private val photosAvailable: () -> Boolean,
  private val debugBuild: () -> Boolean,
  private val onCanvasA2uiPush: () -> Unit,
  private val onCanvasA2uiReset: () -> Unit,
  private val refreshCanvasHostUrl: suspend () -> String?,
  private val motionActivityAvailable: () -> Boolean,
  private val motionPedometerAvailable: () -> Boolean,
) {
  /** Dispatches one gateway node.invoke command after foreground and availability gates pass. */
  suspend fun handleInvoke(
    command: String,
    paramsJson: String?,
  ): GatewaySession.InvokeResult {
    val spec =
      InvokeCommandRegistry.find(command)
        ?: return GatewaySession.InvokeResult.error(
          code = "INVALID_REQUEST",
          message = "INVALID_REQUEST: unknown command",
        )
    if (spec.requiresForeground && !isForeground()) {
      // Canvas, camera, and screen-backed commands need an active Activity/WebView surface.
      return GatewaySession.InvokeResult.error(
        code = "NODE_BACKGROUND_UNAVAILABLE",
        message = "NODE_BACKGROUND_UNAVAILABLE: canvas/camera/screen commands require foreground",
      )
    }
    availabilityError(spec.availability)?.let { return it }

    // Command strings come from MerClawProtocolConstants; the registry above owns advertised availability.
    return when (command) {
      // Canvas commands
      MerClawCanvasCommand.Present.rawValue -> {
        val url = CanvasController.parseNavigateUrl(paramsJson)
        canvas.navigate(url)
        GatewaySession.InvokeResult.ok(null)
      }
      MerClawCanvasCommand.Hide.rawValue -> GatewaySession.InvokeResult.ok(null)
      MerClawCanvasCommand.Navigate.rawValue -> {
        val url = CanvasController.parseNavigateUrl(paramsJson)
        canvas.navigate(url)
        GatewaySession.InvokeResult.ok(null)
      }
      MerClawCanvasCommand.Eval.rawValue -> {
        val js =
          CanvasController.parseEvalJs(paramsJson)
            ?: return GatewaySession.InvokeResult.error(
              code = "INVALID_REQUEST",
              message = "INVALID_REQUEST: javaScript required",
            )
        withCanvasAvailable {
          val result = canvas.eval(js)
          GatewaySession.InvokeResult.ok("""{"result":${result.toJsonString()}}""")
        }
      }
      MerClawCanvasCommand.Snapshot.rawValue -> {
        val snapshotParams = CanvasController.parseSnapshotParams(paramsJson)
        withCanvasAvailable {
          val base64 =
            canvas.snapshotBase64(
              format = snapshotParams.format,
              quality = snapshotParams.quality,
              maxWidth = snapshotParams.maxWidth,
            )
          GatewaySession.InvokeResult.ok("""{"format":"${snapshotParams.format.rawValue}","base64":"$base64"}""")
        }
      }

      // A2UI commands
      MerClawCanvasA2UICommand.Reset.rawValue ->
        withReadyA2ui {
          withCanvasAvailable {
            val res = canvas.eval(A2UIHandler.a2uiResetJS)
            onCanvasA2uiReset()
            GatewaySession.InvokeResult.ok(res)
          }
        }
      MerClawCanvasA2UICommand.Push.rawValue, MerClawCanvasA2UICommand.PushJSONL.rawValue -> {
        val messages =
          try {
            a2uiHandler.decodeA2uiMessages(command, paramsJson)
          } catch (err: Throwable) {
            return GatewaySession.InvokeResult.error(
              code = "INVALID_REQUEST",
              message = err.message ?: "invalid A2UI payload",
            )
          }
        withReadyA2ui {
          withCanvasAvailable {
            val js = A2UIHandler.a2uiApplyMessagesJS(messages)
            val res = canvas.eval(js)
            onCanvasA2uiPush()
            GatewaySession.InvokeResult.ok(res)
          }
        }
      }

      // Camera commands
      MerClawCameraCommand.List.rawValue -> cameraHandler.handleList(paramsJson)
      MerClawCameraCommand.Snap.rawValue -> cameraHandler.handleSnap(paramsJson)
      MerClawCameraCommand.Clip.rawValue -> cameraHandler.handleClip(paramsJson)

      // Location command
      MerClawLocationCommand.Get.rawValue -> locationHandler.handleLocationGet(paramsJson)

      // Device commands
      MerClawDeviceCommand.Status.rawValue -> deviceHandler.handleDeviceStatus(paramsJson)
      MerClawDeviceCommand.Info.rawValue -> deviceHandler.handleDeviceInfo(paramsJson)
      MerClawDeviceCommand.Permissions.rawValue -> deviceHandler.handleDevicePermissions(paramsJson)
      MerClawDeviceCommand.Health.rawValue -> deviceHandler.handleDeviceHealth(paramsJson)

      // Notifications command
      MerClawNotificationsCommand.List.rawValue -> notificationsHandler.handleNotificationsList(paramsJson)
      MerClawNotificationsCommand.Actions.rawValue -> notificationsHandler.handleNotificationsActions(paramsJson)

      // System command
      MerClawSystemCommand.Notify.rawValue -> systemHandler.handleSystemNotify(paramsJson)

      // Talk commands
      MerClawTalkCommand.PttStart.rawValue -> talkHandler.handlePttStart(paramsJson)
      MerClawTalkCommand.PttStop.rawValue -> talkHandler.handlePttStop(paramsJson)
      MerClawTalkCommand.PttCancel.rawValue -> talkHandler.handlePttCancel(paramsJson)
      MerClawTalkCommand.PttOnce.rawValue -> talkHandler.handlePttOnce(paramsJson)

      // Photos command
      ai.merclaw.app.protocol.MerClawPhotosCommand.Latest.rawValue ->
        photosHandler.handlePhotosLatest(
          paramsJson,
        )

      // Contacts command
      MerClawContactsCommand.Search.rawValue -> contactsHandler.handleContactsSearch(paramsJson)
      MerClawContactsCommand.Add.rawValue -> contactsHandler.handleContactsAdd(paramsJson)

      // Calendar command
      MerClawCalendarCommand.Events.rawValue -> calendarHandler.handleCalendarEvents(paramsJson)
      MerClawCalendarCommand.Add.rawValue -> calendarHandler.handleCalendarAdd(paramsJson)

      // Motion command
      MerClawMotionCommand.Activity.rawValue -> motionHandler.handleMotionActivity(paramsJson)
      MerClawMotionCommand.Pedometer.rawValue -> motionHandler.handleMotionPedometer(paramsJson)

      // SMS command
      MerClawSmsCommand.Send.rawValue -> smsHandler.handleSmsSend(paramsJson)
      MerClawSmsCommand.Search.rawValue -> smsHandler.handleSmsSearch(paramsJson)

      // CallLog command
      MerClawCallLogCommand.Search.rawValue -> callLogHandler.handleCallLogSearch(paramsJson)

      // Debug commands
      "debug.ed25519" -> debugHandler.handleEd25519()
      "debug.logs" -> debugHandler.handleLogs()
      else -> GatewaySession.InvokeResult.error(code = "INVALID_REQUEST", message = "INVALID_REQUEST: unknown command")
    }
  }

  private suspend fun withReadyA2ui(block: suspend () -> GatewaySession.InvokeResult): GatewaySession.InvokeResult {
    var a2uiUrl =
      a2uiHandler.resolveA2uiHostUrl()
        ?: refreshCanvasHostUrl().let { a2uiHandler.resolveA2uiHostUrl() }
        ?: return GatewaySession.InvokeResult.error(
          code = "A2UI_HOST_NOT_CONFIGURED",
          message = "A2UI_HOST_NOT_CONFIGURED: gateway did not advertise canvas host",
        )
    val readyOnFirstCheck = a2uiHandler.ensureA2uiReady(a2uiUrl)
    if (!readyOnFirstCheck) {
      // Gateway canvas host metadata can lag reconnects; refresh once before failing the command.
      refreshCanvasHostUrl()
      a2uiUrl = a2uiHandler.resolveA2uiHostUrl() ?: a2uiUrl
      if (!a2uiHandler.ensureA2uiReady(a2uiUrl)) {
        return GatewaySession.InvokeResult.error(
          code = "A2UI_HOST_UNAVAILABLE",
          message = "A2UI_HOST_UNAVAILABLE: A2UI host not reachable",
        )
      }
    }
    return block()
  }

  private suspend fun withCanvasAvailable(block: suspend () -> GatewaySession.InvokeResult): GatewaySession.InvokeResult =
    try {
      block()
    } catch (_: Throwable) {
      // WebView calls throw when the Activity is backgrounded between the foreground check and execution.
      GatewaySession.InvokeResult.error(
        code = "NODE_BACKGROUND_UNAVAILABLE",
        message = "NODE_BACKGROUND_UNAVAILABLE: canvas unavailable",
      )
    }

  private fun availabilityError(availability: InvokeCommandAvailability): GatewaySession.InvokeResult? =
    when (availability) {
      InvokeCommandAvailability.Always -> null
      InvokeCommandAvailability.CameraEnabled ->
        if (cameraEnabled()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "CAMERA_DISABLED",
            message = "CAMERA_DISABLED: enable Camera in Settings",
          )
        }
      InvokeCommandAvailability.LocationEnabled ->
        if (locationEnabled()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "LOCATION_DISABLED",
            message = "LOCATION_DISABLED: enable Location in Settings",
          )
        }
      InvokeCommandAvailability.MotionActivityAvailable ->
        if (motionActivityAvailable()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "MOTION_UNAVAILABLE",
            message = "MOTION_UNAVAILABLE: accelerometer not available",
          )
        }
      InvokeCommandAvailability.MotionPedometerAvailable ->
        if (motionPedometerAvailable()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "PEDOMETER_UNAVAILABLE",
            message = "PEDOMETER_UNAVAILABLE: step counter not available",
          )
        }
      InvokeCommandAvailability.SendSmsAvailable ->
        if (sendSmsAvailable()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "SMS_UNAVAILABLE",
            message = "SMS_UNAVAILABLE: SMS not available on this device",
          )
        }
      InvokeCommandAvailability.ReadSmsAvailable,
      InvokeCommandAvailability.RequestableSmsSearchAvailable,
      ->
        // SMS search may still be advertised as promptable; runtime invoke fails only on permanent unavailability.
        smsSearchAvailabilityError(
          readSmsAvailable = readSmsAvailable(),
          smsFeatureEnabled = smsFeatureEnabled(),
          smsTelephonyAvailable = smsTelephonyAvailable(),
        )
      InvokeCommandAvailability.CallLogAvailable ->
        if (callLogAvailable()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "CALL_LOG_UNAVAILABLE",
            message = "CALL_LOG_UNAVAILABLE: call log not available on this build",
          )
        }
      InvokeCommandAvailability.PhotosAvailable ->
        if (photosAvailable()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "PHOTOS_UNAVAILABLE",
            message = "PHOTOS_UNAVAILABLE: photos not available on this build",
          )
        }
      InvokeCommandAvailability.DebugBuild ->
        if (debugBuild()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "INVALID_REQUEST",
            message = "INVALID_REQUEST: unknown command",
          )
        }
    }
}

/**
 * Talk-mode command adapter implemented by the voice subsystem.
 */
interface TalkHandler {
  /** Starts a push-to-talk capture session and keeps it open until stop or cancel. */
  suspend fun handlePttStart(paramsJson: String?): GatewaySession.InvokeResult

  /** Finishes the active push-to-talk capture and submits recognized speech. */
  suspend fun handlePttStop(paramsJson: String?): GatewaySession.InvokeResult

  /** Aborts the active push-to-talk capture without submitting speech. */
  suspend fun handlePttCancel(paramsJson: String?): GatewaySession.InvokeResult

  /** Runs a bounded one-shot push-to-talk capture. */
  suspend fun handlePttOnce(paramsJson: String?): GatewaySession.InvokeResult
}
