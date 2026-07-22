# Phase 6: Production Deployment - Quick Reference

**Status**: 🟢 READY FOR DEPLOYMENT  
**Target**: Production Deployment with Zero Downtime  
**Timeline**: Week 11-12  

---

## 🚀 Quick Start Deployment

### Option 1: Full Canary Deployment (Recommended)

```bash
# 1. Build and push new version
docker build -f Dockerfile.production -t registry.fixtray.com/fixtray:0.0.4 .
docker push registry.fixtray.com/fixtray:0.0.4

# 2. Deploy to Kubernetes (canary)
kubectl apply -f k8s/production-deployment.yml

# 3. Start phased rollout
bash scripts/deploy-canary.sh

# 4. Monitor (10 min Phase 1, 1 hour Phase 2, then Phase 3)
kubectl logs -l app=fixtray,deployment=canary -f

# 5. If successful, cleanup old deployment
kubectl delete deployment fixtray-old -n fixtray-prod
```

### Option 2: Rolling Restart

```bash
# For small changes, rolling update
kubectl rollout restart deployment/fixtray -n fixtray-prod

# Monitor progress
kubectl rollout status deployment/fixtray -n fixtray-prod --watch
```

### Option 3: Emergency Rollback

```bash
# Instant rollback to previous version
kubectl rollout undo deployment/fixtray-new -n fixtray-prod
kubectl scale deployment/fixtray-new --replicas=0 -n fixtray-prod
kubectl scale deployment/fixtray-old --replicas=10 -n fixtray-prod
```

---

## ✅ Pre-Deployment Checklist

- [ ] All Phase 5 tests passed (≥95%)
- [ ] Code reviewed and merged
- [ ] Secrets configured in .env.production
- [ ] Database backed up
- [ ] Staging deployed and verified
- [ ] Health check endpoints tested
- [ ] Monitoring configured (Sentry, dashboards)
- [ ] Team notified
- [ ] Support standby ready

---

## 📊 Health Checks

### During Deployment

```bash
# Watch deployment progress
kubectl get pods -l app=fixtray -w

# Check health endpoints
curl https://api.fixtray.com/api/monitoring/liveness
curl https://api.fixtray.com/api/monitoring/readiness
curl https://api.fixtray.com/api/health

# Monitor error logs
kubectl logs -l app=fixtray --tail=100 -f
```

### After Deployment

```bash
# Verify all replicas running
kubectl get deployment fixtray -o wide

# Check service endpoints
kubectl get svc fixtray -o wide

# Test API endpoints
curl https://api.fixtray.com/api/workorders
curl https://api.fixtray.com/api/customers

# Check Sentry for errors
# https://sentry.io/organizations/fixtray/issues/
```

---

## 🔍 Monitoring Dashboards

### Kubernetes Dashboard
```bash
# Port-forward to dashboard
kubectl proxy
# Visit: http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
```

### Application Health
- **URL**: https://api.fixtray.com/api/monitoring/readiness
- **Status**: Should return 200 with `ready: true`

### Prometheus Metrics
- **URL**: https://api.fixtray.com/api/monitoring/metrics
- **Endpoint**: Prometheus scrapes every 30s

### Sentry Error Tracking
- **URL**: https://sentry.io/organizations/fixtray/
- **Alert on**: >10 errors per minute

---

## 📈 Performance Targets (Post-Deployment)

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Error Rate | <1% | >5% |
| Avg Response | <500ms | >1s |
| p95 Response | <1.5s | >3s |
| Uptime | 99.9% | <99% |
| CPU | <70% | >85% |
| Memory | <80% | >90% |
| DB Connections | <75% of pool | >90% |
| Redis Memory | <80% | >95% |

---

## 🔧 Common Issues & Fixes

### Issue: Deployment stuck at 0% progress

```bash
# Check pod events
kubectl describe pod <pod-name> -n fixtray-prod

# Check resource limits
kubectl top nodes
kubectl top pods -n fixtray-prod

# Check database connection
kubectl logs <pod-name> -n fixtray-prod | grep -i database
```

**Fix**: Usually caused by database not ready, increase timeout in deployment

### Issue: High error rate post-deployment

```bash
# Check recent errors in Sentry
# Typical causes:
# - Database migration not run
# - New env variables missing
# - New service dependency unavailable (Redis, Firebase, etc.)

# Solution: Check .env.production is correctly loaded
kubectl get secret fixtray-secrets -o yaml
```

### Issue: Connection timeouts to database

