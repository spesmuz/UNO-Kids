# 🏠 Makler.uz — ko'chmas mulk e'lonlari

O'zbekiston bo'ylab kvartira, hovli, ofis va yer uchastkalarini sotish va ijaraga berish e'lonlari sayti.

> **Holat:** statik prototip (1-bosqich). Ma'lumotlar namunaviy, e'lonlar brauzerda saqlanadi.

## Imkoniyatlar

- **Qidiruv:** Sotuv / Ijara, shahar, mulk turi, kalit so'z.
- **Filtr:** xonalar soni, narx va maydon oralig'i; saralash (yangi, arzon, qimmat, maydon).
- **E'lon sahifasi:** rasmlar galereyasi, tavsif, qulayliklar, ma'lumotlar jadvali, m² narxi, o'xshash e'lonlar.
- **Makler bilan aloqa:** raqamni ko'rsatish (bosib qo'ng'iroq), Telegram, ulashish.
- **Saralangan** e'lonlar (♡).
- **E'lon joylash** formasi: mulk turiga qarab maydonlar o'zgaradi, rasm yuklash, tekshiruv.
- Telefon uchun moslashgan, qorong'i rejim.
- Havolalar filtr bilan ulashiladi: `#/?deal=rent&city=Toshkent&rooms=2`

## Ishga tushirish

```bash
python3 -m http.server 8000
# brauzerda: http://localhost:8000
```

## Tuzilma

| Fayl | Vazifasi |
|---|---|
| `index.html` | Sahifa skeleti, yuqori panel, footer |
| `styles.css` | Dizayn (ranglar `:root` da) |
| `data.js` | Namunaviy e'lonlar, shaharlar, maklerlar |
| `app.js` | Router, qidiruv/filtr, e'lon sahifasi, forma |

## Keyingi bosqichlar

1. Backend va ma'lumotlar bazasi (e'lonlar, foydalanuvchilar, rasmlar).
2. Telefon raqami orqali ro'yxatdan o'tish (SMS kod), makler kabineti.
3. Xarita (Yandex/Google) va xaritadan qidirish.
4. Moderatsiya, TOP/VIP pullik xizmatlar (Payme, Click).
5. Rus tili, Telegram bot orqali yangi e'lonlar haqida xabar.

## Vaqtinchalik joylashuv

Loyiha hozircha `UNO-Kids` reposi ichidagi `makler-uz/` papkasida. Alohida repo ochilganda shu papka
o'z tarixi bilan ko'chiriladi:

```bash
git subtree split --prefix=makler-uz -b makler-uz-only
git push https://github.com/<foydalanuvchi>/makler-uz.git makler-uz-only:main
```
