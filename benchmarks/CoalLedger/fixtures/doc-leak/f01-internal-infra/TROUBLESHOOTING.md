# Troubleshooting Guide

## Connection Issues

If you cannot connect to the API, check the following:

1. Verify the API is running:
   ```bash
   curl https://api.example.com/health
   ```

2. If that fails, try the internal endpoint directly:
   ```bash
   curl http://10.0.3.47:8080/health
   ```

3. Check if the staging proxy is routing correctly:
   ```bash
   ssh admin@bastion.internal.acmecorp.net
   kubectl -n production get pods
   ```

## Database Issues

Connect to the primary database:
```bash
psql -h db-primary.us-east-1.rds.amazonaws.com -U app_admin -d production
```

The read replica is at `db-replica-01.us-east-1.rds.amazonaws.com`.

## Logging

Logs are shipped to our ELK stack at https://kibana.internal.acmecorp.net:5601.

For the legacy system, check `/var/log/acmecorp/api-gateway/` on `gateway-prod-01.internal.acmecorp.net`.
