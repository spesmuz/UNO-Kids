---
name: cinematic-reels
description: Turn footage into cinematic vertical short-form video (Instagram Reels, TikTok, YouTube Shorts) - 9:16 reframing, hook-first structure, beat-synced cuts, speed ramps, film look, letterbox, text overlays, captions, music, and platform-ready export. Use when the user asks for a reel, short, TikTok, vertical video, cinematic edit, or social-media cut of their footage.
---

# Cinematic Reels

Builds on the other skills: `automatic-video-editing` (cuts/silence), `professional-color-grading` (look), `video-enhancement` (cleanup, loudness), `auto-subtitles` (captions). This skill covers the short-form structure, vertical reframing, and export.

## 0. Preflight + brief

```bash
command -v ffmpeg ffprobe || { echo "FFmpeg missing - ask before installing"; exit 1; }
for f in "$@"; do ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate,codec_type -of compact "$f"; done
```

Ask (or infer) before editing: platform, target length (7–15 s loop, 15–30 s standard, ≤ 90 s max), mood/look, music track (user must own rights), on-screen text, captions yes/no.

## 1. Structure

1. **Hook (0–2 s)** - strongest shot or moment first; text hook on screen.
2. **Build** - short shots (0.5–2 s), cut on the beat or on motion.
3. **Payoff** - best shot / reveal / punchline.
4. **Loop or CTA** - end on a frame that flows back into the start.

Pick shots with a contact sheet (scene detection) and view it with the Read tool:

```bash
ffmpeg -i "$IN" -vf "select='gt(scene,0.25)',scale=270:-1,tile=5x4" -frames:v 1 -fps_mode vfr contact.png
```

## 2. Reframe to 9:16 (1080×1920)

```bash
# Centre crop from 16:9
-vf "crop=ih*9/16:ih,scale=1080:1920:flags=lanczos,setsar=1"

# Off-centre subject: shift crop x (0 = left edge, iw-ow = right edge)
-vf "crop=ih*9/16:ih:(iw-ih*9/16)*0.30:0,scale=1080:1920,setsar=1"

# Slow pan across a wide shot (left→right over the clip's duration D)
-vf "crop=ih*9/16:ih:'(iw-ow)*t/D':0,scale=1080:1920,setsar=1"

# Keep the full frame: blurred background fill
-filter_complex "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:5,eq=brightness=-0.08[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1"
```

