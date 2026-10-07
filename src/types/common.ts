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

/** How the HTTP core should interpret a successful (2xx) response body. */
export type ResponseType = 'json' | 'binary';

/** Options describing a single HTTP request made by the client. */
export interface RequestOptions {
  /** HTTP method for the request. */
  method: HttpMethod;
  /**
   * Request target. Normally a path appended to the versioned base URL (any
   * leading slash is stripped). When it is an absolute `http(s)` URL it is used
   * verbatim instead of being prefixed with the base URL — this is how media
   * downloads hit the short-lived Graph CDN URL directly.
   */
  path: string;
  /**
   * Optional request body. A plain value is JSON-serialized with a
   * `Content-Type: application/json` header. A `FormData` instance is passed
   * straight through so `fetch` sets the multipart boundary itself; no
   * `Content-Type` header is added in that case.
   */
  body?: unknown;
  /** Optional caller-provided abort signal, combined with the timeout signal. */
  signal?: AbortSignal;
  /** How to decode a 2xx body. Defaults to `'json'`. */
  responseType?: ResponseType;
  /** Optional `User-Agent` header value (used by media downloads). */
  userAgent?: string;
}
