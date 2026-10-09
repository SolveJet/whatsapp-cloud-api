/**
 * Typed Block API for the WhatsApp Cloud API, exposed as `client.blocks`.
 *
 * Covers blocking users ({@link BlocksResource.block}), unblocking them
 * ({@link BlocksResource.unblock}), and listing the currently blocked users
 * ({@link BlocksResource.list}). All operations are scoped by a phone number id
 * (the configured one by default). Built on the resource-agnostic request
 * function and error hierarchy from the HTTP core; no runtime dependencies.
 *
 * Only users who have messaged the business in the last 24 hours can be
 * blocked. A call may succeed overall while individual users fail: those appear
 * in `block_users.failed_users` of the response.
 */

import { WhatsAppValidationError } from '../errors.js';
import type {
  BlockUsersResponse,
  BlockedUserList,
  ListBlockedUsersOptions,
} from '../types/blocks.js';
import type { PhoneNumberIdAccessor, RequestFn } from './messages.js';

/** The messaging product value required on every block/unblock request. */
const MESSAGING_PRODUCT = 'whatsapp';

/** Maximum number of users accepted in a single block or unblock call. */
const MAX_BLOCK_USERS = 1000;

/** Block API exposed as `client.blocks`. */
export class BlocksResource {
  private readonly request: RequestFn;
  private readonly getDefaultPhoneNumberId: PhoneNumberIdAccessor;

  constructor(request: RequestFn, getDefaultPhoneNumberId: PhoneNumberIdAccessor) {
    this.request = request;
    this.getDefaultPhoneNumberId = getDefaultPhoneNumberId;
  }

  /**
   * Blocks one or more WhatsApp users for the given phone number id.
   *
   * Pass up to {@link MAX_BLOCK_USERS} phone numbers; the array must be
   * non-empty. Only users who have messaged the business in the last 24 hours
   * can be blocked. Users that could not be blocked appear in
   * `block_users.failed_users` even when the overall call succeeds.
   */
  async block(users: string[], phoneNumberId?: string): Promise<BlockUsersResponse> {
    this.assertUsers(users);
    const id = this.resolvePhoneNumberId(phoneNumberId);
    return this.request<BlockUsersResponse>({
      method: 'POST',
      path: `${id}/block_users`,
      body: {
        messaging_product: MESSAGING_PRODUCT,
        block_users: users.map((user) => ({ user })),
      },
    });
  }

  /**
   * Unblocks one or more WhatsApp users for the given phone number id.
   *
   * Issues a `DELETE` carrying the same body shape as {@link BlocksResource.block};
   * consumers read the result from `block_users.removed_users`. Pass up to
   * {@link MAX_BLOCK_USERS} phone numbers; the array must be non-empty.
   */
  async unblock(users: string[], phoneNumberId?: string): Promise<BlockUsersResponse> {
    this.assertUsers(users);
    const id = this.resolvePhoneNumberId(phoneNumberId);
    return this.request<BlockUsersResponse>({
      method: 'DELETE',
      path: `${id}/block_users`,
      body: {
        messaging_product: MESSAGING_PRODUCT,
        block_users: users.map((user) => ({ user })),
      },
    });
  }

  /**
   * Lists the users currently blocked for the given phone number id. All
   * options are optional; `limit`, `after`, and `before` are URL-encoded.
   */
  async list(options?: ListBlockedUsersOptions): Promise<BlockedUserList> {
    const id = this.resolvePhoneNumberId(options?.phoneNumberId);
    return this.request<BlockedUserList>({
      method: 'GET',
      path: `${id}/block_users${this.buildListQuery(options)}`,
    });
  }

  /** Builds the `list` query string from the provided options. */
  private buildListQuery(options?: ListBlockedUsersOptions): string {
    if (options === undefined) {
      return '';
    }
    const params: string[] = [];
    if (options.limit !== undefined) {
      params.push(`limit=${encodeURIComponent(String(options.limit))}`);
    }
    if (options.after !== undefined) {
      params.push(`after=${encodeURIComponent(options.after)}`);
    }
    if (options.before !== undefined) {
      params.push(`before=${encodeURIComponent(options.before)}`);
    }
    return params.length > 0 ? `?${params.join('&')}` : '';
  }

  /** Validates that `users` is a non-empty array of at most {@link MAX_BLOCK_USERS} entries. */
  private assertUsers(users: string[]): void {
    if (!Array.isArray(users) || users.length === 0) {
      throw new WhatsAppValidationError('At least one user is required to block or unblock.');
    }
    if (users.length > MAX_BLOCK_USERS) {
      throw new WhatsAppValidationError(
        `At most ${MAX_BLOCK_USERS} users may be blocked or unblocked per call (received ${users.length}).`,
      );
    }
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
}
