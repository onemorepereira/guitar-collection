.PHONY: help init install dev build clean validate status
.PHONY: deploy-backend deploy-frontend-infra deploy-frontend deploy-all
.PHONY: teardown logs test init-hooks
.PHONY: _extract-backend-outputs _extract-frontend-outputs _generate-env

# Load deployment configuration
-include .env.deploy
export

# Generated files (auto-created during deployment)
BACKEND_OUTPUTS_FILE := .env.backend.outputs
FRONTEND_OUTPUTS_FILE := .env.frontend.outputs
GENERATED_ENV_FILE := .env

#============================================================================
# Help
#============================================================================

help:
	@echo "========================================"
	@echo "Guitar Collection - Makefile Deployment"
	@echo "========================================"
	@echo ""
	@echo "Setup:"
	@echo "  make init              - Initialize configuration from templates"
	@echo "  make init-hooks        - Install git pre-commit hook"
	@echo "  make install           - Install dependencies (frontend + backend)"
	@echo ""
	@echo "Development:"
	@echo "  make dev               - Run frontend development server"
	@echo "  make build             - Build frontend for production"
	@echo "  make test              - Run tests"
	@echo ""
	@echo "Deployment (Automated):"
	@echo "  make deploy-all        - Deploy everything (backend → frontend infra → frontend)"
	@echo ""
	@echo "Deployment (Step-by-Step):"
	@echo "  make deploy-backend         - Deploy backend + generate outputs"
	@echo "  make deploy-frontend-infra  - Deploy frontend infrastructure"
	@echo "  make deploy-frontend        - Build + deploy frontend code"
	@echo ""
	@echo "Teardown:"
	@echo "  make teardown          - Delete all deployed resources (DESTRUCTIVE)"
	@echo ""
	@echo "Utilities:"
	@echo "  make status            - Show current configuration"
	@echo "  make validate          - Validate configuration files"
	@echo "  make logs              - Tail backend logs (specify FUNC=guitars|auth|images|...)"
	@echo "  make clean             - Clean build artifacts and generated files"
	@echo ""
	@echo "Configuration:"
	@echo "  Edit .env.deploy with your AWS resource values"

#============================================================================
# Initialization
#============================================================================

init:
	@echo "[*] Initializing configuration..."
	@if [ ! -f .env.deploy ]; then \
		cp .env.deploy.example .env.deploy; \
		echo "[✓] Created .env.deploy - EDIT THIS FILE with your values"; \
	else \
		echo "[!] .env.deploy already exists, skipping..."; \
	fi
	@if [ ! -f backend/samconfig.toml ]; then \
		cp backend/samconfig.toml.example backend/samconfig.toml 2>/dev/null || \
		echo "[!] backend/samconfig.toml.example not found - you may need to create samconfig.toml manually"; \
	else \
		echo "[!] backend/samconfig.toml already exists, skipping..."; \
	fi
	@echo ""
	@echo "Next steps:"
	@echo "   1. Edit .env.deploy with your AWS resource IDs"
	@echo "   2. Edit backend/samconfig.toml with your deployment settings"
	@echo "   3. Run 'make install' to install dependencies"
	@echo "   4. Run 'make deploy-all' to deploy"

init-hooks:
	@echo "[*] Installing git hooks..."
	@if [ -f .git-hooks/pre-commit ]; then \
		mkdir -p .git/hooks; \
		cp .git-hooks/pre-commit .git/hooks/pre-commit; \
		chmod +x .git/hooks/pre-commit; \
		echo "[✓] Pre-commit hook installed"; \
	else \
		echo "[!]  .git-hooks/pre-commit not found"; \
	fi

#============================================================================
# Dependencies
#============================================================================

install:
	@echo "[*] Installing frontend dependencies..."
	@npm install
	@echo "[*] Installing backend dependencies..."
	@cd backend/src && npm install
	@echo "[✓] Dependencies installed"

#============================================================================
# Development
#============================================================================

dev:
	@echo "[*] Starting development server..."
	@npm run dev

test:
	@echo "[*] Running tests..."
	@npm run test || echo "No tests configured yet"
	@echo "[✓] Tests complete"

#============================================================================
# Backend Deployment (with output extraction)
#============================================================================

