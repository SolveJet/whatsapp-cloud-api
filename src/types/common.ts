/**
 * Shared types used across the HTTP core and resource layers.
 *
 * These types are resource-agnostic: they describe the transport contract
 * with the Meta Graph API, not any specific messaging payload.
 */

/** HTTP methods used by the client against the Graph API. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Error envelope returned by the Meta Graph API on failures.
 *
 * See the Graph API error reference. All nested fields are optional except
 * `message` and `code`, which Meta consistently provides.
 */
export interface GraphErrorEnvelope {
  error: {
    /** Human-readable description of the error. */
    message: string;
    /** Error category, e.g. `OAuthException`. */
    type?: string;
    /** Numeric error code. */
    code: number;
    /** More granular numeric subcode. */
    error_subcode?: number;
    /** Additional structured context about the error. */
    error_data?: {
      messaging_product?: string;
      details?: string;
    };
    /** Internal trace identifier for Meta support. */
    fbtrace_id?: string;
  };
}

/** Options describing a single HTTP request made by the client. */
export interface RequestOptions {
  /** HTTP method for the request. */
  method: HttpMethod;
  /** Path appended to the versioned base URL; any leading slash is stripped. */
  path: string;
  /** Optional JSON-serializable request body. */
  body?: unknown;
  /** Optional caller-provided abort signal, combined with the timeout signal. */
  signal?: AbortSignal;
}
