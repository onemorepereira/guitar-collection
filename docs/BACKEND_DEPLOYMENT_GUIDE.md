# Guitar Collection - Backend Deployment Guide

## Overview

This guide covers deploying the Guitar Collection backend infrastructure to AWS.

**Recommended**: Use the root Makefile (`make deploy-all`) which automates the entire deployment process including output extraction and frontend configuration generation.

### What Gets Deployed

- **API Gateway**: HTTP API with JWT authorization
- **Lambda Functions**: 8 functions (Auth, Guitars, Images, Specs, Documents, Provenance, User, Public)
- **DynamoDB**: 4 tables (Guitars, Users, Documents, Provenance Reports)
- **Cognito**: User Pool and App Client
- **S3 + CloudFront**: Image/document storage with CDN
- **Route53 + ACM**: Custom domain and SSL certificate (optional)

### Infrastructure Configuration

- **Runtime**: Node.js 22.x
- **Region**: us-east-1 (configurable)
- **Environment**: prod (default), dev, or staging
- **Billing**: Pay-per-request (no idle costs)

## Prerequisites

### Required Tools

1. **AWS CLI** (v2 recommended)
   ```bash
   aws --version  # Should be 2.x.x or higher
   aws configure  # Set up credentials
   ```

2. **SAM CLI** (v1.146.0+)
   ```bash
   sam --version  # Should be 1.146.0 or higher
   ```

3. **Node.js 22.x**
   ```bash
   node --version  # Should be 22.x.x
   ```

4. **jq** (JSON processor)
   ```bash
   jq --version  # Required for output parsing
   ```

5. **Make** (for root Makefile)
   ```bash
   make --version  # GNU Make 4.x or higher
   ```

### AWS Account Setup

1. **Configure credentials**:
   ```bash
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output (json)
   ```

2. **Verify access**:
   ```bash
   aws sts get-caller-identity
   ```

3. **Optional - Custom domain**:
   - Route53 Hosted Zone created
   - Domain registered and nameservers configured

## Deployment Methods

### Method 1: Root Makefile (Recommended)

The root Makefile provides the simplest deployment experience with automatic output extraction.

```bash
# From project root
cd guitar-collection

# Initialize configuration (first time only)
make init

# Edit .env.deploy with your values
vim .env.deploy

# Deploy backend only
make deploy-backend

# Or deploy everything (backend + frontend)
make deploy-all
```

**What this does**:
1. Builds and deploys backend via SAM
2. Extracts CloudFormation outputs to `.env.backend.outputs`
3. Generates `.env` file for frontend from backend outputs
4. Optionally deploys frontend infrastructure and code

**Configuration file**: `.env.deploy`
```bash
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
BACKEND_STACK_NAME=guitarhelp
FRONTEND_BUCKET_PREFIX=guitar-collection
FRONTEND_DOMAIN=guitarhelp.click
API_DOMAIN=api.guitarhelp.click
HOSTED_ZONE_ID=Z075275313OOZ8SQWX0VU
```

### Method 2: SAM CLI Directly

For more control over the deployment process.

#### First-Time Setup

```bash
cd backend
sam deploy --guided
```

Follow prompts:
- **Stack name**: `guitarhelp` (or your preferred name)
- **AWS Region**: `us-east-1` (or your preferred region)
- **Parameter Environment**: `prod` (or `dev`/`staging`)
- **Parameter AllowedOrigin**: `https://guitarhelp.click` (your frontend URL)
- **Parameter ApiDomainName**: `api.guitarhelp.click` (or leave empty)
- **Parameter ImagesDomainName**: `images.guitarhelp.click` (or leave empty)
- **Parameter HostedZoneId**: Route53 zone ID (or leave empty)
- **Parameter BucketPrefix**: `guitarhelp` (unique S3 bucket prefix)
- **Parameter FrontendDomain**: `guitarhelp.click` (for CSRF validation)
- **Confirm changes**: `Y`
- **Allow IAM role creation**: `Y`
- **Disable rollback**: `N`
- **Save to config file**: `Y`

This creates `samconfig.toml` with your settings.

#### Subsequent Deployments

```bash
cd backend
sam build && sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
```

### Method 3: Environment-Specific Deployment

Deploy to different environments using package.json scripts.

```bash
cd backend

# Deploy to dev (no custom domain, localhost CORS)
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to prod (requires confirmation in samconfig.toml)
npm run deploy:prod
```

**Configuration**: Edit `backend/samconfig.toml` for each environment.

## Installation Steps

### 1. Install Dependencies

