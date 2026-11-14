# Contributing to Guitar Collection Manager

Thank you for your interest in contributing! This document provides guidelines for development and contribution.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Follow the setup instructions in [DEVELOPMENT.md](DEVELOPMENT.md)
4. Install the pre-commit hook (see below)

## Pre-Commit Hook Installation

We provide a pre-commit hook that detects secrets and sensitive information before you commit.

### Install the Hook

```bash
make init-hooks   # sets the repo-local core.hooksPath to .git-hooks
```

### What the Hook Checks

The pre-commit hook scans for:

- AWS credentials (access keys, secret keys)
- Private keys
- Hardcoded passwords, tokens, and API keys
- AWS Account IDs
- Sensitive files (`.env`, `samconfig.toml`, etc.)

If secrets are detected, the commit will be blocked.

### Bypassing the Hook

**NOT RECOMMENDED**, but if you need to bypass:

```bash
git commit --no-verify
```

Only use this if you're absolutely sure your commit contains no secrets.

## Development Guidelines

### Before Committing

1. **Test locally**: Run `npm test`, `npx tsc --noEmit`, and (for backend changes) `cd backend && npm test`; then try the change with `npm run dev`
2. **Check for secrets**: The pre-commit hook will run automatically
3. **Update documentation**: If you change configuration or add features
4. **Follow code style**: Run `npm run lint` (ESLint)

### Sensitive Information

**NEVER commit:**

- `.env` file (auto-generated from backend deployment)
- `.env.deploy` (use `.env.deploy.example`)
- `backend/samconfig.toml` (use `backend/samconfig.toml.example`)
- AWS resource identifiers (account IDs, distribution IDs, hosted zone IDs)
- API keys, tokens, or credentials
- Personal notes containing production details

### Configuration Files

For any configuration that contains environment-specific values:

1. Create a template file with `.example` suffix
2. Add the actual file to `.gitignore`
3. Use only placeholder values in the `.example` file (never copy your real config over it)
4. Document the configuration in [DEPLOYMENT.md](DEPLOYMENT.md#configuration)

## Code Style

- **Frontend**: React + TypeScript, Tailwind CSS
- **Backend**: Node.js, AWS Lambda
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Test thoroughly
4. Ensure the pre-commit hook and CI (typecheck, tests, build, cfn-lint) pass
5. Update documentation if needed
6. Submit a pull request with:
   - Clear description of changes
   - Reason for the change
   - Any breaking changes
   - Screenshots (for UI changes)

## Security

If you discover a security vulnerability:

**Do not open a public issue.** Report it privately as described in [SECURITY.md](../SECURITY.md).

## Questions?

- Check existing [Issues](https://github.com/onemorepereira/guitar-collection/issues)
- Read the documentation in `/docs/`
- Open a new issue for questions

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).
