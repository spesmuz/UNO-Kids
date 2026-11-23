---
name: automatic-video-editing
description: Automatically edit raw footage - remove silences and dead air, detect scene cuts, split into clips, trim, join clips, add transitions and background music with ducking. Use when the user asks to auto-edit, cut silences/pauses, jump-cut a talking-head video, split by scenes, assemble a rough cut, or join clips together.
---

# Automatic Video Editing

FFmpeg alone handles silence detection, scene detection, cutting and joining. `auto-editor` and `PySceneDetect` are optional, better tools if the user approves installing them.

## 0. Preflight

```bash
command -v ffmpeg ffprobe || { echo "FFmpeg missing - ask before installing"; exit 1; }
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,r_frame_rate,width,height -of compact "$IN"
command -v auto-editor >/dev/null && auto-editor --version
python3 -c "import scenedetect; print('scenedetect', scenedetect.__version__)" 2>/dev/null
```

Always produce an **edit decision list (EDL)** - a list of `start,end` keep-ranges - show it to the user (count of cuts, time removed), then render. Write output to a new file.

## 1. Silence removal (FFmpeg only)

Step 1 - detect silence:

```bash
ffmpeg -hide_banner -i "$IN" -af "silencedetect=noise=-30dB:d=0.5" -f null - 2>&1 \
  | grep -E 'silence_(start|end)' > silences.txt
```

- `noise`: -30dB for clean mic audio, -35 to -40dB for noisy rooms. Measure with `volumedetect` if unsure.
- `d`: minimum pause to cut (0.4–0.8 s for jump cuts, 1.5 s+ for gentle tightening).

Step 2 - turn silences into keep-ranges with ~0.15 s padding on each side (so words aren't clipped), drop ranges shorter than 0.2 s. Do this with a small Python script that parses `silences.txt` and the total duration.

Step 3 - render with `select`/`aselect` (frame-accurate, one pass):

```bash
# KEEP is like: between(t,0,4.2)+between(t,5.1,9.8)+...
ffmpeg -i "$IN" \
  -vf "select='$KEEP',setpts=N/FRAME_RATE/TB" \
  -af "aselect='$KEEP',asetpts=N/SR/TB" \
  -c:v libx264 -crf 18 -preset fast -c:a aac -b:a 192k cut.mp4
```

For very long expressions (hundreds of cuts) write the filtergraph to a file and use `-filter_complex_script graph.txt` (FFmpeg 6) / `-/filter_complex graph.txt` (FFmpeg 7+).

## 2. Silence removal with auto-editor (optional, recommended for long videos)

[auto-editor](https://github.com/WyattBlue/auto-editor) - Unlicense (public domain), actively maintained.

```bash
pip install "auto-editor==29.3.1"   # only with user approval; pinned version
auto-editor "$IN" --margin 0.2sec --edit audio:threshold=0.04 -o cut.mp4
auto-editor "$IN" --export premiere   # or: final-cut-pro, resolve - editable timeline instead of render
auto-editor "$IN" --edit audio:threshold=0.04 --export timeline:api=1 > edl.json  # inspect cuts first
```

Exporting a timeline (Premiere / Resolve / FCP XML) lets the user refine cuts in their NLE - offer this.

## 3. Scene detection

FFmpeg:

```bash
ffmpeg -hide_banner -i "$IN" -vf "scdet=threshold=10,metadata=print:file=scenes.txt" -an -f null -
grep -oE 'lavfi.scd.time=[0-9.]+' scenes.txt | cut -d= -f2
# alternative: select='gt(scene,0.3)',showinfo  -> parse pts_time
```

[PySceneDetect](https://github.com/Breakthrough/PySceneDetect) - BSD-3-Clause, more accurate (optional):

```bash
pip install "scenedetect[opencv]==0.7.3"   # only with user approval
scenedetect -i "$IN" detect-adaptive list-scenes save-images split-video
```

Contact sheet to review scenes visually:

```bash
ffmpeg -i "$IN" -vf "select='gt(scene,0.3)',scale=320:-1,tile=4x4" -frames:v 1 -fps_mode vfr contact.png
```

If no PNG is written, no frame crossed the threshold: lower it (0.15) or sample evenly instead with `fps=1/5` in place of `select`.

## 4. Cutting and splitting

```bash
# Fast, lossless (cuts land on keyframes - may be off by up to a GOP)
ffmpeg -ss 00:01:00 -to 00:02:30 -i "$IN" -c copy -avoid_negative_ts make_zero part.mp4
# Frame-accurate (re-encode)
ffmpeg -ss 00:01:00 -to 00:02:30 -i "$IN" -c:v libx264 -crf 18 -c:a aac part.mp4
# Split at scene timestamps
ffmpeg -i "$IN" -f segment -segment_times 12.4,33.0,61.7 -reset_timestamps 1 -c:v libx264 -crf 18 -c:a aac scene_%03d.mp4
```

## 5. Joining

```bash
# Same codec/resolution/fps: lossless concat demuxer
printf "file '%s'\n" clip1.mp4 clip2.mp4 clip3.mp4 > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4

# Mixed sources: normalise then concat filter
ffmpeg -i a.mp4 -i b.mov -filter_complex \
 "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1,setsar=1,fps=30[v0];
  [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1,setsar=1,fps=30[v1];
  [0:a]aresample=48000[a0];[1:a]aresample=48000[a1];
  [v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 18 -c:a aac joined.mp4

# Crossfade transition (offset = duration of first clip - transition length)
ffmpeg -i a.mp4 -i b.mp4 -filter_complex \
 "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=9.5[v];[0:a][1:a]acrossfade=d=0.5[a]" \
 -map "[v]" -map "[a]" -c:v libx264 -crf 18 -c:a aac xfaded.mp4
```

`xfade` transitions include `fade, dissolve, wipeleft, slideleft, circleopen, smoothleft, zoomin`. Both inputs need identical resolution, fps, and pixel format.

## 6. Background music with ducking

```bash
ffmpeg -i video.mp4 -stream_loop -1 -i music.mp3 -filter_complex \
 "[1:a]volume=0.25[m];[m][0:a]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];
  [0:a][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5[a]" \
 -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest with_music.mp4
```

Ask the user for music they have rights to use.

## 7. Report back

Tell the user: original length → edited length, number of cuts, the thresholds used, and offer to tune (e.g. "pauses feel too tight → raise `d` or margin").

## Open-source references (reviewed)

| Project | License | Notes |
|---|---|---|
| [FFmpeg](https://github.com/FFmpeg/FFmpeg) | LGPL-2.1+ / GPL-2+ | Required. |
| [auto-editor](https://github.com/WyattBlue/auto-editor) | Unlicense | Active, ~6k stars. Pin version; install from PyPI only. |
| [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) | BSD-3-Clause | Active, ~5.6k stars. Pin version. |