Face/subject tracking (optional): [MediaPipe](https://github.com/google-ai-edge/mediapipe) (Apache-2.0) face detection on sampled frames → smooth the x-centre (moving average) → per-segment crops. Ask before installing (`pip install mediapipe==<pinned>`).

## 3. Cinematic treatment

```bash
# Speed ramp: normal → 0.5× slow-mo → normal (split, retime, concat)
[0:v]trim=0:2,setpts=PTS-STARTPTS[a];
[0:v]trim=2:3,setpts=2*(PTS-STARTPTS)[b];          # 0.5× (use minterpolate for smoothness on 30fps sources)
[0:v]trim=3:5,setpts=PTS-STARTPTS[c];
[a][b][c]concat=n=3:v=1:a=0[v]
# Audio for retimed parts: atempo=0.5 (range 0.5–2.0; chain for more), or replace with music.

# Letterbox (2.39:1 bars inside 9:16 for a film feel, or on 16:9 masters)
-vf "drawbox=x=0:y=0:w=iw:h=ih*0.12:color=black:t=fill,drawbox=x=0:y=ih*0.88:w=iw:h=ih*0.12:color=black:t=fill"

# Film look: grade + grain + vignette (tune with the color-grading skill)
-vf "colorbalance=rs=-0.06:bs=0.08:rh=0.06:bh=-0.06,curves=master='0/0.03 0.25/0.21 0.75/0.80 1/0.97',noise=alls=7:allf=t,vignette=PI/5"

# Smooth zoom-in (Ken Burns) on a still or slow shot, 5 s at 30 fps
-vf "scale=2160:-2,zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1080x1920:fps=30"

# Flash / dip-to-white transition between shots
xfade=transition=fadewhite:duration=0.25:offset=<clip1_len-0.25>
```

## 4. Beat-synced cuts

Find beat/onset times in the music, then cut shots to land on them.

```bash
# Rough onset map from FFmpeg (loud transients)
ffmpeg -i music.mp3 -af "highpass=f=60,lowpass=f=200,silencedetect=noise=-25dB:d=0.05" -f null - 2>&1 | grep silence_end
```

For accurate beats, [librosa](https://github.com/librosa/librosa) (ISC) `librosa.beat.beat_track` - optional, ask before installing. Given BPM, cut every 1 or 2 beats (`60/BPM` s per beat).

## 5. Text overlays

```bash
# Hook title, fades in/out between 0.2 s and 2.5 s
-vf "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='WAIT FOR IT':fontsize=96:fontcolor=white:borderw=6:bordercolor=black:x=(w-tw)/2:y=h*0.22:alpha='if(lt(t,0.2),0,if(lt(t,0.5),(t-0.2)/0.3,if(lt(t,2.2),1,if(lt(t,2.5),(2.5-t)/0.3,0))))'"
```

Find a font with `fc-list`. Put text through a `textfile=` when it contains quotes or colons. For animated word-by-word captions use the `auto-subtitles` skill (ASS karaoke).

**Safe zones (1080×1920):** keep text and faces out of the top ~220 px and bottom ~380 px, and the right ~120 px (platform buttons/captions).

## 6. Music + audio

```bash
# Music bed under dialogue with ducking, fade in/out, loudness for social
-filter_complex "[1:a]atrim=0:$DUR,afade=t=in:d=0.5,afade=t=out:st=$((DUR-1)):d=1,volume=0.35[m];[m][0:a]sidechaincompress=threshold=0.03:ratio=8:release=400[mduck];[0:a][mduck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[a]"
# Music only: -map 1:a with afade + loudnorm, -shortest
```

## 7. Export (platform-ready)

```bash
ffmpeg -i edit.mp4 -c:v libx264 -profile:v high -preset slow -crf 18 -maxrate 12M -bufsize 24M \
  -pix_fmt yuv420p -r 30 -g 60 -c:a aac -b:a 192k -ar 48000 -movflags +faststart reel_final.mp4
```

| Platform | Resolution | FPS | Max length | Loudness |
|---|---|---|---|---|
| Instagram Reels | 1080×1920 | 30 (or 60) | 90 s typical (up to 3 min) | -14 LUFS |
| TikTok | 1080×1920 | 30/60 | up to 10 min | -14 LUFS |
| YouTube Shorts | 1080×1920 | 30/60 | 3 min | -14 LUFS |

Platform limits change - mention that the user should check current limits if near a boundary.

Deliverables: `reel_final.mp4`, a cover frame (`ffmpeg -ss <best_t> -i reel_final.mp4 -frames:v 1 cover.jpg`), and a short summary of shots, timings, and settings used.

## Open-source references (reviewed)

| Project | License | Notes |
|---|---|---|
| [FFmpeg](https://github.com/FFmpeg/FFmpeg) | LGPL-2.1+ / GPL-2+ | Required; everything above is built in. |
| [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) | BSD-3-Clause | Optional shot detection. |
| [MediaPipe](https://github.com/google-ai-edge/mediapipe) | Apache-2.0 | Optional face tracking for smart reframing. |
| [MoviePy](https://github.com/Zulko/moviepy) | MIT | Optional Python compositing if a script is easier than filtergraphs. |
| [librosa](https://github.com/librosa/librosa) | ISC | Optional beat detection. |

**Avoid** [ultralytics](https://github.com/ultralytics/ultralytics) for subject tracking here: AGPL-3.0 (copyleft obligations for distributed or networked use) and its PyPI package was compromised with a cryptominer in Dec 2024 (v8.3.41–8.3.42). MediaPipe covers face tracking under a permissive license.
