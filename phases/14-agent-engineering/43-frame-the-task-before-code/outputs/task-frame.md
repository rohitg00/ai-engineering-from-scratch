# Task Frame: Prevent duplicate email addresses during signup

Status: READY

## Repository facts
- Account writes use AccountStore (`app/accounts.py:18`)
- Duplicate errors use status 409 (`tests/test_accounts.py:44`)

## Allowed paths
- `app/accounts.py`
- `tests/test_accounts.py`

## Forbidden paths
- `migrations/**`
- `deploy/**`

## Acceptance evidence
- `python3 -m unittest tests.test_accounts`

## Unknowns
- Whether email comparison is case-insensitive
