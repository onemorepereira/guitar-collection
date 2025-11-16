#!/bin/bash
# Production Environment Validation Script
# Validates that all changes work correctly with existing production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "==================================="
echo "Production Validation Report"
echo "==================================="
echo ""

# Track failures
FAILURES=0

# Helper functions
pass() {
    echo -e "   ${GREEN}✅${NC} $1"
}

fail() {
    echo -e "   ${RED}❌${NC} $1"
    ((FAILURES++))
}

warn() {
    echo -e "   ${YELLOW}⚠️${NC}  $1"
}

# 1. Configuration Files
echo "1. Configuration Files:"
if [ -f .env.deploy ]; then
    pass ".env.deploy exists"

    # Source the file to get values
    source .env.deploy

    # Check required values are set (not empty)
    if [ -n "$AWS_ACCOUNT_ID" ]; then
        pass "AWS_ACCOUNT_ID is configured"
    else
        fail "AWS_ACCOUNT_ID not set in .env.deploy"
    fi

    if [ -n "$FRONTEND_DOMAIN" ]; then
        pass "FRONTEND_DOMAIN is configured ($FRONTEND_DOMAIN)"
    else
        fail "FRONTEND_DOMAIN not set in .env.deploy"
    fi

    if [ -n "$AWS_REGION" ]; then
        pass "AWS_REGION is configured ($AWS_REGION)"
    else
        warn "AWS_REGION not set (will use default)"
    fi
else
    fail ".env.deploy missing"
fi

if [ -f backend/samconfig.toml ]; then
    pass "backend/samconfig.toml exists"
else
    fail "backend/samconfig.toml missing"
fi

if [ -f .env ]; then
    pass ".env exists"
    if grep -q "VITE_API_URL=" .env; then
        API_URL=$(grep "VITE_API_URL=" .env | cut -d'=' -f2)
        pass "API URL configured: $API_URL"
    else
        warn "VITE_API_URL not set in .env"
    fi
else
    warn ".env missing (ok for fresh clone)"
fi
echo ""

# 2. Makefile Targets
echo "2. Makefile Targets:"
if make status > /dev/null 2>&1; then
    pass "make status works"
else
    fail "make status failed"
fi

if make validate > /dev/null 2>&1; then
    pass "make validate works"
else
    fail "make validate failed"
fi
echo ""

# 3. Git Ignore Status
echo "3. Git Ignore Status:"
if git status --short .env .env.deploy backend/samconfig.toml CLAUDE.md 2>/dev/null | grep -q .; then
    fail "Sensitive files not ignored!"
    git status --short .env .env.deploy backend/samconfig.toml CLAUDE.md 2>/dev/null
else
    pass "Sensitive files properly ignored"
fi

# Check scripts are NOT ignored (they should be committed now)
if git check-ignore scripts/deploy-frontend.sh 2>/dev/null; then
    fail "scripts/deploy-frontend.sh is ignored (should be committed)"
else
    pass "Scripts are tracked (not ignored)"
fi
echo ""

# 4. Frontend Build
echo "4. Frontend Build:"
if npm run build > /tmp/build.log 2>&1; then
    pass "Frontend build succeeds"

    # Check that build output exists
    if [ -d "dist/assets" ] && [ "$(ls -A dist/assets/*.js 2>/dev/null)" ]; then
        pass "Build artifacts generated"
    else
        warn "Build artifacts not found in dist/assets"
    fi
else
    fail "Frontend build failed (see /tmp/build.log)"
    cat /tmp/build.log | tail -20
fi
echo ""

# 5. Backend Build
echo "5. Backend Build:"
cd backend
if sam build > /tmp/sam-build.log 2>&1; then
    pass "Backend SAM build succeeds"
else
    fail "Backend SAM build failed (see /tmp/sam-build.log)"
    cat /tmp/sam-build.log | tail -20
fi
cd ..
echo ""

# 6. Production API (if accessible)
echo "6. Production API Status:"
if [ -n "$FRONTEND_DOMAIN" ]; then
    API_DOMAIN="api.${FRONTEND_DOMAIN}"

    if curl -s --max-time 5 "https://${API_DOMAIN}/public/guitars/random" > /dev/null 2>&1; then
        pass "Production API responding (https://${API_DOMAIN})"
    else
        warn "Production API not responding at https://${API_DOMAIN} (check if deployed)"
    fi

    if curl -s --max-time 5 "https://${FRONTEND_DOMAIN}" | grep -q "Guitar Collection" 2>/dev/null; then
        pass "Production frontend loading (https://${FRONTEND_DOMAIN})"
    else
        warn "Production frontend not loading at https://${FRONTEND_DOMAIN} (check if deployed)"
    fi
else
    warn "FRONTEND_DOMAIN not set, skipping API checks"
fi
echo ""

# 7. Pre-commit Hook
echo "7. Security (Pre-commit Hook):"
if [ -f .git/hooks/pre-commit ] && [ -x .git/hooks/pre-commit ]; then
    pass "Pre-commit hook installed and executable"
else
    warn "Pre-commit hook not installed (run: make init-hooks)"
fi
echo ""

# 8. Documentation
echo "8. Documentation:"
DOCS=("README.md" "DEVELOPMENT.md" "CONTRIBUTING.md" "backend/README.md" "backend/docs/SECURITY.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        pass "$doc exists"
    else
        fail "$doc missing"
    fi
done
echo ""

# 9. Template Files
echo "9. Configuration Templates:"
TEMPLATES=(".env.template" ".env.deploy.example" "backend/samconfig.toml.example")
for template in "${TEMPLATES[@]}"; do
    if [ -f "$template" ]; then
        pass "$template exists"

        # Check for production domain in templates (should use placeholders instead)
        if [ -n "$FRONTEND_DOMAIN" ] && grep -q "$FRONTEND_DOMAIN" "$template" 2>/dev/null; then
            fail "$template contains your production domain ($FRONTEND_DOMAIN) - should use generic placeholders"
        else
            pass "$template uses generic placeholders"
        fi
    else
        fail "$template missing"
    fi
done
echo ""

# Summary
echo "==================================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✅ All validations passed!${NC}"
    echo ""
    echo "You're ready to commit:"
    echo "  git add ."
    echo "  git commit -m 'Initial commit: Guitar Collection Manager'"
    echo "  git push"
else
    echo -e "${RED}❌ $FAILURES validation(s) failed${NC}"
    echo ""
    echo "Review failures above and fix before committing."
    echo "See VALIDATION.md for detailed troubleshooting."
    exit 1
fi
echo "==================================="
