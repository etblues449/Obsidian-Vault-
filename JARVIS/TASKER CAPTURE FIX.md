# JARVIS Tasker Capture — Fix Empty Captures

**Status:** Diagnostic guide for empty placeholder captures ("your note here")  
**Last Updated:** 2026-08-02  
**Problem:** "Ask JARVIS" shortcut fires 3× with placeholder text instead of user input  
**Root Cause:** Tasker variable scope at HTTP Request action moment  

---

## The Issue

When you use Alt+A → "Ask JARVIS" on your Fold 7, the shortcut sometimes captures with placeholder text **"your note here"** instead of what you actually typed. The webhook returns 200, a file appears, but the content is wrong.

The **n8n junk filter** catches these and quarantines them to `JARVIS/Inbox/_rejected/`, but this is a second-line defence. The real fix is at the source: **Tasker variable is empty or out of scope at the moment of the HTTP POST.**

---

## Diagnosis Steps (Do These First)

### 1. Locate Your "Ask JARVIS" Tasker Task

Open **Tasker** on your Fold 7:
- Go to **Tasks** tab
- Look for a task named **"Ask JARVIS"**, **"Capture"**, **"Note"**, or similar
- If you don't see it: check if it's a shortcut (Android Shortcuts app) instead
- If it's a shortcut: export it to Tasker or recreate as a Tasker task

### 2. Add Diagnostic Flash Logging

Inside the "Ask JARVIS" task, you should have an **HTTP Request** action that posts to the n8n webhook.

**Before that HTTP Request action:**

1. **Add a new action:** Task → Flash
2. **Set the text:** `%captured_text` (or whatever variable name you use for the user's input)
3. **Duration:** Long (3 seconds)

This will pop up a notification showing **exactly what value the variable holds** at that moment, immediately before the POST.

### 3. Test the Fix

1. Open the task and press **Play** (the green play icon)
2. Type something: e.g., "Test message" 
3. **Watch the Flash notification** — what does it show?
4. Check the webhook logs (n8n or GitHub) — what actually got posted?

---

## Expected Scenarios

| Flash Shows | Webhook Gets | Cause | Fix |
|---|---|---|---|
| `"Test message"` | `"Test message"` | ✅ Working | Nothing — no fix needed |
| `(empty)` | `"your note here"` | Variable empty at HTTP action | Scope issue — task variable not visible here |
| `"Test message"` | `"your note here"` | Variable populated but HTTP action override | Check HTTP action parameters |
| (no Flash) | `"your note here"` | Action never reached | Logic flow error before HTTP action |

---

## The Full "Ask JARVIS" Tasker Task (Reference)

If you need to rebuild it from scratch, here's the complete task structure:

```
Task: Ask JARVIS
├─ 1. Variable Set: %userInput (clear it first)
├─ 2. Popup → Input Prompt
│   └─ Title: "Ask JARVIS (or request action)"
│   └─ Text to show: "What would you like me to do?"
│   └─ Store in variable: %userInput
├─ 3. Variable → If: %userInput is set
├─ 4. ⭐ Flash: %userInput  ← DIAGNOSTIC FLASH (new)
│   └─ Duration: Long (3s)
├─ 5. HTTP Request
│   └─ Method: POST
│   └─ URL: https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture
│   └─ Data / Body:
│       {
│         "noteText": "%userInput",
│         "timestamp": "%TIMES",
│         "source": "tasker"
│       }
│   └─ Timeout: 5 seconds
├─ 6. Notify: "Captured ✓"
└─ 7. Else: Notify "No input"
```

**Key points:**
- Variable **must be set before** the Flash action
- The HTTP body uses `%userInput` (or whatever your variable is)
- The Flash happens **immediately before** the HTTP POST
- If Flash is empty, that's your bug — the variable is out of scope

---

## Common Variable Scope Issues in Tasker

### Issue: Task Variable → Subtask → HTTP Action

If you have a **subtask call** between the input prompt and the HTTP action, the variable may be lost:

```
❌ WRONG:
1. Prompt → %userInput
2. Call subtask "Process"
3. HTTP Request (can't see %userInput)
```

**Fix:** Use **local variables** with a scope marker:

```
✅ RIGHT:
1. Prompt → %userInput  (task variable)
2. Variable → %var_captured = %userInput  (explicit copy)
3. Call subtask "Process" with (%var_captured)
4. HTTP Request using passed variable
```

### Issue: Variable Name Typo

Check that the **variable name** in the Flash action matches the **variable name** in the HTTP body.

```
❌ WRONG:
Flash: %input_text
HTTP Body: %userInput
```

---

## After You Fix It

Once the diagnostic Flash shows the **correct value** reaching the HTTP action:

1. **Run the task 5 times** with different inputs
2. **Check the vault** — entries should land in `JARVIS/Inbox/` with correct text
3. **Remove the diagnostic Flash** (optional — you can keep it)
4. **Submit findings** — report what the issue was and how it's fixed

---

## If the Flash Shows the Right Value But Webhook Still Gets "your note here"

Then the problem is in the **HTTP Request action setup**, not the variable. Check:

1. **URL is correct** — exactly `https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture`
2. **Body parameter name** — n8n expects `noteText` (not `note`, `text`, `content`, etc.)
3. **POST headers** — should be `Content-Type: application/json`

**Tasker HTTP Request setup:**
- Method: POST
- URL: `https://jellybean1875.app.n8n.cloud/webhook/jarvis-capture`
- Data / Body / Content: 
  ```json
  {"noteText": "%userInput", "timestamp": "%TIMES"}
  ```
- Headers:
  ```
  Content-Type:application/json
  ```

---

## If the Flash Shows Empty or Weird Values

**"%userInput" not set:**
- The Popup action didn't fire or store the result
- Check: Popup action **"Store in variable"** is set to `%userInput`

**"%userInput" shows **(%userInput)**:**
- Variable expansion is off or the name is wrong
- Check: Variable name is **exactly** `%userInput` (no extra characters)

**"%userInput" shows **%1, %2, etc.:**
- You're looking at parameter variables, not task variables
- Rename to a unique variable name like `%capture_text`

---

## Next Steps

1. **Add the diagnostic Flash** to your current "Ask JARVIS" task
2. **Test 3 times** with different inputs
3. **Screenshot the Flash results** if possible
4. **Report back** what shows in Flash vs. what reaches the webhook
5. **Fix based on the table above**

Once fixed, the placeholder captures will stop and the junk filter will rarely trigger.
