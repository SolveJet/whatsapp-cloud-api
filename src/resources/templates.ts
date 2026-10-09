/**
 * Typed WhatsApp message-template management API, exposed as `client.templates`.
 *
 * Covers listing templates ({@link TemplatesResource.list}), reading one
 * ({@link TemplatesResource.get}), creating ({@link TemplatesResource.create}),
 * editing ({@link TemplatesResource.edit}), and deleting
 * ({@link TemplatesResource.delete}) templates. List/create/delete operate on a
 * WABA id (the configured business account id by default); get/edit are scoped
 * by a template id. Built on the resource-agnostic request function and error
 * hierarchy from the HTTP core.
 */

import { WhatsAppValidationError } from '../errors.js';
import type { SuccessResponse } from '../types/common.js';
import type {
  CreateTemplatePayload,
  CreateTemplateResponse,
  EditTemplatePayload,
  MessageTemplate,
  TemplateComponent,
  TemplateList,
} from '../types/templates.js';
import type { RequestFn } from './messages.js';
import { buildFieldsQuery } from './phone-numbers.js';
import type { BusinessAccountIdAccessor } from './waba.js';

/** The valid template categories, used for client-side validation. */
const TEMPLATE_CATEGORIES = ['AUTHENTICATION', 'MARKETING', 'UTILITY'] as const;

/** Documented client-side limits for template fields (UTF-16 units / counts). */
const TEMPLATE_LIMITS = {
  name: 512,
  bodyText: 1024,
  headerText: 60,
  footerText: 60,
  buttons: 10,
} as const;

/** Pattern a template name must match: lowercase alphanumeric and underscores. */
const TEMPLATE_NAME_PATTERN = /^[a-z0-9_]+$/;

/** Options for {@link TemplatesResource.list}. */
export interface ListTemplatesOptions {
  /** The WABA id to list against; defaults to the configured one. */
  businessAccountId?: string;
  /** Specific Graph fields to request for each template. */
  fields?: string[];
  /** Maximum number of templates to return. */
  limit?: number;
  /** Filter by template name. */
  name?: string;
  /** Filter by status. */
  status?: string;
  /** Filter by category. */
  category?: string;
  /** Filter by language/locale. */
  language?: string;
  /** Paging cursor for the next page. */
  after?: string;
  /** Paging cursor for the previous page. */
  before?: string;
}

/** Options for {@link TemplatesResource.delete}. */
export interface DeleteTemplateOptions {
  /** The template name (required). Deletes all versions unless a id is given. */
  name: string;
  /** A specific template id (maps to `hsm_id`) to delete a single version. */
  templateId?: string;
  /** The WABA id to delete against; defaults to the configured one. */
  businessAccountId?: string;
}

/** Message-template management API exposed as `client.templates`. */
export class TemplatesResource {
  private readonly request: RequestFn;
  private readonly getDefaultBusinessAccountId: BusinessAccountIdAccessor;

  constructor(request: RequestFn, getDefaultBusinessAccountId: BusinessAccountIdAccessor) {
    this.request = request;
    this.getDefaultBusinessAccountId = getDefaultBusinessAccountId;
  }

  /**
   * Lists the message templates on a business account. All options are
   * optional; `fields` is comma-joined and every value is URL-encoded.
   */
  async list(options?: ListTemplatesOptions): Promise<TemplateList> {
    const id = this.resolveBusinessAccountId(options?.businessAccountId);
    return this.request<TemplateList>({
      method: 'GET',
      path: `${id}/message_templates${this.buildListQuery(options)}`,
    });
  }

  /**
   * Reads a single template by its id. Pass `fields` to request specific Graph
   * fields; when omitted no field selection is sent.
   */
  async get(templateId: string, fields?: string[]): Promise<MessageTemplate> {
    this.assertTemplateId(templateId);
    return this.request<MessageTemplate>({
      method: 'GET',
      path: `${encodeURIComponent(templateId)}${buildFieldsQuery(fields)}`,
    });
  }

