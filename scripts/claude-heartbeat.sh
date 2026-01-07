#!/usr/bin/env bash

# Reset 5h limit before each work session
# Runs at 07:00, 12:05, and 17:10 daily

SCHEDULED_TIMES=("07:00" "12:05" "17:10")
LOOP_INTERVAL=30
last_run=""

echo "[claude-heartbeat] watching times: ${SCHEDULED_TIMES[*]}"

while true; do
  now_time="$(date '+%H:%M')"
  today="$(date '+%Y-%m-%d')"

  for t in "${SCHEDULED_TIMES[@]}"; do
    key="${today} ${t}"
    if [[ "$now_time" == "$t" && "$last_run" != "$key" ]]; then
      last_run="$key"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sending heartbeat..."
      claude -p "hello" >/dev/null 2>&1 && echo "✓ Claude responded" || echo "✗ Claude failed"
    fi
  done

  sleep "$LOOP_INTERVAL"
done
