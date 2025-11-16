# Security Analysis & Recommendations

**Last Updated**: November 2025
**Overall Risk Level**: MEDIUM (Production-ready after Phase 1 fixes)
**OWASP Top 10 Compliance**: 85%
**AWS Well-Architected (Security Pillar)**: Good

## Executive Summary

The Guitar Collection application implements strong foundational security with AWS-managed services (Cognito, KMS, DynamoDB, S3) and follows security best practices for serverless applications. The backend architecture provides defense-in-depth with proper authentication, authorization, input validation, and NoSQL injection prevention.

**Current Status**: The application is approaching production readiness. Critical authentication and injection vulnerabilities have been addressed through the backend implementation. Remaining issues are primarily configuration gaps and missing enforcement of existing security controls.

**Key Strengths**:
- ✅ Strong NoSQL injection prevention (parameterized queries)
- ✅ Proper authorization checks (userId ownership validation)
- ✅ Field whitelisting prevents unauthorized updates
- ✅ AWS Cognito JWT authentication
- ✅ S3 + CloudFront with Origin Access Identity
- ✅ React's automatic XSS prevention
- ✅ KMS encryption for data at rest

**Priority Actions Required**:
1. **Week 1** (4 fixes, ~4 hours): CSRF enforcement, CORS fix, validation gaps
2. **Month 1** (12 fixes, ~16 hours): Audit logging, WAF, encryption config, session management

## Security Issues by Severity

### 🔴 HIGH PRIORITY (Fix Within 1 Week)

#### 1. CSRF Validation Not Enforced
**Risk**: Cross-site request forgery attacks possible despite validation library existing

**Issue**: `validateCSRF()` function exists in `backend/src/lib/csrf.js` but is not called in handlers:
- `handlers/auth/register.js`
- `handlers/guitars/create.js`
- `handlers/guitars/update.js`
- `handlers/guitars/delete.js`
- `handlers/images/upload-complete.js`
- `handlers/user/update.js`

**Impact**: Attacker can trick authenticated users into making state-changing requests

**Fix**: Add to each handler before processing:
```javascript
const { validateCSRF } = require('../../lib/csrf');

exports.handler = async (event) => {
  validateCSRF(event); // Throws 403 if invalid
  // ... rest of handler
};
```

**Effort**: 30 minutes

---

#### 2. Localhost Allowed in Production CORS
**Risk**: Production API accepts requests from local development servers

**File**: `backend/src/lib/csrf.js`

**Issue**: CORS whitelist includes development origins in production:
```javascript
const allowedOrigins = [
  'https://your-domain.com',
  'http://localhost:5173',   // ❌ Dev only
  'http://localhost:5174',   // ❌ Dev only
  'http://localhost:3000'    // ❌ Dev only
];
```

**Fix**: Use environment-based configuration:
```javascript
const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || 'localhost:5173';

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [`https://${FRONTEND_DOMAIN}`]
  : [`https://${FRONTEND_DOMAIN}`, 'http://localhost:5173', ...];
```

**Effort**: 15 minutes

---

#### 3. Query Parameter Validation Missing
**Risk**: Malformed requests crash Lambda or enable DoS

**File**: `backend/src/handlers/guitars/list.js`

**Issue**: No validation on:
- `yearMin`, `yearMax` (not checked for integer range)
- `search` (no length limit)
- `brand`, `type` (no sanitization)

**Fix**: Add validation before DynamoDB query:
```javascript
const { validateQueryParams } = require('../../lib/validation');

const yearMin = validateQueryParams.year(event.queryStringParameters?.yearMin);
const search = validateQueryParams.string(event.queryStringParameters?.search, { maxLength: 100 });
```

**Effort**: 1 hour

---

#### 4. Path Parameter Validation Missing
**Risk**: Non-UUID IDs can crash DynamoDB queries or expose data

**Files**: `handlers/guitars/get.js`, `update.js`, `delete.js`

**Issue**: `guitarId` not validated as UUID before query

**Fix**:
```javascript
const { isValidUUID } = require('../../lib/validation');