```bash
# From backend directory
cd backend

# Install dev dependencies (SAM, testing tools)
npm install

# Install runtime dependencies (AWS SDK, Bedrock client, etc.)
cd src
npm install

cd ../..
```

### 2. Validate Template

```bash
cd backend
sam validate
```

This checks for syntax errors in `template.yaml`.

### 3. Build Application

```bash
sam build
```

This:
- Builds all 8 Lambda functions
- Resolves dependencies from `src/package.json`
- Prepares CloudFormation template
- Creates `.aws-sam/build/` directory

### 4. Deploy to AWS

Choose one of the methods above (Makefile recommended).

### 5. Verify Deployment

```bash
# View CloudFormation outputs
aws cloudformation describe-stacks \
  --stack-name guitarhelp \
  --query 'Stacks[0].Outputs' \
  --output table
```

Expected outputs:
- `ApiUrl` - API Gateway URL
- `CustomDomainUrl` - Custom domain URL (if configured)
- `UserPoolId` - Cognito User Pool ID
- `UserPoolClientId` - Cognito App Client ID
- `CloudFrontDomain` - Images CDN domain
- `ImagesBucketName` - S3 bucket name

## Custom Domain Setup (Optional)

### Prerequisites

- Domain registered with a registrar
- Access to domain DNS settings

### Step 1: Create Route53 Hosted Zone

```bash
cd backend

# Run setup script
./scripts/setup-domain.sh guitarhelp.click
```

This creates a hosted zone and displays nameservers.

### Step 2: Update Domain Registrar

Point your domain's nameservers to the Route53 nameservers provided by the script.

**DNS propagation takes 24-48 hours**.

### Step 3: Deploy with Custom Domain

Update `samconfig.toml` or `.env.deploy` with:
- `ApiDomainName`: `api.guitarhelp.click`
- `ImagesDomainName`: `images.guitarhelp.click`
- `HostedZoneId`: (from setup script output)

Then deploy:
```bash
make deploy-backend
```

### Step 4: Verify ACM Certificate

The ACM certificate is automatically created and validated via DNS.

Check status in AWS Console:
- ACM > Certificates > Look for your domain

**Note**: Certificate validation can take 30-60 minutes after DNS propagation.

## Monitoring

### View Logs

#### Using Root Makefile
```bash
# From project root
make logs FUNC=guitars
make logs FUNC=auth
make logs FUNC=specs
```

#### Using SAM CLI
```bash
cd backend

# Tail logs for specific function
sam logs -n GuitarsHandler --tail

# Filter for errors
sam logs -n AuthHandler --tail --filter ERROR

# From specific time
sam logs -n GuitarsHandler --start-time '1hour ago'
```

#### Using AWS CLI
```bash
# Tail logs
aws logs tail /aws/lambda/guitarhelp-guitars --follow

# Filter for errors
aws logs tail /aws/lambda/guitarhelp-auth --follow --filter-pattern ERROR
```

### CloudWatch Console

1. Open AWS Console
2. Navigate to CloudWatch > Log groups
3. Find `/aws/lambda/guitarhelp-*`
4. View log streams

### Metrics

CloudWatch automatically tracks:
- **Invocations**: Function call count
- **Duration**: Execution time
- **Errors**: Error count and rate
- **Throttles**: Concurrency limit hits

View in: CloudWatch > Metrics > Lambda

## Updating the Backend

### Code Changes

1. Make changes to handler code in `backend/src/handlers/`
2. Build and deploy:
   ```bash
   make deploy-backend
   ```

### Infrastructure Changes

1. Edit `backend/template.yaml`
2. Validate changes:
   ```bash
   sam validate
   ```
3. Deploy:
   ```bash
   make deploy-backend
   ```

### Environment Variables

Edit in `template.yaml` under:
- `Globals.Function.Environment.Variables` (all functions)
- Individual function `Environment.Variables` (specific function)

## Testing

### Unit Tests

```bash
cd backend
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Local Testing

```bash
# Start local API
sam local start-api --port 3001

# Test registration
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test User"}'
```

### Production Testing

```bash
# Get API URL from outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name guitarhelp \
  --query 'Stacks[0].Outputs[?OutputKey==`CustomDomainUrl`].OutputValue' \
  --output text)

# Test registration
curl -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test User"}'
```

## Troubleshooting

### Deployment Fails: "Stack already exists"

**Solution**: The stack is already deployed. Use update instead:
```bash
sam build && sam deploy --no-confirm-changeset
```

### Error: "Unable to locate credentials"

**Solution**: Configure AWS CLI:
```bash
aws configure
```

### Error: "Invalid template"

**Solution**: Validate template:
```bash
sam validate
```

Check for YAML syntax errors in `template.yaml`.

### Custom Domain Not Working

**Possible causes**:
1. DNS not propagated (wait 24-48 hours)
2. ACM certificate not validated
3. Hosted Zone nameservers not configured

**Check**:
```bash
# Check certificate status
aws acm list-certificates --region us-east-1