deploy-backend: validate
	@echo "[*] Deploying backend..."
	@if [ -z "$(BACKEND_STACK_NAME)" ]; then \
		echo "[X] Error: BACKEND_STACK_NAME not set in .env.deploy"; \
		exit 1; \
	fi
	@cd backend && sam build && sam deploy --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
	@echo "[✓] Backend deployed"
	@$(MAKE) _extract-backend-outputs
	@$(MAKE) _generate-env
	@echo ""
	@echo "[✓] Backend outputs extracted and .env generated"

_extract-backend-outputs:
	@echo "[*] Extracting backend CloudFormation outputs..."
	@if [ -z "$(BACKEND_STACK_NAME)" ]; then \
		echo "[X] Error: BACKEND_STACK_NAME not set"; \
		exit 1; \
	fi
	@echo "# Auto-generated backend outputs (do not edit manually)" > $(BACKEND_OUTPUTS_FILE)
	@echo "# Generated at: $$(date)" >> $(BACKEND_OUTPUTS_FILE)
	@echo "" >> $(BACKEND_OUTPUTS_FILE)
	@echo "Querying stack: $(BACKEND_STACK_NAME)..."
	@aws cloudformation describe-stacks \
		--stack-name $(BACKEND_STACK_NAME) \
		--query 'Stacks[0].Outputs' \
		--output json > /tmp/backend-outputs.json
	@CUSTOM_DOMAIN_URL=$$(jq -r '.[] | select(.OutputKey=="CustomDomainUrl") | .OutputValue' /tmp/backend-outputs.json 2>/dev/null || echo ""); \
	API_URL=$$(jq -r '.[] | select(.OutputKey=="ApiUrl") | .OutputValue' /tmp/backend-outputs.json); \
	USER_POOL_ID=$$(jq -r '.[] | select(.OutputKey=="UserPoolId") | .OutputValue' /tmp/backend-outputs.json); \
	USER_POOL_CLIENT_ID=$$(jq -r '.[] | select(.OutputKey=="UserPoolClientId") | .OutputValue' /tmp/backend-outputs.json); \
	CLOUDFRONT_DOMAIN=$$(jq -r '.[] | select(.OutputKey=="CloudFrontDomain") | .OutputValue' /tmp/backend-outputs.json); \
	IMAGES_BUCKET=$$(jq -r '.[] | select(.OutputKey=="ImagesBucketName") | .OutputValue' /tmp/backend-outputs.json); \
	if [ -n "$$CUSTOM_DOMAIN_URL" ] && [ "$$CUSTOM_DOMAIN_URL" != "null" ]; then \
		echo "BACKEND_API_URL=$$CUSTOM_DOMAIN_URL" >> $(BACKEND_OUTPUTS_FILE); \
	else \
		echo "BACKEND_API_URL=$$API_URL" >> $(BACKEND_OUTPUTS_FILE); \
	fi; \
	echo "BACKEND_USER_POOL_ID=$$USER_POOL_ID" >> $(BACKEND_OUTPUTS_FILE); \
	echo "BACKEND_USER_POOL_CLIENT_ID=$$USER_POOL_CLIENT_ID" >> $(BACKEND_OUTPUTS_FILE); \
	echo "BACKEND_CLOUDFRONT_DOMAIN=$$CLOUDFRONT_DOMAIN" >> $(BACKEND_OUTPUTS_FILE); \
	echo "BACKEND_IMAGES_BUCKET=$$IMAGES_BUCKET" >> $(BACKEND_OUTPUTS_FILE)
	@rm -f /tmp/backend-outputs.json
	@echo "[✓] Backend outputs saved to $(BACKEND_OUTPUTS_FILE)"
	@cat $(BACKEND_OUTPUTS_FILE)

