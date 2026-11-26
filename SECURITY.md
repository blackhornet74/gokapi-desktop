# Security policy

## Reporting a vulnerability

Open a private security advisory on GitHub:
<https://github.com/blackhornet74/gokapi-desktop/security/advisories/new>

Do not publish exploit details in a public issue before a fix is available.

## Scope

- The desktop application and its update mechanism
- The release workflow and the signed update manifest

Out of scope: vulnerabilities in Gokapi itself (report them to the Gokapi project) and issues caused by a compromised operating system or credential store.

## Update integrity

Releases are signed with a minisign key. The private key is stored only in the repository's encrypted secrets and never committed. The application refuses updates whose signature does not match the embedded public key.
