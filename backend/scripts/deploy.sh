#!/bin/bash
set -e

ENVIRONMENT=${1:-prod}

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
  --stack-name "guitar-collection-backend-$ENVIRONMENT" \
  --query 'Stacks[0].Outputs' \
  --output table

echo "✅ Deployment complete!"
