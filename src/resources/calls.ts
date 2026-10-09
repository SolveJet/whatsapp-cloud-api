/**
 * Typed WhatsApp Business Calling API, exposed as `client.calls`.
 *
 * Covers the REST signaling + settings endpoints: reading and updating a phone
 * number's calling settings ({@link CallsResource.getSettings},
 * {@link CallsResource.updateSettings}) and the call lifecycle
 * ({@link CallsResource.initiate}, {@link CallsResource.preAccept},
 * {@link CallsResource.accept}, {@link CallsResource.reject},
 * {@link CallsResource.terminate}).
 *
 * SCOPE NOTE: the Calling API also has a real-time media layer that exchanges
 * SDP offers/answers over WebRTC/SIP. This SDK wraps the REST signaling +
 * settings endpoints ONLY. The caller owns the WebRTC/SIP media stack and
 * produces/consumes the SDP strings; every method here passes SDP through as
 * opaque strings and never parses or validates SDP content. Built on the
 * resource-agnostic request function and error hierarchy from the HTTP core.
 */

import { WhatsAppValidationError } from '../errors.js';
import type { SuccessResponse } from '../types/common.js';
import type {
  CallResponse,
  CallSdp,
  InitiateCallOptions,
  PhoneNumberSettings,
  UpdateCallSettingsPayload,
} from '../types/calls.js';
import type { PhoneNumberIdAccessor, RequestFn } from './messages.js';
import { buildFieldsQuery } from './phone-numbers.js';

/** The messaging product value required on calling requests. */
const MESSAGING_PRODUCT = 'whatsapp';

/** WhatsApp Business Calling API exposed as `client.calls`. */
export class CallsResource {
  private readonly request: RequestFn;
  private readonly getDefaultPhoneNumberId: PhoneNumberIdAccessor;

  constructor(request: RequestFn, getDefaultPhoneNumberId: PhoneNumberIdAccessor) {
    this.request = request;
    this.getDefaultPhoneNumberId = getDefaultPhoneNumberId;
  }

  /**
   * Reads a phone number's settings, including the `calling` block. Pass
   * `fields` to request specific Graph fields; when omitted no field selection
   * is sent.
   */
  async getSettings(phoneNumberId?: string, fields?: string[]): Promise<PhoneNumberSettings> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    return this.request<PhoneNumberSettings>({
      method: 'GET',
      path: `${id}/settings${buildFieldsQuery(fields)}`,
    });
  }

  /**
   * Updates a phone number's calling settings. Only provided fields are sent,
   * mapped from camelCase to the snake_case API shape; `callHours` and `sip`
   * are passed through unchanged.
   */
  async updateSettings(
    settings: UpdateCallSettingsPayload,
    phoneNumberId?: string,
  ): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/settings`,
      body: { calling: this.mapCallingSettings(settings.calling) },
    });
  }

  /**
   * Initiates (connects) an outbound call to a WhatsApp user. Validates a
   * non-empty `to` before sending. When an SDP offer is supplied it is wrapped
   * into the request `session` as opaque strings.
   */
  async initiate(options: InitiateCallOptions, phoneNumberId?: string): Promise<CallResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    if (options.to === '') {
      throw new WhatsAppValidationError('A non-empty "to" is required to initiate a call.');
    }
    return this.request<CallResponse>({
      method: 'POST',
      path: `${id}/calls`,
      body: {
        messaging_product: MESSAGING_PRODUCT,
        to: options.to,
        action: 'connect',
        ...(options.sdp !== undefined ? { session: this.toSession(options.sdp) } : {}),
      },
    });
  }

  /**
   * Pre-accepts an inbound call with an SDP answer, letting media connect
   * before the user fully accepts. The SDP is passed through unchanged.
   */
  async preAccept(callId: string, sdp: CallSdp, phoneNumberId?: string): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    this.assertCallId(callId);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/calls`,
      body: {
        messaging_product: MESSAGING_PRODUCT,
        call_id: callId,
        action: 'pre_accept',
        session: this.toSession(sdp),
      },
    });
  }

  /**
   * Accepts an inbound call with an SDP answer. The SDP is passed through
   * unchanged.
   */
  async accept(callId: string, sdp: CallSdp, phoneNumberId?: string): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    this.assertCallId(callId);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/calls`,
      body: {
        messaging_product: MESSAGING_PRODUCT,
        call_id: callId,
        action: 'accept',
        session: this.toSession(sdp),
      },
    });
  }

  /** Rejects an inbound call. */
  async reject(callId: string, phoneNumberId?: string): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    this.assertCallId(callId);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/calls`,
      body: {
        messaging_product: MESSAGING_PRODUCT,
        call_id: callId,
        action: 'reject',
      },
    });
  }

  /** Terminates an active call. */
  async terminate(callId: string, phoneNumberId?: string): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    this.assertCallId(callId);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/calls`,
      body: {
        messaging_product: MESSAGING_PRODUCT,
        call_id: callId,
        action: 'terminate',
      },
    });
  }

  /**
   * Maps the camelCase calling-settings update to the snake_case API shape,
   * omitting undefined fields and passing `callHours`/`sip` through unchanged.
   */
  private mapCallingSettings(
    calling: UpdateCallSettingsPayload['calling'],
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    if (calling === undefined) {
      return mapped;
    }
    if (calling.status !== undefined) {
      mapped.status = calling.status;
    }
    if (calling.callIconVisibility !== undefined) {
      mapped.call_icon_visibility = calling.callIconVisibility;
    }
    if (calling.callbackPermissionStatus !== undefined) {
      mapped.callback_permission_status = calling.callbackPermissionStatus;
    }
    if (calling.callHours !== undefined) {
      mapped.call_hours = calling.callHours;
    }
    if (calling.sip !== undefined) {
      mapped.sip = calling.sip;
    }
    return mapped;
  }

  /** Wraps an SDP payload into the request `session` with opaque strings. */
  private toSession(sdp: CallSdp): { sdp_type: string; sdp: string } {
    return { sdp_type: sdp.sdpType, sdp: sdp.sdp };
  }

  /** Resolves a per-call override or the configured default phone number id. */
  private resolvePhoneNumberId(override?: string): string {
    const id = override ?? this.getDefaultPhoneNumberId();
    if (id === undefined || id === '') {
      throw new WhatsAppValidationError(
        'A phoneNumberId is required: pass one or configure it on the client.',
      );
    }
    return id;
  }

  /** Guards that a call id is a non-empty string. */
  private assertCallId(callId: string): void {
    if (callId === '') {
      throw new WhatsAppValidationError('A non-empty call id is required.');
    }
  }
}
