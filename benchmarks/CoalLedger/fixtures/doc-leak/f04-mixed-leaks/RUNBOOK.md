# Incident Response Runbook

## On-Call Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| Primary | Alex Rivera | +1-555-0198 | @arivera |
| Secondary | Priya Sharma | +1-555-0234 | @psharma |
| Escalation | CTO David Kim | +1-555-0301 | @dkim |

## Severity Classification

- **SEV-1:** Revenue impact > $5,000/hour or > 10% of users affected
- **SEV-2:** Feature degraded, workaround exists
- **SEV-3:** Cosmetic or non-critical

## Response Procedures

### Database Failover

```bash
# Connect to the primary
ssh ops@db-failover.internal.acmecorp.net
sudo /opt/acmecorp/bin/failover --cluster prod-pg-01 --promote replica-02

# Verify (password in 1Password vault "Infrastructure")
psql -h 10.0.5.12 -U superadmin -d production -c "SELECT pg_is_in_recovery();"
```

### Rollback Deployment

```bash
# Our deploy key (rotate quarterly, next rotation: Feb 2026)
export DEPLOY_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
curl -H "Authorization: token $DEPLOY_TOKEN" https://api.github.com/repos/acmecorp/app/deployments
```

## Post-Incident

File a report in the `#incidents` channel within 48 hours. Template: https://docs.internal.acmecorp.net/incident-template.
The last three incidents (Nov 2025) cost us approximately $23,000 in SLA credits.
