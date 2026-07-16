# Timber

## ADLC-conventies

- PM-systeem: GitHub Issues in `TomSchillemans/Timber` (geen Linear/JIRA).
- Sub-issues van `/adlc:breakdown` worden aangemaakt als native GitHub sub-issues
  (`gh api repos/TomSchillemans/Timber/issues/<parent>/sub_issues -F sub_issue_id=<id> -X POST`),
  niet als losse top-level issues.
- Bij het aanmaken van een hoofd-issue (via `/adlc:refine`) én bij elke sub-issue uit
  `/adlc:breakdown`: wijs altijd `TomSchillemans` toe als assignee
  (`gh issue edit <n> --add-assignee TomSchillemans`).
