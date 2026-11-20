# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privately** using GitHub's private security advisories:

👉 https://github.com/SolveJet/whatsapp-cloud-api/security/advisories/new

Do **not** open a public issue for security problems.

If GitHub advisories are unavailable to you, email hello@solvejet.net as a fallback. Do not put secrets or exploit details in plain email; ask for a private channel and share details there.

### Response times

- We acknowledge a report within 3 business days.
- We give an initial assessment within 7 days.
- We aim to release a fix or mitigation within 90 days.
- We disclose publicly, in coordination with the reporter, after a fix is released. If no fix is possible, we disclose after 90 days by agreement with the reporter.

### Scope

In scope: vulnerabilities in this package's code, for example webhook signature verification, request handling, or token leakage in errors and logs.

Out of scope: vulnerabilities in the WhatsApp or Meta platform itself, and vulnerabilities in your own deployment.

### Do not include secrets

This SDK handles sensitive material — **access tokens** and **webhook signature secrets**. When reporting an issue, never include live access tokens, app secrets, phone number IDs tied to production, or real webhook payloads. Redact or use placeholder values in any reproduction steps.

## Supply-chain integrity

Releases are published from GitHub Actions using [npm OIDC Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) — no long-lived npm tokens are involved. Each published version carries a signed [npm provenance](https://docs.npmjs.com/generating-provenance-statements) attestation linking the package back to the exact source commit and build workflow. You can verify it with:

```sh
npm audit signatures
```

## Supported versions

Security fixes are applied to the latest `1.x` release line.

| Version | Supported        |
| ------- | ---------------- |
| 1.x     | ✅               |
| < 1.0   | ❌ (pre-release) |
