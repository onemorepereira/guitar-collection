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
STACK_NAME="guitar-collection-backend-dev"
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
    "DYNAMODB_TABLE_USERS": "guitar-collection-users-dev"
  },
  "GuitarsHandler": {
    "NODE_ENV": "development",
    "DYNAMODB_TABLE_GUITARS": "guitar-collection-guitars-dev",
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
