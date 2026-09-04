# Migration Review Checklist

## Forward

- Identify the schema and data transition.
- Check compatibility with the currently deployed application version.
- Estimate locks, transaction duration, and affected row volume.

## Rollback

- State whether rollback is safe, lossy, or impossible.
- Keep destructive cleanup separate from the compatibility migration.
- Name the restore or compensating path when reversal is not possible.

## Evidence

- Record the exact validation command and result.
- Link each risk to a file and statement.
- Leave the decision blocked when production volume or compatibility evidence is missing.