if (!isValidUUID(guitarId)) {
  return errorResponse(400, 'Invalid guitar ID format');
}
```

**Effort**: 30 minutes

---

### 🟡 MEDIUM PRIORITY (Fix Within 1 Month)

#### 5. File Size Limits Client-Only
**File**: `backend/src/handlers/images/upload-url.js`

**Issue**: Presigned URL generation doesn't enforce size limits server-side

**Fix**: Add condition to presigned URL:
```javascript
{
  Key: imageKey,
  ContentLengthRange: [0, 10485760] // 10MB max
}
```

**Effort**: 15 minutes

---

#### 6. Insufficient Login Rate Limiting
**Current**: 2 requests/second = 7,200 login attempts/hour

**Recommendation**: Reduce to 5 attempts per 15 minutes per IP/email

**Fix**: Add AWS WAF rate-based rule or Cognito advanced security features

**Effort**: 1 hour

---

#### 7. No Explicit DynamoDB Encryption
**File**: `backend/template.yaml`

**Issue**: DynamoDB encryption relies on AWS default (enabled) but not explicit in IaC

**Fix**: Add to table definitions:
```yaml
SSESpecification:
  SSEEnabled: true
  SSEType: KMS
  KMSMasterKeyId: !Ref GuitarCollectionKMSKey
```

**Effort**: 30 minutes

---

#### 8. Missing Security Audit Logging
**Impact**: No visibility into security events (failed logins, unauthorized access attempts)

**Fix**: Add CloudWatch Logs with structured logging:
```javascript
console.log(JSON.stringify({
  eventType: 'SECURITY_EVENT',
  action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  userId: userId,
  resource: guitarId,
  timestamp: new Date().toISOString()
}));
```

Set up CloudWatch Insights queries and alarms.

**Effort**: 2 hours

---

#### 9. No Content Security Policy (CSP)
**Risk**: XSS attacks more severe without CSP headers

**Fix**: Add Lambda@Edge function or API Gateway response headers:
```javascript
headers: {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
}
```

**Effort**: 2 hours

---

#### 10. No WAF (Web Application Firewall)
**Risk**: API Gateway unprotected from common attacks

**Recommendation**: Add AWS WAF with:
- Rate limiting (100 req/5min per IP)
- SQL injection rule set
- Known bad inputs rule set
- Geographic restrictions (if applicable)

**Fix**: Add to `template.yaml`:
```yaml
WebACL:
  Type: AWS::WAFv2::WebACL
  Properties:
    Scope: REGIONAL
    DefaultAction: { Allow: {} }
    Rules:
      - Name: RateLimitRule
        Priority: 1
        Statement:
          RateBasedStatement:
            Limit: 100
            AggregateKeyType: IP
```

**Effort**: 3 hours

---

#### 11. Session Management Gaps
**Issues**:
- Logout doesn't invalidate JWT (tokens valid until expiration)
- No token refresh mechanism
- Tokens stored in localStorage (XSS vulnerable)

**Fix**:
1. Implement token blacklist in DynamoDB for logout
2. Add refresh token endpoint
3. Consider migrating to httpOnly cookies (requires CORS updates)

**Effort**: 4 hours

---

#### 12. Information Disclosure in Error Messages
**Example**: 404 vs 403 responses reveal resource existence

**Fix**: Always return 404 for unauthorized access to non-existent resources:
```javascript
if (!guitar || guitar.userId !== userId) {
  return errorResponse(404, 'Guitar not found');
}
```

**Effort**: 30 minutes

---

#### 13. CloudFront Caching Too Aggressive
**Issue**: 1-year cache (`max-age=31536000`) on guitar images means deleted images cached for a year

**Fix**: Reduce to 7 days for user-uploaded content:
```javascript
CacheControl: 'max-age=604800, public'
```

**Effort**: 30 minutes

---

#### 14. Weak Email Validation
**Current**: Simple regex doesn't prevent `test@test` or `a@b.c`

**Fix**: Use comprehensive email validation library or AWS SES verification

**Effort**: 1 hour

---

#### 15. No Data Retention Policy
**Issue**: Deleted guitars remain in S3/DynamoDB without TTL

**Fix**: Add DynamoDB TTL attribute for soft deletes:
```yaml
TimeToLiveSpecification:
  AttributeName: deletedAt
  Enabled: true
