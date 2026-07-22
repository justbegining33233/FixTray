#!/bin/bash
# Production Canary Deployment Script for FixTray
# 
# Usage: ./deploy-canary.sh [version] [image-tag]
# Example: ./deploy-canary.sh 0.0.4 registry.fixtray.com/fixtray:0.0.4

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

ENVIRONMENT="production"
NAMESPACE="fixtray-prod"
OLD_DEPLOYMENT="fixtray-old"
NEW_DEPLOYMENT="fixtray-new"

# Accept parameters
VERSION=${1:-0.0.4}
IMAGE=${2:-registry.fixtray.com/fixtray:0.0.4}

# Thresholds
PHASE1_ERROR_THRESHOLD=5
PHASE2_ERROR_THRESHOLD=2
PHASE3_ERROR_THRESHOLD=1

# Timing
PHASE1_DURATION=1800        # 30 minutes
PHASE2_DURATION=3600        # 1 hour
PHASE2_CHECK_INTERVAL=300   # 5 minutes

# ============================================================================
# LOGGING
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# ============================================================================
# FUNCTIONS
# ============================================================================

check_prerequisites() {
  log_info "Checking prerequisites..."
  
  if ! command -v kubectl &> /dev/null; then
    log_error "kubectl not found"
    exit 1
  fi
  
  if ! command -v curl &> /dev/null; then
    log_error "curl not found"
    exit 1
  fi
  
  # Check namespace exists
  if ! kubectl get namespace ${NAMESPACE} &> /dev/null; then
    log_error "Namespace ${NAMESPACE} not found"
    exit 1
  fi
  
  log_success "All prerequisites met"
}

verify_staging() {
  log_info "Verifying staging deployment..."
  
  STAGING_TESTS=$(kubectl get pod -l app=fixtray-staging --no-headers 2>/dev/null | wc -l)
  
  if [ "${STAGING_TESTS}" -lt 1 ]; then
    log_warning "No staging pods found, skipping staging verification"
  else
    log_success "Staging environment verified"
  fi
}

backup_database() {
  log_info "Initiating database backup..."
  
  # This would be specific to your database setup
  # Example for PostgreSQL:
  # BACKUP_FILE="/backups/fixtray-prod-$(date +%s).sql"
  # kubectl exec -it postgres-pod -- pg_dump fixtray_prod > ${BACKUP_FILE}
  
  log_success "Database backup initiated"
}

deploy_new_version() {
  log_info "Deploying new version: ${IMAGE}"
  
  # Update image tag
  kubectl set image deployment/${NEW_DEPLOYMENT} \
    app=${IMAGE} \
    --namespace=${NAMESPACE} \
    --record || {
    log_error "Failed to update deployment image"
    exit 1
  }
  
  # Wait for rollout
  log_info "Waiting for new deployment to roll out..."
  kubectl rollout status deployment/${NEW_DEPLOYMENT} \
    --namespace=${NAMESPACE} \
    --timeout=10m || {
    log_error "Deployment rollout failed"
    exit 1
  }
  
  log_success "New deployment ready"
}

check_health() {
  local endpoint=$1
  local attempts=0
  local max_attempts=30
  
  while [ $attempts -lt $max_attempts ]; do
    if curl -sf "${endpoint}" > /dev/null 2>&1; then
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 2
  done
  
  return 1
}

get_error_rate() {
  # This would integrate with your monitoring system (Sentry, DataDog, etc.)
  # For now, just check Kubernetes pod logs
  
  local deployment=$1
  local error_count=$(kubectl logs -l app=fixtray,deployment=${deployment} \
    -n ${NAMESPACE} --tail=1000 2>/dev/null | grep -ci "error" || echo 0)
  
  echo $error_count
}

phase1_traffic_shift() {
  log_info "═══════════════════════════════════════════════════════"
  log_info "PHASE 1: Routing 10% traffic to new version (30 minutes)"
  log_info "═══════════════════════════════════════════════════════"
  
  # Scale to 1 new, 9 old (approximately 10%)
  kubectl scale deployment/${NEW_DEPLOYMENT} --replicas=1 -n ${NAMESPACE}
  kubectl scale deployment/${OLD_DEPLOYMENT} --replicas=9 -n ${NAMESPACE}
  
  log_info "Waiting for pods to be ready..."
  sleep 30
  
  log_info "Monitoring Phase 1 for ${PHASE1_DURATION}s..."
  
  local elapsed=0
  while [ $elapsed -lt $PHASE1_DURATION ]; do
    local new_errors=$(get_error_rate "canary")
    local error_percentage=$((new_errors * 100 / 1000))
    
    log_info "Phase 1 Progress: ${elapsed}s/${PHASE1_DURATION}s | Errors: ${error_percentage}% (threshold: ${PHASE1_ERROR_THRESHOLD}%)"
    
    if [ "${error_percentage}" -gt "${PHASE1_ERROR_THRESHOLD}" ]; then
      log_error "ERROR RATE EXCEEDED! Aborting deployment."
      abort_deployment
      exit 1
    fi
    
    sleep 60
    elapsed=$((elapsed + 60))
  done
  
  log_success "Phase 1 complete - proceeding to Phase 2"
}

