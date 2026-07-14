# JARVIS Tasker Setup — Complete Implementation

**Status:** Full automatic assist with 8 phone actions + logging

## Tasks to Create

### 1. Jarvis Alarm
**HTTP Entry Point:** `http://localhost:1337/?task=Jarvis%20Alarm&par1=08&par2=30&par3=Meeting&par4=10`

**Parameters:**
- `par1`: hours (int, 0-23)
- `par2`: minutes (int, 0-59)
- `par3`: label/reason (text)
- `par4`: snooze duration minutes (int, default 10)

**Actions:**
```
1. Task → If: %par1 is set
2. Alarm → Set Alarm
   - Time: %par1:%par2
   - Label: %par3
   - Snooze: %par4 min
   - Sound: Default
   - Vibrate: On
   - Volume: Max
3. Log: Alarm set for %par1:%par2 - %par3
```

---

### 2. Jarvis SMS
**HTTP Entry Point:** `http://localhost:1337/?task=Jarvis%20SMS&par1=John&par2=Running%20late`

**Parameters:**
- `par1`: contact name or number
- `par2`: message text

**Actions:**
```
1. Task → If: %par2 is set
2. Variable → Find Contact Number
   - Name: %par1
   - Store in: %phone_number
3. Send SMS
   - Number: %phone_number (or %par1 if direct number)
   - Message: %par2
4. Notify: "SMS sent to %par1"
5. Log: SMS to %par1 - %par2
```

---

### 3. Jarvis Reminder
**HTTP Entry Point:** `http://localhost:1337/?task=Jarvis%20Reminder&par1=Call%20mum&par2=2026-06-25&par3=14&par4=30`

**Parameters:**
- `par1`: reminder title
- `par2`: date (YYYY-MM-DD)
- `par3`: hours
- `par4`: minutes

**Actions:**
```
1. Task → If: %par1 is set
2. Create Reminder
   - Title: %par1
   - Date: %par2
   - Time: %par3:%par4
   - Show notification: Yes
3. Log: Reminder created - %par1 at %par2 %par3:%par4
```

---

### 4. Jarvis Calendar
**HTTP Entry Point:** `http://localhost:1337/?task=Jarvis%20Calendar&par1=Meeting%20with%20team&par2=2026-06-25&par3=10&par4=00&par5=11&par6=00&par7=Office`

**Parameters:**
- `par1`: event title
- `par2`: date (YYYY-MM-DD)
- `par3`: start hours
- `par4`: start minutes
- `par5`: end hours
- `par6`: end minutes
- `par7`: location (optional)

**Actions:**
```
1. Task → If: %par1 is set
2. Create Calendar Event
   - Title: %par1
   - Date: %par2
   - Start: %par3:%par4
   - End: %par5:%par6
   - Location: %par7 (if set)
   - Calendar: Default
   - Notification: 15 min before
3. Log: Calendar event - %par1 at %par2 %par3:%par4
```

---

### 5. Jarvis OpenApp
**HTTP Entry Point:** `http://localhost:1337/?task=Jarvis%20OpenApp&par1=Chrome`

**Parameters:**
- `par1`: app name (Chrome, Gmail, Obsidian, WhatsApp, etc.)

**Actions:**
```
1. Task → If: %par1 is set
2. Variable → Map app name to package
   - Chrome → com.android.chrome
   - Gmail → com.google.android.gm
   - Obsidian → md.obsidian
   - WhatsApp → com.whatsapp
   - etc.
   - Store in: %package
3. Launch App: %package
4. Log: App opened - %par1
```

---

### 6. Jarvis Timer
**HTTP Entry Point:** `http://localhost:1337/?task=Jarvis%20Timer&par1=5&par2=Cooking`

**Parameters:**
- `par1`: duration in minutes
- `par2`: label/reason (optional)

**Actions:**
```
1. Task → If: %par1 is set
2. Create Timer
   - Duration: %par1 min
   - Label: %par2
   - Sound: Alarm
   - Notification: Yes
3. Notify: "Timer set for %par1 minutes - %par2"
4. Log: Timer - %par1 min (%par2)
```

---

### 7. Jarvis Notify
**HTTP Entry Point:** `http://localhost:1337/?task=Jarvis%20Notify&par1=Reminder&par2=Call%20grandad&par3=high`

**Parameters:**
- `par1`: notification title
- `par2`: notification message
- `par3`: priority (low, normal, high)

**Actions:**
```
1. Task → If: %par1 is set
2. Notification
   - Title: %par1
   - Message: %par2
   - Priority: %par3
   - Sound: Notification tone
   - Vibrate: On (if high priority)
3. Log: Notification sent - %par1: %par2
```

---

### 8. Jarvis Master (Optional Route Dispatcher)
**HTTP Entry Point:** `http://localhost:1337/?task=Jarvis%20Handler&par1=alarm&par2=08&par3=30`

Routes to appropriate sub-task based on `par1`:
```
1. Variable → Switch %par1
   - alarm → Call task "Jarvis Alarm"
   - sms → Call task "Jarvis SMS"
   - reminder → Call task "Jarvis Reminder"
   - calendar → Call task "Jarvis Calendar"
   - app → Call task "Jarvis OpenApp"
   - timer → Call task "Jarvis Timer"
   - notify → Call task "Jarvis Notify"
```

---

## Setup Steps

1. **Create each task in Tasker** with the specified actions
2. **Test each individually** (press play icon in Tasker)
3. **Test HTTP calls** using a browser on the phone:
   - `http://localhost:1337/?task=Jarvis%20Alarm&par1=08&par2=30&par3=Test&par4=10`
4. **Verify logs** are created in action logs
5. **Sync with Obsidian** to pull latest JARVIS Ask macro

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| HTTP requests not reaching Tasker | Ensure Tasker is running, check HTTP server is enabled (Prefs → Misc → Allow external access) |
| Parameters show as literal %par1 | Make sure parameters are passed in URL; check URL encoding |
| Alarms not creating | Verify Tasker has alarm permissions; check system alarms app permissions |
| Tasks fail silently | Add logging to each task; use Tasker's logcat viewer |
| SMS not sending | Add SEND_SMS permission; verify contact resolution |

---

## Automation Workflows (Future)

Once basic actions work:
- Daily routine automation (morning alarms, briefing notifications)
- Recurring reminders based on vault patterns
- Smart scheduling (learn preferences, suggest times)
- Auto-logging important events
- Context-aware recommendations
