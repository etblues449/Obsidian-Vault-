#!/bin/bash
# JARVIS Unlimited — Termux:API Bridge
# Executes phone actions via Termux:API
# Usage: source this file in JARVIS scripts

# Configuration
JARVIS_HOME="$HOME/jarvis"
VAULT_PATH="/storage/emulated/0/Documents/Obsidian Vault — Primary"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==================== TOOL FUNCTIONS ====================

# Set alarm via Termux:API
set_alarm() {
  local time=$1
  local date=$2
  local label=$3

  # Parse time (HH:MM)
  local hour=$(echo $time | cut -d: -f1)
  local minute=$(echo $time | cut -d: -f2)

  # Parse date (convert relative to absolute if needed)
  if [ "$date" = "today" ]; then
    date=$(date +%Y-%m-%d)
  elif [ "$date" = "tomorrow" ]; then
    date=$(date -d "+1 day" +%Y-%m-%d)
  fi

  # Extract year, month, day
  local year=$(echo $date | cut -d- -f1)
  local month=$(echo $date | cut -d- -f2)
  local day=$(echo $date | cut -d- -f3)

  # Use termux-alarm (via Tasker or direct am command)
  # Format: HH:MM:SS
  local alarm_time="${hour}:${minute}:00"

  echo -e "${YELLOW}[ALARM] Setting alarm for ${date} at ${time}${NC}"
  if [ -n "$label" ]; then
    echo -e "${YELLOW}[REASON] ${label}${NC}"
  fi

  # Call Termux:API (if available)
  if command -v termux-alarm-set &> /dev/null; then
    termux-alarm-set $((10#$hour)) $((10#$minute)) "$label"
    echo -e "${GREEN}[OK] Alarm set${NC}"
    return 0
  else
    echo -e "${RED}[ERROR] Termux:API not available${NC}"
    return 1
  fi
}

# Create calendar event
create_calendar_event() {
  local title=$1
  local date=$2
  local start_time=$3
  local end_time=$4
  local description=$5
  local location=$6

  # Parse date if relative
  if [ "$date" = "today" ]; then
    date=$(date +%Y-%m-%d)
  elif [ "$date" = "tomorrow" ]; then
    date=$(date -d "+1 day" +%Y-%m-%d)
  fi

  echo -e "${YELLOW}[CALENDAR] Creating event: ${title}${NC}"
  echo -e "${YELLOW}[DATE] ${date} from ${start_time} to ${end_time}${NC}"
  if [ -n "$location" ]; then
    echo -e "${YELLOW}[LOCATION] ${location}${NC}"
  fi

  # Use termux-open or calendar intent
  # This would typically open Calendar app or use intent
  if command -v termux-open &> /dev/null; then
    # Create intent URL for Google Calendar
    local intent_url="intent://#Intent;action=android.intent.action.INSERT;data=content://com.android.calendar/events;S.title=${title};S.dtstart=${date}T${start_time}:00;S.description=${description};end"
    termux-open "$intent_url"
    echo -e "${GREEN}[OK] Calendar event created${NC}"
    return 0
  else
    echo -e "${RED}[ERROR] Cannot create calendar event${NC}"
    return 1
  fi
}

# Send SMS
send_sms() {
  local contact=$1
  local message=$2

  echo -e "${YELLOW}[SMS] Sending to: ${contact}${NC}"
  echo -e "${YELLOW}[MSG] ${message}${NC}"

  # Use termux-sms-send
  if command -v termux-sms-send &> /dev/null; then
    termux-sms-send -n "$contact" "$message"
    echo -e "${GREEN}[OK] SMS sent${NC}"
    return 0
  else
    echo -e "${RED}[ERROR] Termux:API SMS not available${NC}"
    return 1
  fi
}

# Create reminder
create_reminder() {
  local title=$1
  local date=$2
  local time=$3

  if [ "$date" = "today" ]; then
    date=$(date +%Y-%m-%d)
  elif [ "$date" = "tomorrow" ]; then
    date=$(date -d "+1 day" +%Y-%m-%d)
  fi

  echo -e "${YELLOW}[REMINDER] ${title}${NC}"
  echo -e "${YELLOW}[DATE] ${date} at ${time}${NC}"

  # Use termux-alarm
  local hour=$(echo $time | cut -d: -f1)
  local minute=$(echo $time | cut -d: -f2)

  if command -v termux-alarm-set &> /dev/null; then
    termux-alarm-set $((10#$hour)) $((10#$minute)) "$title"
    echo -e "${GREEN}[OK] Reminder set${NC}"
    return 0
  else
    echo -e "${RED}[ERROR] Cannot set reminder${NC}"
    return 1
  fi
}

# Open app
open_app() {
  local app_name=$1

  echo -e "${YELLOW}[APP] Opening: ${app_name}${NC}"

  if command -v termux-open &> /dev/null; then
    case "$app_name" in
      "Chrome") termux-open "https://google.com" ;;
      "Gmail") termux-open "mailto:" ;;
      "Obsidian") am start -n com.obsidianmd.obsidian/.MainActivity ;;
      "Settings") am start -a android.intent.action.MAIN -n com.android.settings/.Settings ;;
      "Camera") am start -n com.android.camera/.CameraActivity ;;
      *) am start -n "com.${app_name,,}/*" 2>/dev/null || termux-open "$app_name" ;;
    esac
    echo -e "${GREEN}[OK] App launched${NC}"
    return 0
  else
    echo -e "${RED}[ERROR] Cannot launch app${NC}"
    return 1
  fi
}

