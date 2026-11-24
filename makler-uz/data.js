// Namunaviy ma'lumotlar (prototip). Keyinchalik backend API bilan almashtiriladi.
window.MAKLER_DATA = (function () {
  const cities = {
    "Toshkent": ["Yunusobod", "Chilonzor", "Mirzo Ulug'bek", "Yakkasaroy", "Shayxontohur", "Mirobod", "Sergeli", "Yashnobod", "Olmazor", "Uchtepa"],
    "Samarqand": ["Markaz", "Sattepo", "Kattaqo'rg'on yo'li", "Registon atrofi"],
    "Buxoro": ["Markaz", "Kogon yo'li", "Eski shahar"],
    "Andijon": ["Markaz", "Bobur ko'chasi", "Asaka yo'li"],
    "Namangan": ["Markaz", "Davlatobod", "Chorsu"],
    "Farg'ona": ["Markaz", "Marg'ilon yo'li", "Al-Farg'oniy"],
    "Navoiy": ["Markaz", "Zarafshon yo'li"],
    "Qarshi": ["Markaz", "Nasaf"],
  };

  const types = {
    flat: "Kvartira",
    house: "Hovli / uy",
    office: "Ofis / tijorat",
    land: "Yer uchastka",
  };

  const agents = [
    { id: "a1", name: "Dilshod Karimov", phone: "+998 90 123 45 67", tg: "dilshod_makler", agency: "Uy-Joy Servis", deals: 142 },
    { id: "a2", name: "Malika Rahimova", phone: "+998 93 765 43 21", tg: "malika_realty", agency: "Capital Realty", deals: 98 },
    { id: "a3", name: "Jasur Toshmatov", phone: "+998 97 555 11 22", tg: "jasur_uy", agency: "Xususiy makler", deals: 37 },
    { id: "a4", name: "Nodira Usmonova", phone: "+998 91 222 33 44", tg: "nodira_home", agency: "Samarqand Estate", deals: 64 },
    { id: "a5", name: "Bekzod Aliyev", phone: "+998 99 888 77 66", tg: "bekzod_estate", agency: "Mulk Plus", deals: 211 },
  ];

  const amenities = ["Konditsioner", "Mebel", "Maishiy texnika", "Internet", "Lift", "Avtoturargoh", "Balkon", "Qo'riqlash", "Yangi ta'mir", "Gaz", "Markaziy isitish", "Hovli bor"];

  // Takrorlanuvchi tasodifiy sonlar (har safar bir xil e'lonlar chiqishi uchun)
  let seed = 20261124;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  const cityList = Object.keys(cities);
  const weightedCities = ["Toshkent", "Toshkent", "Toshkent", "Toshkent", ...cityList];
  const listings = [];

  for (let i = 1; i <= 36; i++) {
    const type = pick(["flat", "flat", "flat", "flat", "house", "house", "office", "land"]);
    const deal = type === "land" ? "sale" : rnd() < 0.62 ? "sale" : "rent";
    const city = pick(weightedCities);
    const district = pick(cities[city]);
    const capital = city === "Toshkent" ? 1.6 : 1;

    let rooms = 0, area, floor = null, floors = null, price, land = null;
    if (type === "flat") {
      rooms = int(1, 5);
      area = rooms * int(18, 26) + int(10, 25);
      floors = pick([4, 5, 9, 9, 12, 16]);
      floor = int(1, floors);
      price = deal === "sale" ? Math.round(area * int(650, 1100) * capital / 500) * 500 : Math.round((rooms * int(90, 160) + 100) * capital / 10) * 10;
    } else if (type === "house") {
      rooms = int(3, 8);
      area = rooms * int(22, 35) + int(20, 60);
      floors = int(1, 3);
      land = int(3, 12);
      price = deal === "sale" ? Math.round((area * int(400, 800) + land * 6000) * capital / 1000) * 1000 : Math.round((rooms * int(110, 200)) * capital / 10) * 10;
    } else if (type === "office") {
      area = int(30, 400);
      floors = pick([1, 2, 5, 9]);
      floor = int(1, floors);
      price = deal === "sale" ? Math.round(area * int(900, 1600) * capital / 1000) * 1000 : Math.round(area * int(8, 18) * capital / 10) * 10;
    } else {
      land = int(4, 60);
      area = land * 100;
      price = Math.round(land * int(2500, 9000) * capital / 1000) * 1000;
    }

    const title =
      type === "flat" ? `${rooms} xonali kvartira, ${district}` :
      type === "house" ? `${rooms} xonali hovli, ${land} sotix, ${district}` :
      type === "office" ? `Tijorat binosi ${area} m², ${district}` :
      `Yer uchastka ${land} sotix, ${district}`;

    const am = amenities.filter(() => rnd() < 0.4);
    const daysAgo = int(0, 28);

    listings.push({
      id: String(1000 + i),
      deal, type, city, district, title,
      price, currency: "USD",
      rooms, area, floor, floors, land,
      amenities: type === "land" ? ["Gaz", "Elektr", "Suv"].filter(() => rnd() < 0.7) : am,
      description: describe(type, deal, district, city, rooms, area),
      agentId: pick(agents).id,
      createdAt: Date.now() - daysAgo * 86400000 - int(0, 86400000),
      views: int(12, 2400),
      hue: int(0, 359),
      photos: int(3, 6),
      top: rnd() < 0.15,
    });
  }

  function describe(type, deal, district, city, rooms, area) {
    const d = deal === "sale" ? "sotiladi" : "ijaraga beriladi";
    const base = {
      flat: `${city}, ${district} tumanida ${rooms} xonali kvartira ${d}. Umumiy maydon ${area} m². Uy atrofida maktab, bog'cha, supermarket va jamoat transporti bekati bor.`,
      house: `${city}, ${district} hududida shinam hovli ${d}. Hovlida mevali daraxtlar, so'ri va mashina uchun joy bor. Tinch mahalla, qo'shnilar yaxshi.`,
      office: `${city}, ${district} — gavjum ko'chada tijorat maqsadlari uchun bino ${d}. Ofis, do'kon yoki xizmat ko'rsatish markazi uchun mos.`,
      land: `${city}, ${district} hududida yer uchastka ${d}. Hujjatlari tayyor, kommunikatsiyalarga yaqin. Uy qurish yoki biznes uchun mos.`,
    }[type];
    return base + (deal === "rent" ? " Uzoq muddatga, oilaga yoki tashkilotga beriladi." : " Hujjatlari to'liq, savdolashish mumkin.");
  }

  return { cities, types, agents, amenities, listings };
})();
