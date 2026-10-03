---
name: kinetic-director
description: >-
  Automates the OLED Lyrics Studio interface: selects songs/lyrics, executes the Groq Cloud AI Director, renders the 30 FPS kinetic typography sequence, captures a real high-definition .webm video with full browser fonts, and visually inspects the animation frames. Use whenever the user asks to test, preview, run AI director, or analyze kinetic typography on any song or lyrics.
---

# Kinetic Director & OLED WebM Workflow

This skill allows Antigravity to autonomously drive the OLED Visual Studio interface, run the Groq AI Director on any song and lyrics, capture a true 30 FPS `.webm` video recording, and inspect the animation frame-by-frame.

---

## 1. How It Works

1. **Browser Engine**: Launches Google Chrome headlessly via `puppeteer-core`.
2. **Local Studio Server**: Serves the production React studio bundle (`web/dist`).
3. **Lyrics Ingestion**: Injects the song title, artist, and timestamped LRC lyrics into the studio.
4. **AI Director Execution**: Automatically triggers the Groq Cloud AI Director (`openai/gpt-oss-120b`) to classify lyrical punchlines, archetypes, and visual motifs.
5. **Real Phosphor WebM Export**: Captures the live 30 FPS canvas stream using the browser's native `MediaRecorder` into a high-res (512×256) cyan OLED WebM video.
6. **Visual Inspection**: Antigravity calls `view_file` on the generated `.webm` file to visually inspect the animation stills directly in the conversation.

---

## 2. Command Usage

Run the automation script from `D:\espprojects\oled\web`:

### A. Run with a Preset Song
```bash
node scripts/automate-studio-render.cjs --preset 52bars
node scripts/automate-studio-render.cjs --preset shape_of_you
```

### B. Run with Custom Song & LRC Lyrics
```bash
node scripts/automate-studio-render.cjs --song "Song Title" --artist "Artist Name" --lyrics "path/to/lyrics.lrc" --out "exports/my_preview.webm"
```

### C. Run with Plain Text Lyrics (No Timestamps Needed)
Copy-paste raw lyrics directly without any `[mm:ss.xx]` tags. Use `--pacing` to set delivery:
```bash
# Slow Ballad pacing (~4.5s/line):
node scripts/automate-studio-render.cjs --song "Can't Help Falling in Love" --artist "Elvis Presley" --lyrics "path/to/plain_lyrics.txt" --pacing ballad

# Fast Rap pacing (~2.2s/line):
node scripts/automate-studio-render.cjs --song "Godzilla" --artist "Eminem" --lyrics "path/to/plain_lyrics.txt" --pacing rap
```

### D. Inline Lyrics String
```bash
node scripts/automate-studio-render.cjs --song "Title" --artist "Artist" --lyrics "Line 1 lyrics\nLine 2 lyrics\nLine 3 lyrics" --pacing pop
```

---

## 3. Automated Inspection Procedure

After the script outputs `🎉 SUCCESS: WebM Video Recorded & Saved!`:

1. **Call `view_file`**:
   Use `view_file` with `AbsolutePath: "D:/espprojects/oled/web/exports/<filename>.webm"`.
2. **Evaluate Visual Criteria**:
   - **Legibility**: Are all letters immediately readable without broken glyphs or excessive occlusion?
   - **Archetype Fit**: Does the motion archetype match the word's energy (e.g. explosive hits on punches, quiet typewriter on pauses)?
   - **Motif Safety**: Do background motifs preserve a clean text reading zone without swallowing letterforms?
   - **Micro-Badges**: Are micro-badges properly centered above the text with a black knockout halo and no overlap?
   - **Fillers & Connectors**: Are connector words (`jo`, `ne`, `te`, `the`, `and`) cleanly subordinated with minimal distractions?
3. **Iterate & Refine**:
   If any word looks cluttered or awkward, immediately tune the relevant archetype, motif clearance, or prompt rule in `src/engine/kinetic/`, rebuild with `npm run build`, and re-run.