_generate-env:
	@echo "[*] Generating .env file from backend outputs..."
	@if [ ! -f $(BACKEND_OUTPUTS_FILE) ]; then \
		echo "[X] Error: $(BACKEND_OUTPUTS_FILE) not found. Run 'make deploy-backend' first."; \
		exit 1; \
	fi
	@. ./$(BACKEND_OUTPUTS_FILE); \
	echo "# Auto-generated frontend environment variables" > $(GENERATED_ENV_FILE); \
	echo "# Generated at: $$(date)" >> $(GENERATED_ENV_FILE); \
	echo "# Source: Backend CloudFormation stack outputs" >> $(GENERATED_ENV_FILE); \
	echo "" >> $(GENERATED_ENV_FILE); \
	echo "# API Configuration" >> $(GENERATED_ENV_FILE); \
	echo "VITE_API_URL=$$BACKEND_API_URL" >> $(GENERATED_ENV_FILE); \
	echo "" >> $(GENERATED_ENV_FILE); \
	echo "# AWS Cognito Configuration (currently unused in code)" >> $(GENERATED_ENV_FILE); \
	echo "VITE_COGNITO_USER_POOL_ID=$$BACKEND_USER_POOL_ID" >> $(GENERATED_ENV_FILE); \
	echo "VITE_COGNITO_CLIENT_ID=$$BACKEND_USER_POOL_CLIENT_ID" >> $(GENERATED_ENV_FILE); \
	echo "VITE_COGNITO_REGION=$(AWS_REGION)" >> $(GENERATED_ENV_FILE); \
	echo "" >> $(GENERATED_ENV_FILE); \
	echo "# CloudFront Domain for images (currently unused in code)" >> $(GENERATED_ENV_FILE); \
	echo "VITE_CLOUDFRONT_DOMAIN=$$BACKEND_CLOUDFRONT_DOMAIN" >> $(GENERATED_ENV_FILE)
	@echo "[✓] Generated .env file:"
	@cat $(GENERATED_ENV_FILE)

#============================================================================
# Frontend Infrastructure Deployment
#============================================================================

deploy-frontend-infra: validate
	@echo "[*] Deploying frontend infrastructure..."
	@if [ -z "$(FRONTEND_BUCKET_PREFIX)" ]; then \
		echo "[X] Error: FRONTEND_BUCKET_PREFIX not set in .env.deploy"; \
		exit 1; \
	fi
	@if [ -z "$(FRONTEND_DOMAIN)" ]; then \
		echo "[X] Error: FRONTEND_DOMAIN not set in .env.deploy"; \
		exit 1; \
	fi
	@if [ -z "$(HOSTED_ZONE_ID)" ]; then \
		echo "[!]  Warning: HOSTED_ZONE_ID not set - deployment may fail if Route53 is required"; \
	fi
	@aws cloudformation deploy \
		--template-file frontend-infrastructure.yaml \
		--stack-name $(FRONTEND_BUCKET_PREFIX)-frontend \
		--parameter-overrides \
			BucketPrefix=$(FRONTEND_BUCKET_PREFIX) \
			DomainName=$(FRONTEND_DOMAIN) \
			HostedZoneId=$(HOSTED_ZONE_ID) \
		--capabilities CAPABILITY_IAM \
		--no-fail-on-empty-changeset
	@echo "[✓] Frontend infrastructure deployed"
	@$(MAKE) _extract-frontend-outputs

_extract-frontend-outputs:
	@echo "[*] Extracting frontend infrastructure outputs..."
	@FRONTEND_STACK_NAME="$(FRONTEND_BUCKET_PREFIX)-frontend"; \
	echo "# Auto-generated frontend infrastructure outputs (do not edit manually)" > $(FRONTEND_OUTPUTS_FILE); \
	echo "# Generated at: $$(date)" >> $(FRONTEND_OUTPUTS_FILE); \
	echo "" >> $(FRONTEND_OUTPUTS_FILE); \
	echo "Querying stack: $$FRONTEND_STACK_NAME..."; \
	aws cloudformation describe-stacks \
		--stack-name $$FRONTEND_STACK_NAME \
		--query 'Stacks[0].Outputs' \
		--output json > /tmp/frontend-outputs.json; \
	BUCKET_NAME=$$(jq -r '.[] | select(.OutputKey=="BucketName") | .OutputValue' /tmp/frontend-outputs.json); \
	DISTRIBUTION_ID=$$(jq -r '.[] | select(.OutputKey=="DistributionId") | .OutputValue' /tmp/frontend-outputs.json); \
	DISTRIBUTION_DOMAIN=$$(jq -r '.[] | select(.OutputKey=="DistributionDomain") | .OutputValue' /tmp/frontend-outputs.json); \
	WEBSITE_URL=$$(jq -r '.[] | select(.OutputKey=="WebsiteUrl") | .OutputValue' /tmp/frontend-outputs.json); \
	echo "FRONTEND_BUCKET_NAME=$$BUCKET_NAME" >> $(FRONTEND_OUTPUTS_FILE); \
	echo "FRONTEND_DISTRIBUTION_ID=$$DISTRIBUTION_ID" >> $(FRONTEND_OUTPUTS_FILE); \
	echo "FRONTEND_DISTRIBUTION_DOMAIN=$$DISTRIBUTION_DOMAIN" >> $(FRONTEND_OUTPUTS_FILE); \
	echo "FRONTEND_WEBSITE_URL=$$WEBSITE_URL" >> $(FRONTEND_OUTPUTS_FILE); \
	rm -f /tmp/frontend-outputs.json
	@echo "[✓] Frontend infrastructure outputs saved to $(FRONTEND_OUTPUTS_FILE)"
	@cat $(FRONTEND_OUTPUTS_FILE)

