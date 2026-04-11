#!/bin/bash
# scripts/generate-rsa-keys.sh
# Generates RS256 key pair for JWT signing.
# Run once during project setup: bash scripts/generate-rsa-keys.sh

set -e

KEYS_DIR="./keys"
mkdir -p "$KEYS_DIR"

echo "🔑  Generating RSA-2048 key pair..."

openssl genrsa -out "$KEYS_DIR/private.pem" 2048
openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"

chmod 600 "$KEYS_DIR/private.pem"
chmod 644 "$KEYS_DIR/public.pem"

echo "✅  Keys written to $KEYS_DIR/"
echo "    private.pem — keep secret, never commit"
echo "    public.pem  — safe to share with services that verify tokens"
echo ""
echo "Add to .gitignore:"
echo "    keys/"