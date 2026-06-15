# 03 - Voice Cloning Manual

The complete plan to get a voice that sounds like you, not a robot.

## What you need

- ✅ Samsung Fold 7 (use this — much better mic than your laptop)
- ✅ Windows laptop (just for transfer + upload)
- ✅ A quiet room (bedroom, wardrobe even)
- ✅ Two pillows / cushions (to dampen sound)
- ❌ No external mic needed
- ❌ No headphones needed for recording

Total time: about **2 hours today**, then wait 1-4 hours for ElevenLabs to train.

---

## Section 1 — Set up your phone

1. Open **Voice Recorder** on Fold 7 (Galaxy Store → Samsung Voice Recorder if not installed).
2. Settings → Recording quality: **High**. File format: **M4A** or WAV.
3. Phone on **aeroplane mode**.
4. Phone in **landscape**, top edge ~15 cm / 6 inches from your mouth.
5. **Stand it up** on a book — don't hold it (movement noise ruins clones).
6. Test: record yourself saying *"One, two, three — Keep Right On"* — playback should be clear.

## Section 2 — Reduce room sound

- Close the door, close the windows
- Drape a duvet behind you
- Cushion on the table next to the phone
- Stop the fridge, TV, dishwasher
- Record after 9pm or before 7am if near a road

## Section 3 — Block A · Read these (15 min)

→ See [[Scripts/A - Read These]]

## Section 4 — Block B · Talk about these (15 min) — MOST IMPORTANT

→ See [[Scripts/B - Talk About These]]

## Section 5 — Block C · Read short scripts (30 min)

→ See [[Scripts/C - Mat-Style Shorts]]

## Section 6 — Block D · Number drill (5 min)

→ See [[Scripts/D - Number Drill]]

---

## Section 7 — Move files to laptop

USB-C cable from phone to laptop.
Phone asks for "File transfer mode."
Files at: `Internal Storage / Recordings / Voice Recorder`.
Drag them all to a folder on desktop called `Blues_voice`.

(Or upload from phone direct to ElevenLabs in the next step — both work.)

## Section 8 — ElevenLabs setup

1. Go to **https://elevenlabs.io**
2. Sign up. Choose **Creator plan** ($22 / £18 a month). Lower plans don't include PVC.
3. **Voices → Add Voice → Professional Voice Clone**.
4. Name it: `Blues_v1` or `Me_v1`.
5. **Upload all your recording files** (up to 25 separate files).
6. **Identity verification** — webcam selfie, 2 mins, anti-fraud, can't be skipped.
7. **Submit.** Wait 1-4 hours. ElevenLabs emails you when training is done.

## Section 9 — Plug ElevenLabs into HeyGen

1. ElevenLabs → **Profile → API Keys → Create new key**. Copy.
2. HeyGen → **Settings → Integrations** (or "Voice → Add Third-Party Voice").
3. Choose **ElevenLabs** → paste API key → **Confirm**.
4. Your `Blues_v1` voice now appears in HeyGen's voice list.
5. Copy the new Voice ID HeyGen gives you for that voice.

## Section 10 — Use it in FinCast

1. FinCast → **Settings** → paste the new Voice ID into **HeyGen Voice ID**.
2. Tap **↻ Fetch** to confirm it shows up in the dropdown.
3. **Test voice** card → render a 60s sample → listen.

If it sounds like you = done.

## Section 11 — The final test

Render one full TikTok with the new voice on the £100k tax trap script.
**Listen with earbuds in.**

Ask:
1. Does it sound like me?
2. Does it sound like a person, not a robot?
3. Are the numbers (£12,570 etc.) right?
4. Would my mum recognise it?

**3 out of 4 = ship.**
**Less = re-record Block B (talking) and add to the same voice in ElevenLabs.**

---

## What you do NOT need to do

- ❌ Don't worry about reading perfectly — stumbles are fine
- ❌ Don't worry about your accent — the AI learns it
- ❌ Don't bother with audio editing — ElevenLabs handles it
- ❌ Don't read in a voice that isn't your real voice
- ❌ Don't record on the laptop — phone mic is better

## Cost

- ElevenLabs Creator: ~£18/month
- HeyGen: existing plan
- Anthropic API: ~£3/month
- **Total at 4 videos/week: under £30/month**

## Backup plan if it underperforms after retrain #2

- Switch to ElevenLabs **v3 model** (released Q1 2026)
- Try **PlayHT** as alternative ($39/mo, similar PVC quality)
- Last resort: hire a UK voice actor on Voices.com (£40-80 per script)

## When it's done

Tell Claude (the agent): **"Voice ID is [whatever]"** → existing test videos get re-rendered with the new voice → A/B against the originals → ship.
