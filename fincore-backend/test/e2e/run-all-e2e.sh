#!/bin/bash
# test/e2e/run-all-e2e.sh
# Run all E2E tests with coverage

set -e

echo "🧪 Running all E2E tests for FinCore"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Start Docker infrastructure
echo -e "${YELLOW}Starting Docker infrastructure...${NC}"
npm run docker:up
sleep 5

# Run migrations on test database
echo -e "${YELLOW}Running migrations...${NC}"
DATABASE_URL="postgresql://fincore:devpassword@localhost:5432/fincore_dev" npx prisma migrate deploy

# List of all E2E test files
E2E_TESTS=(
    "auth.e2e-spec.ts"
    "workspace.e2e-spec.ts"
    "chart-of-accounts.e2e-spec.ts"
    "general-ledger.e2e-spec.ts"
    "invoicing.e2e-spec.ts"
    "expenses.e2e-spec.ts"
    "bank-reconciliation.e2e-spec.ts"
    "subscriptions.e2e-spec.ts"
    "manual-payments.e2e-spec.ts"
    "financial-reports.e2e-spec.ts"
    "inventory.e2e-spec.ts"
    "analytics.e2e-spec.ts"
    "onboarding.e2e-spec.ts"
)

PASSED=0
FAILED=0
FAILED_TESTS=()

echo ""
echo -e "${YELLOW}Running E2E tests...${NC}"
echo ""

for test in "${E2E_TESTS[@]}"; do
    echo -n "  Running $test ... "
    if npx jest --config test/jest-e2e.config.ts --testPathPattern="$test" --forceExit --silent; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
        FAILED_TESTS+=("$test")
    fi
done

echo ""
echo "===================================="
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo "===================================="

if [ $FAILED -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  - $test"
    done
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All E2E tests passed!${NC}"

# Stop Docker infrastructure
echo ""
echo -e "${YELLOW}Stopping Docker infrastructure...${NC}"
npm run docker:down

exit 0
