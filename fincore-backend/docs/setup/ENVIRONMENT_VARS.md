
## File 3: `docs/setup/ENVIRONMENT_VARS.md`

```markdown
# Environment Variables

## Required Variables

### Application
| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment | development | production |
| `PORT` | API port | 3000 | 3000 |
| `CORS_ORIGINS` | Allowed origins | http://localhost:5173 | https://app.fincore.com |
| `THROTTLE_TTL` | Rate limit window (seconds) | 60 | 60 |
| `THROTTLE_LIMIT` | Requests per window | 100 | 100 |

### Database
| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | postgresql://fincore:devpassword@localhost:5432/fincore_dev |

### Redis
| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `REDIS_PASSWORD` | Redis password | (empty) |

### JWT Authentication
| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_PRIVATE_KEY_PATH` | RSA private key path | ./keys/private.pem |
| `JWT_PUBLIC_KEY_PATH` | RSA public key path | ./keys/public.pem |
| `JWT_EXPIRES_IN` | Access token expiry | 15m |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | 7d |

### AWS S3
| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | ap-south-1 |
| `AWS_ACCESS_KEY_ID` | AWS access key | local-dummy |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | local-dummy |
| `S3_RECEIPTS_BUCKET` | Receipts bucket | fincore-receipts-dev |
| `S3_DOCUMENTS_BUCKET` | Documents bucket | fincore-documents-dev |

### Email (SMTP)
| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server | localhost |
| `SMTP_PORT` | SMTP port | 1025 |
| `SMTP_USER` | SMTP username | (empty) |
| `SMTP_PASS` | SMTP password | (empty) |
| `EMAIL_FROM` | From address | noreply@fincore.local |

### Bank Details (Pro-forma Invoices)
| Variable | Description | Default |
|----------|-------------|---------|
| `BANK_NAME` | Bank name | HBL |
| `BANK_ACCOUNT_TITLE` | Account title | FinCore Technologies (Pvt) Ltd |
| `BANK_IBAN` | IBAN | PK00HABB0000000000000000 |
| `BANK_SWIFT` | SWIFT code | HABBPKKA |

### FX Rates
| Variable | Description |
|----------|-------------|
| `OPEN_EXCHANGE_RATES_APP_ID` | API key for live rates |

## Environment Files

| File | Purpose | Git |
|------|---------|-----|
| `.env.example` | Template with all variables | ✓ |
| `.env` | Production (never commit) | ✗ |
| `.env.local` | Local development | ✗ |
| `.env.test` | Testing | ✗ |

## Generating RSA Keys

```bash
# Generate 2048-bit RSA key pair
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# Verify
ls -la keys/
# private.pem  (1.7 KB)
# public.pem   (0.5 KB)