
## File 11: `docs/devops/CI_CD.md`

```markdown
# CI/CD Pipeline

## GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run lint

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v4

  e2e-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run test:e2e

  deploy-staging:
    needs: [lint, unit-tests, e2e-tests]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1
      - run: |
          docker build -t fincore-backend:staging .
          docker tag fincore-backend:staging $ECR_REPO:staging
          docker push $ECR_REPO:staging
      - run: kubectl rollout restart deployment/fincore-backend -n staging


      PR opened / push to main
         │
 ┌───────▼──────┐
 │    Lint      │  ESLint + Prettier
 └───────┬──────┘
         │
 ┌───────▼──────┐
 │ Unit Tests   │  Jest, 80% coverage
 └───────┬──────┘
         │
 ┌───────▼──────┐
 │  E2E Tests   │  Jest + Supertest
 └───────┬──────┘
         │ (main only)
 ┌───────▼──────┐
 │ Docker Build │  Push to ECR
 └───────┬──────┘
         │
 ┌───────▼──────┐
 │ ArgoCD Sync  │  Deploy to staging
 └──────────────┘

 nvironment Variables (CI)
Secret	Purpose
AWS_ACCESS_KEY_ID	ECR access
AWS_SECRET_ACCESS_KEY	ECR access
DATABASE_URL	Test database
JWT_SECRET	Test token signing
CODECOV_TOKEN	Coverage upload