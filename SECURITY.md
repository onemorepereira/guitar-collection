# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub: go to the repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/onemorepereira/guitar-collection/security/advisories/new)). Include:

- what is affected (endpoint, file, or deployed component),
- steps to reproduce or a proof of concept,
- the impact you expect.

This is a personal project maintained in spare time. Expect an acknowledgement within a week; fixes are prioritized by severity. Please allow time for a fix to ship before disclosing publicly.

## Scope

- The code in this repository (frontend, backend Lambda handlers, SAM/CloudFormation templates, deploy tooling).
- The reference deployment at https://guitarhelp.click — test only against your own account and data. Denial-of-service, spam, social engineering, and automated scanning that degrades the service are out of scope.

## Supported versions

Only the latest commit on `main` is supported. There are no versioned releases.

## Security design

How authentication, authorization, input validation, and encryption work is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security).
