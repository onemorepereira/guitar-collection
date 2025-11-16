#!/bin/bash
set -e

# Usage: ./setup-domain.sh <your-domain.com>
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain>"
  echo "Example: $0 myapp.com"
  exit 1
fi

API_DOMAIN="api.${DOMAIN}"
REGION="${AWS_REGION:-us-east-1}"

echo "🌐 Setting up custom domain for Guitar Collection API..."
echo "   Domain: $DOMAIN"
echo "   API Domain: $API_DOMAIN"
echo ""

# Check if hosted zone exists
echo "📋 Checking for Route53 hosted zone for $DOMAIN..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "$DOMAIN" \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id" \
  --output text | sed 's/\/hostedzone\///')

if [ -z "$HOSTED_ZONE_ID" ]; then
  echo "⚠️  No hosted zone found for $DOMAIN"
  echo "Creating hosted zone..."

  HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
    --name "$DOMAIN" \
    --caller-reference "guitar-collection-$(date +%s)" \
    --hosted-zone-config Comment="Hosted zone for Guitar Collection" \
    --query 'HostedZone.Id' \
    --output text | sed 's/\/hostedzone\///')

  echo "✅ Created hosted zone: $HOSTED_ZONE_ID"

  # Get nameservers
  NAMESERVERS=$(aws route53 get-hosted-zone \
    --id "$HOSTED_ZONE_ID" \
    --query 'DelegationSet.NameServers' \
    --output table)

  echo "📌 Update your domain registrar with these nameservers:"
  echo "$NAMESERVERS"
else
  echo "✅ Found hosted zone: $HOSTED_ZONE_ID"
fi

# Update samconfig.toml with hosted zone ID
echo "📝 Updating samconfig.toml with hosted zone ID..."
if grep -q "HostedZoneId=" samconfig.toml; then
  # Update existing
  sed -i.bak "s/HostedZoneId='[^']*'/HostedZoneId='$HOSTED_ZONE_ID'/" samconfig.toml
else
  # Add new parameter
  sed -i.bak "s/parameter_overrides = \"\(.*\)\"/parameter_overrides = \"\1 HostedZoneId='$HOSTED_ZONE_ID'\"/" samconfig.toml
fi

echo "✅ Domain setup complete!"
echo ""
echo "Hosted Zone ID: $HOSTED_ZONE_ID"
echo "Domain: $DOMAIN"
echo "API Domain: $API_DOMAIN"
echo ""
echo "Next steps:"
echo "1. If you created a new hosted zone, update your domain registrar with the nameservers shown above"
echo "2. Run 'sam build && sam deploy --guided' to deploy the stack"
echo "3. The ACM certificate will be automatically validated via DNS"
