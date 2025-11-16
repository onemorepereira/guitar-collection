#!/bin/bash
set -e

echo "🎸 Deploying Backend..."
cd backend
sam build
sam deploy --no-confirm-changeset
echo "✅ Backend deployed successfully"