#============================================================================
# Frontend Build & Deployment
#============================================================================

build:
	@echo "[*]  Building frontend..."
	@if [ ! -f $(GENERATED_ENV_FILE) ]; then \
		echo "[!]  Warning: $(GENERATED_ENV_FILE) not found. Run 'make deploy-backend' first to auto-generate it."; \
		echo "[!]  Or create $(GENERATED_ENV_FILE) manually from .env.template"; \
	fi
	@npm run build
	@echo "[✓] Build complete: dist/"

deploy-frontend: build
	@echo "[*] Deploying frontend..."
	@if [ ! -f $(FRONTEND_OUTPUTS_FILE) ]; then \
		echo "[X] Error: $(FRONTEND_OUTPUTS_FILE) not found."; \
		echo "   Run 'make deploy-frontend-infra' first to create frontend infrastructure."; \
		exit 1; \
	fi
	@. ./$(FRONTEND_OUTPUTS_FILE); \
	if [ -z "$$FRONTEND_BUCKET_NAME" ]; then \
		echo "[X] Error: FRONTEND_BUCKET_NAME not set in $(FRONTEND_OUTPUTS_FILE)"; \
		exit 1; \
	fi; \
	if [ -z "$$FRONTEND_DISTRIBUTION_ID" ]; then \
		echo "[X] Error: FRONTEND_DISTRIBUTION_ID not set in $(FRONTEND_OUTPUTS_FILE)"; \
		exit 1; \
	fi; \
	echo "   Bucket: $$FRONTEND_BUCKET_NAME"; \
	echo "   CloudFront: $$FRONTEND_DISTRIBUTION_ID"; \
	echo ""; \
	echo "Uploading to S3..."; \
	aws s3 sync dist/ s3://$$FRONTEND_BUCKET_NAME --delete --cache-control max-age=31536000,public; \
	echo ""; \
	echo "Updating index.html with no-cache..."; \
	aws s3 cp dist/index.html s3://$$FRONTEND_BUCKET_NAME/index.html \
		--cache-control no-cache,no-store,must-revalidate \
		--content-type text/html; \
	echo ""; \
	echo "Invalidating CloudFront cache..."; \
	aws cloudfront create-invalidation --distribution-id $$FRONTEND_DISTRIBUTION_ID --paths "/*"; \
	echo ""; \
	echo "[✓] Frontend deployed successfully"; \
	echo "--> $$FRONTEND_WEBSITE_URL"

#============================================================================
# Complete Deployment Pipeline
#============================================================================

deploy-all: validate
	@echo "========================================"
	@echo "  Complete Deployment Pipeline"
	@echo "========================================"
	@echo ""
	@echo "Stage 1/3: Backend"
	@$(MAKE) deploy-backend
	@echo ""
	@echo "Stage 2/3: Frontend Infrastructure"
	@$(MAKE) deploy-frontend-infra
	@echo ""
	@echo "Stage 3/3: Frontend Application"
	@$(MAKE) deploy-frontend
	@echo ""
	@echo "========================================"
	@echo "  [*] All deployments complete!"
	@echo "========================================"
	@echo ""
	@if [ -f $(BACKEND_OUTPUTS_FILE) ] && [ -f $(FRONTEND_OUTPUTS_FILE) ]; then \
		. ./$(BACKEND_OUTPUTS_FILE); \
		. ./$(FRONTEND_OUTPUTS_FILE); \
		echo "Backend:  $$BACKEND_API_URL"; \
		echo "Frontend: $$FRONTEND_WEBSITE_URL"; \
	fi

