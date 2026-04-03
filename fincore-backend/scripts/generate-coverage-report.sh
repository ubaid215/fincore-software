#!/bin/bash
# scripts/generate-coverage-report.sh

set -e

echo "📊 Generating test coverage report"
echo "=================================="

# Run unit tests with coverage
npm run test:cov

# Run E2E tests with coverage
npm run test:e2e -- --coverage

# Merge coverage reports
npx nyc merge coverage coverage/merged

# Generate HTML report
npx nyc report --reporter=html --reporter=lcov --reporter=text

echo ""
echo "✅ Coverage report generated in coverage/index.html"
echo "📈 Opening report..."

# Open in browser (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    open coverage/index.html
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open coverage/index.html
fi 