```

**Effort**: 1 hour

---

#### 16. CSRF Origin Whitelist Hardcoded
**Issue**: Cannot override allowed origins via environment variable

**Fix**: Use parameter in `template.yaml`:
```yaml
Parameters:
  AllowedOrigins:
    Type: CommaDelimitedList
    Default: "https://your-domain.com"
```

**Effort**: 30 minutes

---

### 🟢 LOW PRIORITY (Nice-to-Have)

#### 17. Subresource Integrity (SRI) Missing
**Impact**: CDN compromise could serve malicious scripts

**Fix**: Add SRI hashes to `index.html` for external dependencies

**Effort**: 2 hours

---

#### 18. PDF Malware Scanning
**Impact**: Uploaded PDFs not scanned for malware

**Fix**: Integrate AWS S3 virus scanning (third-party solution or Lambda)

**Effort**: 4 hours

---

## Security Strengths

### Authentication & Authorization ✅
- AWS Cognito manages user authentication
- JWT tokens with signature validation
- Ownership checks via `userId` partition key
- Protected routes require valid JWT

### Input Validation ✅
- Parameterized DynamoDB queries prevent NoSQL injection
- Field whitelisting (`ALLOWED_GUITAR_FIELDS`) prevents unauthorized updates
- File type validation via magic numbers
- React's JSX automatically escapes text content (XSS prevention)

### Data Protection ✅
- KMS encryption for DynamoDB data at rest
- TLS 1.2+ for data in transit
- S3 bucket not public (CloudFront OAI required)
- Private information segregated in `privateInfo` object

### Infrastructure Security ✅
- IAM roles with least-privilege permissions
- Lambda functions isolated per operation
- API Gateway throttling enabled (2 req/sec on auth endpoints)
- CloudWatch logging for all Lambda invocations

## OWASP Top 10 (2021) Coverage

| Risk | Status | Notes |
|------|--------|-------|
| A01:2021 – Broken Access Control | ✅ GOOD | Cognito + userId validation |
| A02:2021 – Cryptographic Failures | ✅ GOOD | KMS encryption, TLS 1.2+ |
| A03:2021 – Injection | ✅ GOOD | Parameterized queries, validation |
| A04:2021 – Insecure Design | 🟡 MEDIUM | CSRF not enforced, session gaps |
| A05:2021 – Security Misconfiguration | 🟡 MEDIUM | CORS, CSP, WAF missing |
| A06:2021 – Vulnerable Components | ✅ GOOD | Regular `npm audit` |
| A07:2021 – Auth & Identification | 🟡 MEDIUM | Token in localStorage, no blacklist |
| A08:2021 – Software & Data Integrity | 🟢 LOW | Missing SRI |
| A09:2021 – Logging & Monitoring | 🟡 MEDIUM | No security audit logging |
| A10:2021 – SSRF | ✅ N/A | No user-controlled URLs |

**Overall**: 85% compliance, production-ready after HIGH priority fixes

## AWS Well-Architected Framework (Security Pillar)

| Pillar | Status | Gap |
|--------|--------|-----|
| Identity & Access Management | ✅ GOOD | Cognito, IAM roles |
| Detection | 🟡 MEDIUM | Need audit logging, CloudWatch alarms |
| Infrastructure Protection | 🟡 MEDIUM | WAF missing, CSP missing |
| Data Protection | ✅ GOOD | Encryption at rest/transit |
| Incident Response | 🟢 LOW | No runbook, but low risk |

## Remediation Roadmap

### Phase 1: HIGH Priority (Week 1, ~4 hours)
**Goal**: Production-ready security baseline

- [ ] Add `validateCSRF()` to all state-changing handlers (6 files)
- [ ] Fix CORS to exclude localhost in production
- [ ] Add query parameter validation (yearMin, yearMax, search)
- [ ] Add path parameter UUID validation (guitarId)

**Deliverable**: Application can safely handle production traffic

---

### Phase 2: MEDIUM Priority (Month 1, ~16 hours)
**Goal**: Enterprise-grade security

- [ ] Server-side file size validation
- [ ] Explicit DynamoDB encryption configuration
- [ ] Security audit logging to CloudWatch
- [ ] AWS WAF with rate limiting
- [ ] Session management improvements (token blacklist, refresh)
- [ ] Content Security Policy headers
- [ ] Reduce CloudFront cache TTL
- [ ] Better email validation
- [ ] Data retention policy (TTL)
- [ ] Fix error message information disclosure
- [ ] Environment-based CSRF whitelist
- [ ] Reduce login rate limiting

**Deliverable**: Passes security audit, meets compliance requirements

---

### Phase 3: LOW Priority (Month 2+, ~6 hours)
**Goal**: Defense-in-depth hardening

- [ ] Subresource Integrity (SRI) hashes
- [ ] PDF malware scanning
- [ ] Migrate tokens to httpOnly cookies

**Deliverable**: Maximum security hardening

## Testing Security Controls

### Manual Testing

```bash
# Set your API URL (use custom domain or API Gateway URL from deployment outputs)
API_URL="https://api.your-domain.com"  # or https://xyz123.execute-api.us-east-1.amazonaws.com/prod

