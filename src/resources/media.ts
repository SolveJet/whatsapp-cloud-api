/**
 * Typed Media API for the WhatsApp Cloud API, exposed as `client.media`.
 *
 * Covers the media lifecycle: {@link MediaResource.upload} a file to obtain a
 * reusable id, {@link MediaResource.getUrl} to resolve a short-lived download
 * URL, {@link MediaResource.download} (or {@link MediaResource.downloadByUrl})
 * to fetch the bytes with the bearer token, and {@link MediaResource.delete} to
 * remove it. Built on the resource-agnostic request function and error
 * hierarchy from the HTTP core; no runtime dependencies.
 */

import { WhatsAppValidationError } from '../errors.js';
import type {
  DeleteMediaResponse,
  DownloadMediaResult,
  MediaInfo,
  MediaInfoResponse,
  MediaRequestOptions,
  MediaUploadInput,
  UploadMediaResponse,
} from '../types/media.js';
import type { PhoneNumberIdAccessor, RequestFn } from './messages.js';

/**
 * User-Agent sent with media downloads so the Graph CDN sees an identifiable
 * client. Matches the published package name.
 */
export const MEDIA_USER_AGENT = '@solvejet/whatsapp-cloud-api';

/** The messaging product value required on every media upload. */
const MESSAGING_PRODUCT = 'whatsapp';

/** Normalized file parts assembled before building the upload FormData. */
interface NormalizedUpload {
  blob: Blob;
  type: string;
  filename?: string;
}

/** True when a value is a `Blob` (includes `File`, which extends `Blob`). */
const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob;

/**
 * Converts raw `Uint8Array`/`ArrayBuffer` bytes into a `BlobPart`. A
 * `Uint8Array` may be backed by a `SharedArrayBuffer`, so copy its exact
 * region into a fresh `ArrayBuffer`-backed view that satisfies the `BlobPart`
 * type without widening to `ArrayBufferLike`.
 */
const toBlobPart = (bytes: Uint8Array | ArrayBuffer): ArrayBuffer => {
  if (bytes instanceof ArrayBuffer) {
    return bytes;
  }
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
};

/** Media API exposed as `client.media`. */
export class MediaResource {
  private readonly request: RequestFn;
  private readonly getDefaultPhoneNumberId: PhoneNumberIdAccessor;

  constructor(request: RequestFn, getDefaultPhoneNumberId: PhoneNumberIdAccessor) {
    this.request = request;
    this.getDefaultPhoneNumberId = getDefaultPhoneNumberId;
  }

  /**
   * Uploads a file and returns its reusable media `id`.
   *
   * Accepts a `Blob`/`File` directly, or `{ file, filename?, type? }` wrapping
   * `Blob`/`Uint8Array`/`ArrayBuffer` bytes. A content type is required: it is
   * taken from a `Blob`'s `type` or the explicit `type` option, otherwise this
   * throws {@link WhatsAppValidationError}.
   */
  async upload(
    input: MediaUploadInput,
    options?: MediaRequestOptions,
  ): Promise<UploadMediaResponse> {
    const id = this.resolvePhoneNumberId(options?.phoneNumberId);
    const { blob, type, filename } = this.normalizeUpload(input);

    const form = new FormData();
    form.set('messaging_product', MESSAGING_PRODUCT);
    form.set('type', type);
    // A filename is required by multipart for the part to be treated as a file.
    form.set('file', blob, filename ?? 'file');

    const response = await this.request<UploadMediaResponse>({
      method: 'POST',
      path: `${id}/media`,
      body: form,
    });
    return { id: response.id };
  }

  /**
   * Retrieves metadata for a media id, including a short-lived download `url`.
   *
   * The returned `url` expires quickly and must be fetched with the bearer
   * token (handled by {@link MediaResource.download}).
   */
  async getUrl(mediaId: string, options?: MediaRequestOptions): Promise<MediaInfo> {
    this.assertMediaId(mediaId);
    const raw = await this.request<MediaInfoResponse>({
      method: 'GET',
      path: this.withPhoneNumberId(encodeURIComponent(mediaId), options?.phoneNumberId),
    });
    return {
      id: raw.id,
      url: raw.url,
      mimeType: raw.mime_type,
      sha256: raw.sha256,
      fileSize: raw.file_size,
      messagingProduct: raw.messaging_product,
    };
  }

