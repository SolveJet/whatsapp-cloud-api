/**
 * Types for the WhatsApp message-template management endpoints, exposed as
 * `client.templates`.
 *
 * Message templates are created, listed, edited, and deleted against a
 * `{WHATSAPP_BUSINESS_ACCOUNT_ID}` (WABA) via `/message_templates`, while a
 * single template is read/edited by its own `{TEMPLATE_ID}`. Graph may return
 * extra fields and newer component/button shapes, so the shapes here are
 * intentionally permissive: object shapes carry an index signature and the
 * string unions accept unknown values gracefully.
 *
 * Note: these are the *management* types. The send-side template types
 * (`TemplateComponent`, `TemplateParameter`, `TemplatePayload`) live in
 * `./messages.ts` and are unrelated; the management component union is
 * re-exported from the package root under the alias `MessageTemplateComponent`
 * to avoid a naming collision.
 */

import type { PagingCursors } from './waba.js';

/** Category a template is created under. */
export type TemplateCategory = 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';

/**
 * Review/lifecycle status of a template. Modeled as the documented union but
 * widened to `string` at usage sites so unknown future statuses never error.
 */
export type TemplateStatus =
  | 'APPROVED'
  | 'IN_APPEAL'
  | 'PENDING'
  | 'REJECTED'
  | 'PENDING_DELETION'
  | 'DELETED'
  | 'DISABLED'
  | 'PAUSED'
  | 'LIMIT_EXCEEDED';

/** How body/header parameters are addressed in a template. */
export type TemplateParameterFormat = 'POSITIONAL' | 'NAMED';

/** A named example value, e.g. for named-parameter templates. */
export interface TemplateNamedParamExample {
  /** The parameter name used in the template text. */
  param_name: string;
  /** An example value for the parameter. */
  example: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A HEADER component. `format` selects text vs. a media/location header. */
export interface TemplateHeaderComponent {
  type: 'HEADER';
  /** The header format. */
  format: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  /** Header text (only for `TEXT` headers). */
  text?: string;
  /** Example values used by Graph when creating the template. */
  example?: {
    /** Example values for positional header text parameters. */
    header_text?: string[];
    /** Example values for named header text parameters. */
    header_text_named_params?: TemplateNamedParamExample[];
    /** Media handles for a media header example. */
    header_handle?: string[];
    /** Additional Graph fields not explicitly typed above. */
    [key: string]: unknown;
  };
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A BODY component. The body text is required. */
export interface TemplateBodyComponent {
  type: 'BODY';
  /** The body text, with optional `{{1}}` / `{{name}}` placeholders. */
  text: string;
  /** Example values used by Graph when creating the template. */
  example?: {
    /** Example value sets for positional body parameters. */
    body_text?: string[][];
    /** Example values for named body parameters. */
    body_text_named_params?: TemplateNamedParamExample[];
    /** Additional Graph fields not explicitly typed above. */
    [key: string]: unknown;
  };
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A FOOTER component. */
export interface TemplateFooterComponent {
  type: 'FOOTER';
  /** The footer text. */
  text: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A quick-reply button. */
export interface TemplateQuickReplyButton {
  type: 'QUICK_REPLY';
  /** Button label. */
  text: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A URL button. The URL may contain a trailing `{{1}}` variable. */
export interface TemplateUrlButton {
  type: 'URL';
  /** Button label. */
  text: string;
  /** The destination URL. */
  url: string;
  /** Example values for a dynamic URL suffix. */
  example?: string[];
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A phone-number (call) button. */
export interface TemplatePhoneNumberButton {
  type: 'PHONE_NUMBER';
  /** Button label. */
  text: string;
  /** The phone number to dial. */
  phone_number: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A copy-code button (e.g. for one-time passwords/coupons). */
export interface TemplateCopyCodeButton {
  type: 'COPY_CODE';
  /** An example code value. */
  example: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** A permissive fallback for button shapes not modeled above (OTP/FLOW/...). */
export interface TemplateUnknownButton {
  /** The button type. */
  type: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/**
 * A template button. The union is intentionally open: OTP, MPM, CATALOG, FLOW
 * and other button shapes fall through to {@link TemplateUnknownButton} rather
 * than failing type-checking.
 */
export type TemplateButton =
  | TemplateQuickReplyButton
  | TemplateUrlButton
  | TemplatePhoneNumberButton
  | TemplateCopyCodeButton
  | TemplateUnknownButton;

/** A BUTTONS component holding up to ten buttons. */
export interface TemplateButtonsComponent {
  type: 'BUTTONS';
  /** The buttons in this component. */
  buttons: TemplateButton[];
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/**
 * A template component, discriminated by its UPPERCASE `type`. Each member
 * carries an index signature so newer component shapes do not error.
 *
 * Re-exported from the package root as `MessageTemplateComponent` to avoid a
 * collision with the send-side `TemplateComponent` from `./messages.ts`.
 */
export type TemplateComponent =
  | TemplateHeaderComponent
  | TemplateBodyComponent
  | TemplateFooterComponent
  | TemplateButtonsComponent;

/**
 * A message template as returned by the Graph API. Only commonly used fields
 * are typed; an index signature allows any additional Graph fields.
 */
export interface MessageTemplate {
  /** The template id. */
  id: string;
  /** The template name (lowercase, alphanumeric + underscores). */
  name: string;
  /** The template language/locale, e.g. `en_US`. */
  language: string;
  /** The current review/lifecycle status. */
  status: TemplateStatus | string;
  /** The template category. */
  category: TemplateCategory | string;
  /** How parameters are addressed, when present. */
  parameter_format?: string;
  /** The template components. */
  components: TemplateComponent[];
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/**
 * Payload for {@link TemplatesResource.create}. camelCase fields are mapped to
 * the snake_case Graph shape (`parameterFormat` -> `parameter_format`,
 * `messageSendTtlSeconds` -> `message_send_ttl_seconds`).
 */
export interface CreateTemplatePayload {
  /** Template name: lowercase alphanumeric and underscores, up to 512 chars. */
  name: string;
  /** The template language/locale, e.g. `en_US`. */
  language: string;
  /** The template category. */
  category: TemplateCategory;
  /** How parameters are addressed. */
  parameterFormat?: TemplateParameterFormat;
  /** The template components (exactly one BODY is required). */
  components: TemplateComponent[];
  /** Time-to-live for message sends using this template, in seconds. */
  messageSendTtlSeconds?: number;
}

/**
 * Payload for {@link TemplatesResource.edit}. `name` and `language` are
 * immutable and therefore not editable.
 */
export interface EditTemplatePayload {
  /** A new category, when changing it. */
  category?: TemplateCategory;
  /** Replacement components, when editing the template body/structure. */
  components?: TemplateComponent[];
  /** A new message send TTL, in seconds. */
  messageSendTtlSeconds?: number;
}

/** A page of templates from `GET /{WABA_ID}/message_templates`. */
export interface TemplateList {
  /** The templates on this page. */
  data: MessageTemplate[];
  /** Paging metadata, when present. Graph may return cursor- or link-style. */
  paging?: {
    /** Cursors for navigating pages. */
    cursors?: PagingCursors;
    /** A link to the next page. */
    next?: string;
    /** A link to the previous page. */
    previous?: string;
  };
}

/** The response from `POST /{WABA_ID}/message_templates`. */
export interface CreateTemplateResponse {
  /** The new template id. */
  id: string;
  /** The initial status, typically `PENDING`. */
  status: string;
  /** The resolved category. */
  category: string;
}
