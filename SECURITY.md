# Security

## Reporting a vulnerability

Please **do not** file a public GitHub issue for undisclosed security problems.

- If this repository is on **GitHub**, use **[Security → Report a vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)** (private advisory) so maintainers can review and coordinate a fix before details are public.
- If private reporting is not available, open a **public issue only to ask for a security contact**—do not include exploit details, credentials, or live URLs there.

Include, when you can:

- A short description of the impact and affected component (e.g. Discord command handling, config parsing).
- Steps to reproduce or a proof of concept.
- Your assessment of severity (best guess is fine).

We will treat reports in good faith and aim to respond as capacity allows; this is a volunteer-maintained project.

## Credentials and secrets

If you believe a **Discord bot token**, **BitCraft JWT**, **database URL**, or other secret was exposed (committed, pasted in an issue, or logged), **revoke and rotate it immediately** in the relevant service (Discord Developer Portal, BitCraft auth, database, etc.). Removing a file from git does not remove it from history until the repository is rewritten and all clones updated.

## Scope

Security reports should concern **this repository and its default deployment pattern** (Node process, env-based config, Postgres, Discord bot, SpacetimeDB read-only client). Vulnerabilities in upstream products (Discord, SpacetimeDB, BitCraft, Node.js) should be reported to those projects’ own security channels.
