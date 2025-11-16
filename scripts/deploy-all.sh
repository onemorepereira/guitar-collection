#!/bin/bash
set -e

echo "🎸 Full Deployment"
echo "=================="

# Backend
./scripts/deploy-backend.sh

echo ""

# Frontend
./scripts/deploy-frontend.sh

echo ""
echo "✨ Complete deployment finished!"
