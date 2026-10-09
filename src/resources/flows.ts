/**
 * Typed WhatsApp Flows management API, exposed as `client.flows`.
 *
 * Covers the Flow lifecycle: {@link FlowsResource.create} a Flow,
 * {@link FlowsResource.list} and {@link FlowsResource.get} to read Flows,
 * {@link FlowsResource.update} Flow metadata, {@link FlowsResource.updateJson}
 * to upload a Flow JSON definition (multipart), {@link FlowsResource.publish}
 * and {@link FlowsResource.deprecate} to move it through its lifecycle,
 * {@link FlowsResource.delete} (only while `DRAFT`),
 * {@link FlowsResource.listAssets} to read its assets, and
 * {@link FlowsResource.getPreview} for a short-lived preview URL. List/create
 * are scoped to a WABA id (the configured business account id by default);
 * the rest are addressed by a Flow id. Built on the resource-agnostic request
 * function and error hierarchy from the HTTP core; no runtime dependencies.
 */

import { WhatsAppValidationError } from '../errors.js';
import type { SuccessResponse } from '../types/common.js';
import type {
  CreateFlowPayload,
  CreateFlowResponse,
  Flow,
  FlowAssetList,
  FlowJsonInput,
  FlowList,
  FlowPreview,
  GetPreviewOptions,
  ListFlowsOptions,
  UpdateFlowJsonOptions,
  UpdateFlowJsonResponse,
  UpdateFlowPayload,
} from '../types/flows.js';
import type { RequestFn } from './messages.js';
import { buildFieldsQuery } from './phone-numbers.js';
import type { BusinessAccountIdAccessor } from './waba.js';

/** The content type used for an uploaded Flow JSON asset. */
const FLOW_JSON_CONTENT_TYPE = 'application/json';

/** The asset type for a Flow JSON upload. */
const FLOW_JSON_ASSET_TYPE = 'FLOW_JSON';

/** The default file name used for a Flow JSON upload. */
const DEFAULT_FLOW_JSON_NAME = 'flow.json';

/** True when a value is a `Blob` (includes `File`, which extends `Blob`). */
const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob;

/**
 * Converts raw `Uint8Array` bytes into a `BlobPart`. A `Uint8Array` may be
 * backed by a `SharedArrayBuffer`, so copy its exact region into a fresh
 * `ArrayBuffer`-backed view that satisfies the `BlobPart` type.
 */
const toBlobPart = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
};

/** Flows management API exposed as `client.flows`. */
export class FlowsResource {
  private readonly request: RequestFn;
  private readonly getDefaultBusinessAccountId: BusinessAccountIdAccessor;

  constructor(request: RequestFn, getDefaultBusinessAccountId: BusinessAccountIdAccessor) {
    this.request = request;
    this.getDefaultBusinessAccountId = getDefaultBusinessAccountId;
  }

  /**
   * Creates a Flow on a business account. New Flows start in `DRAFT`. Validates
   * that `name` is non-empty and `categories` is a non-empty array before
   * sending. Supply `flowJson` to seed the definition, `publish: true` to
   * publish immediately, or `cloneFlowId` to clone an existing Flow.
   */
  async create(
    payload: CreateFlowPayload,
    businessAccountId?: string,
  ): Promise<CreateFlowResponse> {
    this.assertCreatePayload(payload);
    const id = this.resolveBusinessAccountId(businessAccountId);
    return this.request<CreateFlowResponse>({
      method: 'POST',
      path: `${id}/flows`,
      body: {
        name: payload.name,
        categories: payload.categories,
        ...(payload.flowJson !== undefined ? { flow_json: payload.flowJson } : {}),
        ...(payload.publish !== undefined ? { publish: payload.publish } : {}),
        ...(payload.cloneFlowId !== undefined ? { clone_flow_id: payload.cloneFlowId } : {}),
        ...(payload.endpointUri !== undefined ? { endpoint_uri: payload.endpointUri } : {}),
      },
    });
  }

  /**
   * Lists the Flows on a business account. Pass `fields` to request specific
   * Graph fields; when omitted no field selection is sent.
   */
  async list(options?: ListFlowsOptions): Promise<FlowList> {
    const id = this.resolveBusinessAccountId(options?.businessAccountId);
    return this.request<FlowList>({
      method: 'GET',
      path: `${id}/flows${buildFieldsQuery(options?.fields)}`,
    });
  }

  /**
   * Reads a single Flow by its id. Pass `fields` to request specific Graph
   * fields; when omitted no field selection is sent.
   */
  async get(flowId: string, fields?: string[]): Promise<Flow> {
    this.assertFlowId(flowId);
    return this.request<Flow>({
      method: 'GET',
      path: `${encodeURIComponent(flowId)}${buildFieldsQuery(fields)}`,
    });
  }

