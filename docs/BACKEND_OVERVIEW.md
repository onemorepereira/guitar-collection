# Guitar Collection Backend

AWS SAM serverless backend for the Guitar Collection application.

## Architecture

- **API Gateway**: HTTP API with JWT authorization via Cognito
- **Lambda Functions**: Node.js 22.x functions for all backend operations
- **DynamoDB**: Four tables (Guitars, Users, Documents, Provenance Reports) with GSI for queries
- **Cognito**: User authentication and management
- **S3 + CloudFront**: Image and document storage with CDN delivery
- **Amazon Bedrock**: AI-powered spec extraction using Nova models

## Prerequisites

- AWS CLI configured with appropriate credentials
- SAM CLI installed (v1.146.0+): `brew install aws-sam-cli` or `pip install aws-sam-cli`
- Node.js 22.x or later
- Docker (for local testing)
- jq (for output parsing): `apt install jq` or `brew install jq`

## Project Structure

```
backend/
├── template.yaml         # SAM infrastructure template
├── samconfig.toml        # SAM deployment configuration
├── package.json          # Dev dependencies and scripts
├── src/
│   ├── handlers/         # Lambda function handlers
│   │   ├── auth/         # Authentication (register, login, refresh)
│   │   ├── authorizer/   # JWT authorizer for API Gateway
│   │   ├── guitars/      # Guitar CRUD operations
│   │   ├── images/       # Image upload (presigned URLs)
│   │   ├── specs/        # AI spec extraction (Bedrock Nova)
│   │   ├── documents/    # Document management
│   │   ├── provenance/   # Guitar provenance reports
│   │   └── user/         # User profile management
│   ├── lib/              # Shared utilities
│   │   ├── cognito.js    # Cognito authentication helpers
│   │   ├── dynamodb.js   # DynamoDB query/scan helpers
│   │   ├── s3.js         # S3 upload/download helpers
│   │   ├── validation.js # Input validation schemas
│   │   ├── response.js   # HTTP response formatting
│   │   └── errors.js     # Custom error classes
│   ├── config/
│   │   └── constants.js  # Application constants
│   ├── package.json      # Runtime dependencies (AWS SDK, etc.)
│   └── Makefile          # Build targets for SAM
├── events/               # Sample event JSON for local testing
└── scripts/              # Deployment and utility scripts
```

## Lambda Functions

The backend consists of 8 Lambda functions:

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| **AuthHandler** | User registration, login, password reset | No |
| **CognitoAuthorizer** | JWT token validation for API Gateway | N/A |
| **GuitarsHandler** | CRUD operations on guitars | Yes |
| **PublicGuitarHandler** | Random guitar endpoint (community feature) | No |
| **ImagesHandler** | Generate presigned S3 upload URLs | Yes |
| **UserHandler** | User profile management | Yes |
| **SpecsHandler** | AI-powered spec extraction from PDFs/text | Yes |
| **DocumentsHandler** | Document storage and retrieval | Yes |
| **ProvenanceHandler** | Generate authenticity reports | Yes |

## Local Development

### Install Dependencies

```bash
cd backend
npm install        # Dev dependencies (SAM, testing tools)
cd src
npm install        # Runtime dependencies (AWS SDK, Bedrock, etc.)
cd ../..
```

### Validate Template

```bash
cd backend
sam validate
```

### Build Application

```bash
sam build
```

This builds all Lambda functions and prepares the CloudFormation template.

### Run API Locally

```bash
# Start local API on port 3001
sam local start-api --port 3001

# With environment variables
sam local start-api --port 3001 --env-vars env.json
```

**Note**: Local development requires Docker to be running.

### Test Individual Functions

```bash
# Test auth registration
sam local invoke AuthHandler --event events/register.json

# Test guitar creation
sam local invoke GuitarsHandler --event events/create-guitar.json

# Test guitar listing
sam local invoke GuitarsHandler --event events/list-guitars.json
```

### Debug with VS Code

1. Start SAM with debug port:
```bash
sam local start-api --debug-port 9229
```

2. Use VS Code launch configuration:
```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to SAM CLI",
  "port": 9229
}
```

## Deployment

