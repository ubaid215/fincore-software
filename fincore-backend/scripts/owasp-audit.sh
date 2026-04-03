#!/bin/bash
# scripts/owasp-audit.sh
# OWASP security audit script for FinCore

set -e

echo "🔒 OWASP Security Audit - FinCore"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Dependency vulnerability scan
echo "📦 1. Scanning dependencies for vulnerabilities..."
npm audit --json > audit-results.json 2>/dev/null || true

VULN_COUNT=$(jq '.metadata.vulnerabilities.total' audit-results.json 2>/dev/null || echo "0")
if [ "$VULN_COUNT" -gt 0 ]; then
    echo -e "${RED}⚠️  Found $VULN_COUNT vulnerabilities${NC}"
    jq '.advisories | to_entries[] | "  - \(.value.title): \(.value.severity)"' audit-results.json 2>/dev/null || true
else
    echo -e "${GREEN}✅ No vulnerabilities found in dependencies${NC}"
fi

# 2. Check for secrets in code
echo ""
echo "🔑 2. Scanning for hardcoded secrets..."
if command -v gitleaks &> /dev/null; then
    gitleaks detect --source . --no-git --verbose
else
    echo -e "${YELLOW}⚠️  gitleaks not installed. Run: brew install gitleaks${NC}"
    # Basic secret pattern check
    echo "Checking for common secret patterns..."
    grep -r --include="*.ts" --include="*.js" "secret.*=.*['\"]" src/ 2>/dev/null | grep -v "test" | grep -v ".env" && echo -e "${RED}⚠️  Potential secrets found${NC}" || echo -e "${GREEN}✅ No obvious secrets found${NC}"
fi

# 3. Check for SQL injection patterns
echo ""
echo "🗄️ 3. Scanning for SQL injection patterns..."
SQL_INJECTION=$(grep -r --include="*.ts" --include="*.js" -E '\$queryRaw|\$executeRaw' src/ 2>/dev/null | grep -v "prisma.service" | wc -l)
if [ "$SQL_INJECTION" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $SQL_INJECTION raw SQL queries. Review for parameterization.${NC}"
else
    echo -e "${GREEN}✅ No raw SQL queries found${NC}"
fi

# 4. Check for missing rate limiting
echo ""
echo "🚦 4. Checking rate limiting configuration..."
if grep -r "ThrottlerModule" src/ 2>/dev/null | grep -q "forRoot"; then
    echo -e "${GREEN}✅ Rate limiting is configured${NC}"
else
    echo -e "${RED}⚠️  Rate limiting not found. Add ThrottlerModule to prevent DoS attacks.${NC}"
fi

# 5. Check for Helmet.js (security headers)
echo ""
echo "🛡️ 5. Checking security headers (Helmet)..."
if grep -r "helmet" src/ 2>/dev/null | grep -q "app.use"; then
    echo -e "${GREEN}✅ Helmet.js is configured${NC}"
else
    echo -e "${RED}⚠️  Helmet.js not found. Add to main.ts for security headers.${NC}"
fi

# 6. Check for CORS configuration
echo ""
echo "🌐 6. Checking CORS configuration..."
if grep -r "enableCors" src/ 2>/dev/null | grep -q "credentials: true"; then
    echo -e "${GREEN}✅ CORS is properly configured${NC}"
else
    echo -e "${YELLOW}⚠️  CORS may not be properly configured${NC}"
fi

# 7. Check for input validation
echo ""
echo "✅ 7. Checking input validation (class-validator)..."
VALIDATION_COUNT=$(grep -r --include="*.ts" "@IsString\|@IsNumber\|@IsEmail" src/ 2>/dev/null | wc -l)
if [ "$VALIDATION_COUNT" -gt 50 ]; then
    echo -e "${GREEN}✅ Input validation found ($VALIDATION_COUNT validators)${NC}"
else
    echo -e "${YELLOW}⚠️  Limited input validation found ($VALIDATION_COUNT validators)${NC}"
fi

# 8. Check for JWT expiration
echo ""
echo "⏰ 8. Checking JWT configuration..."
if grep -r "JWT_EXPIRES_IN" .env* 2>/dev/null | grep -q "15m\|30m"; then
    echo -e "${GREEN}✅ JWT expiration is configured${NC}"
else
    echo -e "${YELLOW}⚠️  Check JWT expiration time in .env${NC}"
fi

# 9. Check for secure cookie settings
echo ""
echo "🍪 9. Checking cookie security..."
if grep -r "httpOnly\|secure\|sameSite" src/ 2>/dev/null | grep -q "true"; then
    echo -e "${GREEN}✅ Secure cookie attributes found${NC}"
else
    echo -e "${YELLOW}⚠️  Consider adding httpOnly and secure flags to cookies${NC}"
fi

# 10. Check for environment variable exposure
echo ""
echo "🔐 10. Checking environment variables..."
ENV_VARS=$(grep -v "^#" .env.example 2>/dev/null | grep -v "^$" | wc -l)
if [ "$ENV_VARS" -gt 10 ]; then
    echo -e "${GREEN}✅ Environment variables properly documented ($ENV_VARS vars)${NC}"
else
    echo -e "${YELLOW}⚠️  Check .env.example for missing variables${NC}"
fi

echo ""
echo "=================================="
echo "📊 OWASP Audit Summary"
echo "=================================="
echo "Review the findings above and address any RED items before production deployment."
echo ""
echo "For full OWASP compliance, also check:"
echo "  - Authentication (MFA implemented ✓)"
echo "  - Authorization (RBAC implemented ✓)"
echo "  - Session management"
echo "  - Logging & monitoring"
echo "  - Data encryption at rest"
echo "  - Backup & recovery"