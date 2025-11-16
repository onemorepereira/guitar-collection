# Documentation Index

Complete documentation for the Guitar Collection Manager application.

## Getting Started

Start here if you're new to the project:

1. **[Deployment Guide](DEPLOYMENT.md)** - Complete walkthrough from zero to deployed application
   - Prerequisites and tool installation
   - Step-by-step deployment instructions
   - Troubleshooting common issues
   - Architecture diagrams and cost estimates

2. **[Makefile Deployment Summary](MAKEFILE_DEPLOYMENT_SUMMARY.md)** - Deep-dive into the deployment system
   - How the self-generating pipeline works
   - Technical implementation details
   - Generated files and outputs
   - Usage examples and testing checklist

## Development

For developers working on the codebase:

3. **[Development Guide](DEVELOPMENT.md)** - Local development setup
   - Environment setup and configuration
   - Build process and tooling
   - Debugging techniques
   - Code organization

4. **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute
   - Git workflow and commit standards
   - Pre-commit hooks
   - Code review process
   - Testing requirements

## Backend & API

For understanding and working with the backend:

5. **[Backend Overview](BACKEND_OVERVIEW.md)** - Backend architecture
   - Lambda function details
   - DynamoDB schema
   - Authentication flow
   - AWS services used

6. **[Backend Architecture](BACKEND_ARCHITECTURE.md)** - Detailed architecture
   - System design and data flow
   - Infrastructure components
   - Security architecture
   - Performance considerations

7. **[SAM Implementation Guide](SAM_IMPLEMENTATION_GUIDE.md)** - SAM/CloudFormation details
   - Template structure
   - Resource definitions
   - Deployment process
   - Stack outputs

8. **[Backend Deployment Guide](BACKEND_DEPLOYMENT_GUIDE.md)** - Backend-specific deployment
   - SAM CLI usage
   - CloudFormation stack management
   - Environment configuration
   - Monitoring and logs

9. **[API Contract](API_CONTRACT.md)** - Complete API specification
   - Data models and schemas
   - Required vs optional fields
   - API endpoints and parameters
   - Request/response examples

10. **[Security](SECURITY.md)** - Security architecture and best practices
    - Authentication and authorization
    - Data encryption
    - Input validation
    - Audit logging

## Quick Reference

| I want to... | See document |
|--------------|--------------|
| Deploy the app from scratch | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Understand how deployment works | [MAKEFILE_DEPLOYMENT_SUMMARY.md](MAKEFILE_DEPLOYMENT_SUMMARY.md) |
| Set up local development | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Contribute code | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Understand the backend | [BACKEND_OVERVIEW.md](BACKEND_OVERVIEW.md) |
| Deep-dive backend architecture | [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) |
| Understand SAM/CloudFormation | [SAM_IMPLEMENTATION_GUIDE.md](SAM_IMPLEMENTATION_GUIDE.md) |
| Work with the API | [API_CONTRACT.md](API_CONTRACT.md) |
| Understand security | [SECURITY.md](SECURITY.md) |
| Deploy backend only | [BACKEND_DEPLOYMENT_GUIDE.md](BACKEND_DEPLOYMENT_GUIDE.md) |

## Document Organization

```
docs/
├── README.md (this file)                    # Documentation index
│
├── Getting Started
│   ├── DEPLOYMENT.md                        # Main deployment guide
│   ├── MAKEFILE_DEPLOYMENT_SUMMARY.md      # Deployment system deep-dive
│   ├── DEVELOPMENT.md                       # Development setup
│   └── CONTRIBUTING.md                      # Contributing guidelines
│
└── Backend & API
    ├── BACKEND_OVERVIEW.md                 # Backend architecture overview
    ├── BACKEND_ARCHITECTURE.md             # Detailed architecture
    ├── SAM_IMPLEMENTATION_GUIDE.md         # SAM/CloudFormation details
    ├── BACKEND_DEPLOYMENT_GUIDE.md         # Backend deployment
    ├── API_CONTRACT.md                     # API specification
    └── SECURITY.md                         # Security architecture
```

---

**Back to [Main README](../README.md)**