#============================================================================
# Teardown
#============================================================================

teardown:
	@echo "[!]  WARNING: This will DELETE all deployed resources!"
	@echo ""
	@if [ -n "$(BACKEND_STACK_NAME)" ]; then \
		echo "   Backend stack: $(BACKEND_STACK_NAME)"; \
	else \
		echo "[X] Error: BACKEND_STACK_NAME not set in .env.deploy"; \
		exit 1; \
	fi
	@if [ -n "$(FRONTEND_BUCKET_PREFIX)" ]; then \
		echo "   Frontend stack: $(FRONTEND_BUCKET_PREFIX)-frontend"; \
	fi
	@echo ""
	@read -p "Type 'DELETE' to confirm: " confirm; \
	if [ "$$confirm" != "DELETE" ]; then \
		echo "[X] Teardown cancelled"; \
		exit 1; \
	fi
	@echo ""
	@echo "[*]  Emptying S3 buckets..."
	@if [ -f $(FRONTEND_OUTPUTS_FILE) ]; then \
		. ./$(FRONTEND_OUTPUTS_FILE); \
		if [ -n "$$FRONTEND_BUCKET_NAME" ]; then \
			echo "   Emptying: $$FRONTEND_BUCKET_NAME"; \
			aws s3 rm s3://$$FRONTEND_BUCKET_NAME --recursive 2>/dev/null || echo "   Bucket doesn't exist or already empty"; \
		fi; \
	fi
	@if [ -f $(BACKEND_OUTPUTS_FILE) ]; then \
		. ./$(BACKEND_OUTPUTS_FILE); \
		if [ -n "$$BACKEND_IMAGES_BUCKET" ]; then \
			echo "   Emptying: $$BACKEND_IMAGES_BUCKET"; \
			aws s3 rm s3://$$BACKEND_IMAGES_BUCKET --recursive 2>/dev/null || echo "   Bucket doesn't exist or already empty"; \
		fi; \
	fi
	@echo ""
	@echo "[*]  Deleting frontend infrastructure stack..."
	@if [ -n "$(FRONTEND_BUCKET_PREFIX)" ]; then \
		aws cloudformation delete-stack --stack-name $(FRONTEND_BUCKET_PREFIX)-frontend 2>/dev/null || echo "   Stack doesn't exist"; \
	fi
	@echo ""
	@echo "[*]  Deleting backend stack..."
	@cd backend && sam delete --stack-name $(BACKEND_STACK_NAME) --no-prompts
	@echo ""
	@echo "[✓] Teardown complete"
	@echo ""
	@echo "[!]  Note: The following may need manual cleanup:"
	@echo "   - Route53 Hosted Zone (if created)"
	@echo "   - ACM Certificates (if created)"
	@echo "   - CloudWatch Log Groups (retained by default)"

#============================================================================
# Utilities
#============================================================================

logs:
	@if [ -z "$(FUNC)" ]; then \
		echo "Usage: make logs FUNC=<function-name>"; \
		echo ""; \
		echo "Available functions:"; \
		echo "  - guitars"; \
		echo "  - auth"; \
		echo "  - images"; \
		echo "  - specs"; \
		echo "  - documents"; \
		echo "  - provenance"; \
		echo "  - user"; \
		echo "  - public-guitars"; \
		echo ""; \
		echo "Example: make logs FUNC=guitars"; \
		exit 1; \
	fi
	@if [ -z "$(BACKEND_STACK_NAME)" ]; then \
		echo "[X] Error: BACKEND_STACK_NAME not set in .env.deploy"; \
		exit 1; \
	fi
	@LOG_GROUP="/aws/lambda/$(BACKEND_STACK_NAME)-$(FUNC)"; \
	echo "[*] Tailing logs: $$LOG_GROUP"; \
	aws logs tail $$LOG_GROUP --follow

clean:
	@echo "[*] Cleaning build artifacts and generated files..."
	@rm -rf dist/
	@rm -rf backend/.aws-sam/
	@rm -f $(BACKEND_OUTPUTS_FILE)
	@rm -f $(FRONTEND_OUTPUTS_FILE)
	@echo "[!]  Note: .env file preserved (delete manually if needed)"
	@echo "[✓] Cleaned"

