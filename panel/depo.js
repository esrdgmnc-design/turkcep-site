// Panelin veri katmanı: Supabase (gerçek) ya da tarayıcı (yerel deneme). İkisi de aynı işlevleri sunar.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './ayar.js';

export const YEREL = !SUPABASE_URL || !SUPABASE_ANON_KEY;
let sb = null;

async function istemci() {
  if (!sb) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sb;
}

// --- Giriş ---
export async function oturum() {
  if (YEREL) return { eposta: 'yerel deneme' };
  const { data } = await (await istemci()).auth.getSession();
  return data.session ? { eposta: data.session.user.email } : null;
}

export async function girisBaglantisiGonder(eposta) {
  const { error } = await (await istemci()).auth.signInWithOtp({
    email: eposta,
    // İlk girişte hesap kendiliğinden açılır; ama içerik yalnızca editör listesindeki e-postalara görünür (RLS).
    options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function cikis() {
  if (!YEREL) await (await istemci()).auth.signOut();
}

export async function oturumDinle(f) {
  if (YEREL) return;
  (await istemci()).auth.onAuthStateChange((_o, s) => f(s ? { eposta: s.user.email } : null));
}

// --- Günler ---
const yerelAnahtar = (sinav) => `turkcep-panel-${sinav}`;
const yerelOku = (sinav) => { try { return JSON.parse(localStorage.getItem(yerelAnahtar(sinav)) ?? '[]'); } catch { return []; } };
const yerelYaz = (sinav, v) => localStorage.setItem(yerelAnahtar(sinav), JSON.stringify(v));

export async function gunleriGetir(sinav) {
  if (YEREL) return yerelOku(sinav);
  const { data, error } = await (await istemci()).from('gunler').select('*').eq('sinav', sinav).order('gun');
  if (error) throw error;
  return data.map((r) => ({ ...r, not: r.not_ }));
}

// Metni değişen günün onayı burada (ve sunucuda tetikleyiciyle) düşer.
export async function gunKaydet(sinav, satir) {
  const kayit = { sinav, gun: satir.gun, veri: satir.veri, imza: satir.imza, onayli: satir.onayli, not_: satir.not ?? null };
  if (YEREL) {
    const hepsi = yerelOku(sinav);
    const eski = hepsi.find((r) => r.gun === satir.gun);
    if (eski && eski.imza !== kayit.imza && eski.onayli && kayit.onayli) kayit.onayli = false;
    const yeni = { ...kayit, not: kayit.not_, guncelleme: new Date().toISOString(), onay_zamani: kayit.onayli ? (eski?.onay_zamani ?? new Date().toISOString()) : null };
    yerelYaz(sinav, [...hepsi.filter((r) => r.gun !== satir.gun), yeni].sort((a, b) => a.gun - b.gun));
    return yeni;
  }
  const { data, error } = await (await istemci()).from('gunler').upsert(kayit).select().single();
  if (error) throw error;
  return { ...data, not: data.not_ };
}

export async function gunSil(sinav, gun) {
  if (YEREL) { yerelYaz(sinav, yerelOku(sinav).filter((r) => r.gun !== gun)); return; }
  const { error } = await (await istemci()).from('gunler').delete().eq('sinav', sinav).eq('gun', gun);
  if (error) throw error;
}

// --- Yayın ---
export const yayinAdresi = (sinav) => (YEREL ? null : `${SUPABASE_URL}/storage/v1/object/public/icerik/${sinav.toLowerCase()}.json`);

export async function yayinla(sinav, dosya) {
  const metin = JSON.stringify(dosya);
  if (YEREL) {
    // Yerel modda yayın dosyası indirilir (bulut yok).
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([metin], { type: 'application/json' })), download: `${sinav.toLowerCase()}.json` });
    a.click();
    return;
  }
  const s = await istemci();
  const { error } = await s.storage.from('icerik').upload(`${sinav.toLowerCase()}.json`, new Blob([metin], { type: 'application/json' }), { upsert: true, cacheControl: '60', contentType: 'application/json' });
  if (error) throw error;
  await s.from('yayinlar').insert({ sinav, gun_sayisi: dosya.gunler.length, surum: dosya.surum });
}