```bash
# Verify database is accessible
kubectl run -it --rm debug --image=postgres:15-alpine --restart=Never -- \
  psql -h db.fixtray.com -U postgres -c "SELECT 1"

# Check database connection pool
kubectl logs <pod-name> | grep -i "pool\|connection"
```

---

## 📝 Deployment Log Template

```markdown
# Deployment Log - [VERSION] - [DATE]

## Pre-Deployment
- [ ] All checks passed
- [ ] Time: ____
- [ ] Team: ____

## Deployment Started
- [ ] Phase 1 (10% - 30 min)
  - Error rate: ___%
  - Avg response: ___ms
  - Status: ✅ OK / ⚠️ WARNING / ❌ CRITICAL
  
- [ ] Phase 2 (50% - 1 hour)
  - Error rate: ___%
  - Avg response: ___ms
  - Status: ✅ OK / ⚠️ WARNING / ❌ CRITICAL
  
- [ ] Phase 3 (100%)
  - Error rate: ___%
  - Avg response: ___ms
  - Status: ✅ OK / ⚠️ WARNING / ❌ CRITICAL

## Post-Deployment (24 hours)
- [ ] No critical incidents
- [ ] All metrics normal
- [ ] User reports: ____

## Sign-Off
- Deployed by: ____
- Approved by: ____
- Time completed: ____
```

---

## 📞 Emergency Contacts

- **On-Call Engineer**: [Name] +1-XXX-XXX-XXXX
- **Database Admin**: [Name] +1-XXX-XXX-XXXX
- **Security Team**: security@fixtray.com
- **Support**: support@fixtray.com
- **Escalation**: devops@fixtray.com

---

## 🎯 Success Criteria

✅ Deployment successful when:
- Zero downtime during rollout
- Error rate remains <1%
- All health checks passing
- No database migrations pending
- All services operational
- No rollback needed

---

## 📊 Phased Rollout Strategy

```
Time    | Phase 1  | Phase 2  | Phase 3   | Phase 4
        | 10%      | 50%      | 100%      | Stable
--------|----------|----------|-----------|----------
Users   | 1 of 10  | 5 of 10  | 10 of 10  | 10 of 10
Monitor | 30 min   | 1 hour   | Ongoing   | Daily
Action  | Watch    | Expand   | Complete  | Confirm
Abort?  | If >5%   | If >2%   | If >1%    | Never
        | errors   | errors   | errors    | (locked)
```

---

## 🚨 Automatic Rollback Triggers

Deployment will automatically abort and rollback if:

- ❌ Error rate > 5% for 2 minutes
- ❌ p95 response time > 5 seconds
- ❌ Database connections > 95%
- ❌ Memory usage > 95%
- ❌ Health check fails 3 times
- ❌ Manual abort via: `kubectl rollout undo deployment/fixtray`

---

## 🔐 Secrets Management

### Load Production Secrets

```bash
# Create secrets from env file
kubectl create secret generic fixtray-secrets \
  --from-env-file=.env.production \
  -n fixtray-prod

# Or update existing secrets
kubectl set env deployment/fixtray-new \
  --from=secret/fixtray-secrets \
  -n fixtray-prod
```

### Verify Secrets Loaded

```bash
# Check secrets exist
kubectl get secrets -n fixtray-prod

# Verify secret mounting
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[0].env}' | grep secret
```

---

## 📱 Monitoring Setup

### Prometheus Scraping
```yaml
# Prometheus will scrape:
# - https://api.fixtray.com/api/monitoring/metrics
# - Every 30 seconds
# - Store metrics for 15 days
```

### Grafana Dashboard
1. Add Prometheus datasource
2. Import dashboard: `dashboards/fixtray-prod.json`
3. Alert thresholds configured

### Sentry Alerts
- Configured to alert #devops Slack channel
- Alert on >10 errors/minute
- Alert on new issue types

---

## ✅ Post-Deployment Checklist (24 hours)

- [ ] Zero incidents during 24 hours
- [ ] Error rate stable (<1%)
- [ ] Response times normal (<500ms avg)
- [ ] All features working (test manually)
- [ ] Customer feedback positive
- [ ] Database healthy
- [ ] Redis cache performing
- [ ] Backups completed successfully
- [ ] Team happy with deployment

---

## 🎓 Next Steps

**After successful deployment**:
1. ✅ Document any issues found
2. ✅ Update runbooks
3. ✅ Schedule retrospective
4. ✅ Plan Phase 7 (v0.0.5)
5. ✅ Enable continuous monitoring

---

**Last Updated**: 2026-07-22  
**Version**: 0.0.4  
**Ready for**: Production Deployment
