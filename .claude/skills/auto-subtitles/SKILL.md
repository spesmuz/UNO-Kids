---
name: auto-subtitles
description: Generate subtitles and captions for video - transcribe speech with Whisper (faster-whisper / whisper.cpp), produce SRT/VTT/ASS, translate, style and burn in captions, including word-by-word animated captions for Reels/TikTok/Shorts. Use when the user asks for subtitles, captions, transcription, SRT files, translated subs, or burned-in text on a video.
---

# Auto Subtitles

Pipeline: **extract audio → transcribe (Whisper) → review/fix → style → burn in or mux**. FFmpeg (with libass) handles everything except speech recognition.

## 0. Preflight

```bash
command -v ffmpeg || { echo "FFmpeg missing - ask before installing"; exit 1; }
ffmpeg -hide_banner -filters | grep -E ' (subtitles|ass) '   # requires libass
python3 -c "import faster_whisper; print('faster-whisper', faster_whisper.__version__)" 2>/dev/null
command -v whisper-cli whisper 2>/dev/null
nvidia-smi -L 2>/dev/null || echo "no NVIDIA GPU - use CPU int8 + a smaller model"
fc-list | grep -iE 'montserrat|inter|roboto|dejavu|noto' | head   # available fonts
```

If no Whisper engine is installed, **ask the user** which to install (recommendation below). Model weights download from Hugging Face / the project's official host on first run - this needs network access and disk space (tiny ≈ 75 MB, small ≈ 470 MB, large-v3 ≈ 3 GB).

## 1. Extract audio

```bash
ffmpeg -y -i "$IN" -vn -ac 1 -ar 16000 -c:a pcm_s16le audio.wav
# Optional cleanup for noisy recordings:
#   -af "highpass=f=80,afftdn=nf=-25,loudnorm"
```

## 2. Transcribe

### Option A - faster-whisper (recommended: fast on CPU, MIT)

```bash
python3 -m venv .venv-subs && . .venv-subs/bin/activate
pip install "faster-whisper==1.2.1"
```

```python
# transcribe.py  usage: python transcribe.py audio.wav out.srt [lang|auto] [model]
import sys
from faster_whisper import WhisperModel

audio, out = sys.argv[1], sys.argv[2]
lang = None if len(sys.argv) < 4 or sys.argv[3] == "auto" else sys.argv[3]
model = WhisperModel(sys.argv[4] if len(sys.argv) > 4 else "small", device="auto", compute_type="int8")
segments, info = model.transcribe(audio, language=lang, vad_filter=True, word_timestamps=True)
print(f"language={info.language} p={info.language_probability:.2f}", file=sys.stderr)

def ts(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int((s % 1) * 1000):03}"

with open(out, "w", encoding="utf-8") as f:
    for i, seg in enumerate(segments, 1):
        f.write(f"{i}\n{ts(seg.start)} --> {ts(seg.end)}\n{seg.text.strip()}\n\n")
```

Keep the `word_timestamps` data (each `seg.words` has `.word .start .end`) when word-level captions are needed (section 5).

Model choice: `small` for drafts/CPU, `medium` or `large-v3` for accuracy, `large-v3-turbo` for speed with near-large quality. Uzbek, Russian, and other non-English languages benefit noticeably from `large-v3`. Set `language` explicitly when known - auto-detect can misfire on short clips.

### Option B - whisper.cpp (no Python, MIT)

Build from the official repository with CMake and download a model with its bundled `models/download-ggml-model.sh` (read the script first; it only fetches from Hugging Face).

```bash
whisper-cli -m models/ggml-small.bin -f audio.wav -l auto -osrt -ovtt -of subs
```

### Option C - WhisperX (BSD-2-Clause)

Adds forced alignment for very precise word timing and speaker diarization. Heavier (PyTorch). Diarization needs a Hugging Face token for gated pyannote models - ask the user; never hard-code tokens.

### Translation

Whisper's `task="translate"` translates **into English only**. For other target languages, translate the SRT text yourself segment-by-segment, keeping the timings unchanged.

## 3. Review and clean the SRT

Before burning in, always:
- Fix names, brand terms, and obvious mis-hearings (ask the user for a glossary).
- Keep lines ≤ 42 characters (≤ 32 for vertical video), max 2 lines per cue.
- Cue duration 1–7 s; reading speed ≤ 17 characters/second.
- No overlapping cues.

Show the user the SRT (or the first ~20 cues) and ask for corrections before rendering.

## 4. Deliver

```bash
# Soft subtitles (toggleable) - MP4
ffmpeg -i "$IN" -i subs.srt -map 0 -map 1 -c copy -c:s mov_text -metadata:s:s:0 language=eng out_soft.mp4
# Soft subtitles - MKV (keeps SRT/ASS as-is)
ffmpeg -i "$IN" -i subs.srt -map 0 -map 1 -c copy out.mkv

# Burned-in with styling (ASS colours are &HAABBGGRR)
ffmpeg -i "$IN" -vf "subtitles=subs.srt:force_style='FontName=DejaVu Sans,FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=40,Alignment=2'" \
  -c:v libx264 -crf 18 -preset fast -c:a copy out_burned.mp4

# Boxed captions (background box)
force_style='FontName=DejaVu Sans,FontSize=20,BorderStyle=3,BackColour=&H80000000,Outline=6,Shadow=0,MarginV=50'
```

Convert formats: `ffmpeg -i subs.srt subs.vtt` / `ffmpeg -i subs.srt subs.ass`.

Paths with special characters in the `subtitles=` filter need escaping; copy the subtitle file to a simple name (`subs.srt`) in the working directory to avoid issues.

## 5. Word-by-word "Reels" captions (ASS karaoke)

For TikTok/Reels/Shorts style: 1–3 words per cue, large bold centred text, current word highlighted.

Generate an `.ass` file from the word timestamps:

```
[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Reel,DejaVu Sans,86,&H0000E5FF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.20,0:00:02.00,Reel,,0,0,0,,{\kf25}THIS {\kf30}IS {\kf25}HUGE
```

- `\kf<centiseconds>` sweeps each word from SecondaryColour (upcoming, white here) to PrimaryColour (spoken, yellow here); compute it from each word's `end - start`, in centiseconds.
- Alignment `5` = middle-centre; use `2` with `MarginV=380` to sit above platform UI.
- Pop-in effect: prefix text with `{\fscx80\fscy80\t(0,80,\fscx100\fscy100)}`.
- Uppercase text and 2–3 words per line read best on mobile.

Burn: `ffmpeg -i "$IN" -vf "ass=captions.ass" -c:v libx264 -crf 18 -c:a copy reel_captioned.mp4`

## Open-source references (reviewed)

| Project | License | Notes |
|---|---|---|
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | MIT | CTranslate2 backend; up to 4× faster than reference Whisper; safe model format (no pickle). **Default choice.** |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT | C/C++, no Python; GGML models. |
| [openai/whisper](https://github.com/openai/whisper) | MIT | Reference implementation; PyTorch, slower. Loads `.pt` checkpoints via torch - use official weights only. |
| [WhisperX](https://github.com/m-bain/whisperX) | BSD-2-Clause | Precise word alignment + diarization. |
| [FFmpeg](https://github.com/FFmpeg/FFmpeg) + libass | LGPL/GPL, libass ISC | Rendering. |

Security: install into a virtualenv with pinned versions from PyPI; model weights only from the official Hugging Face orgs (`Systran`, `ggerganov`/`ggml-org`, `openai`); transcripts may contain private speech - keep them local and don't upload audio to third-party services without the user's consent.
