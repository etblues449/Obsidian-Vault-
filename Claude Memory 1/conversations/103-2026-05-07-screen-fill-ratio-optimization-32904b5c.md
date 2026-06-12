---
title: "Screen fill ratio optimization"
date: 2026-05-07
uuid: 32904b5c-cb66-4feb-aa8b-84e8b69b9920
messages: 8
project: ""
source: claude.ai export 2026-05-08
---

# Screen fill ratio optimization

> 8 messages · 2026-05-07

### Human — 2026-05-07T23:08

What's the best ratio to fill the screen fully

### Assistant — 2026-05-07T23:09

Let me read the Smart Home project index first as instructed.Got the project context. Now to your question — this isn't really a Smart Home task, it's a YouTube Shorts editing question, so I'll just answer directly.

**9:16** — which is what you've already got selected. That's the correct ratio for YouTube Shorts (and TikTok/Reels) and will fill a phone screen fully in vertical orientation.

The reason your preview looks letterboxed in the screenshot is that your **source footage is 16:9** (landscape, filmed on the monitor). When you drop 16:9 footage into a 9:16 project, it sits in the middle with black bars top and bottom by default.

To fill the 9:16 frame fully, you need to either:
- Pinch-zoom / scale the clip up until it crops to fill the vertical frame, or
- Use the "fit to screen" / "fill" option in the clip settings

Keep the project at 9:16 — don't change it.

### Human — 2026-05-07T23:17

But when I stretch it it fits the full screen I want that automatically

### Assistant — 2026-05-07T23:17

In Samsung Studio there isn't a true "auto-fill" toggle for the whole project, but there are two ways to make it happen without manually pinch-zooming each clip:

**Option 1 — Set it on the clip**
Tap the clip in the timeline → look for **Crop / Fit / Fill** (sometimes shown as a frame icon). Switch from **Fit** to **Fill**. The clip will auto-scale to fill the 9:16 frame and crop the sides.

**Option 2 — Apply to all clips at once**
After setting one clip to Fill, long-press it → **Apply to all** (or the three-dot menu → Apply to all clips). New clips you add after will usually inherit it too.

Try Option 1 first on one clip and let me know if you see the Fit/Fill toggle — the menu wording varies slightly between Studio versions.

### Human — 2026-05-07T23:19

I only have this

### Assistant — 2026-05-07T23:19

Got it — that screen is just the project ratio, no Fit/Fill option there.

Tap the **arrow (>)** next to 16:9. That should expand it to show auto-fill / auto-resize options for that ratio. If 9:16 has the same arrow when you tap into it, that's where the auto-fill toggle lives.

If there's no arrow on 9:16, then Studio doesn't have a project-wide auto-fill — you'll need to do it per clip: tap the clip → look for a **Fill** or **crop-to-fit** icon in the clip toolbar.

Let me know what the arrow reveals.

### Human — 2026-05-07T23:20

Why not 1 1

### Assistant — 2026-05-07T23:20

1:1 is square — it won't fill a phone screen either. You'd get black bars on the **top and bottom** instead of the sides.

Phone screens are tall (roughly 9:16 themselves), so only **9:16** matches the screen shape and fills it fully in vertical orientation.

Quick visual:
- **16:9** = landscape (wide) → bars top/bottom on a phone
- **1:1** = square → bars top/bottom on a phone
- **9:16** = vertical → fills the whole phone screen ✅

Also, YouTube Shorts specifically requires 9:16 to display properly as a Short — 1:1 would get letterboxed in the Shorts feed.

Stick with 9:16.

