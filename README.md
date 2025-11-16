# Guitar Collection Manager

A modern, full-stack web application for cataloging and managing your guitar collection with AI-powered features, secure cloud storage, and provenance tracking.

## Features

- **🎸 Complete Guitar Catalog** - Track brand, model, year, specs, condition, and modifications
- **📸 Image Management** - Upload multiple photos per guitar with cloud storage via S3 + CloudFront CDN
- **🤖 AI-Powered Specs Import** - Extract detailed specifications from PDFs and manufacturer websites using Amazon Bedrock Nova
- **🔍 Smart Search & Filters** - Fuzzy search with autocomplete, filter by brand/type/year
- **📄 Document Storage** - Securely store receipts, manuals, and certificates of authenticity
- **📝 Notes Journal** - Track repairs, modifications, setup changes, and history
- **🔐 Provenance Reports** - Generate authenticity reports for valuable or vintage guitars
- **🌐 Public Gallery** - Share random guitars from the community (optional)
- **🔒 Security** - KMS encryption at rest, JWT authentication, audit logging

## Quick Start

```bash
# 1. Initialize configuration files
make init

# 2. Edit .env.deploy with your AWS values
vim .env.deploy

# 3. Install dependencies and deploy
make install
make deploy-all
```

That's it! Your application is now running on AWS.

## Common Commands

```bash
# Development
make dev              # Start development server (localhost:5173)
make build            # Build for production

# Deployment
make deploy-backend   # Deploy Lambda functions + DynamoDB + Cognito
make deploy-frontend  # Deploy React app to S3 + CloudFront
make deploy-all       # Deploy everything

# Utilities
make status           # Show current configuration
make logs FUNC=guitars  # Tail CloudWatch logs for a function
make clean            # Remove build artifacts
make help             # See all available commands
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  React + TypeScript + Tailwind CSS + Vite                   │
│  Hosted on S3, served via CloudFront CDN                    │
└─────────────────────────────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway (HTTP)                     │
│             JWT Authorization via AWS Cognito               │
└─────────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  Lambda  │   │  Lambda  │   │  Lambda  │
    │  Guitars │   │   Auth   │   │  Images  │
    └──────────┘   └──────────┘   └──────────┘
            │              │              │
            ▼              ▼              ▼
    ┌──────────────────────────────────────────┐
    │           DynamoDB Tables                │
    │  • Guitars (encrypted with KMS)          │
    │  • Users                                 │
    └──────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │          S3 + CloudFront                 │
    │  • Guitar images                         │
    │  • Receipts and documents                │
    │  • Automatic CDN distribution            │
    └──────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │         Amazon Bedrock (Nova)            │
    │  • AI spec extraction from PDFs/text     │
    │  • Confidence scoring                    │
    └──────────────────────────────────────────┘
```

## Technology Stack

**Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Fuse.js, React Router

**Backend**: AWS Lambda (Node.js 20.x), API Gateway, DynamoDB, Cognito, Bedrock Nova

**Storage**: S3, CloudFront CDN, KMS encryption

**Infrastructure**: AWS SAM, CloudFormation, CloudWatch

## Documentation

### Getting Started

- **[Deployment Guide](docs/DEPLOYMENT.md)** - Complete deployment walkthrough with prerequisites and troubleshooting
- **[Makefile Deployment Summary](docs/MAKEFILE_DEPLOYMENT_SUMMARY.md)** - Technical deep-dive on the self-generating deployment pipeline

### Development

- **[Development Guide](docs/DEVELOPMENT.md)** - Local development setup, build process, and debugging
- **[Contributing Guidelines](docs/CONTRIBUTING.md)** - How to contribute, git hooks, and code standards

### Backend & API

- **[Backend Overview](docs/BACKEND_OVERVIEW.md)** - Backend architecture and Lambda function details
- **[Backend Deployment Guide](docs/BACKEND_DEPLOYMENT_GUIDE.md)** - Backend-specific deployment instructions
- **[API Contract](docs/API_CONTRACT.md)** - Complete API specification and data models

## Why Serverless?

**Cost Efficiency**: Pay only for what you use (~$5-10/month for personal use). No idle servers.

**Scalability**: Automatically handles traffic from 1 to thousands of users without configuration.

**Durability**: 99.999999999% durability for photos and documents via S3.

**Security**: AWS-managed services provide enterprise-grade security. Data encrypted at rest (KMS) and in transit (TLS).

**Maintenance-Free**: No servers to patch, no databases to tune. AWS handles operational overhead.

**Developer Experience**: Infrastructure as Code makes the entire stack reproducible with one command.

## Security Features

- **Authentication**: AWS Cognito with JWT tokens
- **Authorization**: Lambda authorizers validate every request
- **Encryption**: KMS encryption at rest, TLS 1.2+ in transit
- **Validation**: Input validation on all endpoints, output sanitization
- **Rate Limiting**: Public endpoints limited to 1 req/sec
- **Audit Logging**: CloudWatch logs for all API calls
- **IAM Policies**: Least-privilege access for all Lambda functions
- **Pre-commit Hooks**: Prevent accidental credential commits

**Sensitive Files** (never commit):

- `.env*` files - Frontend configuration
- `.env.deploy` - Deployment configuration with AWS resource IDs
- `backend/samconfig.toml` - SAM deployment parameters

Template files (`.example` suffix) are provided for each.

## Cost Estimate

Monthly cost for personal use (~100 guitars, moderate traffic):

| Service | Cost |
|---------|------|
| DynamoDB | $1-2 |
| Lambda | $0-1 (within free tier) |
| S3 Storage | $1-3 |
| CloudFront | $1-2 |
| Cognito | $0 (within free tier) |
| Bedrock Nova | <$0.01 |
| **Total** | **~$5-10/month** |

## Prerequisites

- **Node.js 22+** ([nvm](https://github.com/nvm-sh/nvm) or [asdf](https://asdf-vm.com/))
- **AWS CLI** ([installation guide](https://aws.amazon.com/cli/))
- **AWS SAM CLI** ([installation guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- **jq** (JSON processor - `apt install jq` / `brew install jq`)
- **Make** (pre-installed on Linux/macOS)
- **AWS Account** with appropriate permissions

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Need Help?** See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed setup instructions and troubleshooting.
