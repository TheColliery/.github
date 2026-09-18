# Deployment Guide

Last updated: 2023-11-20.

## Prerequisites

- AWS CLI v2 configured with the `staging` profile
- Terraform >= 1.3.0
- kubectl (matching your cluster version, currently 1.25)

## Steps

1. Build the Docker image:
   ```bash
   docker build -t app:latest .
   ```

2. Push to ECR:
   ```bash
   aws ecr get-login-password | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
   docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/app:latest
   ```

TODO: Automate this with the deploy script once it's ready.

3. Apply Terraform:
   ```bash
   cd infra/terraform
   terraform apply -var-file=staging.tfvars
   ```

## Rollback

> **Note:** The rollback procedure below was written for the old ECS deployment. We migrated to EKS in Q3 2024. FIXME: Rewrite for EKS.

```bash
aws ecs update-service --cluster prod --service app --task-definition app:previous
```

## Monitoring

Dashboard: https://grafana.internal.example.com/d/deploy-status

Alerts go to the #deploys Slack channel (configured in PagerDuty, last verified August 2023).
