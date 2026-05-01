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
| `development` | Single-AZ `db.t3.micro` | Single-node `cache.t3.micro` | 1–2 × `m7i-flex.large` |
| `production` | Multi-AZ `db.t3.micro` + cross-region replica | 2-node `cache.t3.micro` | 2–6 × `m7i-flex.large` |

The current live AWS demo uses two Kubernetes namespaces in the same EKS cluster:

- Production namespace: `shopcloud`
- Development namespace: `shopcloud-dev`

Production remains the live customer path. Development deploys independently from the `dev` branch and uses `dev-<sha>` image tags.

To deploy the current local branch to development only:

```bash
git push origin HEAD:dev
```

To refresh development from the latest production branch after a merge:

```bash
git push origin main:dev
```

Production updates only from `main` through `CD - Production Deploy`, or through the manual `CD - Production Promote` workflow.

### Live endpoints

Production CloudFront:

```text
https://dc3jxbgwg4zpn.cloudfront.net/
```

Development is not routed under `/dev` on the production CloudFront distribution. It is exposed through the development frontend load balancer:

```text
http://a1aa3223b047a4de4a69d27daf1be91e-1248667715.us-east-1.elb.amazonaws.com/
```

Health checks:

```bash
curl http://a98f519c4af93425b99b2dc81d16f3e9-2102793419.us-east-1.elb.amazonaws.com/health
curl http://a2925f4a964a541f5a9c67ff0c54c074-1231656343.us-east-1.elb.amazonaws.com/health
```

### Deploy with Terraform

```bash
cd infra/terraform
terraform workspace select development   # or production
terraform init
terraform apply
```

## CI/CD

- **CI** (pull requests): unit tests, property-based tests, image build, CVE scan, secret scan, `terraform validate`
- **CD - Development Deploy** (`push` to `dev`): build images tagged `dev-<sha>`, deploy to `shopcloud-dev`, then run smoke tests
- **CD - Production Deploy** (`push` to `main`): preserve the existing live deployment path into `shopcloud`
- **CD - Production Promote** (`workflow_dispatch`): manually promote a known image tag to production with environment approval, smoke tests, and rollback on failure

Production deployments use the GitHub `production` environment, which should keep required reviewer protection enabled. Development deployments use the GitHub `development` environment without required reviewers.

### Invoice delivery

Checkout stores the order with `pending` status, publishes an invoice event to SQS, and returns without waiting for PDF/email work. The invoice worker is an AWS Lambda function subscribed to the invoice queue. It writes PDFs to S3 and sends the customer a pre-signed download link through SES.

SES requires the configured `ses_from_email` sender identity to be verified before invoices can be delivered. In an SES sandbox account, recipient addresses must also be verified or SES production access must be requested.

The Lambda, SQS event source mapping, S3 bucket configuration, and SES identity are managed in Terraform. After changing this infrastructure, run `terraform apply` for the target workspace; Kubernetes deploy workflows only update EKS workloads and container images.

### Known follow-up work

- Set `ses_from_email` to a real SES-verifiable sender address before applying invoice Lambda infrastructure; placeholder `.local` senders are rejected by Terraform validation.
- Apply the merged Terraform invoice changes so AWS creates/updates the invoice Lambda and SQS trigger after the SES sender value is corrected.
- Verify the SES sender identity configured by `ses_from_email`; if the account is in SES sandbox, verify test recipient addresses too or request SES production access.
- Keep the `admin` API off the public storefront path. The durable config returns 404 for `/api/admin/`, and the admin Kubernetes service is internal-only.
- Keep production reviewer protection enabled in the GitHub `production` environment.

### Rollback

For a failed production promotion, the workflow automatically runs `kubectl rollout undo` for all application deployments and uploads a short-lived deployment snapshot artifact.

Manual rollback for the live production namespace:

```bash
kubectl rollout undo deployment/catalog  -n shopcloud
kubectl rollout undo deployment/cart     -n shopcloud
kubectl rollout undo deployment/checkout -n shopcloud
kubectl rollout undo deployment/auth     -n shopcloud
kubectl rollout undo deployment/admin    -n shopcloud
kubectl rollout undo deployment/frontend -n shopcloud
```

Manual rollback for development:

```bash
kubectl rollout undo deployment/catalog  -n shopcloud-dev
kubectl rollout undo deployment/cart     -n shopcloud-dev
kubectl rollout undo deployment/checkout -n shopcloud-dev
kubectl rollout undo deployment/auth     -n shopcloud-dev
kubectl rollout undo deployment/admin    -n shopcloud-dev
kubectl rollout undo deployment/frontend -n shopcloud-dev
```