  /**
   * Updates a Flow's metadata. At least one of `name`, `categories`,
   * `endpointUri`, or `applicationId` must be provided. To change the Flow's
   * JSON definition use {@link FlowsResource.updateJson} instead.
   */
  async update(flowId: string, payload: UpdateFlowPayload): Promise<SuccessResponse> {
    this.assertFlowId(flowId);
    if (
      payload.name === undefined &&
      payload.categories === undefined &&
      payload.endpointUri === undefined &&
      payload.applicationId === undefined
    ) {
      throw new WhatsAppValidationError(
        'An update requires at least one of "name", "categories", "endpointUri", or "applicationId".',
      );
    }
    const response = await this.request<{ success?: boolean }>({
      method: 'POST',
      path: `${encodeURIComponent(flowId)}`,
      body: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.categories !== undefined ? { categories: payload.categories } : {}),
        ...(payload.endpointUri !== undefined ? { endpoint_uri: payload.endpointUri } : {}),
        ...(payload.applicationId !== undefined ? { application_id: payload.applicationId } : {}),
      },
    });
    return { success: response?.success === true };
  }

  /**
   * Uploads a Flow JSON definition as a multipart asset. Accepts a `Blob`, raw
   * `Uint8Array` bytes, or a JSON `string`; all are sent as an
   * `application/json` file part named `flow.json` (override via
   * `options.name`). Uploading JSON reverts a published Flow to `DRAFT`.
   */
  async updateJson(
    flowId: string,
    file: FlowJsonInput,
    options?: UpdateFlowJsonOptions,
  ): Promise<UpdateFlowJsonResponse> {
    this.assertFlowId(flowId);
    const name = options?.name ?? DEFAULT_FLOW_JSON_NAME;
    const blob = isBlob(file)
      ? file
      : new Blob([typeof file === 'string' ? file : toBlobPart(file)], {
          type: FLOW_JSON_CONTENT_TYPE,
        });

    const form = new FormData();
    form.set('asset_type', FLOW_JSON_ASSET_TYPE);
    form.set('name', name);
    form.set('file', blob, name);

    return this.request<UpdateFlowJsonResponse>({
      method: 'POST',
      path: `${encodeURIComponent(flowId)}/assets`,
      body: form,
    });
  }

  /** Publishes a Flow, moving it from `DRAFT` to `PUBLISHED`. */
  async publish(flowId: string): Promise<SuccessResponse> {
    this.assertFlowId(flowId);
    const response = await this.request<{ success?: boolean }>({
      method: 'POST',
      path: `${encodeURIComponent(flowId)}/publish`,
    });
    return { success: response?.success === true };
  }

  /** Deprecates a published Flow. Deprecation is irreversible. */
  async deprecate(flowId: string): Promise<SuccessResponse> {
    this.assertFlowId(flowId);
    const response = await this.request<{ success?: boolean }>({
      method: 'POST',
      path: `${encodeURIComponent(flowId)}/deprecate`,
    });
    return { success: response?.success === true };
  }

  /** Deletes a Flow. Only Flows in `DRAFT` status can be deleted. */
  async delete(flowId: string): Promise<SuccessResponse> {
    this.assertFlowId(flowId);
    const response = await this.request<{ success?: boolean }>({
      method: 'DELETE',
      path: `${encodeURIComponent(flowId)}`,
    });
    return { success: response?.success === true };
  }

  /** Lists the assets (e.g. the Flow JSON) attached to a Flow. */
  async listAssets(flowId: string): Promise<FlowAssetList> {
    this.assertFlowId(flowId);
    return this.request<FlowAssetList>({
      method: 'GET',
      path: `${encodeURIComponent(flowId)}/assets`,
    });
  }

  /**
   * Reads a Flow's short-lived preview URL. Pass `invalidate: true` to force a
   * fresh URL instead of a cached one.
   */
  async getPreview(flowId: string, options?: GetPreviewOptions): Promise<FlowPreview> {
    this.assertFlowId(flowId);
    const invalidate = String(options?.invalidate ?? false);
    return this.request<FlowPreview>({
      method: 'GET',
      path: `${encodeURIComponent(flowId)}?fields=preview.invalidate(${invalidate})`,
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

  /** Validates the required fields for a create payload. */
  private assertCreatePayload(payload: CreateFlowPayload): void {
    if (payload.name === undefined || payload.name === '') {
      throw new WhatsAppValidationError('A non-empty Flow name is required.');
    }
    if (!Array.isArray(payload.categories) || payload.categories.length === 0) {
      throw new WhatsAppValidationError('At least one Flow category is required.');
    }
  }

  /** Validates that a Flow id is a non-empty string. */
  private assertFlowId(flowId: string): void {
    if (flowId === undefined || flowId === '') {
      throw new WhatsAppValidationError('A non-empty Flow id is required.');
    }
  }
}