# Send notification
send_notification() {
  local title=$1
  local message=$2
  local priority=${3:-"normal"}

  echo -e "${YELLOW}[NOTIFY] ${title}${NC}"
  echo -e "${YELLOW}[MSG] ${message}${NC}"

  if command -v termux-notification &> /dev/null; then
    termux-notification --title "$title" --content "$message"
    echo -e "${GREEN}[OK] Notification sent${NC}"
    return 0
  else
    echo -e "${RED}[ERROR] Cannot send notification${NC}"
    return 1
  fi
}

# Get contacts
get_contacts() {
  local query=$1

  if command -v termux-contact-list &> /dev/null; then
    if [ -z "$query" ]; then
      termux-contact-list
    else
      termux-contact-list | grep -i "$query"
    fi
    return 0
  else
    echo -e "${RED}[ERROR] Cannot access contacts${NC}"
    return 1
  fi
}

# Set timer
set_timer() {
  local duration_minutes=$1
  local label=$2

  local duration_seconds=$((duration_minutes * 60))

  echo -e "${YELLOW}[TIMER] ${duration_minutes} minutes${NC}"
  if [ -n "$label" ]; then
    echo -e "${YELLOW}[LABEL] ${label}${NC}"
  fi

  if command -v termux-alarm-set &> /dev/null; then
    # Calculate future time
    local future_time=$(date -d "+${duration_minutes} minutes" +%H:%M)
    local future_hour=$(echo $future_time | cut -d: -f1)
    local future_minute=$(echo $future_time | cut -d: -f2)

    termux-alarm-set $((10#$future_hour)) $((10#$future_minute)) "Timer: $label"
    echo -e "${GREEN}[OK] Timer set${NC}"
    return 0
  else
    echo -e "${RED}[ERROR] Cannot set timer${NC}"
    return 1
  fi
}

# Read file
read_file() {
  local file_path=$1

  if [ -f "$file_path" ]; then
    cat "$file_path"
    return 0
  else
    echo -e "${RED}[ERROR] File not found: ${file_path}${NC}"
    return 1
  fi
}

# Write file
write_file() {
  local file_path=$1
  local content=$2
  local append=${3:-false}

  if [ "$append" = true ]; then
    echo "$content" >> "$file_path"
  else
    echo "$content" > "$file_path"
  fi

  echo -e "${GREEN}[OK] File written: ${file_path}${NC}"
  return 0
}

# Get current time and date
get_time_and_date() {
  local format=${1:-"readable"}

  case "$format" in
    "iso")
      date -u +%Y-%m-%dT%H:%M:%SZ
      ;;
    "readable")
      date '+%A, %B %d, %Y at %H:%M:%S'
      ;;
    "timestamp")
      date +%s
      ;;
    *)
      date '+%A, %B %d, %Y at %H:%M:%S'
      ;;
  esac
}

# ==================== CONFIRMATION SYSTEM ====================

confirm_action() {
  local action_description=$1

  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}[JARVIS] About to perform:${NC}"
  echo "$action_description"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Send notification to phone asking for confirmation
  if command -v termux-notification &> /dev/null; then
    termux-notification --title "JARVIS Confirmation" --content "Allow this action? Check terminal"
  fi

  read -p "Proceed? (Y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    return 0
  else
    echo -e "${RED}[CANCELLED]${NC}"
    return 1
  fi
}

# ==================== EXPORT FUNCTIONS ====================

export -f set_alarm
export -f create_calendar_event
export -f send_sms
export -f create_reminder
export -f open_app
export -f send_notification
export -f get_contacts
export -f set_timer
export -f read_file
export -f write_file
export -f get_time_and_date
export -f confirm_action

echo -e "${GREEN}[JARVIS] Termux:API bridge loaded${NC}"
