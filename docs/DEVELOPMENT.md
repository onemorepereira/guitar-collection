# Development Guide

Comprehensive guide for developers working on the Guitar Collection Manager.

## Prerequisites

Install these tools before starting:

### Required

- **Node.js 22+** - JavaScript runtime
  - Install via [nvm](https://github.com/nvm-sh/nvm): `nvm install 22 && nvm use 22`
  - Or [asdf](https://asdf-vm.com/): `asdf install nodejs 22.0.0`
- **AWS CLI** - AWS command-line tool ([installation](https://aws.amazon.com/cli/))
  - Configure: `aws configure` (requires AWS access key ID and secret)
- **AWS SAM CLI** - Serverless deployment tool ([installation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
  - macOS: `brew install aws-sam-cli`
  - Linux: `pip install aws-sam-cli`
- **Make** - Build automation (pre-installed on Linux/macOS)
  - Windows: Install via [chocolatey](https://chocolatey.org/) or WSL

### Optional but Recommended

- **Docker** - For local SAM testing (Lambda functions run in containers)
- **Git** - Version control (pre-installed on most systems)
- **Code Editor** - VS Code recommended with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense

## Initial Setup

### 1. Clone and Initialize

```bash
git clone <repository-url>
cd guitar-collection

# Initialize configuration from templates
make init
```

This creates:
- `.env.deploy` - Deployment configuration (from `.env.deploy.example`)
- `backend/samconfig.toml` - SAM deployment config (from `backend/samconfig.toml.example`)

Note: `.env` is NOT created by `make init`. It's auto-generated during backend deployment from CloudFormation outputs.

### 2. Configure AWS Resources

Edit `.env.deploy` with your AWS values:

```bash
vim .env.deploy
```

**Required values**:
- `AWS_ACCOUNT_ID` - Your AWS account number (12 digits)
- `AWS_REGION` - AWS region (default: `us-east-1`)
- `FRONTEND_BUCKET_PREFIX` - S3 bucket prefix for frontend (e.g., `my-app-frontend`)
- `BACKEND_STACK_NAME` - CloudFormation stack name (e.g., `my-app-backend-prod`)
- `CLOUDFRONT_DISTRIBUTION_ID` - Set after initial deploy (see below)

**How to get these values**:

```bash
# AWS Account ID
aws sts get-caller-identity --query Account --output text

# CloudFront Distribution ID (after deploying frontend infrastructure)
aws cloudformation describe-stacks \
  --stack-name <frontend-stack-name> \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text
```

### 3. Install Dependencies

```bash
make install
```

This installs:
- Frontend dependencies (React, TypeScript, Tailwind, etc.)
- Backend dependencies (AWS SDK, Bedrock client, etc.)

### 4. Install Git Hooks (Recommended)

```bash
make init-hooks
```

This installs a pre-commit hook that prevents accidentally committing:
- AWS credentials (access keys, secret keys)
- Sensitive files (`.env`, `samconfig.toml`)
- API keys and tokens
- AWS Account IDs

## Development Workflow

### Frontend Development

```bash
# Start dev server (http://localhost:5173)
make dev

# Build for production
make build
```

The dev server includes:
- Hot module replacement (HMR)
- Fast refresh for React
- TypeScript type checking
- Tailwind CSS compilation

### Backend Development

#### Local API Testing

```bash
cd backend

# Validate SAM template
sam validate

# Build Lambda functions
sam build

# Start local API (http://localhost:3001)
sam local start-api --port 3001

# Test specific function
sam local invoke GuitarsHandler --event events/list-guitars.json
```

#### Add Test Events

Create JSON files in `backend/events/` for testing:

```json
{
  "httpMethod": "GET",
  "path": "/guitars",
  "headers": {
    "Authorization": "Bearer <jwt-token>"
  }
}
```

### Code Quality

```bash
# Lint frontend
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## Build & Test

### Frontend Build

```bash
make build
```

Output: `dist/` directory with:
- Minified JavaScript bundles
- Optimized CSS
- Static assets (images, fonts)
- `index.html` entry point

### Backend Build

```bash
cd backend
sam build
```

Output: `.aws-sam/build/` directory with:
- Compiled Lambda functions
- Node modules for each function
- Layer dependencies

### Running Tests

```bash
# Frontend tests (if configured)
npm test

# Backend tests
cd backend
npm test

# Run all tests
make test
```

## Deployment

**IMPORTANT**: Always deploy in this order:

1. **Backend first** (creates DynamoDB, Cognito, API Gateway)
2. **Frontend second** (needs API endpoint from backend)

### Deploy Backend

```bash
make deploy-backend
```

This will:
1. Build Lambda functions with `sam build`
2. Package and upload to S3
3. Deploy via CloudFormation
4. Create/update:
   - DynamoDB tables (Guitars, Users)
   - Cognito User Pool
   - API Gateway HTTP API
   - Lambda functions (Auth, Guitars, Images, Specs, etc.)
   - IAM roles and policies
   - CloudWatch log groups

**First deployment takes 3-5 minutes**. Subsequent deploys are faster (~1-2 min).

**Save these outputs** (you'll need them for `.env.deploy`):
- API Gateway endpoint URL
- Cognito User Pool ID
- Cognito Client ID
- Images bucket name
- CloudFront domain

### Deploy Frontend

```bash
make deploy-frontend
```

This will:
1. Build React app with `npm run build`
2. Upload to S3 bucket
3. Set cache headers:
   - Assets: 1 year cache (`max-age=31536000`)
   - `index.html`: No cache (`no-cache`)
4. Invalidate CloudFront cache

**Takes ~2-3 minutes** depending on CloudFront invalidation.

### Deploy Everything

```bash
make deploy-all
```

Runs backend deployment, then frontend deployment in sequence.

### Deploy Frontend Infrastructure (First Time Only)

If you need to create the CloudFront distribution and S3 bucket:

```bash
./deploy-frontend-infra.sh
```

This creates:
- S3 bucket for hosting
- CloudFront distribution
- Proper bucket policies

Note the CloudFront Distribution ID from outputs and add to `.env.deploy`.

## Configuration Management

All configuration is managed through simple files:

### `.env.deploy` (Deployment Config)

**Purpose**: AWS resource IDs, domains, stack names
**Used by**: Makefile, deployment scripts
**Git status**: Ignored (contains your AWS account details)

```bash
AWS_ACCOUNT_ID=123456789012
FRONTEND_BUCKET_PREFIX=my-app-frontend
BACKEND_STACK_NAME=my-app-backend-prod
CLOUDFRONT_DISTRIBUTION_ID=EXAMPLEID123
# ... etc
```

### `backend/samconfig.toml` (SAM Config)

**Purpose**: SAM deployment parameters (region, stack name, capabilities)
**Used by**: `sam deploy`
**Git status**: Ignored (environment-specific)

Created from `backend/samconfig.toml.example` via `make init`.

### `.env` (Local Development)

**Purpose**: Frontend environment variables for local dev
**Used by**: Vite dev server
**Git status**: Ignored

```bash
VITE_API_URL=http://localhost:3001
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxx
# ... etc
```

## Useful Commands

### Check Configuration

```bash
make status
```

Shows:
- Whether config files exist
- AWS Account ID
- Frontend/API domains
- Backend stack name
- Git hook installation status

### Validate Configuration

```bash
make validate
```

Checks that all required values are set in `.env.deploy`.

### View Logs

```bash
# Tail logs for a specific function
make logs FUNC=guitars
make logs FUNC=auth
make logs FUNC=images

# Or use AWS CLI directly
aws logs tail /aws/lambda/my-app-backend-prod-guitars --follow
```

### Clean Build Artifacts

```bash
make clean
```

Removes:
- `dist/` (frontend build output)
- `backend/.aws-sam/` (SAM build cache)

## Project Structure

```
guitar-collection/
├── src/                        # Frontend source
│   ├── components/             # React components
│   │   ├── GuitarGallery.tsx   # Main gallery view
│   │   ├── GuitarDetail.tsx    # Individual guitar detail
│   │   ├── GuitarForm.tsx      # Add/edit form
│   │   ├── AutocompleteInput.tsx  # Smart autocomplete
│   │   └── ...
│   ├── services/               # API integration
│   │   ├── guitarService.ts    # Guitar CRUD operations
│   │   └── authService.ts      # Authentication
│   ├── context/                # React context
│   │   └── AuthContext.tsx     # Global auth state
│   ├── hooks/                  # Custom React hooks
│   │   └── useGuitarSuggestions.ts  # AI suggestions
│   ├── types/                  # TypeScript definitions
│   ├── data/                   # Static data
│   │   └── guitarKnowledge.json  # Specs database (350+ models)
│   └── App.tsx                 # Root component
├── backend/
│   ├── src/
│   │   ├── handlers/           # Lambda functions
│   │   │   ├── auth/           # Registration, login
│   │   │   ├── guitars/        # CRUD operations
│   │   │   ├── images/         # Upload/download
│   │   │   ├── specs/          # AI extraction
│   │   │   └── user/           # Profile management
│   │   ├── lib/                # Shared utilities
│   │   │   ├── dynamodb.js     # DynamoDB helpers
│   │   │   ├── s3.js           # S3 operations
│   │   │   ├── cognito.js      # Cognito utils
│   │   │   └── validation.js   # Input validation
│   │   └── config/
│   │       └── constants.js    # Configuration
│   ├── template.yaml           # SAM template (infrastructure)
│   ├── samconfig.toml          # SAM deployment config
│   └── events/                 # Test events for local testing
├── scripts/
│   ├── deploy-frontend.sh      # Frontend deployment
│   ├── deploy-backend.sh       # Backend deployment
│   ├── deploy-all.sh           # Deploy everything
│   └── logs.sh                 # CloudWatch log viewer
├── .env.deploy.example         # Template for AWS config
├── Makefile                    # Build automation
└── vite.config.ts              # Vite configuration
```

## Troubleshooting

### Build Failures

**Symptom**: `make build` fails with TypeScript errors

**Solutions**:
- Run `npm install` to ensure dependencies are up to date
- Check `tsconfig.json` for strict mode issues
- Fix type errors in source files

---

**Symptom**: `sam build` fails

**Solutions**:
- Verify Node.js 20.x is installed: `node --version`
- Check `backend/template.yaml` syntax: `sam validate`
- Try building in Docker: `sam build --use-container`

### Deployment Failures

**Symptom**: Backend deployment fails with IAM errors

**Solutions**:
- Verify AWS credentials: `aws sts get-caller-identity`
- Check IAM permissions (need CloudFormation, Lambda, DynamoDB, S3, etc.)
- Review CloudFormation events in AWS Console for specific error

---

**Symptom**: Frontend deployment succeeds but changes not visible

**Solutions**:
- Wait for CloudFront invalidation to complete (~2-3 minutes)
- Hard refresh browser (Ctrl+Shift+R)
- Check `index.html` cache headers: `curl -I https://your-domain.com`

---

**Symptom**: API returns 403 Forbidden

**Solutions**:
- Check JWT token is valid and not expired
- Verify Cognito User Pool ID and Client ID in frontend `.env`
- Check Lambda authorizer logs in CloudWatch

### Local Development Issues

**Symptom**: `make dev` starts but API calls fail

**Solutions**:
- Check `.env` has correct `VITE_API_URL` (should point to deployed API or local SAM)
- Verify CORS configuration in `backend/template.yaml`
- Check browser console for CORS errors

---

**Symptom**: `sam local start-api` fails to start

**Solutions**:
- Ensure Docker is running: `docker ps`
- Check port 3001 is not in use: `lsof -i :3001`
- Try a different port: `sam local start-api --port 3002`

### Database Issues

**Symptom**: DynamoDB query returns empty results

**Solutions**:
- Verify table exists: `aws dynamodb list-tables`
- Check userId matches authenticated user
- Review Lambda logs for error details
- Scan table in AWS Console to verify data exists

### S3/Image Issues

**Symptom**: Image uploads fail

**Solutions**:
- Check S3 bucket exists and is accessible
- Verify CORS configuration on images bucket
- Check IAM role has `s3:PutObject` permission
- Review CloudWatch logs for presigned URL generation errors

## Common Development Tasks

### Add a New Guitar Specification Field

1. **Update TypeScript types** (`src/types/guitar.ts`):
   ```typescript
   export interface Guitar {
     // ... existing fields
     newField?: string;
   }
   ```

2. **Update GuitarForm component** (`src/components/GuitarForm.tsx`):
   - Add input field
   - Add to form state
   - Include in submission payload

3. **Update backend validation** (optional, `backend/src/lib/validation.js`)

4. **No database migration needed** - DynamoDB is schemaless

### Add a New API Endpoint

1. **Create handler** in `backend/src/handlers/<category>/`:
   ```javascript
   export const handler = async (event) => {
     // Implementation
   };
   ```

2. **Add to SAM template** (`backend/template.yaml`):
   ```yaml
   NewFunction:
     Type: AWS::Serverless::Function
     Properties:
       Handler: src/handlers/category/handler.handler
       Events:
         ApiEvent:
           Type: HttpApi
           Properties:
             Path: /new-endpoint
             Method: GET
   ```

3. **Deploy**: `make deploy-backend`

4. **Update frontend service** (`src/services/`):
   ```typescript
   export const callNewEndpoint = async () => {
     const response = await fetch(`${API_URL}/new-endpoint`);
     return response.json();
   };
   ```

### Update Dependencies

```bash
# Frontend
npm update
npm audit fix

# Backend
cd backend/src
npm update
npm audit fix
```

## Performance Optimization

### Frontend

- **Code splitting**: Vite automatically splits vendor code
- **Image optimization**: Compress images before upload (not automated yet)
- **Lazy loading**: Use React.lazy() for route-based code splitting

### Backend

- **DynamoDB**: Use GSI for queries, avoid scans
- **Lambda**: Keep functions small, share code via layers
- **S3**: Enable CloudFront caching for images

### Monitoring

```bash
# CloudWatch Logs Insights query
aws logs insights query \
  --log-group-name /aws/lambda/my-app-backend-prod-guitars \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
```

## Security Best Practices

1. **Never commit**:
   - `.env`, `.env.local`, `.env.production`
   - `.env.deploy`
   - `backend/samconfig.toml`
   - Any file with AWS credentials or tokens

2. **Use git hooks**: `make init-hooks` installs pre-commit checks

3. **Rotate credentials**: Regularly rotate AWS access keys

4. **Review IAM policies**: Follow least-privilege principle

5. **Monitor CloudWatch**: Set up alarms for unusual activity

## Getting Help

- **AWS SAM**: https://docs.aws.amazon.com/serverless-application-model/
- **React**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **AWS DynamoDB**: https://docs.aws.amazon.com/dynamodb/
- **AWS Cognito**: https://docs.aws.amazon.com/cognito/

**Found a bug?** Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Error messages (sanitize any sensitive data)
- Environment (OS, Node version, AWS region)

---

**Ready to deploy?** Run `make deploy-all` and your app will be live in ~5 minutes!
