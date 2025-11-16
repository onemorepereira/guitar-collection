#!/bin/bash

# Deploy frontend infrastructure using CloudFormation

set -e

echo "Deploying frontend infrastructure..."

STACK_NAME="guitar-collection-frontend"
TEMPLATE_FILE="frontend-infrastructure.yaml"

# Deploy the CloudFormation stack
aws cloudformation deploy \
  --template-file "$TEMPLATE_FILE" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

echo ""
echo "Frontend infrastructure deployment complete!"
echo ""

# Get stack outputs
echo "Stack Outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output table
