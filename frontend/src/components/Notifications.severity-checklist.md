# Notifications – Severity visual snapshot checklist

Use this checklist when validating the notification dropdown styles.

## Fixture payload (manual snapshot)

```json
[
  { "id": 1, "notification_type": "custom_reminder", "message": "Info sample", "severity": "info" },
  { "id": 2, "notification_type": "daily_summary", "message": "Success sample", "severity": "success" },
  { "id": 3, "notification_type": "stalled_goal", "message": "Warning sample", "severity": "warning" },
  { "id": 4, "notification_type": "consumable_overdue", "message": "Critical sample", "severity": "critical" },
  { "id": 5, "notification_type": "unknown_future_type", "message": "Neutral fallback sample", "severity": "unknown" }
]
```

## Visual checklist by severity

- [ ] **info**: background, left border and icon use info tokens.
- [ ] **success**: background, left border and icon use success tokens.
- [ ] **warning**: background, left border and icon use warning tokens.
- [ ] **critical**: background, left border and icon use critical tokens.
- [ ] **neutral fallback**: unknown severity/type renders with neutral tokens.

## Type icon checklist (new notifications)

- [ ] `consumable_insufficient_history` uses info icon.
- [ ] `consumable_restock_due` uses warning icon.
- [ ] `consumable_overdue` uses critical icon.
- [ ] `custom_reminder` uses bell icon.