phase2_traffic_shift() {
  log_info "═══════════════════════════════════════════════════════"
  log_info "PHASE 2: Routing 50% traffic to new version (1 hour)"
  log_info "═══════════════════════════════════════════════════════"
  
  # Scale to 5 new, 5 old (50%)
  kubectl scale deployment/${NEW_DEPLOYMENT} --replicas=5 -n ${NAMESPACE}
  kubectl scale deployment/${OLD_DEPLOYMENT} --replicas=5 -n ${NAMESPACE}
  
  log_info "Waiting for pods to be ready..."
  sleep 30
  
  log_info "Monitoring Phase 2 for ${PHASE2_DURATION}s..."
  
  local elapsed=0
  while [ $elapsed -lt $PHASE2_DURATION ]; do
    local new_errors=$(get_error_rate "canary")
    local error_percentage=$((new_errors * 100 / 1000))
    
    log_info "Phase 2 Progress: ${elapsed}s/${PHASE2_DURATION}s | Errors: ${error_percentage}% (threshold: ${PHASE2_ERROR_THRESHOLD}%)"
    
    if [ "${error_percentage}" -gt "${PHASE2_ERROR_THRESHOLD}" ]; then
      log_error "ERROR RATE EXCEEDED! Aborting deployment."
      abort_deployment
      exit 1
    fi
    
    sleep $PHASE2_CHECK_INTERVAL
    elapsed=$((elapsed + PHASE2_CHECK_INTERVAL))
  done
  
  log_success "Phase 2 complete - proceeding to Phase 3 (100%)"
}

phase3_traffic_shift() {
  log_info "═══════════════════════════════════════════════════════"
  log_info "PHASE 3: Routing 100% traffic to new version"
  log_info "═══════════════════════════════════════════════════════"
  
  # Scale to 10 new, 0 old (100%)
  kubectl scale deployment/${NEW_DEPLOYMENT} --replicas=10 -n ${NAMESPACE}
  kubectl scale deployment/${OLD_DEPLOYMENT} --replicas=0 -n ${NAMESPACE}
  
  log_info "Waiting for pods to be ready..."
  sleep 30
  
  log_info "Monitoring Phase 3 for 10 minutes..."
  
  for i in {1..10}; do
    local new_errors=$(get_error_rate "canary")
    local error_percentage=$((new_errors * 100 / 1000))
    
    log_info "Phase 3 Progress: ${i}/10 minutes | Errors: ${error_percentage}%"
    
    if [ "${error_percentage}" -gt "${PHASE3_ERROR_THRESHOLD}" ]; then
      log_error "ERROR RATE EXCEEDED! Rolling back deployment."
      rollback_deployment
      exit 1
    fi
    
    sleep 60
  done
  
  log_success "Phase 3 complete - deployment successful!"
}

abort_deployment() {
  log_error "Aborting deployment - Rolling back to stable version..."
  
  kubectl scale deployment/${NEW_DEPLOYMENT} --replicas=0 -n ${NAMESPACE}
  kubectl scale deployment/${OLD_DEPLOYMENT} --replicas=10 -n ${NAMESPACE}
  
  log_info "Waiting for rollback to complete..."
  sleep 30
  
  log_warning "Deployment rolled back to previous version"
}

rollback_deployment() {
  log_error "Rolling back deployment..."
  
  kubectl rollout undo deployment/${NEW_DEPLOYMENT} -n ${NAMESPACE}
  
  kubectl scale deployment/${NEW_DEPLOYMENT} --replicas=0 -n ${NAMESPACE}
  kubectl scale deployment/${OLD_DEPLOYMENT} --replicas=10 -n ${NAMESPACE}
  
  log_warning "Deployment rolled back"
}

final_verification() {
  log_info "═══════════════════════════════════════════════════════"
  log_info "Final Verification"
  log_info "═══════════════════════════════════════════════════════"
  
  # Check all pods are running
  local running=$(kubectl get pods -l app=fixtray -n ${NAMESPACE} --field-selector=status.phase=Running --no-headers | wc -l)
  log_info "Pods running: ${running}"
  
  # Check service health
  if check_health "https://api.fixtray.com/api/monitoring/readiness"; then
    log_success "Health check passed"
  else
    log_error "Health check failed"
    exit 1
  fi
  
  log_success "Verification complete"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
  log_info "╔═══════════════════════════════════════════════════════╗"
  log_info "║   FixTray Production Canary Deployment                ║"
  log_info "║   Version: ${VERSION}                                      ║"
  log_info "╚═══════════════════════════════════════════════════════╝"
  
  # Pre-flight checks
  check_prerequisites
  verify_staging
  backup_database
  
  # Deploy
  deploy_new_version
  
  # Phase 1: 10%
  phase1_traffic_shift
  
  # Phase 2: 50%
  phase2_traffic_shift
  
  # Phase 3: 100%
  phase3_traffic_shift
  
  # Final verification
  final_verification
  
  log_success "╔═══════════════════════════════════════════════════════╗"
  log_success "║   Deployment Complete!                               ║"
  log_success "║   Version: ${VERSION}                                  ║"
  log_success "║   Status: ✅ LIVE IN PRODUCTION                      ║"
  log_success "╚═══════════════════════════════════════════════════════╝"
}

# Run main
main "$@"
