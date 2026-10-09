/**
 * Typed WhatsApp Business Account (WABA) management API, exposed as
 * `client.waba`.
 *
 * Covers reading WABA details ({@link WabaResource.get}), listing the phone
 * numbers it owns ({@link WabaResource.listPhoneNumbers}), and managing the
 * apps subscribed to its webhooks ({@link WabaResource.listSubscribedApps},
 * {@link WabaResource.subscribeApp}, {@link WabaResource.unsubscribeApp}).
 * Built on the resource-agnostic request function and error hierarchy from the
 * HTTP core. The default id here is the configured business account id.
 */

import { WhatsAppValidationError } from '../errors.js';
import type { SuccessResponse } from '../types/common.js';
import type {
  ListPhoneNumbersOptions,
  PhoneNumberList,
  SubscribedAppList,
  Waba,
} from '../types/waba.js';
import type { RequestFn } from './messages.js';
import { buildFieldsQuery } from './phone-numbers.js';

/** Accessor returning the client's default business account id, if configured. */
export type BusinessAccountIdAccessor = () => string | undefined;

/** WABA management API exposed as `client.waba`. */
export class WabaResource {
  private readonly request: RequestFn;
  private readonly getDefaultBusinessAccountId: BusinessAccountIdAccessor;

  constructor(request: RequestFn, getDefaultBusinessAccountId: BusinessAccountIdAccessor) {
    this.request = request;
    this.getDefaultBusinessAccountId = getDefaultBusinessAccountId;
  }

  /**
   * Reads the business account's details. Pass `fields` to request specific
   * Graph fields; when omitted no field selection is sent.
   */
  async get(businessAccountId?: string, fields?: string[]): Promise<Waba> {
    const id = this.resolveBusinessAccountId(businessAccountId);
    return this.request<Waba>({
      method: 'GET',
      path: `${id}${buildFieldsQuery(fields)}`,
    });
  }

  /**
   * Lists the phone numbers owned by the business account, with optional field
   * selection. Returns the Graph page shape including paging cursors.
   */
  async listPhoneNumbers(
    businessAccountId?: string,
    options?: ListPhoneNumbersOptions,
  ): Promise<PhoneNumberList> {
    const id = this.resolveBusinessAccountId(businessAccountId);
    return this.request<PhoneNumberList>({
      method: 'GET',
      path: `${id}/phone_numbers${buildFieldsQuery(options?.fields)}`,
    });
  }

  /** Lists the apps subscribed to the business account's webhooks. */
  async listSubscribedApps(businessAccountId?: string): Promise<SubscribedAppList> {
    const id = this.resolveBusinessAccountId(businessAccountId);
    return this.request<SubscribedAppList>({
      method: 'GET',
      path: `${id}/subscribed_apps`,
    });
  }

  /** Subscribes the current app to the business account's webhooks. */
  async subscribeApp(businessAccountId?: string): Promise<SuccessResponse> {
    const id = this.resolveBusinessAccountId(businessAccountId);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/subscribed_apps`,
    });
  }

  /** Unsubscribes the current app from the business account's webhooks. */
  async unsubscribeApp(businessAccountId?: string): Promise<SuccessResponse> {
    const id = this.resolveBusinessAccountId(businessAccountId);
    return this.request<SuccessResponse>({
      method: 'DELETE',
      path: `${id}/subscribed_apps`,
    });
  }

  /** Resolves a per-call override or the configured default business account id. */
  private resolveBusinessAccountId(override?: string): string {
    const id = override ?? this.getDefaultBusinessAccountId();
    if (id === undefined || id === '') {
      throw new WhatsAppValidationError(
        'A businessAccountId is required: pass one or configure it on the client.',
      );
    }
    return id;
  }
}
