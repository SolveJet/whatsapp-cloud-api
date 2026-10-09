/**
 * Types for the Block API, exposed as `client.blocks`.
 *
 * The block endpoints operate on a phone number id's `/block_users` edge and
 * let a business block, unblock, and list the WhatsApp users it has blocked.
 * Graph responses may carry extra fields beyond those typed here, so permissive
 * shapes allow them.
 */

import type { Paging } from './waba.js';

/** A user that was successfully blocked or unblocked. */
export interface BlockedUser {
  /** The phone number exactly as supplied in the request. */
  input: string;
  /** The resolved WhatsApp user id. */
  wa_id: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A user that could not be blocked or unblocked, with per-user error detail. */
export interface FailedBlockUser {
  /** The phone number exactly as supplied in the request. */
  input: string;
  /** The resolved WhatsApp user id, when Graph was able to resolve it. */
  wa_id?: string;
  /** The errors explaining why this user could not be processed. */
  errors: {
    /** Human-readable error message. */
    message: string;
    /** Graph error code. */
    code: number;
    /** Optional nested error detail. */
    error_data?: {
      /** Additional detail string. */
      details?: string;
    };
  }[];
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/**
 * The response from a block or unblock call. All three inner keys are optional:
 * a block call populates `added_users`, an unblock call populates
 * `removed_users`, and either may include `failed_users` for per-user failures.
 */
export interface BlockUsersResponse {
  /** Always `whatsapp` for the Cloud API. */
  messaging_product: 'whatsapp';
  /** The per-outcome breakdown of the request. */
  block_users: {
    /** Users successfully blocked (block calls). */
    added_users?: BlockedUser[];
    /** Users successfully unblocked (unblock calls). */
    removed_users?: BlockedUser[];
    /** Users that could not be processed, with per-user error detail. */
    failed_users?: FailedBlockUser[];
    /** Additional Graph fields not explicitly typed above. */
    [key: string]: unknown;
  };
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A page of currently blocked users from `GET /{PHONE_NUMBER_ID}/block_users`. */
export interface BlockedUserList {
  /** The blocked users on this page. */
  data: {
    /** Always `whatsapp` for the Cloud API. */
    messaging_product: 'whatsapp';
    /** The blocked WhatsApp user id. */
    wa_id: string;
    /** Additional Graph fields not explicitly typed above. */
    [key: string]: unknown;
  }[];
  /** Paging metadata, when present. */
  paging?: Paging;
}

/** Options for {@link BlocksResource.list}. */
export interface ListBlockedUsersOptions {
  /** The phone number id to list against; defaults to the configured one. */
  phoneNumberId?: string;
  /** Maximum number of blocked users to return. */
  limit?: number;
  /** Paging cursor for the next page. */
  after?: string;
  /** Paging cursor for the previous page. */
  before?: string;
}
