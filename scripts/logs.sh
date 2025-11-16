#!/bin/bash

# Get stack name and environment from samconfig.toml or use defaults
STACK_NAME="${STACK_NAME:-guitar-collection-backend}"
ENVIRONMENT="${ENVIRONMENT:-prod}"

# If samconfig.toml exists in backend/, try to extract stack name
if [ -f backend/samconfig.toml ]; then
  EXTRACTED_STACK=$(grep "stack_name" backend/samconfig.toml | head -1 | cut -d'"' -f2 | tr -d ' ')
  if [ -n "$EXTRACTED_STACK" ]; then
    STACK_NAME="$EXTRACTED_STACK"
  fi
fi

LAMBDA="${1:-guitars}"

# Map friendly names to Lambda function names
case $LAMBDA in
  guitars|guitar)
    FUNCTION_NAME="GuitarsHandler"
    ;;
  auth)
    FUNCTION_NAME="AuthHandler"
    ;;
  images|image)
    FUNCTION_NAME="ImagesHandler"
    ;;
  specs)
    FUNCTION_NAME="SpecsHandler"
    ;;
  documents|docs|doc)
    FUNCTION_NAME="DocumentsHandler"
    ;;
  provenance|prov)
    FUNCTION_NAME="ProvenanceHandler"
    ;;
  user)
    FUNCTION_NAME="UserHandler"
    ;;
  public)
    FUNCTION_NAME="PublicGuitarHandler"
    ;;
  *)
    echo "Usage: $0 [guitars|auth|images|specs|documents|provenance|user|public]"
    echo ""
    echo "Options:"
    echo "  STACK_NAME=my-stack $0 guitars    # Override stack name"
    echo "  ENVIRONMENT=dev $0 auth            # Override environment"
    echo ""
    echo "Default: guitars"
    exit 1
    ;;
esac

# Try to get actual log group name from CloudFormation stack
LOG_GROUP=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --query "StackResources[?LogicalResourceId=='${FUNCTION_NAME}'].PhysicalResourceId" \
  --output text 2>/dev/null)

# If CloudFormation lookup failed, construct log group name manually
if [ -z "$LOG_GROUP" ] || [ "$LOG_GROUP" == "None" ]; then
  # Extract base name without -backend suffix if present
  BASE_NAME="${STACK_NAME%-backend}"
  LOG_GROUP="/aws/lambda/${BASE_NAME}-${LAMBDA}-${ENVIRONMENT}"
  echo "⚠️  Could not find stack '$STACK_NAME', using constructed log group name"
fi

# Convert function resource ID to log group name if it's not already
if [[ ! "$LOG_GROUP" =~ ^/aws/lambda/ ]]; then
  LOG_GROUP="/aws/lambda/${LOG_GROUP}"
fi

echo "📋 Tailing logs for: $LOG_GROUP"
echo "   Stack: $STACK_NAME"
echo ""
aws logs tail "$LOG_GROUP" --follow --since 5m