  /**
   * Creates a message template. Client-side validation of the documented hard
   * limits runs before the request, so an invalid payload never hits the API.
   *
   * @example Positional body with a footer
   * ```ts
   * await client.templates.create({
   *   name: 'order_confirmation',
   *   language: 'en_US',
   *   category: 'UTILITY',
   *   components: [
   *     { type: 'BODY', text: 'Hi {{1}}, your order {{2}} is confirmed.', example: { body_text: [['Sam', '12345']] } },
   *     { type: 'FOOTER', text: 'Reply STOP to opt out.' },
   *   ],
   * });
   * ```
   *
   * @example Named-parameter body with a media header and buttons
   * ```ts
   * await client.templates.create({
   *   name: 'appointment_reminder',
   *   language: 'en_US',
   *   category: 'UTILITY',
   *   parameterFormat: 'NAMED',
   *   components: [
   *     { type: 'HEADER', format: 'IMAGE', example: { header_handle: ['4::handle'] } },
   *     {
   *       type: 'BODY',
   *       text: 'Hi {{name}}, your appointment is on {{date}}.',
   *       example: { body_text_named_params: [{ param_name: 'name', example: 'Sam' }, { param_name: 'date', example: 'Monday' }] },
   *     },
   *     { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Confirm' }, { type: 'QUICK_REPLY', text: 'Cancel' }] },
   *   ],
   * });
   * ```
   */
  async create(
    payload: CreateTemplatePayload,
    businessAccountId?: string,
  ): Promise<CreateTemplateResponse> {
    const id = this.resolveBusinessAccountId(businessAccountId);
    this.assertCreatePayload(payload);
    return this.request<CreateTemplateResponse>({
      method: 'POST',
      path: `${id}/message_templates`,
      body: {
        name: payload.name,
        language: payload.language,
        category: payload.category,
        ...(payload.parameterFormat !== undefined
          ? { parameter_format: payload.parameterFormat }
          : {}),
        components: payload.components,
        ...(payload.messageSendTtlSeconds !== undefined
          ? { message_send_ttl_seconds: payload.messageSendTtlSeconds }
          : {}),
      },
    });
  }

