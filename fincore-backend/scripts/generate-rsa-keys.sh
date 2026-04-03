#!/bin/bash
# Usage: bash scripts/generate-rsa-keys.sh
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
echo "✅ RSA-2048 key pair generated in keys/"
echo "⚠️  Never commit these files to git"