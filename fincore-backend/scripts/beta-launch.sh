#!/bin/bash
# scripts/beta-launch.sh
# Beta launch preparation script for FinCore

set -e

echo "🚀 FinCore Beta Launch Preparation"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BETA_EMAILS_FILE=${1:-"beta-emails.txt"}
DEPLOY_ENV=${2:-"staging"}

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Beta emails file: $BETA_EMAILS_FILE"
echo "  Deploy environment: $DEPLOY_ENV"
echo ""

# 1. Run all tests
echo -e "${BLUE}🧪 1. Running all tests...${NC}"
npm run test:ci || { echo -e "${YELLOW}⚠️  Unit tests failed${NC}"; exit 1; }
npm run test:e2e || { echo -e "${YELLOW}⚠️  E2E tests failed${NC}"; exit 1; }
echo -e "${GREEN}✅ All tests passed${NC}"
echo ""

# 2. Run OWASP audit
echo -e "${BLUE}🔒 2. Running security audit...${NC}"
bash scripts/owasp-audit.sh
echo ""

# 3. Run load test (optional, manual)
echo -e "${BLUE}⚡ 3. Running load test...${NC}"
read -p "Run load test? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    k6 run test/load/load-test.js || { echo -e "${YELLOW}⚠️  Load test failed${NC}"; exit 1; }
    echo -e "${GREEN}✅ Load test passed${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping load test${NC}"
fi
echo ""

# 4. Check database migrations
echo -e "${BLUE}🗄️ 4. Checking database migrations...${NC}"
npm run db:migrate:prod -- --dry-run || { echo -e "${YELLOW}⚠️  Migration dry run failed${NC}"; exit 1; }
echo -e "${GREEN}✅ Migrations are ready${NC}"
echo ""

# 5. Build production bundle
echo -e "${BLUE}📦 5. Building production bundle...${NC}"
npm run build || { echo -e "${YELLOW}⚠️  Build failed${NC}"; exit 1; }
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# 6. Send beta invitations
echo -e "${BLUE}📧 6. Sending beta invitations...${NC}"
if [ -f "$BETA_EMAILS_FILE" ]; then
    while IFS= read -r email; do
        if [ -n "$email" ]; then
            echo "  Sending invite to: $email"
            # Call API to send invitation
            curl -X POST "${API_URL:-http://localhost:3000}/v1/admin/beta/invite" \
              -H "Content-Type: application/json" \
              -H "Authorization: Bearer $ADMIN_TOKEN" \
              -d "{\"email\":\"$email\"}" 2>/dev/null || echo "    Failed to send to $email"
        fi
    done < "$BETA_EMAILS_FILE"
    echo -e "${GREEN}✅ Beta invitations sent${NC}"
else
    echo -e "${YELLOW}⚠️  Beta emails file not found: $BETA_EMAILS_FILE${NC}"
fi
echo ""

# 7. Deploy to staging
echo -e "${BLUE}🚢 7. Deploying to $DEPLOY_ENV...${NC}"
if [ "$DEPLOY_ENV" = "staging" ]; then
    docker build -t fincore-backend:staging .
    docker tag fincore-backend:staging "$ECR_REPO:staging"
    docker push "$ECR_REPO:staging"
    echo -e "${GREEN}✅ Deployed to staging${NC}"
else
    echo -e "${YELLOW}⚠️  Skipping deployment (production requires manual approval)${NC}"
fi
echo ""

# 8. Health check
echo -e "${BLUE}🏥 8. Running health check...${NC}"
sleep 10
curl -f "${API_URL:-http://localhost:3000}/health" || { echo -e "${YELLOW}⚠️  Health check failed${NC}"; exit 1; }
echo -e "${GREEN}✅ Health check passed${NC}"
echo ""

# 9. Generate beta report
echo -e "${BLUE}📊 9. Generating beta launch report...${NC}"
cat > beta-launch-report.md << EOF
# FinCore Beta Launch Report
## $(date)

### Pre-Launch Checks
- [x] All unit tests passed
- [x] All E2E tests passed
- [x] Security audit completed
- [x] Database migrations verified
- [x] Production build successful
- [x] Health check passed

### Deployment Information
- **Environment:** $DEPLOY_ENV
- **Timestamp:** $(date)
- **Version:** $(git rev-parse --short HEAD)

### Next Steps
1. Monitor system metrics for first 24 hours
2. Collect beta user feedback
3. Track error rates and performance
4. Prepare for GA launch

### Contact
- Support: support@fincore.com
- Emergency: +92-XXX-XXXXXXX
EOF

echo -e "${GREEN}✅ Beta launch report generated: beta-launch-report.md${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Beta Launch Preparation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Review beta-launch-report.md"
echo "  2. Monitor staging environment"
echo "  3. Collect feedback from beta users"
echo "  4. Schedule GA launch"