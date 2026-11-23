---
name: video-enhancement
description: Improve video and audio quality with FFmpeg - denoise, sharpen, stabilize shaky footage, deinterlace, deband, upscale, smooth frame rate, fix loudness and clean noisy audio. Use when the user asks to enhance, clean up, restore, stabilize, upscale, sharpen, denoise or "make this video look/sound better".
---

# Video Enhancement

FFmpeg built-in filters cover most enhancement work with no extra installs. AI upscalers are optional and need explicit user approval.

## 0. Preflight + diagnosis

```bash
command -v ffmpeg ffprobe || { echo "FFmpeg missing - ask before installing"; exit 1; }
ffmpeg -hide_banner -filters | grep -E ' (hqdn3d|nlmeans|unsharp|cas|vidstabdetect|vidstabtransform|deshake|bwdif|deband|minterpolate|afftdn|loudnorm|highpass) '
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,field_order,pix_fmt,bit_rate -of compact "$IN"
ffmpeg -y -ss 5 -i "$IN" -frames:v 1 frame.png   # look at it with the Read tool
```

Diagnose before fixing. Apply **only** what the footage needs, in this order:

1. Deinterlace (if `field_order` is `tt`/`bb`/`tb`/`bt`, or comb artifacts appear)
2. Stabilize
3. Denoise
4. Deband
5. Scale / upscale
6. Sharpen (always **after** denoise and scaling)
7. Frame-rate conversion
8. Audio

Preview 10 seconds first (`-ss 5 -t 10`), compare with `hstack`, then render the full file to a new name. Never overwrite the source.

## 1. Video recipes

```bash
# Deinterlace (best built-in)
-vf "bwdif=mode=send_frame"

# Stabilize - two passes, best quality (libvidstab)
ffmpeg -i "$IN" -vf vidstabdetect=shakiness=6:accuracy=15:result=transforms.trf -f null -
ffmpeg -i "$IN" -vf "vidstabtransform=input=transforms.trf:smoothing=20:zoom=0:optzoom=1,unsharp=5:5:0.6" \
  -c:v libx264 -crf 18 -preset slow -c:a copy stabilized.mp4
# Quick single-pass fallback if libvidstab is missing:
-vf "deshake"

# Denoise
-vf "hqdn3d=3:2:4:3"            # light, fast - phone/webcam footage
-vf "hqdn3d=6:4:8:6"            # medium
-vf "nlmeans=s=3.5:p=7:r=15"    # strongest, slow - low-light grain (preview first)

# Deband (gradients / skies after heavy compression)
-vf "deband=1thr=0.02:2thr=0.02:3thr=0.02:blur=1"

# Sharpen
-vf "cas=strength=0.5"          # contrast-adaptive, natural
-vf "unsharp=5:5:0.8:3:3:0.0"   # classic luma-only unsharp mask

# Upscale (classical) - lanczos, then mild sharpen
-vf "scale=iw*2:ih*2:flags=lanczos,cas=strength=0.4"
-vf "scale=-2:2160:flags=lanczos"           # to 4K height, keep aspect

# Frame-rate smoothing (slow; motion artifacts on fast action - preview!)
-vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
# Simple conversion without interpolation
-vf "fps=30"
```

Combined example for typical phone footage:

```bash
ffmpeg -i "$IN" -vf "hqdn3d=3:2:4:3,cas=strength=0.4,eq=contrast=1.03:saturation=1.05" \
  -af "highpass=f=80,afftdn=nf=-25,loudnorm=I=-14:TP=-1.5:LRA=11" \
  -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k enhanced.mp4
```

## 2. Audio recipes

```bash
# Measure loudness first
ffmpeg -i "$IN" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=summary -f null - 2>&1 | tail -12

# Two-pass loudnorm (accurate): feed measured_* values from pass 1 into pass 2
-af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=...:measured_TP=...:measured_LRA=...:measured_thresh=...:offset=...:linear=true"

-af "highpass=f=80,lowpass=f=14000"   # remove rumble / hiss band
-af "afftdn=nf=-25"                   # broadband noise reduction
-af "anlmdn=s=7"                      # stronger non-local-means audio denoise
-af "adeclick"                        # clicks / pops
-af "acompressor=threshold=-20dB:ratio=3:attack=5:release=100"  # even out speech
```

Loudness targets: social/YouTube/streaming **-14 LUFS**, podcasts **-16 LUFS**, broadcast EBU R128 **-23 LUFS**. True peak ≤ -1 dBTP.

## 3. Encoding

- `-c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -movflags +faststart` (delivery)
- `-c:v libx265 -crf 20 -tag:v hvc1` (smaller files, 10-bit capable)
- Keep source frame rate unless asked; keep audio with `-c:a copy` when audio isn't processed.

## 4. AI upscaling / interpolation (optional, ask first)

Only when classical scaling isn't enough **and** the user approves the download. These need a GPU to be practical.

| Project | License | Status / security notes |
|---|---|---|
| [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) | BSD-3-Clause | Reputable, but no commits since 2024. Prefer the official prebuilt `realesrgan-ncnn-vulkan` release from the project's GitHub Releases page; verify the checksum. The Python route pulls old `basicsr`/torch pins. Model weights are `.pth` (pickle) - load only official weights. |
| [Practical-RIFE](https://github.com/hzwer/Practical-RIFE) | MIT | Frame interpolation. Weights hosted externally - same pickle caution. |

Workflow: extract frames (`ffmpeg -i in.mp4 frames/%06d.png`), process, then reassemble with the original audio (`ffmpeg -framerate <fps> -i out/%06d.png -i in.mp4 -map 0:v -map 1:a? -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a copy out.mp4`). Check disk space first - frames are large.

## Open-source references (reviewed)

| Project | License | Notes |
|---|---|---|
| [FFmpeg](https://github.com/FFmpeg/FFmpeg) | LGPL-2.1+ / GPL-2+ | All filters above are built in. |
| [vid.stab](https://github.com/georgmartius/vid.stab) | GPL-2.0 | Powers `vidstabdetect`/`vidstabtransform`; already compiled into most distro FFmpeg builds. |

Never pipe install scripts from the internet into a shell. Use distro packages or pinned PyPI releases.
