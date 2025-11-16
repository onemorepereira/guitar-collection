# Guitar Collection - Deployment Guide

This document provides comprehensive instructions for deploying the Guitar Collection application using the **Makefile-only deployment system**.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [Configuration](#configuration)
- [Deployment Targets](#deployment-targets)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)

---

## Overview

The Guitar Collection application uses a **fully automated, Makefile-only deployment system** that:

1. **Deploys the backend** (SAM/CloudFormation)
2. **Extracts CloudFormation outputs** automatically
3. **Generates frontend environment variables** from backend outputs
4. **Deploys frontend infrastructure** (S3 + CloudFront)
5. **Builds and deploys the frontend** application

**Key Features:**
- ✅ Zero shell scripts required - everything in Makefile
- ✅ Self-generating configuration - outputs feed successive stages
- ✅ Colored, user-friendly output
- ✅ Comprehensive validation
- ✅ Atomic teardown for cleanup

---

## Prerequisites

### Required Tools

1. **AWS CLI** (v2 recommended)
   ```bash
   aws --version
   # Should output: aws-cli/2.x.x or higher
   ```

2. **AWS SAM CLI** (v1.146.0+)
   ```bash
   sam --version
   # Should output: SAM CLI, version 1.146.0 or higher
   ```

3. **jq** (JSON processor)
   ```bash
   jq --version
   # Should output: jq-1.6 or higher
   ```

4. **Node.js** (v20+) and npm
   ```bash
   node --version  # v20.x.x or higher
   npm --version   # 10.x.x or higher
   ```

5. **Make** (GNU Make)
   ```bash
   make --version
   # Should output: GNU Make 4.x or higher
   ```

### Installation (Ubuntu/Debian)

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# SAM CLI
pip install aws-sam-cli

# jq
sudo apt-get install jq

# Node.js via asdf (recommended)
asdf install nodejs 20.11.0
asdf global nodejs 20.11.0
```

### AWS Configuration

1. **Configure AWS credentials**:
   ```bash
   aws configure
   ```

2. **Required AWS resources** (created once manually or via IaC):
   - Route53 Hosted Zone (if using custom domains)
   - ACM Certificate validation access

---

## Quick Start

### First-Time Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd guitar-collection

# 2. Initialize configuration files
make init

# 3. Edit configuration (see Configuration section)
nano .env.deploy
nano backend/samconfig.toml

# 4. Install dependencies
make install

# 5. Validate configuration
make validate

# 6. Deploy everything
make deploy-all
```

**That's it!** The Makefile will:
- Deploy backend via SAM
- Extract API URL, Cognito IDs, CloudFront domain
- Generate `.env` file automatically
- Deploy frontend infrastructure
- Build and deploy frontend

---

## How It Works

### Deployment Pipeline

```
┌─────────────────────┐
│  make deploy-all    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ Stage 1: Backend Deployment                        │
│  • Run: sam build && sam deploy                    │
│  • Extract CloudFormation outputs                  │
│  • Save to: .env.backend.outputs                   │
│  • Generate: .env (frontend environment vars)      │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ Stage 2: Frontend Infrastructure                   │
│  • Deploy: frontend-infrastructure.yaml             │
│  • Extract CloudFormation outputs                  │
│  • Save to: .env.frontend.outputs                  │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ Stage 3: Frontend Application                      │
│  • Build: npm run build (uses generated .env)      │
│  • Upload to S3                                     │
│  • Invalidate CloudFront cache                     │
└─────────────────────────────────────────────────────┘
```

### Generated Files

The Makefile creates these files automatically:

| File | Purpose | Source |
|------|---------|--------|
| `.env.backend.outputs` | Backend CloudFormation outputs | AWS CloudFormation API |
| `.env.frontend.outputs` | Frontend infrastructure outputs | AWS CloudFormation API |
| `.env` | Vite environment variables | Generated from backend outputs |

**Example `.env.backend.outputs`**:
```bash
# Auto-generated backend outputs (do not edit manually)
# Generated at: Fri Nov 15 10:30:00 PST 2025

BACKEND_API_URL=https://api.guitarhelp.click
BACKEND_USER_POOL_ID=us-east-1_abc123xyz
BACKEND_USER_POOL_CLIENT_ID=7k2jp5prpkubsbbujgkajsutf0
BACKEND_CLOUDFRONT_DOMAIN=d3jknizi2nswkn.cloudfront.net
BACKEND_IMAGES_BUCKET=guitarhelp-prod-123456789012
```

**Example `.env` (auto-generated for frontend)**:
```bash
# Auto-generated frontend environment variables
# Generated at: Fri Nov 15 10:30:01 PST 2025
# Source: Backend CloudFormation stack outputs

# API Configuration
VITE_API_URL=https://api.guitarhelp.click

# AWS Cognito Configuration (currently unused in code)
VITE_COGNITO_USER_POOL_ID=us-east-1_abc123xyz
VITE_COGNITO_CLIENT_ID=7k2jp5prpkubsbbujgkajsutf0
VITE_COGNITO_REGION=us-east-1

# CloudFront Domain for images (currently unused in code)
VITE_CLOUDFRONT_DOMAIN=d3jknizi2nswkn.cloudfront.net
```

---

## Step-by-Step Deployment

### Option 1: Full Automated Deployment

```bash
make deploy-all
```

This runs all three stages automatically.

### Option 2: Manual Step-by-Step

```bash
# Stage 1: Deploy backend
make deploy-backend
# ✅ Backend deployed
# ✅ .env.backend.outputs created
# ✅ .env generated

# Stage 2: Deploy frontend infrastructure
make deploy-frontend-infra
# ✅ S3 bucket created
# ✅ CloudFront distribution created
# ✅ .env.frontend.outputs created

# Stage 3: Deploy frontend application
make deploy-frontend
# ✅ Frontend built
# ✅ Uploaded to S3
# ✅ CloudFront cache invalidated
```

### Option 3: Frontend-Only Update

If you only changed frontend code:

```bash
make deploy-frontend
```

This rebuilds and redeploys the frontend without touching the backend.

---

## Configuration

### `.env.deploy` (Manual Configuration)

This file contains **deployment configuration** (not secrets, just resource identifiers).

```bash
# AWS Configuration
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1

# Domain Configuration
FRONTEND_DOMAIN=guitarhelp.click
API_DOMAIN=api.guitarhelp.click

# Stack and Bucket Names
BACKEND_STACK_NAME=guitarhelp
FRONTEND_BUCKET_PREFIX=guitarhelp-click-frontend

# Route53 (optional - leave empty if not using custom domains)
HOSTED_ZONE_ID=Z075275313OOZ8SQWX0VU

# Optional: Override default AWS profile
# AWS_PROFILE=default
```

### `backend/samconfig.toml` (SAM Configuration)

This file contains **SAM deployment parameters**.

```toml
version = 0.1

[default.global.parameters]
stack_name = "guitarhelp"
region = "us-east-1"

[default.build.parameters]
cached = true
parallel = true

[default.deploy.parameters]
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
resolve_s3 = true
parameter_overrides = "Environment=prod AllowedOrigin='https://guitarhelp.click' ApiDomainName='api.guitarhelp.click' ImagesDomainName='images.guitarhelp.click' HostedZoneId='Z075275313OOZ8SQWX0VU' BucketPrefix='guitarhelp' FrontendDomain='guitarhelp.click'"
s3_prefix = "guitarhelp"
tags = "Environment=prod Project=GuitarCollection"
```

**Important**: The `stack_name` in `samconfig.toml` must match `BACKEND_STACK_NAME` in `.env.deploy`.

---

## Deployment Targets

### Core Targets

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make init` | Initialize configuration from templates |
| `make install` | Install frontend and backend dependencies |
| `make validate` | Validate configuration and check for required tools |
| `make status` | Show current configuration and cached outputs |

### Deployment Targets

| Command | Description |
|---------|-------------|
| `make deploy-all` | Deploy everything (backend → infra → frontend) |
| `make deploy-backend` | Deploy backend + extract outputs + generate .env |
| `make deploy-frontend-infra` | Deploy S3 bucket + CloudFront distribution |
| `make deploy-frontend` | Build and deploy frontend code |

### Development Targets

| Command | Description |
|---------|-------------|
| `make dev` | Start frontend development server |
| `make build` | Build frontend for production |
| `make test` | Run tests |

### Utility Targets

| Command | Description | Example |
|---------|-------------|---------|
| `make logs` | Tail backend Lambda logs | `make logs FUNC=guitars` |
| `make clean` | Clean build artifacts and generated files | - |
| `make teardown` | Delete all deployed resources (DESTRUCTIVE) | - |

---

## Troubleshooting

### Common Issues

#### 1. **"jq not found"**

**Error**:
```
❌ jq not found - please install it (required for parsing CloudFormation outputs)
```

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq

# Fedora
sudo dnf install jq
```

#### 2. **"BACKEND_STACK_NAME not set"**

**Error**:
```
❌ Error: BACKEND_STACK_NAME not set in .env.deploy
```

**Solution**:
```bash
# Edit .env.deploy and set:
BACKEND_STACK_NAME=your-stack-name
```

#### 3. **Backend outputs not found**

**Error**:
```
❌ Error: .env.backend.outputs not found. Run 'make deploy-backend' first.
```

**Solution**:
```bash
# Deploy backend first to generate outputs
make deploy-backend
```

#### 4. **Frontend infrastructure not deployed**

**Error**:
```
❌ Error: .env.frontend.outputs not found.
   Run 'make deploy-frontend-infra' first to create frontend infrastructure.
```

**Solution**:
```bash
# Deploy frontend infrastructure
make deploy-frontend-infra
```

#### 5. **AWS CLI not configured**

**Error**:
```
Unable to locate credentials. You can configure credentials by running "aws configure".
```

**Solution**:
```bash
aws configure
# Enter:
#   AWS Access Key ID
#   AWS Secret Access Key
#   Default region name: us-east-1
#   Default output format: json
```

#### 6. **SAM build fails**

**Error**:
```
Error: PythonPipBuilder:ResolveDependencies - {error message}
```

**Solution**:
```bash
# Clean SAM cache and rebuild
cd backend
rm -rf .aws-sam
sam build --use-container
```

#### 7. **CloudFront invalidation takes too long**

**Behavior**: CloudFront invalidation can take 1-3 minutes.

**Solution**: This is normal. Wait for the invalidation to complete before testing:

```bash
# Check invalidation status
aws cloudfront list-invalidations --distribution-id <DIST_ID>
```

### Debugging

#### Check Configuration

```bash
# Show current configuration and cached outputs
make status
```

#### Validate Configuration

```bash
# Validate all configuration files and required tools
make validate
```

#### View Backend Logs

```bash
# Tail logs for specific Lambda function
make logs FUNC=guitars     # Guitars CRUD
make logs FUNC=auth        # Authentication
make logs FUNC=images      # Image uploads
make logs FUNC=specs       # AI spec extraction
```

#### Manual CloudFormation Outputs

```bash
# Query backend stack outputs manually
aws cloudformation describe-stacks \
  --stack-name guitarhelp \
  --query 'Stacks[0].Outputs' \
  --output table

# Query frontend stack outputs manually
aws cloudformation describe-stacks \
  --stack-name guitarhelp-click-frontend-frontend \
  --query 'Stacks[0].Outputs' \
  --output table
```

---

## Architecture

### AWS Resources Created

#### Backend Stack (`guitarhelp`)

| Resource Type | Resource | Purpose |
|---------------|----------|---------|
| **Lambda** | AuthHandler | User authentication (register, login, refresh) |
| **Lambda** | GuitarsHandler | Guitar CRUD operations |
| **Lambda** | ImagesHandler | Image upload (presigned URLs) |
| **Lambda** | UserHandler | User profile management |
| **Lambda** | SpecsHandler | AI-powered spec extraction (Bedrock Nova) |
| **Lambda** | DocumentsHandler | Document management |
| **Lambda** | ProvenanceHandler | Guitar provenance reports |
| **Lambda** | PublicGuitarHandler | Public random guitar endpoint |
| **DynamoDB** | GuitarsTable | Guitar data storage |
| **DynamoDB** | UsersTable | User profiles |
| **DynamoDB** | DocumentsTable | Documents metadata |
| **DynamoDB** | ProvenanceReportsTable | Provenance reports |
| **S3** | ImagesBucket | Guitar images and receipts |
| **CloudFront** | ImagesDistribution | CDN for images |
| **Cognito** | UserPool | User authentication |
| **API Gateway** | GuitarCollectionApi | HTTP API with JWT auth |
| **Route53** | ApiDnsRecord | DNS for api.guitarhelp.click |
| **ACM** | ApiCertificate | SSL certificate for custom domains |

#### Frontend Stack (`guitarhelp-click-frontend-frontend`)

| Resource Type | Resource | Purpose |
|---------------|----------|---------|
| **S3** | FrontendBucket | Static website hosting |
| **CloudFront** | FrontendDistribution | CDN for frontend assets |
| **Route53** | FrontendDnsRecord | DNS for guitarhelp.click |
| **ACM** | FrontendCertificate | SSL certificate |

### Data Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ HTTPS (guitarhelp.click)
       ▼
┌─────────────────────┐
│ CloudFront (Frontend)│
└──────┬──────────────┘
       │
       │ Origin: S3
       ▼
┌─────────────────┐
│  S3 Frontend    │  (React SPA, HTML/JS/CSS)
│  Bucket         │
└─────────────────┘

Browser makes API calls:

┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ HTTPS (api.guitarhelp.click)
       │ Authorization: Bearer <JWT>
       ▼
┌─────────────────────┐
│  API Gateway        │
│  (JWT Authorizer)   │
└──────┬──────────────┘
       │
       │ Invoke Lambda
       ▼
┌─────────────────┐       ┌─────────────────┐
│  Lambda         │──────▶│  DynamoDB       │
│  (Guitars, etc.)│       │  (Data)         │
└──────┬──────────┘       └─────────────────┘
       │
       │ S3 presigned URLs
       ▼
┌─────────────────┐       ┌─────────────────┐
│  S3 Images      │◀──────│  CloudFront     │
│  Bucket         │       │  (Images CDN)   │
└─────────────────┘       └─────────────────┘
```

---

## Cost Estimate

**Monthly AWS Costs** (low-medium traffic):

| Service | Estimated Cost |
|---------|---------------|
| Lambda | ~$5-10 (within free tier for low traffic) |
| DynamoDB | ~$0-5 (on-demand, low traffic) |
| S3 | ~$1-3 (storage + requests) |
| CloudFront | ~$1-10 (data transfer) |
| API Gateway | ~$3-10 (requests) |
| Cognito | ~$0 (within free tier for <50k MAU) |
| Route53 | ~$1 (hosted zone) |
| **Total** | **~$10-40/month** |

**Note**: Bedrock Nova Micro is extremely cheap (~$0.0001 per spec extraction).

---

## Security Considerations

1. **Environment Variables**:
   - `.env.deploy` contains resource IDs (not secrets) but should not be committed
   - `.env.backend.outputs` and `.env.frontend.outputs` are auto-generated and excluded from git
   - `.env` is auto-generated and excluded from git

2. **IAM Permissions**:
   - Lambda functions use least-privilege IAM roles
   - S3 buckets are private with CloudFront OAI access only

3. **Authentication**:
   - JWT-based authentication via Cognito
   - All protected endpoints require valid JWT token

4. **HTTPS**:
   - All traffic encrypted via ACM certificates
   - TLS 1.2 minimum

---

## Next Steps

After successful deployment:

1. **Test the Application**:
   ```bash
   # Visit your frontend
   open https://guitarhelp.click

   # Test API endpoint
   curl https://api.guitarhelp.click/public/guitars/random
   ```

2. **Monitor Logs**:
   ```bash
   # Watch backend logs
   make logs FUNC=guitars
   ```

3. **Make Changes**:
   - Edit frontend code in `src/`
   - Redeploy: `make deploy-frontend`

4. **Tear Down** (if needed):
   ```bash
   make teardown
   # Type 'DELETE' to confirm
   ```

---

## Support

- **Documentation**: See `README.md`, `CLAUDE.md`, `DEVELOPMENT.md`
- **API Contract**: See `backend/API_CONTRACT.md`
- **Issues**: Check CloudWatch logs via `make logs FUNC=<function-name>`

---

## License

[Your License Here]
