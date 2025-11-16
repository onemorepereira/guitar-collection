#!/bin/bash
set -e

# Load configuration from .env.deploy if it exists
if [ -f "$(dirname "$0")/../.env.deploy" ]; then
  source "$(dirname "$0")/../.env.deploy"
fi

# Get bucket prefix from environment variable or use default
BUCKET_PREFIX="${FRONTEND_BUCKET_PREFIX:-guitar-collection-frontend}"

# Dynamically get AWS Account ID
ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
BUCKET="${BUCKET_PREFIX}-${ACCOUNT_ID}"

# Get CloudFront Distribution ID from environment variable or CloudFormation stack
if [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  echo "📋 Fetching CloudFront Distribution ID from backend stack..."
  # Get CloudFront domain from backend stack
  CF_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "${BACKEND_STACK_NAME}" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomain`].OutputValue' \
    --output text 2>/dev/null || echo "")

  if [ -n "$CF_DOMAIN" ]; then
    # Get distribution ID from CloudFront domain
    CLOUDFRONT_ID=$(aws cloudfront list-distributions \
      --query "DistributionList.Items[?DomainName=='${CF_DOMAIN}'].Id" \
      --output text 2>/dev/null || echo "")
  fi

  if [ -z "$CLOUDFRONT_ID" ]; then
    echo "❌ Error: Could not determine CloudFront Distribution ID"
    echo "   Please set CLOUDFRONT_DISTRIBUTION_ID in .env.deploy"
    exit 1
  fi
else
  CLOUDFRONT_ID="$CLOUDFRONT_DISTRIBUTION_ID"
fi

echo "🎸 Deploying Frontend..."
echo "   Bucket Prefix: ${BUCKET_PREFIX}"
echo "   Account ID: ${ACCOUNT_ID}"
echo "   Bucket: ${BUCKET}"
echo "   CloudFront ID: ${CLOUDFRONT_ID}"

# Upload to S3 (build already done by Makefile)
aws s3 sync dist/ s3://$BUCKET --delete --cache-control max-age=31536000,public

# Update index.html with no-cache
aws s3 cp dist/index.html s3://$BUCKET/index.html \
  --cache-control no-cache,no-store,must-revalidate \
  --content-type text/html

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"

echo "✅ Frontend deployed successfully"
if [ -n "$FRONTEND_DOMAIN" ]; then
  echo "🌐 https://${FRONTEND_DOMAIN}"
else
  echo "🌐 https://${BUCKET}.s3-website-${AWS_REGION:-us-east-1}.amazonaws.com"
fi