  /**
   * Edits an existing template by its id. Only `category`, `components`, and
   * `messageSendTtlSeconds` are editable; `name` and `language` are immutable.
   * Editing an APPROVED template resets it to PENDING for re-review.
   *
   * `businessAccountId` is accepted for signature parity with the other
   * methods but is unused: the edit endpoint is addressed globally by template
   * id and does not include a WABA segment.
   */
  async edit(
    templateId: string,
    payload: EditTemplatePayload,
    businessAccountId?: string,
  ): Promise<SuccessResponse> {
    // Accepted for signature parity with the other methods; the edit endpoint
    // is addressed globally by template id and carries no WABA segment.
    void businessAccountId;
    this.assertTemplateId(templateId);
    if (
      payload.category === undefined &&
      payload.components === undefined &&
      payload.messageSendTtlSeconds === undefined
    ) {
      throw new WhatsAppValidationError(
        'An edit requires at least one of "category", "components", or "messageSendTtlSeconds".',
      );
    }
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${encodeURIComponent(templateId)}`,
      body: {
        ...(payload.category !== undefined ? { category: payload.category } : {}),
        ...(payload.components !== undefined ? { components: payload.components } : {}),
        ...(payload.messageSendTtlSeconds !== undefined
          ? { message_send_ttl_seconds: payload.messageSendTtlSeconds }
          : {}),
      },
    });
  }

  /**
   * Deletes a template by name. By default all versions are deleted; pass
   * `templateId` (mapped to `hsm_id`) to delete a single version. `name` is
   * always required.
   */
  async delete(options: DeleteTemplateOptions): Promise<SuccessResponse> {
    const id = this.resolveBusinessAccountId(options.businessAccountId);
    this.assertName(options.name);
    let query = `?name=${encodeURIComponent(options.name)}`;
    if (options.templateId !== undefined && options.templateId !== '') {
      query += `&hsm_id=${encodeURIComponent(options.templateId)}`;
    }
    return this.request<SuccessResponse>({
      method: 'DELETE',
      path: `${id}/message_templates${query}`,
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

  /** Builds the `list` query string from the provided options. */
  private buildListQuery(options?: ListTemplatesOptions): string {
    if (options === undefined) {
      return '';
    }
    const params: string[] = [];
    if (options.fields !== undefined && options.fields.length > 0) {
      params.push(`fields=${options.fields.map(encodeURIComponent).join(',')}`);
    }
    if (options.limit !== undefined) {
      params.push(`limit=${encodeURIComponent(String(options.limit))}`);
    }
    if (options.name !== undefined) {
      params.push(`name=${encodeURIComponent(options.name)}`);
    }
    if (options.status !== undefined) {
      params.push(`status=${encodeURIComponent(options.status)}`);
    }
    if (options.category !== undefined) {
      params.push(`category=${encodeURIComponent(options.category)}`);
    }
    if (options.language !== undefined) {
      params.push(`language=${encodeURIComponent(options.language)}`);
    }
    if (options.after !== undefined) {
      params.push(`after=${encodeURIComponent(options.after)}`);
    }
    if (options.before !== undefined) {
      params.push(`before=${encodeURIComponent(options.before)}`);
    }
    return params.length > 0 ? `?${params.join('&')}` : '';
  }

  /** Validates the documented hard limits for a create payload. */
  private assertCreatePayload(payload: CreateTemplatePayload): void {
    if (payload.name === undefined || payload.name === '') {
      throw new WhatsAppValidationError('A non-empty template name is required.');
    }
    if (!TEMPLATE_NAME_PATTERN.test(payload.name)) {
      throw new WhatsAppValidationError(
        'A template name must contain only lowercase letters, digits, and underscores.',
      );
    }
    this.assertLength(payload.name, TEMPLATE_LIMITS.name, 'Template name');
    if (payload.language === undefined || payload.language === '') {
      throw new WhatsAppValidationError('A non-empty language is required (e.g. "en_US").');
    }
    if (!TEMPLATE_CATEGORIES.includes(payload.category)) {
      throw new WhatsAppValidationError(
        'A category of "AUTHENTICATION", "MARKETING", or "UTILITY" is required.',
      );
    }
    if (!Array.isArray(payload.components) || payload.components.length === 0) {
      throw new WhatsAppValidationError('At least one template component is required.');
    }
    this.assertComponents(payload.components);
  }

  /** Validates component counts and the per-component length/count limits. */
  private assertComponents(components: TemplateComponent[]): void {
    let headerCount = 0;
    let bodyCount = 0;
    let footerCount = 0;
    for (const component of components) {
      switch (component.type) {
        case 'HEADER':
          headerCount += 1;
          if (typeof component.text === 'string') {
            this.assertLength(component.text, TEMPLATE_LIMITS.headerText, 'Template header text');
          }
          break;
        case 'BODY':
          bodyCount += 1;
          this.assertLength(component.text, TEMPLATE_LIMITS.bodyText, 'Template body text');
          break;
        case 'FOOTER':
          footerCount += 1;
          this.assertLength(component.text, TEMPLATE_LIMITS.footerText, 'Template footer text');
          break;
        case 'BUTTONS':
          if (component.buttons.length > TEMPLATE_LIMITS.buttons) {
            throw new WhatsAppValidationError(
              `A template supports at most ${TEMPLATE_LIMITS.buttons} buttons (received ${component.buttons.length}).`,
            );
          }
          break;
        default:
          break;
      }
    }
    if (bodyCount !== 1) {
      throw new WhatsAppValidationError('A template requires exactly one BODY component.');
    }
    if (headerCount > 1) {
      throw new WhatsAppValidationError('A template supports at most one HEADER component.');
    }
    if (footerCount > 1) {
      throw new WhatsAppValidationError('A template supports at most one FOOTER component.');
    }
  }

  /** Validates that a template id is a non-empty string. */
  private assertTemplateId(templateId: string): void {
    if (templateId === undefined || templateId === '') {
      throw new WhatsAppValidationError('A non-empty template id is required.');
    }
  }

  /** Validates that a template name is a non-empty string. */
  private assertName(name: string): void {
    if (name === undefined || name === '') {
      throw new WhatsAppValidationError('A non-empty template name is required.');
    }
  }

  /** Throws when a string exceeds `max` UTF-16 units. Never truncates. */
  private assertLength(value: string, max: number, field: string): void {
    if (value.length > max) {
      throw new WhatsAppValidationError(
        `${field} must be at most ${max} characters (received ${value.length}).`,
      );
    }
  }
}
