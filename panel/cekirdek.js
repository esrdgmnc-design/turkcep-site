// Panelin içerik kuralları: denetim, içerik imzası ve yayın dosyası.
// Kurallar icerik/uret.mjs ve icerik/csv.mjs ile aynıdır (imza da aynı alanlarla, aynı sırayla hesaplanır).

export const SIK_SAYISI = { TYT: 5, LGS: 4 };
export const HARFLER = ['A', 'B', 'C', 'D', 'E'];
export const ALANLAR = ['Yazım', 'Noktalama', 'Sözcükte anlam', 'Cümlede anlam', 'Paragraf', 'Dil bilgisi', 'Anlatım bozukluğu'];

export const harfler = (sinav) => HARFLER.slice(0, SIK_SAYISI[sinav]);

export function bosSoru(sinav) {
  return { metin: '', kok: '', siklar: harfler(sinav).map(() => ''), dogru: '', gerekce: '', yanlis: {} };
}

export function bosGun(sinav, gun) {
  return { gun, alan: '', konu: '', bildirim: '', kural: '', ornekler: ['', ''], hata: '', ipucu: '', kaynak: '', sozcukler: [['', ''], ['', '']], ...bosSoru(sinav), ekSorular: [] };
}

const dolu = (v) => typeof v === 'string' && v.trim().length > 0;

function soruDenetle(s, sinav, ad) {
  const h = [];
  const harf = harfler(sinav);
  if (!dolu(s.kok)) h.push(`${ad}: soru kökü boş`);
  if (s.siklar.length !== harf.length) h.push(`${ad}: ${harf.length} şık olmalı`);
  s.siklar.forEach((t, i) => { if (!dolu(t)) h.push(`${ad}: ${harf[i]} şıkkı boş`); });
  if (!harf.includes(s.dogru)) h.push(`${ad}: doğru cevap seçilmedi`);
  if (!dolu(s.gerekce)) h.push(`${ad}: doğru cevabın gerekçesi boş`);
  harf.filter((x) => x !== s.dogru).forEach((x) => {
    if (!dolu(s.yanlis?.[x]?.[0])) h.push(`${ad}: ${x} şıkkının neden yanlış olduğu yazılmadı`);
    if (!dolu(s.yanlis?.[x]?.[1])) h.push(`${ad}: ${x} şıkkının hata etiketi yok`);
  });
  return h;
}

// Onaylanabilmesi için bir günde eksik olan her şeyi listeler (boş liste = onaya hazır).
export function denetle(g, sinav) {
  const h = [];
  if (!dolu(g.alan)) h.push('Alan seçilmedi');
  if (!dolu(g.konu)) h.push('Konu boş');
  if (!dolu(g.bildirim)) h.push('Sabah bildirimi boş');
  else if (g.bildirim.length > 140) h.push(`Sabah bildirimi ${g.bildirim.length} karakter (en fazla 140)`);
  if (!dolu(g.kural)) h.push('Kural boş');
  if (!dolu(g.ornekler?.[0])) h.push('En az bir örnek gerekli');
  if (!dolu(g.kaynak)) h.push('Kaynak boş (TDK sayfası ya da "öğretmen kontrolü")');
  (g.sozcukler ?? []).forEach(([s, a], i) => {
    if ((dolu(s) || dolu(a)) && !(dolu(s) && dolu(a))) h.push(`${i + 1}. sözcük: sözcük ve anlamı birlikte yazılmalı`);
  });
  if ((g.sozcukler?.length ?? 0) > 2) h.push('Günde en fazla 2 sözcük');
  h.push(...soruDenetle(g, sinav, 'Ana soru'));
  (g.ekSorular ?? []).forEach((s, i) => h.push(...soruDenetle(s, sinav, `${i + 2}. soru`)));
  if ((g.ekSorular?.length ?? 0) > 2) h.push('En fazla 2 ek soru olabilir');
  return h;
}

// Boş alanları atarak uygulamaya gidecek biçime getirir (imza ve yayın bu biçimden üretilir).
export function temizle(g) {
  const soru = (s) => {
    const t = { kok: s.kok.trim(), siklar: s.siklar.map((x) => x.trim()), dogru: s.dogru, gerekce: s.gerekce.trim(), yanlis: {} };
    if (dolu(s.metin)) t.metin = s.metin.trim();
    for (const [h, v] of Object.entries(s.yanlis ?? {})) if (h !== s.dogru && v) t.yanlis[h] = [String(v[0] ?? '').trim(), String(v[1] ?? '').trim()];
    return t;
  };
  const c = {
    gun: g.gun, alan: g.alan.trim(), konu: g.konu.trim(), bildirim: g.bildirim.trim(), kural: g.kural.trim(),
    ornekler: (g.ornekler ?? []).map((x) => x.trim()).filter(Boolean), hata: (g.hata ?? '').trim(), ipucu: (g.ipucu ?? '').trim(),
    ...soru(g), kaynak: (g.kaynak ?? '').trim(),
  };
  if (g.anlatim && dolu(g.anlatim.ozet)) c.anlatim = g.anlatim;
  const ek = (g.ekSorular ?? []).map(soru);
  if (ek.length) c.ekSorular = ek;
  const soz = (g.sozcukler ?? []).map(([s, a]) => [String(s ?? '').trim(), String(a ?? '').trim()]).filter(([s, a]) => s || a);
  if (soz.length) c.sozcukler = soz;
  return c;
}

// icerik/csv.mjs içindeki imza ile birebir aynı alanlar ve sıra.
export async function imza(g) {
  const { gun, alan, konu, bildirim, kural, ornekler, hata, ipucu, metin, kok, siklar, dogru, gerekce, yanlis, anlatim, ekSorular, sozcukler } = g;
  const metinJson = JSON.stringify({ gun, alan, konu, bildirim, kural, ornekler, hata, ipucu, metin, kok, siklar, dogru, gerekce, yanlis, anlatim, ekSorular, sozcukler });
  const ozet = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(metinJson));
  return [...new Uint8Array(ozet)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

// Aynı alan art arda gelmesin (konular bilerek karışık sıradadır).
export function siraUyarilari(satirlar) {
  const u = [];
  const sirali = [...satirlar].sort((a, b) => a.gun - b.gun);
  sirali.forEach((s, i) => {
    if (i && s.veri.alan && s.veri.alan === sirali[i - 1].veri.alan && s.gun === sirali[i - 1].gun + 1) u.push(`Gün ${s.gun}: ${s.veri.alan} art arda geliyor`);
  });
  return u;
}

// Yalnızca onaylı ve onaydan sonra değişmemiş günlerden yayın dosyası üretir.
export async function yayinDosyasi(sinav, satirlar) {
  const gunler = [];
  for (const s of [...satirlar].sort((a, b) => a.gun - b.gun)) {
    if (!s.onayli) continue;
    const t = temizle({ ...s.veri, gun: s.gun });
    if ((await imza(t)) !== s.imza) continue;
    if (denetle(s.veri, sinav).length) continue;
    gunler.push({ ...t, onayli: true });
  }
  return { sinav, surum: new Date().toISOString(), gunler };
}
