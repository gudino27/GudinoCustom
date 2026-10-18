#!/bin/bash
# Deployment Validation Script
# Comprehensive testing for zero-downtime deployments

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
FRONTEND_URL="http://localhost"
BACKEND_URL="http://localhost:3001"
STAGING_FRONTEND_URL="http://localhost:8088"
STAGING_BACKEND_URL="http://localhost:3002"
TIMEOUT=30

log_info() {
    echo -e "${BLUE}[VALIDATOR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test HTTP endpoint with timeout
test_endpoint() {
    local url=$1
    local expected_status=${2:-200}
    local description=$3
    
    log_info "Testing: $description"
    log_info "URL: $url"
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code};RESPONSE_TIME:%{time_total}" --max-time $TIMEOUT "$url")
    
    if [ $? -eq 0 ]; then
        http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
        response_time=$(echo "$response" | grep -o "RESPONSE_TIME:[0-9.]*" | cut -d: -f2)
        body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*;RESPONSE_TIME:[0-9.]*$//')
        
        if [ "$http_code" -eq "$expected_status" ]; then
            log_success "$description - Status: $http_code, Time: ${response_time}s"
            return 0
        else
            log_error "$description - Expected: $expected_status, Got: $http_code"
            return 1
        fi
    else
        log_error "$description - Connection failed or timeout"
        return 1
    fi
}

# Test API endpoint with JSON validation
test_api_endpoint() {
    local url=$1
    local description=$2
    local expected_fields=$3
    
    log_info "Testing API: $description"
    
    response=$(curl -s --max-time $TIMEOUT "$url")
    
    if [ $? -eq 0 ]; then
        # Check if response is valid JSON
        if echo "$response" | jq . >/dev/null 2>&1; then
            log_success "$description - Valid JSON response"
            
            # Check for expected fields if provided
            if [ ! -z "$expected_fields" ]; then
                for field in $expected_fields; do
                    if echo "$response" | jq -e ".$field" >/dev/null 2>&1; then
                        log_success "  ✓ Field '$field' present"
                    else
                        log_warning "  ✗ Field '$field' missing"
                    fi
                done
            fi
            return 0
        else
            log_error "$description - Invalid JSON response"
            log_error "Response: $response"
            return 1
        fi
    else
        log_error "$description - API call failed"
        return 1
    fi
}

# Test database connectivity through API
test_database_connectivity() {
    local base_url=$1
    local description=$2
    
    log_info "Testing database connectivity: $description"
    
    # Test health endpoint which includes database check
    response=$(curl -s --max-time $TIMEOUT "$base_url/api/health")
    
    if [ $? -eq 0 ]; then
        # Check if database check passed
        db_status=$(echo "$response" | jq -r '.checks.database.status' 2>/dev/null)
        
        if [ "$db_status" = "OK" ]; then
            log_success "$description - Database connectivity OK"
            return 0
        else
            log_error "$description - Database connectivity failed"
            log_error "DB Status: $db_status"
            return 1
        fi
    else
        log_error "$description - Health check failed"
        return 1
    fi
}

# Load testing function
basic_load_test() {
    local url=$1
    local description=$2
    local concurrent_requests=${3:-10}
    local total_requests=${4:-50}
    
    log_info "Running basic load test: $description"
    log_info "Concurrent: $concurrent_requests, Total: $total_requests"
    
    # Create temporary script for concurrent requests
    temp_script=$(mktemp)
    cat << EOF > "$temp_script"
#!/bin/bash
url="\$1"
for i in \$(seq 1 $((total_requests / concurrent_requests))); do
    curl -s --max-time 10 "\$url" > /dev/null &
done
wait
EOF
    chmod +x "$temp_script"
    
    # Run concurrent requests
    start_time=$(date +%s)
    for i in $(seq 1 $concurrent_requests); do
        "$temp_script" "$url" &
    done
    wait
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    rm -f "$temp_script"
    
    log_success "$description - Load test completed in ${duration}s"
    return 0
}

