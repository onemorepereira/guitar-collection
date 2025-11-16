#!/bin/bash
set -e

# Get API URL from argument, .env.deploy, or .env
if [ -n "$1" ]; then
  API_URL="$1"
elif [ -f .env.deploy ]; then
  source .env.deploy
  if [ -n "$FRONTEND_DOMAIN" ]; then
    API_URL="https://api.${FRONTEND_DOMAIN}"
  fi
elif [ -f .env ]; then
  source .env
  API_URL="${VITE_API_URL}"
fi

# Validate we have an API URL
if [ -z "$API_URL" ]; then
  echo "❌ Error: No API URL configured"
  echo ""
  echo "Usage:"
  echo "  $0 <api-url>                          # Provide URL directly"
  echo "  $0                                     # Auto-detect from .env.deploy or .env"
  echo ""
  echo "Examples:"
  echo "  $0 https://api.example.com"
  echo "  $0 https://xyz123.execute-api.us-east-1.amazonaws.com/prod"
  exit 1
fi

echo "🧪 Testing API Endpoints..."
echo "   API URL: $API_URL"
echo ""

# Test public endpoint
echo "Testing public endpoint..."
curl -s -X GET "$API_URL/public/guitars/random" | jq '.'
echo "✅ Public endpoint OK"
echo ""

# Test health/connectivity
echo "Testing API connectivity..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/guitars" -H "Authorization: Bearer invalid")
if [ "$STATUS" == "401" ]; then
  echo "✅ Auth endpoint OK (properly rejecting invalid token)"
else
  echo "⚠️  Unexpected status: $STATUS"
fi

echo ""
echo "✨ Basic tests complete"
