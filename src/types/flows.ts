/**
 * Types for the WhatsApp Flows management endpoints.
 *
 * A Flow is a multi-screen interactive form hosted by Meta, scoped to a
 * `{WHATSAPP_BUSINESS_ACCOUNT_ID}` and addressed individually by its `{FLOW_ID}`.
 * Flows are created in `DRAFT`, published, deprecated, and deleted (only while
 * `DRAFT`). Graph responses may carry extra fields beyond those typed here, so
 * permissive shapes allow them.
 */

import type { Paging } from './waba.js';

/** The categories a Flow can be tagged with. */
export type FlowCategory =
  | 'SIGN_UP'
  | 'SIGN_IN'
  | 'APPOINTMENT_BOOKING'
  | 'LEAD_GENERATION'
  | 'CONTACT_US'
  | 'CUSTOMER_SUPPORT'
  | 'SURVEY'
  | 'OTHER';

/** Lifecycle status of a Flow. Widen with `| string` at usage for forward-compat. */
export type FlowStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'BLOCKED' | 'THROTTLED';

/** A validation error reported against a Flow's JSON definition. */
export interface FlowValidationError {
  /** Short machine-readable error key. */
  error: string;
  /** Optional error category. */
  error_type?: string;
  /** Human-readable description of the error. */
  message: string;
  /** First line of the offending region, when known. */
  line_start?: number;
  /** Last line of the offending region, when known. */
  line_end?: number;
  /** First column of the offending region, when known. */
  column_start?: number;
  /** Last column of the offending region, when known. */
  column_end?: number;
  /** Additional structured pointers into the document. */
  pointers?: unknown[];
}

/**
 * A Flow as returned by the Graph API. Only commonly used fields are typed; an
 * index signature allows any additional Graph fields.
 */
export interface Flow {
  /** The Flow id used in `{FLOW_ID}` paths. */
  id: string;
  /** Display name of the Flow. */
  name: string;
  /** Current lifecycle status. */
  status: FlowStatus | string;
  /** The categories this Flow is tagged with. */
  categories: string[];
  /** Validation errors against the current Flow JSON, when present. */
  validation_errors?: FlowValidationError[];
  /** The Flow JSON schema version. */
  json_version?: string;
  /** The Flow data-exchange endpoint API version. */
  data_api_version?: string;
  /** The configured data-exchange endpoint URI. */
  endpoint_uri?: string;
  /** A short-lived preview URL and its expiry, when requested. */
  preview?: { preview_url: string; expires_at: string };
  /** Health status details reported by Graph. */
  health_status?: unknown;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A page of Flows from `GET /{WABA_ID}/flows`. */
export interface FlowList {
  /** The Flows on this page. */
  data: Flow[];
  /** Paging metadata, when present. */
  paging?: Paging;
}

/** Payload for {@link FlowsResource.create}. */
export interface CreateFlowPayload {
  /** Display name of the Flow. */
  name: string;
  /** One or more categories for the Flow. */
  categories: FlowCategory[];
  /** Optional Flow JSON definition, as a JSON string. */
  flowJson?: string;
  /** Publish the Flow immediately after creation. */
  publish?: boolean;
  /** Id of an existing Flow to clone from. */
  cloneFlowId?: string;
  /** Data-exchange endpoint URI for the Flow. */
  endpointUri?: string;
}

/** Response from {@link FlowsResource.create}. */
export interface CreateFlowResponse {
  /** The id of the newly created Flow. */
  id: string;
  /** Whether creation succeeded, when reported. */
  success?: boolean;
  /** Validation errors against the supplied Flow JSON, when present. */
  validation_errors?: FlowValidationError[];
}

/** Payload for {@link FlowsResource.update} (Flow metadata). */
export interface UpdateFlowPayload {
  /** New display name. */
  name?: string;
  /** New categories. */
  categories?: FlowCategory[];
  /** New data-exchange endpoint URI. */
  endpointUri?: string;
  /** Meta app id to associate with the Flow. */
  applicationId?: string;
}

/** Options for {@link FlowsResource.updateJson}. */
export interface UpdateFlowJsonOptions {
  /** The asset file name; defaults to `flow.json`. */
  name?: string;
}

/** Response from {@link FlowsResource.updateJson}. */
export interface UpdateFlowJsonResponse {
  /** Whether the Flow JSON upload succeeded. */
  success: boolean;
  /** Validation errors against the uploaded Flow JSON, when present. */
  validation_errors?: FlowValidationError[];
}

/** A Flow asset (e.g. the Flow JSON) as returned by Graph. */
export interface FlowAsset {
  /** The asset file name. */
  name: string;
  /** The asset type, e.g. `FLOW_JSON`. */
  asset_type: string;
  /** A URL to download the asset. */
  download_url: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A page of Flow assets from `GET /{FLOW_ID}/assets`. */
export interface FlowAssetList {
  /** The assets on this page. */
  data: FlowAsset[];
  /** Paging metadata, when present. */
  paging?: Paging;
}

/** A Flow preview from `GET /{FLOW_ID}?fields=preview...`. */
export interface FlowPreview {
  /** The Flow id. */
  id: string;
  /** A short-lived preview URL and its expiry, when present. */
  preview?: { preview_url: string; expires_at: string };
}

/** Options for {@link FlowsResource.list}. */
export interface ListFlowsOptions {
  /** The WABA id to list against; defaults to the configured one. */
  businessAccountId?: string;
  /** Specific Graph fields to request for each Flow. */
  fields?: string[];
}

/** Options for {@link FlowsResource.getPreview}. */
export interface GetPreviewOptions {
  /** Force a fresh preview URL instead of a cached one. */
  invalidate?: boolean;
}

/** The accepted file input for {@link FlowsResource.updateJson}. */
export type FlowJsonInput = Blob | Uint8Array | string;