### Using the Root Makefile (Recommended)

From the project root:

```bash
# Deploy backend only
make deploy-backend

# Deploy everything (backend + frontend)
make deploy-all
```

This automatically extracts CloudFormation outputs and generates frontend configuration.

### Using SAM CLI Directly

#### First-Time Setup

```bash
cd backend
sam deploy --guided
```

Follow prompts to configure:
- Stack name (e.g., `guitarhelp`)
- AWS Region (e.g., `us-east-1`)
- Environment (`prod`, `dev`, or `staging`)
- Allowed origin for CORS (your frontend URL)
- Custom domain names (optional)

#### Deploy to Specific Environments

```bash
# Deploy to dev
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to prod (requires confirmation)
npm run deploy:prod
```

### Using Scripts

```bash
# Deploy with script
./scripts/deploy.sh prod

# Set up local environment from deployed stack
./scripts/local-setup.sh
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Coverage Report

```bash
npm run test:coverage
```

## API Endpoints

### Authentication (Public)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user (returns JWT tokens)
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Initiate password reset
- `POST /auth/reset-password` - Complete password reset

### Guitars (Authenticated)
- `GET /guitars` - List user's guitars (supports filtering)
- `POST /guitars` - Create new guitar
- `GET /guitars/{id}` - Get guitar details
- `PUT /guitars/{id}` - Update guitar
- `DELETE /guitars/{id}` - Delete guitar (including images)
- `GET /guitars/brands` - Get available brands/types/conditions

### Images (Authenticated)
- `POST /images/upload-url` - Get presigned S3 upload URL
- `POST /images/upload-complete` - Confirm upload and process image

### Documents (Authenticated)
- `GET /documents` - List user's documents
- `POST /documents` - Upload document metadata
- `GET /documents/{id}` - Get document details
- `PUT /documents/{id}` - Update document
- `DELETE /documents/{id}` - Delete document
- `POST /guitars/{guitarId}/documents/{documentId}` - Attach document to guitar
- `DELETE /guitars/{guitarId}/documents/{documentId}` - Detach document

### Specs Extraction (Authenticated)
- `POST /specs/extract` - Extract guitar specs from PDF or text (AI-powered)

### Provenance (Authenticated)
- `POST /guitars/{guitarId}/provenance` - Generate provenance report
- `GET /guitars/{guitarId}/provenance` - List provenance reports
- `DELETE /guitars/{guitarId}/provenance/{reportId}` - Delete report

### User Profile (Authenticated)
- `GET /user/profile` - Get user profile
- `PUT /user/profile` - Update user profile
- `PUT /user/name` - Update display name

### Public (No Auth)
- `GET /public/guitars/random` - Get random guitar from community

## Environment Variables

Lambda functions receive these environment variables from the SAM template:

- `GUITARS_TABLE_NAME` - DynamoDB guitars table
- `USERS_TABLE_NAME` - DynamoDB users table
- `DOCUMENTS_TABLE_NAME` - DynamoDB documents table
- `PROVENANCE_REPORTS_TABLE_NAME` - DynamoDB provenance reports table
- `USER_POOL_ID` - Cognito User Pool ID
- `USER_POOL_CLIENT_ID` - Cognito App Client ID
- `IMAGES_BUCKET` - S3 bucket for images
- `CLOUDFRONT_DOMAIN` - CloudFront distribution domain
- `ALLOWED_ORIGIN` - CORS allowed origin
- `FRONTEND_DOMAIN` - Frontend domain for CSRF validation

## Monitoring

### View Logs (Using Root Makefile)

From project root:
```bash
# Tail guitars handler logs
make logs FUNC=guitars

# Tail auth handler logs
make logs FUNC=auth

# Tail specs handler logs
make logs FUNC=specs
```

### View Logs (Using SAM CLI)

```bash
# Tail specific function logs
sam logs -n GuitarsHandler --tail

# Filter for errors only
sam logs -n GuitarsHandler --tail --filter ERROR