# Check Route53 records
aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID>

# Test DNS resolution
dig api.guitarhelp.click
nslookup api.guitarhelp.click
```

### Lambda Function Errors

**Check CloudWatch Logs**:
```bash
make logs FUNC=guitars
```

**Common issues**:
- Missing environment variables
- DynamoDB table doesn't exist
- IAM permission denied
- Timeout (increase in template.yaml)

### CORS Errors

**Solution**: Verify `AllowedOrigin` parameter matches frontend URL exactly:
```bash
aws cloudformation describe-stacks \
  --stack-name guitarhelp \
  --query 'Stacks[0].Parameters'
```

Update if needed in `samconfig.toml` and redeploy.

## Cleanup

### Using Root Makefile (Recommended)

```bash
make teardown
```

This automatically:
- Empties S3 buckets
- Deletes frontend stack
- Deletes backend stack

### Using SAM CLI

```bash
# Empty S3 bucket first
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name guitarhelp \
  --query 'Stacks[0].Outputs[?OutputKey==`ImagesBucketName`].OutputValue' \
  --output text)

aws s3 rm s3://$BUCKET --recursive

# Delete stack
cd backend
sam delete --stack-name guitarhelp --no-prompts
```

**Note**: Route53 hosted zones and ACM certificates may need manual cleanup.

## Cost Optimization

### Pay-Per-Request Pricing

All resources use pay-per-request billing:
- **Lambda**: $0.20 per 1M requests + $0.0000166667 per GB-second
- **DynamoDB**: $1.25 per million write requests, $0.25 per million read requests
- **API Gateway**: $1.00 per million requests
- **S3**: $0.023 per GB storage, $0.0004 per 1K PUT requests
- **CloudFront**: $0.085 per GB (first 10 TB)
- **Cognito**: Free for first 50K MAU

### Free Tier Benefits

- **Lambda**: 1M requests/month + 400K GB-seconds free
- **DynamoDB**: 25 GB storage + 200M requests/month free
- **API Gateway**: 1M requests/month free (12 months)
- **CloudFront**: 1 TB data transfer free (12 months)
- **ACM**: Free SSL certificates
- **Cognito**: 50K MAU free

**Estimated cost for personal use**: $5-10/month after free tier

### Cost Reduction Tips

1. **Enable S3 lifecycle rules** (already configured)
   - Deletes abandoned uploads after 1 day

2. **Use CloudFront PriceClass_100** (already configured)
   - Serves from US, Canada, Europe only

3. **Monitor usage** via AWS Cost Explorer

4. **Set up billing alerts**:
   ```bash
   aws budgets create-budget \
     --account-id $(aws sts get-caller-identity --query Account --output text) \
     --budget file://budget.json
   ```

## Security Checklist

- [ ] AWS credentials secured (never committed to git)
- [ ] Cognito password policy enforced
- [ ] CORS restricted to frontend domain
- [ ] S3 buckets private (CloudFront OAI only)
- [ ] DynamoDB encrypted with KMS
- [ ] HTTPS enforced on all endpoints
- [ ] Rate limiting on public endpoints
- [ ] CloudWatch logging enabled
- [ ] IAM roles follow least privilege
- [ ] Input validation on all Lambda functions

See [SECURITY.md](SECURITY.md) for comprehensive security documentation.

## Next Steps

After successful backend deployment:

1. **Extract CloudFormation outputs** (automatic with `make deploy-backend`)

2. **Deploy frontend** (if using root Makefile):
   ```bash
   make deploy-frontend-infra
   make deploy-frontend
   ```

3. **Test API endpoints**:
   - Registration: `POST /auth/register`
   - Login: `POST /auth/login`
   - Create guitar: `POST /guitars` (requires auth)

4. **Monitor logs** for any errors

5. **Set up CI/CD** (optional) using GitHub Actions or similar

## Additional Resources

- [Backend Overview](BACKEND_OVERVIEW.md) - Architecture and development guide
- [Backend Architecture](BACKEND_ARCHITECTURE.md) - Detailed architecture diagrams
- [SAM Implementation Guide](SAM_IMPLEMENTATION_GUIDE.md) - SAM/CloudFormation deep dive
- [API Contract](API_CONTRACT.md) - API specification
- [Security Guide](SECURITY.md) - Security architecture
- [Root Deployment Guide](DEPLOYMENT.md) - Full-stack deployment guide
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
