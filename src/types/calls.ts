/**
 * Types for the WhatsApp Business Calling API, exposed as `client.calls`.
 *
 * SCOPE NOTE: the WhatsApp Business Calling API has two layers. A REST
 * signaling layer (call settings plus the connect/accept/reject/terminate
 * lifecycle) AND a real-time media layer that exchanges SDP offers/answers
 * over WebRTC/SIP. This SDK wraps the REST signaling + settings endpoints
 * ONLY. The caller owns the WebRTC/SIP media stack and is responsible for
 * producing and consuming the SDP strings; every method here passes SDP
 * through as opaque strings and never parses or validates SDP content.
 */

/**
 * A Session Description Protocol payload exchanged during call setup. Both
 * fields are opaque to this SDK: `sdpType` is typically `offer` or `answer`
 * and `sdp` is the raw SDP blob produced by the caller's media stack.
 */
export interface CallSdp {
  /** SDP type, e.g. `offer` or `answer`. Passed through unchanged. */
  sdpType: string;
  /** Raw SDP string produced by the caller's media stack. */
  sdp: string;
}

/**
 * Calling configuration as returned by Graph under a phone number's
 * `settings.calling`. Permissive: new fields Graph adds are preserved via the
 * index signature, and nested `call_hours`/`sip` shapes are left as `unknown`.
 */
export interface CallingSettings {
  /** Whether calling is enabled for the phone number. */
  status?: 'ENABLED' | 'DISABLED' | string;
  /** Visibility of the call icon in the chat UI. */
  call_icon_visibility?: string;
  /** Whether the business may request callback permission. */
  callback_permission_status?: 'ENABLED' | 'DISABLED' | string;
  /** Configured call hours. Shape left opaque. */
  call_hours?: unknown;
  /** SIP configuration. Shape left opaque. */
  sip?: unknown;
  [key: string]: unknown;
}

/**
 * A phone number's settings as returned by `GET {id}/settings`. Only the
 * `calling` block is modeled; other setting groups are preserved via the
 * index signature.
 */
export interface PhoneNumberSettings {
  /** Calling-related settings for the phone number. */
  calling?: CallingSettings;
  [key: string]: unknown;
}

/**
 * camelCase update shape accepted by {@link CallsResource.updateSettings}.
 * Only provided fields are sent; `call_hours` and `sip` pass through
 * unchanged.
 */
export interface CallingSettingsUpdate {
  /** Enable or disable calling for the phone number. */
  status?: 'ENABLED' | 'DISABLED';
  /** Maps to `call_icon_visibility`. */
  callIconVisibility?: 'DEFAULT' | 'DISABLE_ALL';
  /** Maps to `callback_permission_status`. */
  callbackPermissionStatus?: 'ENABLED' | 'DISABLED';
  /** Maps to `call_hours`. Passed through unchanged. */
  callHours?: unknown;
  /** Maps to `sip`. Passed through unchanged. */
  sip?: unknown;
}

/** Payload accepted by {@link CallsResource.updateSettings}. */
export interface UpdateCallSettingsPayload {
  /** Calling settings to update. */
  calling?: CallingSettingsUpdate;
}

/** Options accepted by {@link CallsResource.initiate}. */
export interface InitiateCallOptions {
  /** Recipient WhatsApp user, in E.164 format without a leading `+`. */
  to: string;
  /** Optional SDP offer produced by the caller's media stack. */
  sdp?: CallSdp;
}

/**
 * Response returned by the call lifecycle endpoints that create a call. The
 * `calls` array carries the new call id(s).
 */
export interface CallResponse {
  messaging_product: 'whatsapp';
  calls: { id: string }[];
}