# Tail from specific start time
sam logs -n GuitarsHandler --start-time '10min ago'
```

### CloudWatch

All Lambda functions log to CloudWatch. View in AWS Console:
- CloudWatch > Log groups > `/aws/lambda/<stack-name>-<function-name>`

## DynamoDB Tables

### GuitarsTable
- **Partition Key**: `userId`
- **Sort Key**: `guitarId`
- **GSI**: `brand-userId-index` (for filtering by brand)
- **Billing**: Pay-per-request
- **Encryption**: AWS KMS
- **Stream**: NEW_AND_OLD_IMAGES (for change tracking)
- **Backup**: Point-in-time recovery (prod only)

### UsersTable
- **Partition Key**: `userId`
- **Billing**: Pay-per-request
- **Encryption**: AWS KMS

### DocumentsTable
- **Partition Key**: `userId`
- **Sort Key**: `documentId`
- **Billing**: Pay-per-request
- **Encryption**: AWS KMS

### ProvenanceReportsTable
- **Partition Key**: `userId`
- **Sort Key**: `reportId`
- **GSI**: `GuitarIdIndex` (guitarId + reportId)
- **Billing**: Pay-per-request
- **Encryption**: AWS KMS

## Cost Optimization

- **DynamoDB**: Pay-per-request billing (no idle costs)
- **Lambda**: Free tier covers most development usage (1M requests/month)
- **S3**: Lifecycle rule deletes abandoned uploads after 1 day
- **CloudFront**: PriceClass_100 (US, Canada, Europe only)
- **Cognito**: Free for first 50K monthly active users
- **Bedrock Nova**: $0.035 per 1M input tokens, $0.14 per 1M output tokens

**Estimated monthly cost for personal use**: $5-10/month

## Cleanup

```bash
# Using root Makefile (recommended)
make teardown

# Or using SAM CLI directly
cd backend
sam delete --stack-name <your-stack-name> --no-prompts
```

**Note**: The Makefile `teardown` command automatically empties S3 buckets before deletion.

## Troubleshooting

### SAM build fails
- Ensure Node.js 22.x is installed: `node --version`
- Check `package.json` dependencies are valid
- Try `sam build --use-container` to build in Docker
- Clear cache: `rm -rf .aws-sam` and rebuild

### Local API not working
- Verify Docker is running: `docker ps`
- Check port 3001 is not in use: `lsof -i :3001`
- Ensure template is valid: `sam validate`
- Check Docker has sufficient resources allocated

### Deployment fails
- Verify AWS credentials: `aws sts get-caller-identity`
- Check IAM permissions (CloudFormation, Lambda, DynamoDB, etc.)
- View CloudFormation events in AWS Console for details
- Check for resource limit quotas in your AWS account

### Function returns 500 error
- Check CloudWatch Logs for stack traces
- Verify environment variables are set correctly
- Test function locally: `sam local invoke <FunctionName> --event events/<event>.json`
- Check DynamoDB table names match environment variables

### CORS errors
- Verify `AllowedOrigin` parameter matches frontend URL exactly
- Check frontend sends `X-Requested-With` header
- Ensure protocol matches (http vs https)

### Bedrock errors
- Verify IAM role has `bedrock:InvokeModel` permission
- Check Bedrock model IDs are correct
- Ensure you're in a region where Bedrock is available
- Check CloudWatch Logs for specific error messages

## Security

See [SECURITY.md](SECURITY.md) for comprehensive security analysis, threat model, and best practices.

**Key security features**:
- JWT authentication via Cognito
- KMS encryption for DynamoDB
- Private S3 buckets with CloudFront OAI
- CORS restricted to configured origin
- CSRF protection via custom headers
- Input validation on all endpoints
- Rate limiting on public endpoints

## Additional Resources

- [API Contract](API_CONTRACT.md) - Data models and API specification
- [Backend Architecture](BACKEND_ARCHITECTURE.md) - Detailed architecture diagrams
- [SAM Implementation Guide](SAM_IMPLEMENTATION_GUIDE.md) - SAM/CloudFormation deep dive
- [Security Guide](SECURITY.md) - Security architecture and compliance
- [Deployment Guide](BACKEND_DEPLOYMENT_GUIDE.md) - Step-by-step deployment instructions
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [SAM CLI Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
- [API Gateway HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html)
