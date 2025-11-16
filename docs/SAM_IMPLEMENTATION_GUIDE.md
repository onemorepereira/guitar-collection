# SAM CLI Implementation Guide - Guitar Collection

## Overview
This guide provides detailed instructions for implementing the backend using AWS SAM (Serverless Application Model) CLI.

## Prerequisites

### Required Tools
```bash
# Install AWS SAM CLI
brew install aws-sam-cli  # macOS
# or
pip install aws-sam-cli   # Python

# Verify installation
sam --version  # Should be 1.100.0 or later

# Install AWS CLI
brew install awscli
aws --version  # Should be 2.x

# Configure AWS credentials
aws configure
```

### Required AWS Permissions
Your IAM user needs:
- CloudFormation (full)
- Lambda (full)
- API Gateway (full)
- S3 (full)
- DynamoDB (full)
- Cognito (full)
- IAM (CreateRole, PutRolePolicy)
- CloudWatch Logs (full)

## Project Structure

```
{project-name}/
├── frontend/                    # React app (existing)
├── backend/                     # SAM project
│   ├── template.yaml           # SAM template (infrastructure)
│   ├── samconfig.toml          # SAM deployment config
│   ├── package.json            # Node.js dependencies
│   ├── .env.dev                # Dev environment vars
│   ├── .env.prod               # Prod environment vars
│   ├── src/
│   │   ├── handlers/           # Lambda function handlers
│   │   │   ├── auth/
│   │   │   │   ├── index.js           # Auth handler entry
│   │   │   │   ├── register.js
│   │   │   │   ├── login.js
│   │   │   │   ├── refresh.js
│   │   │   │   └── reset-password.js
│   │   │   ├── guitars/
│   │   │   │   ├── index.js           # Guitars handler entry
│   │   │   │   ├── list.js
│   │   │   │   ├── create.js
│   │   │   │   ├── get.js
│   │   │   │   ├── update.js
│   │   │   │   ├── delete.js
│   │   │   │   └── brands.js
│   │   │   ├── images/
│   │   │   │   ├── index.js           # Images handler entry
│   │   │   │   ├── upload-url.js
│   │   │   │   └── process.js
│   │   │   ├── user/
│   │   │   │   ├── index.js           # User handler entry
│   │   │   │   ├── profile.js
│   │   │   │   └── update-name.js
│   │   │   └── authorizer/
│   │   │       └── index.js           # JWT authorizer
│   │   ├── lib/                # Shared libraries
│   │   │   ├── cognito.js
│   │   │   ├── dynamodb.js
│   │   │   ├── s3.js
│   │   │   ├── validation.js
│   │   │   ├── response.js
│   │   │   └── errors.js
│   │   ├── config/
│   │   │   └── constants.js
│   │   └── types/              # TypeScript types (if using TS)
│   │       └── index.d.ts
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── auth.test.js
│   │   │   ├── guitars.test.js
│   │   │   ├── images.test.js
│   │   │   └── user.test.js
│   │   └── integration/
│   │       └── api.test.js
│   ├── scripts/
│   │   ├── setup-cognito.sh
│   │   ├── create-tables.sh
│   │   └── deploy.sh
│   └── layers/                 # Lambda layers
│       └── nodejs/
│           └── package.json
├── infrastructure/             # Additional CloudFormation for CloudFront, S3
│   └── cloudfront-template.yaml
└── .github/
    └── workflows/
        └── deploy.yml          # CI/CD pipeline
```

## SAM Template Structure

### Main Template (template.yaml)

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Guitar Collection Backend API

# Global settings for all functions
Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 10
    MemorySize: 512
    Environment:
      Variables:
        NODE_ENV: !Ref Environment
        COGNITO_USER_POOL_ID: !Ref UserPool
        COGNITO_CLIENT_ID: !Ref UserPoolClient
        DYNAMODB_TABLE_GUITARS: !Ref GuitarsTable
        DYNAMODB_TABLE_USERS: !Ref UsersTable
        S3_BUCKET_IMAGES: !Ref ImagesBucket
        CLOUDFRONT_DOMAIN: !GetAtt ImagesDistribution.DomainName
    Layers:
      - !Ref DependenciesLayer
  Api:
    Cors:
      AllowOrigin: !Ref AllowedOrigin
      AllowHeaders: "'Content-Type,Authorization'"
      AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"

