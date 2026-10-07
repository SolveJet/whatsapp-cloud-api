/**
 * Types for the WhatsApp Cloud API Media endpoints.
 *
 * Media is uploaded to `${phoneNumberId}/media` to obtain a reusable media
 * `id`, retrieved via `GET /{mediaId}` (returning a short-lived download URL),
 * downloaded from that URL with the bearer token, and deleted via
 * `DELETE /{mediaId}`. Uploaded media is retained by Meta for 30 days.
 */

/** Raw bytes accepted by {@link MediaResource.upload} for an in-memory file. */
export type MediaBytes = Blob | Uint8Array | ArrayBuffer;

/**
 * Input accepted by {@link MediaResource.upload}.
 *
 * Either a {@link Blob}/`File` directly (its `type` is used as the content
 * type), or an object wrapping raw bytes with an explicit content `type` and
 * optional display `filename`. When bytes carry no inferable content type and
 * none is supplied, upload throws `WhatsAppValidationError`.
 */
export type MediaUploadInput =
  | Blob
  | {
      /** File contents as a `Blob`/`File`, `Uint8Array`, or `ArrayBuffer`. */
      file: MediaBytes;
      /** Display filename for the uploaded file part. */
      filename?: string;
      /** MIME content type, e.g. `image/jpeg`. Required when it can't be inferred. */
      type?: string;
    };

/** Shape returned by a successful media upload. */
export interface UploadMediaResponse {
  /** The reusable media id to pass to the media senders. */
  id: string;
}

/** Shape returned by a media delete. */
export interface DeleteMediaResponse {
  /** True when Meta acknowledged the deletion. */
  success: boolean;
}

/** Typed, camelCase metadata for a media object (from `GET /{mediaId}`). */
export interface MediaInfo {
  /** The media id. */
  id: string;
  /**
   * Short-lived, authenticated download URL. It expires quickly and must be
   * fetched with the `Authorization: Bearer` token.
   */
  url: string;
  /** MIME type of the stored media, e.g. `image/jpeg`. */
  mimeType: string;
  /** SHA-256 checksum of the media contents. */
  sha256: string;
  /** Size of the media in bytes. */
  fileSize: number;
  /** Messaging product the media belongs to (always `whatsapp`). */
  messagingProduct: string;
}

/** Per-call options for media methods that support a phone number id. */
export interface MediaRequestOptions {
  /** Override the client's configured phone number id for this call. */
  phoneNumberId?: string;
}

/** Raw snake_case response shape of `GET /{mediaId}`, mapped to {@link MediaInfo}. */
export interface MediaInfoResponse {
  id: string;
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  messaging_product: string;
}

/** Result returned by {@link MediaResource.download}. */
export interface DownloadMediaResult {
  /** Raw media bytes. */
  data: Uint8Array;
  /** MIME type reported by `getUrl`. */
  mimeType: string;
  /** SHA-256 checksum reported by `getUrl`, when present. */
  sha256?: string;
}
