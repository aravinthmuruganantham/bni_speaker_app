# BNI Speaker Timer

Projector countdown, phone remote and speaker lineup for chapter meetings. Plain HTML/CSS/JS plus a few small Vercel functions. No build step.

- **Display mode** (laptop on the projector): the timer only. 30 s countdown, bell at 0:00, then a beep every second in overtime (-0:01, -0:02...) with a red flashing screen.
- **Remote mode** (phone): start / pause / stop, who is speaking, who is up next, view-only lineup, speaker log, CSV export.
- **Lineup setup** (before the meeting): speakers in order with name, category, company and photo.

## Structure

```
api/        Vercel functions (state, cmd, data, lineup, photo, export)
lib/        storage (Upstash Redis), commands, PIN check
public/     the website: index, display, remote, lineup, css/, js/, icons
dev-server.js   local testing only (npm run dev)
vercel.json
```

## Deploy (about 10 minutes)

1. **GitHub:** create a new repository and push this folder.
   ```
   git init && git add . && git commit -m "BNI speaker timer"
   git branch -M main
   git remote add origin https://github.com/<you>/bni-speaker-timer.git
   git push -u origin main
   ```
2. **Vercel:** Add New > Project > import the repository. Framework preset: **Other**. Leave build settings empty. Deploy.
3. **Storage:** in the Vercel project open **Storage** (or Marketplace), add **Upstash Redis**, and connect it to the project. This adds the Redis environment variables automatically.
4. **PIN:** Settings > Environment Variables > add `ADMIN_PIN` with a PIN only you know.
5. **Redeploy** (Deployments > the latest > Redeploy) so the new variables take effect.

Without step 4 anyone with the link can control the timer. Without step 3 the site shows "Redis is not connected".

## Use

**Before the meeting (phone or laptop):** open `/lineup`, enter the PIN, paste or add speakers in order, add photos, Save.

**At the meeting:**
1. Laptop (on the projector): open the site, go to **Display mode**, click once on the page (this allows sound), press **F** for full screen.
2. Phone: open the site, go to **Remote mode**, enter the PIN once. Add it to the home screen if you like.
3. Tap **Start**. The projector counts down. Tap **Stop & log** when the speaker finishes, then **Next speaker**.
4. Tap a name in the **Lineup** tab to jump to anyone out of order. Use **Visitor** for people not on the list.
5. After the meeting: **Log** tab > **Export CSV**, then **Clear log** to start fresh next week.

Time slots: 30-Second Speech (30 s), Education Slot (4 min), Feature Presentation (8 min), or any custom title and time. Edit the saved slots in the Timer tab.

## Notes

- Needs internet at the venue, on both the laptop and the phone.
- Screens refresh about once a second. The countdown itself is smooth and uses the server clock, so the phone and the projector agree.
- Each open screen makes about one small request per second. Close the tabs after the meeting. A forgotten open projector tab keeps using your Redis and function quota.
- Photos are shrunk on the phone to 128 px before upload and stored in Redis.
- The CSV time column is shown in India time (IST).
- To use the official BNI logo, add your own file at `public/assets/logo.png`. It appears in the red header automatically. Check BNI's brand rules before using it.
- Local test: `make dev` then open http://localhost:4817 (change with `make dev PORT=5000`; `npm run dev` also works, on port 3000) (data is kept in memory only, and no PIN is required).