# Parameters for different environments
Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - staging
      - prod
    Description: Environment name

  AllowedOrigin:
    Type: String
    Description: CORS allowed origin
    Default: "'http://localhost:5173'"

# Resources
Resources:
  # ==================== API Gateway ====================

  HttpApiGateway:
    Type: AWS::Serverless::HttpApi
    Properties:
      Name: !Sub {stack-name}-api-${Environment}
      StageName: !Ref Environment
      CorsConfiguration:
        AllowOrigins:
          - !Ref AllowedOrigin
        AllowHeaders:
          - Content-Type
          - Authorization
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
      Auth:
        Authorizers:
          CognitoAuthorizer:
            IdentitySource: $request.header.Authorization
            JwtConfiguration:
              Issuer: !Sub https://cognito-idp.${AWS::Region}.amazonaws.com/${UserPool}
              Audience:
                - !Ref UserPoolClient

  # ==================== Lambda Functions ====================

  # Dependencies Layer (shared node_modules)
  DependenciesLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: !Sub {stack-name}-dependencies-${Environment}
      Description: Shared dependencies for all Lambda functions
      ContentUri: layers/nodejs/
      CompatibleRuntimes:
        - nodejs20.x
    Metadata:
      BuildMethod: nodejs20.x

  # Auth Handler
  AuthHandler:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub {stack-name}-auth-${Environment}
      CodeUri: src/handlers/auth/
      Handler: index.handler
      Description: Handles user authentication
      Policies:
        - Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - cognito-idp:AdminInitiateAuth
                - cognito-idp:AdminCreateUser
                - cognito-idp:AdminSetUserPassword
                - cognito-idp:ForgotPassword
                - cognito-idp:ConfirmForgotPassword
                - dynamodb:PutItem
              Resource:
                - !GetAtt UserPool.Arn
                - !GetAtt UsersTable.Arn
      Events:
        RegisterPost:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /auth/register
            Method: POST
        LoginPost:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /auth/login
            Method: POST
        RefreshPost:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /auth/refresh
            Method: POST
        ForgotPasswordPost:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /auth/forgot-password
            Method: POST
        ResetPasswordPost:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /auth/reset-password
            Method: POST

  # Guitars Handler
  GuitarsHandler:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub {stack-name}-guitars-${Environment}
      CodeUri: src/handlers/guitars/
      Handler: index.handler
      Description: Handles guitar CRUD operations
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref GuitarsTable
        - Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - dynamodb:Query
                - dynamodb:Scan
              Resource:
                - !Sub ${GuitarsTable.Arn}/index/*
      Events:
        ListGuitars:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /guitars
            Method: GET
            Auth:
              Authorizer: CognitoAuthorizer
        CreateGuitar:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /guitars
            Method: POST
            Auth:
              Authorizer: CognitoAuthorizer
        GetGuitar:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /guitars/{id}
            Method: GET
            Auth:
              Authorizer: CognitoAuthorizer
        UpdateGuitar:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /guitars/{id}
            Method: PUT
            Auth:
              Authorizer: CognitoAuthorizer
        DeleteGuitar:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /guitars/{id}
            Method: DELETE
            Auth:
              Authorizer: CognitoAuthorizer
        GetBrands:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /guitars/brands
            Method: GET
            Auth:
              Authorizer: CognitoAuthorizer

  # Images Handler
  ImagesHandler:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub {stack-name}-images-${Environment}
      CodeUri: src/handlers/images/
      Handler: index.handler
      Description: Handles image uploads and processing
      Policies:
        - S3CrudPolicy:
            BucketName: !Ref ImagesBucket
        - Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - s3:PutObjectAcl
              Resource: !Sub ${ImagesBucket.Arn}/*
      Events:
        GetUploadUrl:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /images/upload-url
            Method: POST
            Auth:
              Authorizer: CognitoAuthorizer
        UploadComplete:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /images/upload-complete
            Method: POST
            Auth:
              Authorizer: CognitoAuthorizer

  # User Handler
  UserHandler:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub {stack-name}-user-${Environment}
      CodeUri: src/handlers/user/
      Handler: index.handler
      Description: Handles user profile operations
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref UsersTable
        - Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - cognito-idp:AdminGetUser
                - cognito-idp:AdminUpdateUserAttributes
              Resource: !GetAtt UserPool.Arn
      Events:
        GetProfile:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /user/profile
            Method: GET
            Auth:
              Authorizer: CognitoAuthorizer
        UpdateProfile:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /user/profile
            Method: PUT
            Auth:
              Authorizer: CognitoAuthorizer
        UpdateName:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApiGateway
            Path: /user/name
            Method: PUT
            Auth:
              Authorizer: CognitoAuthorizer

  # ==================== DynamoDB Tables ====================

  GuitarsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub {stack-name}-guitars-${Environment}
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: userId
          AttributeType: S
        - AttributeName: guitarId
          AttributeType: S
        - AttributeName: brand
          AttributeType: S
      KeySchema:
        - AttributeName: userId
          KeyType: HASH
        - AttributeName: guitarId
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: brand-userId-index
          KeySchema:
            - AttributeName: brand
              KeyType: HASH
            - AttributeName: userId
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: !If [IsProduction, true, false]
      Tags:
        - Key: Environment
          Value: !Ref Environment

  UsersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub {stack-name}-users-${Environment}
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: userId
          AttributeType: S
      KeySchema:
        - AttributeName: userId
          KeyType: HASH
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: !If [IsProduction, true, false]
      Tags:
        - Key: Environment
          Value: !Ref Environment

  # ==================== Cognito ====================

  UserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: !Sub {stack-name}-users-${Environment}
      UsernameAttributes:
        - email
      AutoVerifiedAttributes:
        - email
      Schema:
        - Name: email
          Required: true
          Mutable: true
        - Name: name
          Required: true
          Mutable: true
      Policies:
        PasswordPolicy:
          MinimumLength: 8
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true
          RequireSymbols: true
      AccountRecoverySetting:
        RecoveryMechanisms:
          - Name: verified_email
            Priority: 1
      UserAttributeUpdateSettings:
        AttributesRequireVerificationBeforeUpdate:
          - email
      UserPoolAddOns:
        AdvancedSecurityMode: AUDIT

  UserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      ClientName: !Sub {stack-name}-web-${Environment}
      UserPoolId: !Ref UserPool
      GenerateSecret: false
      ExplicitAuthFlows:
        - ALLOW_USER_PASSWORD_AUTH
        - ALLOW_REFRESH_TOKEN_AUTH
      AccessTokenValidity: 1
      IdTokenValidity: 1
      RefreshTokenValidity: 30
      TokenValidityUnits:
        AccessToken: hours
        IdToken: hours
        RefreshToken: days

  # ==================== S3 Buckets ====================

  ImagesBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub {stack-name}-images-${Environment}-${AWS::AccountId}
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      CorsConfiguration:
        CorsRules:
          - AllowedOrigins:
              - !Ref AllowedOrigin
            AllowedMethods:
              - GET
              - PUT
              - POST
            AllowedHeaders:
              - '*'
            MaxAge: 3000
      LifecycleConfiguration:
        Rules:
          - Id: DeleteOldUploads
            Status: Enabled
            ExpirationInDays: 1
            Prefix: uploads/
      VersioningConfiguration:
        Status: Enabled
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      Tags:
        - Key: Environment
          Value: !Ref Environment

  ImagesBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref ImagesBucket
      PolicyDocument:
        Statement:
          - Sid: AllowCloudFrontOAI
            Effect: Allow
            Principal:
              AWS: !Sub arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ${ImagesOAI}
            Action: s3:GetObject
            Resource: !Sub ${ImagesBucket.Arn}/images/*

  ImagesOAI:
    Type: AWS::CloudFront::CloudFrontOriginAccessIdentity
    Properties:
      CloudFrontOriginAccessIdentityConfig:
        Comment: !Sub OAI for {stack-name}-images-${Environment}

  ImagesDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        Comment: !Sub Images CDN for {stack-name}-${Environment}
        PriceClass: PriceClass_100
        Origins:
          - Id: S3Origin
            DomainName: !GetAtt ImagesBucket.RegionalDomainName
            S3OriginConfig:
              OriginAccessIdentity: !Sub origin-access-identity/cloudfront/${ImagesOAI}
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods:
            - GET
            - HEAD
            - OPTIONS
          CachedMethods:
            - GET
            - HEAD
          Compress: true
          ForwardedValues:
            QueryString: false
            Cookies:
              Forward: none
          MinTTL: 0
          DefaultTTL: 86400
          MaxTTL: 31536000

# Conditions
Conditions:
  IsProduction: !Equals [!Ref Environment, prod]

# Outputs
Outputs:
  ApiUrl:
    Description: API Gateway URL
    Value: !Sub https://${HttpApiGateway}.execute-api.${AWS::Region}.amazonaws.com/${Environment}
    Export:
      Name: !Sub ${AWS::StackName}-ApiUrl

  UserPoolId:
    Description: Cognito User Pool ID
    Value: !Ref UserPool
    Export:
      Name: !Sub ${AWS::StackName}-UserPoolId

  UserPoolClientId:
    Description: Cognito User Pool Client ID
    Value: !Ref UserPoolClient
    Export:
      Name: !Sub ${AWS::StackName}-UserPoolClientId

  ImagesBucketName:
    Description: S3 bucket for images
    Value: !Ref ImagesBucket
    Export:
      Name: !Sub ${AWS::StackName}-ImagesBucketName

  CloudFrontDomain:
    Description: CloudFront distribution domain
    Value: !GetAtt ImagesDistribution.DomainName
    Export:
      Name: !Sub ${AWS::StackName}-CloudFrontDomain

  GuitarsTableName:
    Description: DynamoDB Guitars table name
    Value: !Ref GuitarsTable

  UsersTableName:
    Description: DynamoDB Users table name
    Value: !Ref UsersTable
```

## SAM Configuration (samconfig.toml)

```toml
version = 0.1

[default]
[default.global.parameters]
stack_name = "{stack-name}-backend"
region = "us-east-1"

[default.build.parameters]
cached = true
parallel = true

[default.deploy.parameters]
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
resolve_s3 = true

# Development environment
[dev]
[dev.deploy.parameters]
stack_name = "{stack-name}-backend-dev"
parameter_overrides = "Environment=dev AllowedOrigin='http://localhost:5173'"
s3_prefix = "{stack-name}-dev"
tags = "Environment=dev Project={ProjectName}"

# Staging environment
[staging]
[staging.deploy.parameters]
stack_name = "{stack-name}-backend-staging"
parameter_overrides = "Environment=staging AllowedOrigin='https://staging.your-domain.com'"
s3_prefix = "{stack-name}-staging"
tags = "Environment=staging Project={ProjectName}"

# Production environment
[prod]
[prod.deploy.parameters]
stack_name = "{stack-name}-backend-prod"
parameter_overrides = "Environment=prod AllowedOrigin='https://your-domain.com'"
s3_prefix = "{stack-name}-prod"
tags = "Environment=prod Project={ProjectName}"
confirm_changeset = true  # Require manual confirmation for prod
```

## SAM CLI Commands

### Local Development

```bash
# Build the application
sam build

# Validate template
sam validate

# Run API locally
sam local start-api --port 3001

# Invoke a specific function locally
sam local invoke AuthHandler --event events/register.json

# Generate sample event
sam local generate-event apigateway http-api-proxy > events/register.json

# Run with environment variables
sam local start-api --env-vars env.json

# Debug with VS Code
sam local start-api --debug-port 9229

# Tail logs from deployed Lambda
sam logs -n AuthHandler --tail
```

### Deployment

```bash
# First-time deployment setup
sam deploy --guided

# Deploy to dev (using samconfig.toml)
sam build && sam deploy --config-env dev

# Deploy to staging
sam build && sam deploy --config-env staging

# Deploy to prod (requires confirmation)
sam build && sam deploy --config-env prod

# Deploy without confirmation (CI/CD)
sam deploy --config-env dev --no-confirm-changeset

# Deploy with parameter overrides
sam deploy --parameter-overrides Environment=dev AllowedOrigin="'http://localhost:3000'"
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests against deployed stack
npm run test:integration

# Test locally with SAM
sam local invoke GuitarsHandler --event tests/events/list-guitars.json
```

### Cleanup

```bash
# Delete stack (dev)
sam delete --stack-name {stack-name}-backend-dev --no-prompts

# Delete stack (prod) - requires confirmation
sam delete --stack-name {stack-name}-backend-prod
```

## Environment Variables File (env.json)

```json
{
  "AuthHandler": {
    "NODE_ENV": "development",
    "COGNITO_USER_POOL_ID": "us-east-1_XXXXXXXXX",
    "COGNITO_CLIENT_ID": "XXXXXXXXXXXXXXXXXXXXXXXXXX",
    "DYNAMODB_TABLE_USERS": "{stack-name}-users-dev"
  },
  "GuitarsHandler": {
    "NODE_ENV": "development",
    "DYNAMODB_TABLE_GUITARS": "{stack-name}-guitars-dev",
    "S3_BUCKET_IMAGES": "{stack-name}-images-dev"
  },
  "ImagesHandler": {
    "NODE_ENV": "development",
    "S3_BUCKET_IMAGES": "{stack-name}-images-dev",
    "CLOUDFRONT_DOMAIN": "d1234567890.cloudfront.net"
  }
}
```

## Package.json for Backend

```json
{
  "name": "{stack-name}-backend",
  "version": "1.0.0",
  "description": "Backend API for Guitar Collection",
  "main": "index.js",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "node tests/integration/runner.js",
    "lint": "eslint src/",
    "format": "prettier --write \"src/**/*.js\"",
    "build": "sam build",
    "deploy:dev": "sam build && sam deploy --config-env dev",
    "deploy:staging": "sam build && sam deploy --config-env staging",
    "deploy:prod": "sam build && sam deploy --config-env prod",
    "local:api": "sam local start-api --port 3001",
    "logs:auth": "sam logs -n AuthHandler --tail",
    "logs:guitars": "sam logs -n GuitarsHandler --tail"
  },
  "dependencies": {
    "aws-sdk": "^2.1500.0",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.130",
    "@types/node": "^20.10.0",
    "eslint": "^8.55.0",
    "jest": "^29.7.0",
    "prettier": "^3.1.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

## Deployment Scripts

### deploy.sh
```bash
#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}

echo "🚀 Deploying to $ENVIRONMENT..."

# Validate template
echo "📋 Validating SAM template..."
sam validate

# Build
echo "🔨 Building application..."
sam build

# Deploy
echo "📦 Deploying to AWS..."
sam deploy --config-env $ENVIRONMENT

# Get outputs
echo "📊 Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "{stack-name}-backend-$ENVIRONMENT" \
  --query 'Stacks[0].Outputs' \
  --output table

echo "✅ Deployment complete!"
```

### local-setup.sh
```bash
#!/bin/bash
set -e

echo "🔧 Setting up local development environment..."

# Install dependencies
npm install

# Install SAM CLI if not present
if ! command -v sam &> /dev/null; then
    echo "Installing SAM CLI..."
    pip3 install aws-sam-cli
fi

# Build
sam build

# Generate env.json from deployed stack
STACK_NAME="{stack-name}-backend-dev"
echo "Fetching stack outputs..."

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

IMAGES_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`ImagesBucketName`].OutputValue' \
  --output text)

cat > env.json <<EOF
{
  "AuthHandler": {
    "NODE_ENV": "development",
    "COGNITO_USER_POOL_ID": "$USER_POOL_ID",
    "COGNITO_CLIENT_ID": "$CLIENT_ID",
    "DYNAMODB_TABLE_USERS": "{stack-name}-users-dev"
  },
  "GuitarsHandler": {
    "NODE_ENV": "development",
    "DYNAMODB_TABLE_GUITARS": "{stack-name}-guitars-dev",
    "S3_BUCKET_IMAGES": "$IMAGES_BUCKET"
  },
  "ImagesHandler": {
    "NODE_ENV": "development",
    "S3_BUCKET_IMAGES": "$IMAGES_BUCKET"
  }
}
EOF

echo "✅ Local environment ready!"
echo "Start API with: sam local start-api --port 3001"
```

## CI/CD with GitHub Actions

### .github/workflows/deploy.yml
```yaml
name: Deploy Backend

on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'backend/**'
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd backend
          npm ci

      - name: Run tests
        run: |
          cd backend
          npm test

      - name: Run linter
        run: |
          cd backend
          npm run lint

  deploy-dev:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install SAM CLI
        run: pip install aws-sam-cli

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: SAM Build
        run: |
          cd backend
          sam build

      - name: SAM Deploy to Dev
        run: |
          cd backend
          sam deploy --config-env dev --no-confirm-changeset

  deploy-prod:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install SAM CLI
        run: pip install aws-sam-cli

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: SAM Build
        run: |
          cd backend
          sam build

      - name: SAM Deploy to Prod
        run: |
          cd backend
          sam deploy --config-env prod --no-confirm-changeset
```

## Best Practices

### 1. Development Workflow
```bash
# 1. Make changes to Lambda functions
# 2. Test locally
sam local start-api --port 3001

# 3. Test specific function
sam local invoke GuitarsHandler --event tests/events/create-guitar.json

# 4. Run unit tests
npm test

# 5. Deploy to dev
npm run deploy:dev

# 6. Test deployed API
curl https://api-dev.example.com/guitars

# 7. Create PR, merge to main
# 8. Auto-deploy to prod via CI/CD
```

### 2. Layer Management
```bash
# Update dependencies in layer
cd backend/layers/nodejs
npm install aws-sdk uuid jsonwebtoken
cd ../..

# Rebuild and deploy
sam build
sam deploy --config-env dev
```

### 3. Debugging
```bash
# Enable X-Ray tracing in template.yaml
Tracing: Active

# View traces in AWS X-Ray console

# Tail logs in real-time
sam logs -n GuitarsHandler --tail --filter "ERROR"

# Debug locally with VS Code
# Launch config in .vscode/launch.json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to SAM CLI",
  "port": 9229
}

# Start with debug
sam local start-api --debug-port 9229
```

### 4. Cost Monitoring
```bash
# Check stack cost
aws cloudformation estimate-template-cost \
  --template-body file://template.yaml \
  --parameters ParameterKey=Environment,ParameterValue=dev

# Set up budget alert
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget.json
```

## Next Steps

1. **Initialize Backend Project**
   ```bash
   mkdir backend
   cd backend
   sam init --runtime nodejs20.x --name {stack-name}-backend
   ```

2. **Customize Template**
   - Replace generated template.yaml with the one above
   - Add samconfig.toml
   - Create directory structure

3. **Deploy to Dev**
   ```bash
   sam build
   sam deploy --guided
   ```

4. **Implement Lambda Handlers**
   - Start with auth handler
   - Then guitars handler
   - Then images handler
   - Finally user handler

5. **Test Locally**
   ```bash
   sam local start-api --port 3001
   ```

6. **Set Up CI/CD**
   - Add GitHub Actions workflow
   - Configure AWS credentials in GitHub secrets
   - Test deployment pipeline

---

**Document Version**: 1.0
**Last Updated**: 2025-01-13
