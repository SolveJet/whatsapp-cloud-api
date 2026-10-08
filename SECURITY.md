# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** using GitHub's private security advisories:

👉 https://github.com/solvejet/whatsapp-cloud-api/security/advisories/new

Do **not** open a public issue for security problems.

We will acknowledge your report, investigate, and keep you informed of the resolution. Please give us a reasonable amount of time to address the issue before any public disclosure.

### Do not include secrets

This SDK handles sensitive material — **access tokens** and **webhook signature secrets**. When reporting an issue, never include live access tokens, app secrets, phone number IDs tied to production, or real webhook payloads. Redact or use placeholder values in any reproduction steps.

## Supply-chain integrity

Releases are published from GitHub Actions using [npm OIDC Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) — no long-lived npm tokens are involved. Each published version carries a signed [npm provenance](https://docs.npmjs.com/generating-provenance-statements) attestation linking the package back to the exact source commit and build workflow. You can verify it with:

```sh
npm audit signatures
```

## Supported versions

The project is in early development. Security fixes are applied to the latest release line.

| Version | Supported           |
| ------- | ------------------- |
| 0.x     | ✅ (in development) |

Once a stable 1.x release is published, this table will be updated to reflect the supported release lines.
