# ShopCloud E-Commerce Platform

A cloud-native e-commerce platform deployed on AWS using a microservices architecture on Amazon EKS. Serves customers in Europe and the United States with low-latency product browsing, cart management, checkout, and invoice delivery.

## Architecture Overview

Five EKS-hosted microservices communicate via Kubernetes internal DNS with mTLS encryption:

| Service | Port | Responsibility |
|---------|------|----------------|
| `catalog` | 3000 | Product listings, search, category filtering |
| `cart` | 3001 | Session-scoped cart persistence (Redis) |
| `checkout` | 3002 | Order validation, payment simulation, SQS publishing |
| `auth` | 3003 | Customer and admin authentication (Cognito) |
| `admin` | 3004 | Internal inventory and product management |

An async invoice pipeline handles PDF generation: `SQS → Invoice Lambda → S3 + SES`.

### Infrastructure

- **Database**: Amazon RDS PostgreSQL (Multi-AZ in production)
- **Cache**: Amazon ElastiCache Redis (Multi-AZ in production)
- **CDN**: CloudFront + WAF + Shield for public traffic
- **Auth**: Amazon Cognito (separate Customer and Admin pools)
- **Async**: SQS + Lambda for invoice generation
- **IaC**: Terraform with `production` and `development` workspaces

## Repository Structure

```
shopcloud/
├── services/
│   ├── catalog/          # Catalog Service (Node.js/Express)
│   ├── cart/             # Cart Service (Node.js/Express)
│   ├── checkout/         # Checkout Service (Node.js/Express)
│   ├── auth/             # Auth Service (Node.js/Express)
│   └── admin/            # Admin Service (Node.js/Express)
├── functions/
│   └── invoice-lambda/   # Invoice Lambda (Node.js)
├── infra/
│   ├── terraform/        # Terraform IaC modules and root config
│   └── k8s/              # Kubernetes manifests
├── .github/
│   └── workflows/        # GitHub Actions CI/CD pipelines
├── docker-compose.yml    # Local development environment
└── package.json          # Monorepo root (npm workspaces)
```

## Local Development

### Prerequisites

- Node.js >= 20
- Docker and Docker Compose
- AWS CLI (for integration tests)

### Start local dependencies

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Redis** on `localhost:6379`
- **LocalStack** on `localhost:4566` (AWS service stubs: SQS, S3, SES, Cognito)

### Install dependencies

```bash
npm install
```

### Run all tests

```bash
npm test
```

### Lint and format

```bash
npm run lint
npm run format
```

## Environments

| Environment | RDS | Redis | EKS Nodes |
|-------------|-----|-------|-----------|
| `development` | Single-AZ `db.t3.micro` | Single-node `cache.t3.micro` | 1–3 × `t3.micro` |
| `production` | Multi-AZ `db.t3.micro` + cross-region replica | 2-node `cache.t3.micro` | 2–6 × `t3.micro` |

### Deploy with Terraform

```bash
cd infra/terraform
terraform workspace select development   # or production
terraform init
terraform apply
```

## CI/CD

- **CI** (pull requests): unit tests, property-based tests, image build, CVE scan, secret scan, `terraform validate`
- **CD-dev** (merge to main): push images to ECR, deploy to Development environment, integration tests
- **CD-prod** (manual approval): push images to ECR, deploy to Production environment, smoke tests, auto-rollback on failure