# Validate production environment
validate_production() {
    log_info "=== PRODUCTION ENVIRONMENT VALIDATION ==="
    
    local failures=0
    
    # Frontend tests
    test_endpoint "$FRONTEND_URL" 200 "Frontend homepage" || ((failures++))
    test_endpoint "$FRONTEND_URL/health" 200 "Frontend health check" || ((failures++))
    
    # Backend tests
    test_api_endpoint "$BACKEND_URL/api/health" "Backend health check" "status timestamp checks" || ((failures++))
    test_database_connectivity "$BACKEND_URL" "Production database" || ((failures++))
    
    # API functionality tests
    test_api_endpoint "$BACKEND_URL/api/photos" "Photos API" || ((failures++))
    test_api_endpoint "$BACKEND_URL/api/prices/cabinets" "Pricing API" || ((failures++))
    
    # Basic load test
    basic_load_test "$FRONTEND_URL" "Frontend load test" 5 25 || ((failures++))
    
    return $failures
}

# Validate staging environment
validate_staging() {
    log_info "=== STAGING ENVIRONMENT VALIDATION ==="
    
    local failures=0
    
    # Check if staging containers are running
    if ! docker ps | grep -q "frontend-new\|backend-new"; then
        log_error "Staging containers not found"
        return 1
    fi
    
    # Frontend tests
    test_endpoint "$STAGING_FRONTEND_URL" 200 "Staging frontend homepage" || ((failures++))
    test_endpoint "$STAGING_FRONTEND_URL/health" 200 "Staging frontend health" || ((failures++))
    
    # Backend tests  
    test_api_endpoint "$STAGING_BACKEND_URL/api/health" "Staging backend health" "status timestamp checks" || ((failures++))
    test_database_connectivity "$STAGING_BACKEND_URL" "Staging database" || ((failures++))
    
    return $failures
}

# Pre-deployment validation
pre_deployment_checks() {
    log_info "=== PRE-DEPLOYMENT CHECKS ==="
    
    local failures=0
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon not running"
        ((failures++))
    else
        log_success "Docker daemon running"
    fi
    
    # Check available disk space
    available_space=$(df / | awk 'NR==2 {print $4}')
    if [ "$available_space" -lt 1048576 ]; then  # Less than 1GB
        log_warning "Low disk space: $(($available_space / 1024))MB available"
    else
        log_success "Sufficient disk space available"
    fi
    
    # Check system load
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
    if (( $(echo "$load_avg > 2.0" | bc -l) )); then
        log_warning "High system load: $load_avg"
    else
        log_success "System load normal: $load_avg"
    fi
    
    return $failures
}

# Post-deployment validation
post_deployment_checks() {
    log_info "=== POST-DEPLOYMENT VALIDATION ==="
    
    local failures=0
    
    # Validate production environment
    validate_production || ((failures+=1))
    
    # Check if old containers are cleaned up
    if docker ps -a | grep -q "frontend-new\|backend-new"; then
        log_warning "Deployment containers still present (cleanup needed)"
    else
        log_success "Deployment containers properly cleaned up"
    fi
    
    # Verify no orphaned processes
    orphaned=$(docker ps -f "status=exited" --format "table {{.Names}}" | grep -c "frontend\|backend" || true)
    if [ "$orphaned" -gt 0 ]; then
        log_warning "$orphaned orphaned containers found"
    else
        log_success "No orphaned containers"
    fi
    
    return $failures
}

# Main execution
main() {
    local mode=${1:-production}
    local exit_code=0
    
    log_info "Starting deployment validation in '$mode' mode"
    
    case "$mode" in
        "pre-deployment")
            pre_deployment_checks || exit_code=1
            ;;
        "staging")
            validate_staging || exit_code=1
            ;;
        "production")
            validate_production || exit_code=1
            ;;
        "post-deployment")
            post_deployment_checks || exit_code=1
            ;;
        "full")
            pre_deployment_checks || exit_code=1
            validate_production || exit_code=1
            ;;
        *)
            echo "Usage: $0 {pre-deployment|staging|production|post-deployment|full}"
            exit 1
            ;;
    esac
    
    if [ $exit_code -eq 0 ]; then
        log_success "All validation checks passed!"
    else
        log_error "Validation failed with $exit_code errors"
    fi
    
    exit $exit_code
}

# Run main function with all arguments
main "$@"