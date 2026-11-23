# 🦄 UNO Kids — bolalar uchun xavfsiz video ilova

Ota-ona YouTube havolalarini qo'shadi, bola esa **faqat shu videolarni** ko'radi.
YouTube tavsiyalari, qidiruv, izohlar va boshqa keraksiz narsalar ko'rsatilmaydi.

## Imkoniyatlar

- **Tanish interfeys** — mashhur video ilovalar uslubida: bosh sahifa lentasi, kategoriya chiplari, Shorts (vertikal aylantirish),
  kanallar, "Siz" sahifasi (tarix, yoqqan videolar), qidiruv, pastki menyu, mini-pleyer, avto-ijro, ikki marta teginib 10 soniya o'tkazish,
  to'liq ekran va qorong'i rejim. Logotip va nom — o'zimizniki (UNO Kids).

- **Faqat tasdiqlangan videolar.** Video, Shorts, pleylist yoki kanal havolasini qo'ysangiz, ilova faqat o'sha videolarni ko'rsatadi.
- **YouTube'ga chiqib ketib bo'lmaydi.** Pleyer ustida himoya qatlami bor: YouTube logotipi, sarlavha va tavsiyalarni bosib bo'lmaydi.
  Pauza qilinganda yoki video tugaganda YouTube'ning "boshqa videolar" oynasi yopiladi, uning o'rniga **sizning ro'yxatingizdagi** keyingi videolar chiqadi.
- **Ota-ona PIN kodi.** Video qo'shish/o'chirish va sozlamalar faqat 4 xonali PIN bilan ochiladi.
- **Bo'limlar.** Multfilmlar, Ta'limiy, Qo'shiqlar va o'zingizning bo'limlaringiz.
- **Kunlik vaqt cheklovi.** Masalan, kuniga 60 daqiqa. Vaqt tugasa ilova qulflanadi.
- **Avtomatik filtr** (pleylist/kanal qo'shganda): Shorts videolar, taqiqlangan so'zli sarlavhalar, yosh cheklovli va joylashtirib bo'lmaydigan videolar o'tkazib yuboriladi.
- **Zaxira nusxa.** Ro'yxatni JSON faylga eksport qilib, boshqa qurilmaga import qilish mumkin.
- **Telefonga o'rnatiladi** (PWA): brauzer menyusidan "Bosh ekranga qo'shish".
- Server kerak emas: hamma ma'lumot qurilmaning o'zida saqlanadi.

## Ishga tushirish

Bu oddiy statik sayt, uni istalgan hostingda joylash mumkin (GitHub Pages, Netlify, Vercel...).
YouTube pleyeri `http(s)://` manzilida ishlaydi, faylni to'g'ridan-to'g'ri (`file://`) ochmang.

```bash
python3 -m http.server 8000
# brauzerda: http://localhost:8000
```

### GitHub Pages orqali
Repo → Settings → Pages → Branch: `main` / root → Save. Bir necha daqiqadan keyin ilova
`https://<foydalanuvchi>.github.io/UNO-Kids/` manzilida ochiladi.

## Foydalanish

1. Birinchi ochilganda ota-ona PIN kodini yarating.
2. "Video qo'shish" maydoniga YouTube havolalarini qo'ying (har biri yangi qatorda) va bo'limni tanlang.
3. "✅ Bola rejimi" tugmasini bosing. Endi bola faqat shu videolarni ko'radi.
4. Sozlamalarga qaytish uchun "🔒 Ota-ona" tugmasini bosib, PIN kodni kiriting.

### Pleylist va kanallar
Alohida videolar uchun hech narsa kerak emas. Butun pleylist yoki kanalni bir martada qo'shish uchun
bepul **YouTube Data API v3** kaliti kerak:
1. https://console.cloud.google.com ga kiring, loyiha yarating.
2. "YouTube Data API v3" ni yoqing (Enable).
3. Credentials → Create credentials → API key.
4. Kalitni ilovaning ota-ona bo'limidagi "YouTube API kaliti" maydoniga qo'ying.

## Fayllar

| Fayl | Vazifasi |
|---|---|
| `index.html` | Ekranlar: sozlash, bola rejimi, pleyer, ota-ona bo'limi |
| `app.js` | Butun mantiq: havolani tahlil qilish, YouTube API, pleyer, PIN, vaqt cheklovi |
| `styles.css` | Bolalarga mos dizayn |
| `sw.js`, `manifest.json`, `icon.svg` | Telefonga o'rnatish (PWA) |
| `tests/parse.test.js` | Havola tahlili testlari: `node tests/parse.test.js` |

## Eslatma
Videolar YouTube'ning maxfiylikni kuchaytirilgan rejimida (`youtube-nocookie.com`) o'ynaydi.
YouTube pleyerining ba'zi qismlari (masalan, video boshida qisqa sarlavha) ko'rinishi mumkin, lekin ularni bosib bo'lmaydi.
To'liq qulflash uchun telefonda **ekranni qadash** (Android: Screen pinning, iPhone: Guided Access) funksiyasidan foydalaning.
