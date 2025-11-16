# Backend Architecture - Guitar Collection

## Overview
Serverless architecture using AWS services optimized for cost-effectiveness and scalability.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                              Users                                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      CloudFront (CDN)                                │
│  ┌──────────────────────┐              ┌──────────────────────┐    │
│  │  Origin 1: Frontend  │              │  Origin 2: Images    │    │
│  │  (S3 Static Website) │              │  (S3 Images Bucket)  │    │
│  └──────────────────────┘              └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (HTTP API)                            │
│                    /api/* routes                                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ↓
                    ┌───────────┴───────────┐
                    │   Lambda Authorizer   │
                    │   (Cognito Verify)    │
                    └───────────┬───────────┘
                                │
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         Lambda Functions                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Auth    │  │ Guitars  │  │ Images   │  │  User    │           │
│  │ Handler  │  │ Handler  │  │ Handler  │  │ Handler  │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ↓                       ↓
         ┌──────────────────┐    ┌──────────────────┐
         │   DynamoDB       │    │   Cognito        │
         │   - Guitars      │    │   User Pool      │
         │   - Notes        │    └──────────────────┘
         └──────────────────┘
                    │
                    ↓
         ┌──────────────────┐
         │   S3 Uploads     │
         │   Bucket         │
         └──────────────────┘
```

## AWS Services Breakdown

### 1. S3 (Simple Storage Service)
**Purpose**: Static asset hosting and image storage

**Buckets**:
- `{bucket-prefix}-frontend-{account-id}` - Frontend assets (HTML, JS, CSS)
  - Versioning: Enabled
  - Public access: Via CloudFront only (OAI)
  - Storage class: S3 Standard

- `{bucket-prefix}-{env}-{account-id}` - User-uploaded images and receipts
  - Versioning: Enabled
  - Public access: Via CloudFront only (OAI)
  - Storage class: S3 Intelligent-Tiering (auto-optimizes costs)
  - Lifecycle policy: Archive receipts to Glacier after 1 year

**Cost Optimization**:
- Use S3 Intelligent-Tiering for images (30% cost savings)
- Enable CloudFront compression to reduce transfer costs
- Set CORS policies for pre-signed URL uploads

### 2. CloudFront
**Purpose**: Content Delivery Network for low-latency global access

**Distributions**:
1. **Frontend Distribution**
   - Origin: S3 frontend bucket
   - Default root object: index.html
   - Custom error responses: 404 → /index.html (SPA routing)
   - Price class: PriceClass_100 (US, Canada, Europe - cheapest)
   - Caching: Cache-Control headers from S3
   - Compression: Enabled (gzip, brotli)

2. **Images Distribution** (can be same distribution, different behavior)
   - Origin: S3 images bucket
   - Path pattern: /images/*
   - Caching: Long TTL (1 year) with versioned filenames
   - Compression: Enabled
   - Custom headers: Immutable cache headers

**Cost Optimization**:
- Free tier: 1TB data transfer out/month
- Use PriceClass_100 (cheapest, covers major regions)
- Long cache TTLs reduce origin requests

### 3. API Gateway (HTTP API)
**Purpose**: API endpoint routing

**Configuration**:
- **Type**: HTTP API (70% cheaper than REST API)
- **Authorizer**: JWT authorizer (Cognito)
- **CORS**: Configured for frontend domain
- **Throttling**: 10,000 requests/second (default)
- **Stages**: dev, staging, prod

**Endpoints**:
```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password

GET    /user/profile
PUT    /user/profile
PUT    /user/name

GET    /guitars
POST   /guitars
GET    /guitars/{id}
PUT    /guitars/{id}
DELETE /guitars/{id}
GET    /guitars/brands

POST   /images/upload-url        # Get pre-signed URL
POST   /images/upload-complete   # Notify upload complete
```

**Cost Optimization**:
- HTTP API: $1.00 per million requests (vs $3.50 for REST API)
- Free tier: 1M requests/month for first 12 months

### 4. Lambda Functions
**Purpose**: Business logic execution

**Runtime**: Node.js 20.x (latest LTS as of Jan 2025)

**Functions**:

1. **auth-handler** (512 MB, 10s timeout)
   - POST /auth/register - Create Cognito user
   - POST /auth/login - Get tokens from Cognito
   - POST /auth/refresh - Refresh access token
   - POST /auth/forgot-password - Initiate password reset
   - POST /auth/reset-password - Complete password reset

2. **guitars-handler** (512 MB, 10s timeout)
   - GET /guitars - List user's guitars (with filtering)
   - POST /guitars - Create new guitar
   - GET /guitars/{id} - Get guitar details
   - PUT /guitars/{id} - Update guitar
   - DELETE /guitars/{id} - Delete guitar
   - GET /guitars/brands - Get unique brands

3. **images-handler** (512 MB, 10s timeout)
   - POST /images/upload-url - Generate pre-signed URL for S3
   - POST /images/upload-complete - Process uploaded image (create thumbnail)

4. **user-handler** (256 MB, 5s timeout)
   - GET /user/profile - Get user profile
   - PUT /user/profile - Update user profile
   - PUT /user/name - Update display name

5. **lambda-authorizer** (128 MB, 3s timeout)
   - Validates JWT tokens from Cognito
   - Caches authorization decisions (5 min TTL)

**Environment Variables**:
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `DYNAMODB_TABLE_GUITARS`
- `S3_BUCKET_IMAGES`
- `S3_BUCKET_UPLOADS`
- `CLOUDFRONT_DOMAIN`
- `NODE_ENV`

**Cost Optimization**:
- Right-sized memory (128-512 MB)
- Use provisioned concurrency only if needed (likely not)
- Free tier: 1M requests/month + 400,000 GB-seconds compute

### 5. DynamoDB
**Purpose**: NoSQL database for guitar data

**Tables**:

1. **Guitars Table**
   ```
   Table Name: {stack-name}-guitars-{env}

   Primary Key:
     - userId (String) - Partition Key
     - guitarId (String) - Sort Key

   Attributes:
     - userId (String)
     - guitarId (String)
     - brand (String)
     - model (String)
     - year (Number)
     - type (String)
     - bodyMaterial (String)
     - neckMaterial (String)
     - fretboardMaterial (String)
     - numberOfFrets (Number)
     - scaleLength (String)
     - pickupConfiguration (String)
     - color (String)
     - finish (String)
     - tuningMachines (String)
     - bridge (String)
     - nut (String)
     - electronics (String)
     - caseIncluded (Boolean)
     - countryOfOrigin (String)
     - detailedSpecs (Map)
     - images (List of Maps)
       - id (String)
       - url (String)
       - thumbnailUrl (String)
       - caption (String)
       - isPrimary (Boolean)
       - order (Number)
     - privateInfo (Map)
       - serialNumber (String)
       - purchaseDate (String)
       - originalRetailPrice (Number)
       - purchasePrice (Number)
       - purchaseLocation (String)
       - currentValue (Number)
       - currency (String)
       - receiptUrl (String)
       - insuranceInfo (String)
     - notes (List of Maps)
       - id (String)
       - content (String)
       - createdAt (String)
     - createdAt (String)
     - updatedAt (String)

   GSI (Global Secondary Index):
     - GSI1: brand-userId-index
       PK: brand
       SK: userId
       Purpose: Query guitars by brand

   Billing Mode: On-Demand (pay per request)
   ```

2. **Users Table** (Metadata - Cognito handles auth)
   ```
   Table Name: {stack-name}-users-{env}

   Primary Key:
     - userId (String) - Partition Key

   Attributes:
     - userId (String) - Cognito sub
     - email (String)
     - name (String)
     - createdAt (String)
     - updatedAt (String)
     - preferences (Map)

   Billing Mode: On-Demand
   ```

**Cost Optimization**:
- On-Demand pricing: $1.25 per million write requests, $0.25 per million read requests
- No provisioned capacity needed
- Free tier: 25 GB storage, 25 write units, 25 read units

### 6. Cognito User Pool
**Purpose**: User authentication and management

**Configuration**:
```
User Pool Name: {stack-name}-users-{env}

Sign-in Options:
  - Email (required)

Password Policy:
  - Minimum length: 8 characters
  - Require uppercase: Yes
  - Require lowercase: Yes
  - Require numbers: Yes
  - Require special characters: Yes

MFA: Optional (user choice)

Account Recovery: Email only

Attributes:
  - email (required, mutable)
  - name (required, mutable)
  - sub (immutable, used as userId)

App Client:
  - Name: {stack-name}-web
  - Token expiration:
    - Access token: 1 hour
    - ID token: 1 hour
    - Refresh token: 30 days
  - Auth flows: USER_PASSWORD_AUTH, REFRESH_TOKEN_AUTH

Advanced Security:
  - Adaptive authentication: Enabled (free)
  - Compromised credentials: Enabled (free)
```

**Cost Optimization**:
- Free tier: 50,000 MAU (Monthly Active Users)
- Pay only above 50K users: $0.00550 per MAU

### 7. IAM Roles & Policies

**Lambda Execution Role** (guitars-handler, images-handler, user-handler):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/{stack-name}-guitars-*",
        "arn:aws:dynamodb:*:*:table/{stack-name}-guitars-*/index/*",
        "arn:aws:dynamodb:*:*:table/{stack-name}-users-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::{bucket-prefix}-images-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::{bucket-prefix}-uploads-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

**Lambda Authorizer Role**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:GetUser"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## Authentication Flow

### Registration
```
1. User submits registration form (email, password, name)
2. Frontend → POST /auth/register
3. Lambda creates Cognito user
4. Cognito sends verification email
5. User clicks verification link
6. Lambda creates user record in DynamoDB
7. Return success
```

### Login
```
1. User submits login form (email, password)
2. Frontend → POST /auth/login
3. Lambda calls Cognito InitiateAuth
4. Cognito validates credentials
5. Return tokens: { accessToken, idToken, refreshToken }
6. Frontend stores tokens in memory (NOT localStorage)
7. Use accessToken in Authorization header for API calls
```

### Protected API Call
```
1. Frontend → GET /guitars (with Authorization: Bearer <accessToken>)
2. API Gateway invokes Lambda Authorizer
3. Authorizer validates JWT signature with Cognito public keys
4. Authorizer returns IAM policy (allow/deny) + context (userId)
5. If allowed, route to Lambda handler with userId in context
6. Lambda queries DynamoDB filtered by userId
7. Return response
```

### Token Refresh
```
1. Access token expires (1 hour)
2. Frontend → POST /auth/refresh (with refreshToken)
3. Lambda calls Cognito InitiateAuth (REFRESH_TOKEN_AUTH)
4. Cognito validates refresh token
5. Return new accessToken and idToken
6. Frontend updates tokens in memory
```

## S3 Pre-Signed URL Upload Flow

### Image Upload Process
```
1. User selects image in frontend
2. Frontend → POST /images/upload-url
   Body: { fileName: "guitar.jpg", fileType: "image/jpeg" }
3. Lambda generates pre-signed PUT URL (5 min expiry)
   - Key: uploads/{userId}/{uuid}-{fileName}
   - Content-Type: image/jpeg
   - Max size: 10 MB (enforced via condition)
4. Return { uploadUrl, imageKey }
5. Frontend uploads directly to S3 using uploadUrl (PUT request)
6. On success, Frontend → POST /images/upload-complete
   Body: { imageKey }
7. Lambda triggers image processing:
   - Generate thumbnail (400x400)
   - Move from uploads/ to images/
   - Store URLs in DynamoDB
8. Return { imageUrl, thumbnailUrl }
```

**Benefits**:
- No image data through Lambda (bypasses 6MB payload limit)
- Direct S3 upload (faster, cheaper)
- Pre-signed URL enforces security (time-limited, user-specific)

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "GUITAR_NOT_FOUND",
    "message": "Guitar not found or unauthorized",
    "statusCode": 404
  }
}
```

### Standard Error Codes
- `AUTH_INVALID_CREDENTIALS` - Wrong email/password
- `AUTH_USER_EXISTS` - Email already registered
- `AUTH_TOKEN_EXPIRED` - Access token expired
- `AUTH_UNAUTHORIZED` - Missing or invalid token
- `GUITAR_NOT_FOUND` - Guitar doesn't exist or unauthorized
- `GUITAR_VALIDATION_ERROR` - Invalid input data
- `IMAGE_UPLOAD_FAILED` - Image upload error
- `INTERNAL_ERROR` - Server error

## Database Schema (DynamoDB)

### Access Patterns

1. **Get all guitars for user**
   - Query: userId = :userId
   - Filter: Optional filters (brand, type, year range)

2. **Get single guitar**
   - GetItem: userId = :userId AND guitarId = :guitarId

3. **Create guitar**
   - PutItem: New item with userId and generated guitarId

4. **Update guitar**
   - UpdateItem: userId = :userId AND guitarId = :guitarId
   - Condition: userId matches (prevent unauthorized updates)

5. **Delete guitar**
   - DeleteItem: userId = :userId AND guitarId = :guitarId
   - Condition: userId matches

6. **Get brands for user**
   - Query: userId = :userId
   - Projection: brand only
   - Post-process: Get unique brands

### Single Table Design Consideration
Currently using two tables (Guitars, Users). Could be consolidated to single table design:

```
PK: USER#{userId}  SK: META#           → User metadata
PK: USER#{userId}  SK: GUITAR#{id}    → Guitar item
PK: BRAND#{brand}  SK: USER#{userId}  → GSI for brand queries
```

**Recommendation**: Start with separate tables for simplicity. Migrate to single table if needed for performance optimization.

## Deployment Strategy

### Infrastructure as Code (IaC)
**Recommended**: AWS SAM (Serverless Application Model) or Terraform

**AWS SAM Benefits**:
- Native AWS integration
- Local testing with sam local
- Simple YAML/JSON templates
- Built-in Lambda deployment

**Project Structure**:
```
backend/
├── sam-template.yaml          # SAM template
├── src/
│   ├── handlers/
│   │   ├── auth.js
│   │   ├── guitars.js
│   │   ├── images.js
│   │   ├── user.js
│   │   └── authorizer.js
│   ├── lib/
│   │   ├── cognito.js
│   │   ├── dynamodb.js
│   │   ├── s3.js
│   │   └── utils.js
│   └── config/
│       └── constants.js
├── tests/
├── package.json
└── .env.example
```

### CI/CD Pipeline
```
1. Code commit to GitHub
2. GitHub Actions workflow triggers
3. Run tests (unit + integration)
4. Build Lambda packages
5. Deploy to dev environment (SAM/CloudFormation)
6. Run E2E tests against dev
7. Manual approval for prod
8. Deploy to prod
9. Smoke tests
```

### Environment Management
- **dev**: Development environment (auto-deploy on commits)
- **staging**: Pre-production testing
- **prod**: Production (manual approval)

Each environment has separate:
- API Gateway stages
- Lambda versions
- DynamoDB tables
- S3 buckets
- Cognito user pools
- CloudFront distributions

## Security Best Practices

### 1. API Security
- JWT validation on all protected routes
- Rate limiting via API Gateway (10,000 req/sec default)
- CORS configured for frontend domain only
- Input validation on all endpoints (joi/zod)

### 2. Data Security
- DynamoDB encryption at rest (enabled by default)
- S3 encryption at rest (SSE-S3)
- CloudFront HTTPS only (redirect HTTP → HTTPS)
- Pre-signed URLs time-limited (5 min)

### 3. Authentication Security
- Cognito adaptive authentication (blocks suspicious logins)
- Password policy enforced (8+ chars, mixed case, numbers, symbols)
- Refresh token rotation
- Token stored in memory only (not localStorage)

### 4. Authorization
- Partition key isolation (userId in PK ensures user can't access others' data)
- Condition expressions on writes (verify userId)
- Lambda authorizer caches decisions (reduces Cognito calls)

### 5. Network Security
- S3 buckets private (CloudFront OAI only)
- Lambda in private subnet (optional, if VPC needed)
- Security groups (if using RDS/VPC)

## Cost Estimates (Monthly)

### Assumptions
- 1,000 active users
- Each user: 100 API calls/month
- 10 guitars per user average
- 5 images per guitar
- Total guitars: 10,000
- Total images: 50,000

### Service Costs
- **API Gateway HTTP API**: 100K requests = FREE (within 1M free tier)
- **Lambda**: 100K invocations, avg 512MB, 500ms = FREE (within free tier)
- **DynamoDB**:
  - Storage: 1 GB = FREE (within 25 GB free tier)
  - Reads: 100K = $0.025
  - Writes: 20K = $0.025
  - Total: ~$0.05/month
- **S3**:
  - Frontend: 1 GB = $0.023
  - Images: 50,000 images @ 2MB avg = 100 GB = $2.30 (Intelligent-Tiering)
  - Total: ~$2.33/month
- **CloudFront**:
  - Data transfer: 10 GB/month = FREE (within 1TB free tier)
  - Requests: 100K = FREE
- **Cognito**: 1,000 users = FREE (within 50K MAU free tier)

**Total Estimated Cost: ~$2.38/month** (effectively free with free tiers)

### At Scale (10,000 active users)
- API Gateway: 1M requests = $1.00
- Lambda: 1M invocations = ~$0.20
- DynamoDB: ~$5.00
- S3: ~$25.00
- CloudFront: ~$8.00
- Cognito: FREE (within 50K MAU)

**Total at 10K users: ~$39/month**

## Next Steps

1. **Phase 1: Core Infrastructure**
   - Set up AWS account and IAM users
   - Create S3 buckets
   - Configure CloudFront distributions
   - Set up Cognito User Pool

2. **Phase 2: API Development**
   - Create SAM template
   - Implement Lambda handlers
   - Configure API Gateway
   - Set up DynamoDB tables

3. **Phase 3: Frontend Integration**
   - Update frontend to use real API
   - Remove mock services
   - Implement token management
   - Add error handling

4. **Phase 4: Testing & Deployment**
   - Write unit tests
   - Integration tests
   - Set up CI/CD
   - Deploy to dev environment

5. **Phase 5: Production Launch**
   - Performance testing
   - Security audit
   - Deploy to prod
   - Monitor and optimize

## Monitoring & Observability

### CloudWatch Metrics
- Lambda invocations, errors, duration
- API Gateway 4xx/5xx errors, latency
- DynamoDB consumed capacity
- CloudFront cache hit rate

### CloudWatch Alarms
- Lambda error rate > 1%
- API Gateway 5xx errors > 0.1%
- DynamoDB throttling
- S3 bucket unauthorized access

### Cost Monitoring
- AWS Cost Explorer
- Budgets: Alert at $50/month
- Cost anomaly detection

### Logging
- Lambda logs to CloudWatch Logs
- Structured logging (JSON format)
- Log retention: 7 days (dev), 30 days (prod)
- Centralized logging with log groups

## Future Enhancements

### Performance
- DynamoDB DAX (caching layer) if needed
- Lambda provisioned concurrency for high traffic
- CloudFront caching optimization

### Features
- Real-time updates (WebSockets via API Gateway)
- Image recognition (AWS Rekognition) for auto-tagging
- Full-text search (OpenSearch or Algolia)
- Backup automation (DynamoDB PITR)

### Scale
- Multi-region deployment
- Global DynamoDB tables
- CloudFront Lambda@Edge for personalization
- CDN optimization

---

**Document Version**: 1.0
**Last Updated**: 2025-01-13
**Author**: Architecture Team