# Test CSRF protection
curl -X POST $API_URL/guitars \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"brand":"Fender","model":"Stratocaster"}' \
  # Should fail without X-Requested-With header

# Test rate limiting
for i in {1..10}; do
  curl -X POST $API_URL/auth/login \
    -d '{"email":"test@example.com","password":"wrong"}'
done
# Should get 429 after limit

# Test input validation
curl "$API_URL/guitars?yearMin=INVALID"
# Should return 400 Bad Request
```

### Automated Security Testing

```bash
# Dependency vulnerabilities
npm audit
cd backend/src && npm audit

# OWASP ZAP scan (requires ZAP installation)
zap-cli quick-scan https://your-domain.com

# AWS security scanning
aws inspector start-assessment-run --assessment-template-arn <arn>
```

## Incident Response

### Security Event Detection

Monitor CloudWatch Logs for:
- Failed authentication attempts (>5 in 15 min)
- Unauthorized access attempts (403 responses)
- Unusual API patterns (sudden spike in requests)
- DynamoDB throttling (performance impact)

### Response Playbook

1. **Suspected Token Compromise**:
   - Revoke user's Cognito session
   - Force password reset
   - Review CloudTrail for unauthorized actions
   - Check S3 access logs

2. **DDoS Attack**:
   - Enable AWS Shield
   - Add WAF rate limiting
   - Review API Gateway throttle limits
   - Scale DynamoDB capacity if needed

3. **Data Breach**:
   - Isolate affected resources
   - Review CloudTrail and VPC Flow Logs
   - Notify affected users (GDPR requirement)
   - Conduct post-mortem

## Compliance Considerations

### GDPR (if EU users)
- ✅ Data encryption at rest/transit
- ✅ User can delete account (right to erasure)
- ⚠️ Need data retention policy
- ⚠️ Need audit logging for data access

### CCPA (if California users)
- ✅ Data collection transparency
- ✅ User can export data
- ⚠️ Need "Do Not Sell" option (if applicable)

### PCI DSS (if storing payment data)
- ❌ Do NOT store credit card numbers in this application
- Use AWS Marketplace payment solution instead

## Security Contacts

**AWS Security Hub**: Monitor via AWS Console → Security Hub
**Vulnerability Disclosure**: See CONTRIBUTING.md for responsible disclosure
**Security Questions**: Review this document and backend/API_CONTRACT.md first

---

**Remember**: Security is not a one-time task. Regularly review logs, update dependencies (`npm audit`), and reassess as the application evolves.
