
## File 12: `docs/operations/RUNBOOK.md`

```markdown
# Operations Runbook

## Deployment

### Staging Deployment

```bash
# 1. Merge PR to main
# 2. CI pipeline runs automatically
# 3. ArgoCD syncs to staging
# 4. Verify health
curl https://staging-api.fincore.com/health

# 1. Create release branch
git checkout -b release/v1.0.0

# 2. Update version
npm version patch

# 3. Push and create PR
git push origin release/v1.0.0

# 4. After approval, merge to main
# 5. Monitor ArgoCD sync

Monitoring
Health Checks
bash
# API health
GET /health
# Returns: { status: "ok", info: { database: "up", redis: "up" } }

# Readiness probe
GET /health/readiness

# Liveness probe
GET /health/liveness
Metrics
Metric	Target	Alert
p95 response time	<400ms	>800ms
Error rate	<0.1%	>1%
CPU usage	<70%	>85%
Memory usage	<80%	>90%
Database connections	<50	>80
Logging
bash
# View logs
kubectl logs -f deployment/fincore-backend -n production

# Search errors
kubectl logs deployment/fincore-backend | grep ERROR

# Follow all pods
stern fincore-backend
Troubleshooting
Database Connection Issues
bash
# Check connection
kubectl exec -it fincore-backend-pod -- npx prisma db execute --file health.sql

# Restart service
kubectl rollout restart deployment/fincore-backend
High Memory Usage
bash
# Check Node memory
kubectl exec -it fincore-backend-pod -- node -e "console.log(process.memoryUsage())"

# Increase limit
kubectl edit deployment/fincore-backend
# Update resources.limits.memory
Slow Queries
bash
# Enable query logging
export DEBUG="prisma:query"

# Analyze
kubectl exec -it fincore-backend-pod -- npx prisma studio
Backup & Recovery
Database Backup
bash
# Automated daily backup at 2 AM
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20250101.sql.gz | psql $DATABASE_URL
Configuration Backup
bash
# Backup secrets
kubectl get secrets -n production -o yaml > secrets-backup.yaml

# Backup configmaps
kubectl get configmaps -n production -o yaml > configmaps-backup.yaml
Incident Response
Severity Levels
Level	Description	Response Time
SEV0	System down	15 minutes
SEV1	Major feature broken	1 hour
SEV2	Minor issue	4 hours
SEV3	Cosmetic issue	24 hours
Runbook Steps
Acknowledge - Respond to alert

Assess - Determine severity and impact

Mitigate - Apply fix or rollback

Communicate - Update status page

Resolve - Deploy permanent fix

Review - Post-mortem within 48 hours