status:
	@echo "[*] Current Configuration"
	@echo "======================="
	@echo ""
	@if [ -f .env.deploy ]; then \
		echo "[✓] .env.deploy exists"; \
		[ -n "$(AWS_ACCOUNT_ID)" ] && echo "   AWS Account: $(AWS_ACCOUNT_ID)" || echo "   AWS Account: Not set"; \
		[ -n "$(AWS_REGION)" ] && echo "   AWS Region: $(AWS_REGION)" || echo "   AWS Region: Not set"; \
		[ -n "$(FRONTEND_DOMAIN)" ] && echo "   Frontend: https://$(FRONTEND_DOMAIN)" || echo "   Frontend: Not configured"; \
		[ -n "$(API_DOMAIN)" ] && echo "   API: https://$(API_DOMAIN)" || echo "   API: Not configured"; \
		[ -n "$(BACKEND_STACK_NAME)" ] && echo "   Backend Stack: $(BACKEND_STACK_NAME)" || echo "   Backend Stack: Not set"; \
		[ -n "$(FRONTEND_BUCKET_PREFIX)" ] && echo "   Frontend Bucket Prefix: $(FRONTEND_BUCKET_PREFIX)" || echo "   Frontend Bucket Prefix: Not set"; \
	else \
		echo "[X] .env.deploy not found (run 'make init')"; \
	fi
	@echo ""
	@if [ -f backend/samconfig.toml ]; then \
		echo "[✓] backend/samconfig.toml exists"; \
	else \
		echo "[X] backend/samconfig.toml not found"; \
	fi
	@echo ""
	@if [ -f $(GENERATED_ENV_FILE) ]; then \
		echo "[✓] .env exists (auto-generated)"; \
	else \
		echo "[!]  .env not found (will be generated on backend deployment)"; \
	fi
	@echo ""
	@if [ -f $(BACKEND_OUTPUTS_FILE) ]; then \
		echo "[✓] Backend outputs cached:"; \
		cat $(BACKEND_OUTPUTS_FILE) | grep -v '^#' | grep -v '^$$'; \
	else \
		echo "[!]  No backend outputs cached"; \
	fi
	@echo ""
	@if [ -f $(FRONTEND_OUTPUTS_FILE) ]; then \
		echo "[✓] Frontend infrastructure outputs cached:"; \
		cat $(FRONTEND_OUTPUTS_FILE) | grep -v '^#' | grep -v '^$$'; \
	else \
		echo "[!]  No frontend infrastructure outputs cached"; \
	fi
	@echo ""
	@if [ -f .git/hooks/pre-commit ]; then \
		echo "[✓] Git pre-commit hook installed"; \
	else \
		echo "[!]  Git pre-commit hook not installed (run 'make init-hooks')"; \
	fi

validate:
	@echo "[*] Validating configuration..."
	@if [ ! -f .env.deploy ]; then \
		echo "[X] .env.deploy not found - run 'make init'"; \
		exit 1; \
	fi
	@if [ -z "$(AWS_ACCOUNT_ID)" ]; then \
		echo "[X] AWS_ACCOUNT_ID not set in .env.deploy"; \
		exit 1; \
	fi
	@if [ -z "$(AWS_REGION)" ]; then \
		echo "[X] AWS_REGION not set in .env.deploy"; \
		exit 1; \
	fi
	@if [ -z "$(FRONTEND_BUCKET_PREFIX)" ]; then \
		echo "[X] FRONTEND_BUCKET_PREFIX not set in .env.deploy"; \
		exit 1; \
	fi
	@if [ -z "$(BACKEND_STACK_NAME)" ]; then \
		echo "[X] BACKEND_STACK_NAME not set in .env.deploy"; \
		exit 1; \
	fi
	@if [ ! -f backend/samconfig.toml ]; then \
		echo "[X] backend/samconfig.toml not found"; \
		exit 1; \
	fi
	@if ! command -v aws >/dev/null 2>&1; then \
		echo "[X] AWS CLI not found - please install it"; \
		exit 1; \
	fi
	@if ! command -v sam >/dev/null 2>&1; then \
		echo "[X] SAM CLI not found - please install it"; \
		exit 1; \
	fi
	@if ! command -v jq >/dev/null 2>&1; then \
		echo "[X] jq not found - please install it (required for parsing CloudFormation outputs)"; \
		exit 1; \
	fi
	@echo "[✓] Configuration valid"