  /**
   * Resolves the download URL for a media id and fetches its bytes.
   *
   * Returns the raw bytes as a `Uint8Array` alongside the reported MIME type
   * and SHA-256 checksum.
   */
  async download(mediaId: string, options?: MediaRequestOptions): Promise<DownloadMediaResult> {
    const info = await this.getUrl(mediaId, options);
    const data = await this.downloadByUrl(info.url);
    return {
      data,
      mimeType: info.mimeType,
      ...(info.sha256 !== '' ? { sha256: info.sha256 } : {}),
    };
  }

  /**
   * Downloads media bytes from an absolute Graph CDN URL (as returned by
   * {@link MediaResource.getUrl}). Sends the bearer token and a User-Agent.
   */
  downloadByUrl(url: string): Promise<Uint8Array> {
    if (url === '') {
      throw new WhatsAppValidationError('A non-empty media download URL is required.');
    }
    return this.request<Uint8Array>({
      method: 'GET',
      path: url,
      responseType: 'binary',
      userAgent: MEDIA_USER_AGENT,
    });
  }

  /** Deletes a media object by id. */
  async delete(mediaId: string, options?: MediaRequestOptions): Promise<DeleteMediaResponse> {
    this.assertMediaId(mediaId);
    const response = await this.request<{ success?: boolean }>({
      method: 'DELETE',
      path: this.withPhoneNumberId(encodeURIComponent(mediaId), options?.phoneNumberId),
    });
    return { success: response?.success === true };
  }

  /**
   * Normalizes any accepted upload input to a `Blob` with a resolved content
   * type, throwing {@link WhatsAppValidationError} when none can be determined.
   */
  private normalizeUpload(input: MediaUploadInput): NormalizedUpload {
    if (isBlob(input)) {
      const type = input.type;
      if (type === '') {
        throw new WhatsAppValidationError(
          'Media upload requires a content type: supply a Blob with a "type" or pass { type }.',
        );
      }
      const filename = typeof (input as File).name === 'string' ? (input as File).name : undefined;
      return {
        blob: input,
        type,
        ...(filename !== undefined && filename !== '' ? { filename } : {}),
      };
    }

    const { file, type, filename } = input;
    if (isBlob(file)) {
      const resolvedType = type ?? file.type;
      if (resolvedType === '') {
        throw new WhatsAppValidationError(
          'Media upload requires a content type: supply a Blob with a "type" or pass { type }.',
        );
      }
      const blob = type !== undefined && type !== file.type ? new Blob([file], { type }) : file;
      return {
        blob,
        type: resolvedType,
        ...(filename !== undefined ? { filename } : {}),
      };
    }

    // Raw bytes carry no content type, so an explicit one is mandatory.
    if (type === undefined || type === '') {
      throw new WhatsAppValidationError(
        'Media upload from raw bytes requires an explicit "type" (e.g. "image/jpeg").',
      );
    }
    const blob = new Blob([toBlobPart(file)], { type });
    return {
      blob,
      type,
      ...(filename !== undefined ? { filename } : {}),
    };
  }

  /** Appends `?phone_number_id=` when an override or default id is available. */
  private withPhoneNumberId(path: string, override?: string): string {
    const id = override ?? this.getDefaultPhoneNumberId();
    if (id === undefined || id === '') {
      return path;
    }
    return `${path}?phone_number_id=${encodeURIComponent(id)}`;
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

  /** Guards that a media id is a non-empty string. */
  private assertMediaId(mediaId: string): void {
    if (mediaId === '') {
      throw new WhatsAppValidationError('A non-empty media id is required.');
    }
  }
}
