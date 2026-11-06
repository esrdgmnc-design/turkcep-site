// TürkçeP öğretmen paneli: içerik yazma, denetim, önizleme, onay ve yayın.
import { ALANLAR, bosGun, bosSoru, denetle, harfler, imza, siraUyarilari, temizle, yayinDosyasi } from './cekirdek.js';
import * as depo from './depo.js';

const K = document.getElementById('uygulama');
const d = { oturum: null, sinav: 'TYT', satirlar: [], secili: null, calisma: null, kirli: false, mesaj: '' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const alti = (s) => esc(s).replace(/\[\[(.+?)\]\]/g, '<u>$1</u>').replace(/\n/g, '<br>');
const kopya = (o) => JSON.parse(JSON.stringify(o));

// --- yol ile değer okuma/yazma: "ekSorular.0.yanlis.B.1" ---
function oku(o, yol) { return yol.split('.').reduce((x, k) => (x == null ? x : x[k]), o); }
function yaz(o, yol, v) {
  const p = yol.split('.');
  let x = o;
  p.slice(0, -1).forEach((k, i) => { if (x[k] == null) x[k] = /^\d+$/.test(p[i + 1]) ? [] : {}; x = x[k]; });
  x[p.at(-1)] = v;
}

// ---------------- Giriş ----------------
async function basla() {
  d.oturum = await depo.oturum();
  depo.oturumDinle((o) => { d.oturum = o; o ? yukle() : girisCiz(); });
  d.oturum ? yukle() : girisCiz();
}

function girisCiz(mesaj = '') {
  K.innerHTML = `<div id="giris" class="kutu">
    <img src="../logo-yatay.png" alt="TürkçeP" style="width:180px">
    <h2 style="margin-top:12px">Öğretmen paneli</h2>
    <p class="ipucu">E-posta adresini yaz; giriş bağlantısı gönderilir. Yalnızca yetkili e-postalar girebilir.</p>
    <label for="eposta">E-posta</label><input id="eposta" type="email" autocomplete="email" placeholder="ogretmen@ornek.com">
    <p id="gmesaj" class="ipucu" style="color:var(--kiremit)">${esc(mesaj)}</p>
    <button class="ana" id="gonder" style="width:100%">Giriş bağlantısı gönder</button></div>`;
  document.getElementById('gonder').onclick = async () => {
    const e = document.getElementById('eposta').value.trim();
    if (!e.includes('@')) return (document.getElementById('gmesaj').textContent = 'Geçerli bir e-posta yaz.');
    try { await depo.girisBaglantisiGonder(e); girisCiz(''); document.getElementById('gmesaj').style.color = 'var(--yesil)'; document.getElementById('gmesaj').textContent = 'Bağlantı gönderildi. E-postandaki bağlantıya bu tarayıcıda tıkla.'; }
    catch (err) { document.getElementById('gmesaj').textContent = 'Gönderilemedi: ' + (err.message ?? err); }
  };
}

// ---------------- Ana ekran ----------------
async function yukle() {
  try { d.satirlar = await depo.gunleriGetir(d.sinav); }
  catch (e) { d.satirlar = []; d.mesaj = 'İçerik okunamadı: ' + (e.message ?? e) + ' (Bu e-posta editör listesinde mi?)'; }
  if (!d.satirlar.find((r) => r.gun === d.secili)) d.secili = d.satirlar[0]?.gun ?? null;
  calismayiAc();
  ciz();
}

function calismayiAc() {
  const s = d.satirlar.find((r) => r.gun === d.secili);
  d.calisma = s ? { ...bosGun(d.sinav, s.gun), ...kopya(s.veri), gun: s.gun } : null;
  if (d.calisma) {
    d.calisma.sozcukler = [0, 1].map((i) => d.calisma.sozcukler?.[i] ?? ['', '']);
    d.calisma.ekSorular = (d.calisma.ekSorular ?? []).map((q) => ({ ...bosSoru(d.sinav), ...q }));
    d.calisma.not = s.not ?? '';
  }
  d.kirli = false;
}

function rozet(s) {
  const eksik = denetle(s.veri, d.sinav).length;
  if (s.onayli) return '<span class="rozet r-onay">onaylı</span>';
  if (s.onay_zamani === null && s._degisti) return '<span class="rozet r-degisti">onaydan sonra değişti</span>';
  return eksik ? `<span class="rozet r-eksik">${eksik} eksik</span>` : '<span class="rozet r-taslak">onaya hazır</span>';
}

function ciz() {
  const onayli = d.satirlar.filter((r) => r.onayli).length;
  const sira = siraUyarilari(d.satirlar);
  K.innerHTML = `
  <header>
    <img src="../logo-yatay.png" alt="TürkçeP"><b>Öğretmen paneli</b>
    <div class="sekme">${['TYT', 'LGS'].map((s) => `<button data-sinav="${s}" class="${s === d.sinav ? 'on' : ''}">${s}</button>`).join('')}</div>
    <span class="bosluk"></span>
    <span style="font-size:13px;color:#A8A49A">${esc(d.oturum?.eposta)}</span>
    <label class="ipucu" style="margin:0;color:#A8A49A;cursor:pointer"><input type="file" id="iceAktar" accept=".json" hidden><u>İçe aktar</u></label>
    <button class="ana" id="yayinla">Yayınla (${onayli} onaylı gün)</button>
    ${depo.YEREL ? '' : '<button id="cikis">Çıkış</button>'}
  </header>
  ${depo.YEREL ? '<div class="uyari">Yerel deneme modu: veriler yalnızca bu tarayıcıda tutulur ve "Yayınla" dosyayı indirir. Gerçek kullanım için ayar.js dosyasına Supabase bilgileri girilmeli.</div>' : ''}
  ${d.mesaj ? `<div class="uyari">${esc(d.mesaj)}</div>` : ''}
  <main>
    <aside class="kutu"><h2>${d.sinav} günleri</h2>
      <button id="yeniGun" style="width:100%;margin-bottom:8px">+ Yeni gün</button>
      ${sira.length ? `<p class="ipucu" style="color:var(--kiremit)">${sira.map(esc).join('<br>')}</p>` : ''}
      <div id="liste">${d.satirlar.map((s) => `<button class="oge ${s.gun === d.secili ? 'secili' : ''}" data-gun="${s.gun}"><b>Gün ${s.gun}</b> · ${esc(s.veri.alan || '—')}<br><span class="ipucu">${esc(s.veri.konu || 'konu yok')}</span><br>${rozet(s)}</button>`).join('') || '<p class="ipucu">Henüz gün yok. "Yeni gün" ile başla ya da "İçe aktar" ile mevcut içeriği yükle.</p>'}</div>
    </aside>
    <section class="kutu" id="form">${d.calisma ? formHtml() : '<p class="ipucu">Soldan bir gün seç.</p>'}</section>
    <aside id="onizleme"></aside>
  </main>`;
  baglaUst();
  if (d.calisma) { baglaForm(); guncelleDurum(); }
}

// ---------------- Form ----------------
function soruHtml(on, baslik, sil) {
  const s = on ? oku(d.calisma, on.slice(0, -1)) : d.calisma;
  const harf = harfler(d.sinav);
  return `<h3>${baslik}${sil ? ` <button class="tehlike" data-eksil="${sil}" style="float:right;min-height:30px;padding:2px 10px">Kaldır</button>` : ''}</h3>
  <label>Metin / paragraf (isteğe bağlı; altı çizili için [[sözcük]])</label><textarea data-yol="${on}metin">${esc(s.metin)}</textarea>
  <label>Soru kökü</label><textarea data-yol="${on}kok" style="min-height:44px">${esc(s.kok)}</textarea>
  ${harf.map((h, i) => `<div class="sik"><div class="harf"><input type="radio" name="dogru-${on || 'ana'}" data-yol="${on}dogru" value="${h}" ${s.dogru === h ? 'checked' : ''} aria-label="${h} doğru cevap" style="width:auto">${h}</div>
    <div><input data-yol="${on}siklar.${i}" value="${esc(s.siklar[i])}" placeholder="${h} şıkkı">
    ${s.dogru && s.dogru !== h ? `<div class="yanlisAcik"><input data-yol="${on}yanlis.${h}.0" value="${esc(s.yanlis?.[h]?.[0])}" placeholder="Neden yanlış? (öğrenciye gösterilir)"><input data-yol="${on}yanlis.${h}.1" value="${esc(s.yanlis?.[h]?.[1])}" placeholder="Hata etiketi" list="etiketler"></div>` : ''}</div></div>`).join('')}
  <p class="ipucu">Doğru şıkkı soldaki daireden seç; diğer şıklar için açıklama alanları açılır.</p>
  <label>Doğru cevabın gerekçesi</label><textarea data-yol="${on}gerekce" style="min-height:44px">${esc(s.gerekce)}</textarea>`;
}

function anlatimMetni() {
  const a = d.calisma.anlatim ?? {};
  return {
    maddeler: (a.maddeler ?? []).map((m) => [m.baslik, m.aciklama, m.ornek].filter((x) => x != null).join(' | ')).join('\n'),
    hatalar: (a.hatalar ?? []).map(([y, dg]) => `${y} → ${dg}`).join('\n'),
    mini: (a.mini ?? []).map(([c, v, x]) => `${c} | ${v ? 'D' : 'Y'} | ${x}`).join('\n'),
  };
}

function formHtml() {
  const g = d.calisma;
  const am = anlatimMetni();
  const etiketler = [...new Set(d.satirlar.flatMap((r) => [r.veri, ...(r.veri.ekSorular ?? [])].flatMap((q) => Object.values(q.yanlis ?? {}).map((v) => v?.[1]))).filter(Boolean))];
  return `<datalist id="etiketler">${etiketler.map((e) => `<option value="${esc(e)}">`).join('')}</datalist>
  <h2>Gün ${g.gun}</h2><div id="durum"></div>
  <div class="iki"><div><label>Alan</label><select data-yol="alan"><option value="">Seç</option>${ALANLAR.map((a) => `<option ${g.alan === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
  <div><label>Konu</label><input data-yol="konu" value="${esc(g.konu)}" placeholder='Bağlaç olan "de/da"'></div></div>
  <label>Sabah bildirimi (en fazla 140 karakter)</label><textarea data-yol="bildirim" style="min-height:44px">${esc(g.bildirim)}</textarea><div class="sayac" id="sayac"></div>
  <label>Kural</label><textarea data-yol="kural">${esc(g.kural)}</textarea>
  <div class="iki"><div><label>Örnek 1</label><input data-yol="ornekler.0" value="${esc(g.ornekler?.[0])}"></div><div><label>Örnek 2</label><input data-yol="ornekler.1" value="${esc(g.ornekler?.[1])}"></div></div>
  <div class="iki"><div><label>Sık yapılan hata</label><input data-yol="hata" value="${esc(g.hata)}" placeholder="Bende geldim → Ben de geldim"></div><div><label>İpucu</label><input data-yol="ipucu" value="${esc(g.ipucu)}"></div></div>
  <label>Kaynak</label><input data-yol="kaynak" value="${esc(g.kaynak)}" placeholder="TDK: https://tdk.gov.tr/icerik/yazim-kurallari/... ya da Öğretmen kontrolü">
  <h3>Günün sözcükleri (sabah hap bilgisinde gösterilir, en fazla 2)</h3>
  ${[0, 1].map((i) => `<div class="iki"><div><label>${i + 1}. sözcük</label><input data-yol="sozcukler.${i}.0" value="${esc(g.sozcukler?.[i]?.[0])}" placeholder="Muğlak"></div>
    <div><label>Anlamı</label><input data-yol="sozcukler.${i}.1" value="${esc(g.sozcukler?.[i]?.[1])}" placeholder="Anlaşılması güç"></div></div>`).join('')}
  ${soruHtml('', '1. soru (kavrama, akşam bildirimiyle gelir)')}
  ${(g.ekSorular ?? []).map((_, i) => soruHtml(`ekSorular.${i}.`, `${i + 2}. soru (${i === 0 ? 'pekiştirme' : 'ÖSYM tarzı'})`, String(i))).join('')}
  ${(g.ekSorular?.length ?? 0) < 2 ? '<button id="ekSoru" style="margin-top:12px">+ Ek soru ekle</button>' : ''}
  <h3>Genişletilmiş anlatım (isteğe bağlı; yanlış cevapta açılır)</h3>
  <label>Tek cümlede özet</label><textarea data-yol="anlatim.ozet" style="min-height:44px">${esc(g.anlatim?.ozet)}</textarea>
  <label>Maddeler (her satır: Başlık | Açıklama | Örnek)</label><textarea data-anlatim="maddeler">${esc(am.maddeler)}</textarea>
  <label>Nasıl ayırt edersin?</label><textarea data-yol="anlatim.ayirt" style="min-height:44px">${esc(g.anlatim?.ayirt)}</textarea>
  <label>Sık yapılan hatalar (her satır: yanlış → doğru)</label><textarea data-anlatim="hatalar">${esc(am.hatalar)}</textarea>
  <label>Mini kontrol (her satır: cümle | D ya da Y | açıklama)</label><textarea data-anlatim="mini">${esc(am.mini)}</textarea>
  <h3>Öğretmen notu (öğrenciye gösterilmez)</h3><textarea data-yol="not">${esc(g.not)}</textarea>
  <ul id="denetim"></ul>
  <div class="eylemler">
    <button id="kaydet">Kaydet</button>
    <button class="ana" id="onayla">Kaydet ve onayla</button>
    <button id="onayKaldir">Onayı kaldır</button>
    <span class="bosluk" style="flex:1"></span>
    <button class="tehlike" id="sil">Günü sil</button>
  </div>`;
}

function baglaUst() {
  K.querySelectorAll('[data-sinav]').forEach((b) => (b.onclick = () => { if (kirliyse()) return; d.sinav = b.dataset.sinav; d.secili = null; d.mesaj = ''; yukle(); }));
  K.querySelectorAll('[data-gun]').forEach((b) => (b.onclick = () => { if (kirliyse()) return; d.secili = Number(b.dataset.gun); calismayiAc(); ciz(); }));
  document.getElementById('yeniGun').onclick = async () => {
    if (kirliyse()) return;
    const gun = Math.max(0, ...d.satirlar.map((r) => r.gun)) + 1;
    const veri = temizle(bosGun(d.sinav, gun));
    const kayit = await depo.gunKaydet(d.sinav, { gun, veri, imza: await imza(veri), onayli: false });
    d.satirlar.push(kayit); d.secili = gun; calismayiAc(); ciz();
  };
  document.getElementById('yayinla').onclick = yayinEt;
  document.getElementById('iceAktar').onchange = iceAktar;
  const c = document.getElementById('cikis'); if (c) c.onclick = () => depo.cikis();
}

function kirliyse() { return d.kirli && !confirm('Kaydedilmemiş değişiklikler var. Yine de çıkılsın mı?'); }

function baglaForm() {
  const f = document.getElementById('form');
  f.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.yol) {
      if (t.type === 'radio') { yaz(d.calisma, t.dataset.yol, t.value); d.kirli = true; formuYenile(); return; }
      yaz(d.calisma, t.dataset.yol, t.value);
    } else if (t.dataset.anlatim) {
      const satirlar = t.value.split('\n').map((x) => x.trim()).filter(Boolean);
      d.calisma.anlatim ??= { ozet: '' };
      if (t.dataset.anlatim === 'maddeler') d.calisma.anlatim.maddeler = satirlar.map((x) => { const [baslik = '', aciklama = '', ornek] = x.split('|').map((y) => y.trim()); return ornek ? { baslik, aciklama, ornek } : { baslik, aciklama }; });
      if (t.dataset.anlatim === 'hatalar') d.calisma.anlatim.hatalar = satirlar.map((x) => x.split('→').map((y) => y.trim()));
      if (t.dataset.anlatim === 'mini') d.calisma.anlatim.mini = satirlar.map((x) => { const [c = '', v = '', a = ''] = x.split('|').map((y) => y.trim()); return [c, /^d/i.test(v), a]; });
    } else return;
    d.kirli = true;
    guncelleDurum();
  });
  f.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') { yaz(d.calisma, e.target.dataset.yol, e.target.value); d.kirli = true; guncelleDurum(); } });
  const ek = document.getElementById('ekSoru');
  if (ek) ek.onclick = () => { d.calisma.ekSorular.push(bosSoru(d.sinav)); d.kirli = true; formuYenile(); };
  f.querySelectorAll('[data-eksil]').forEach((b) => (b.onclick = () => { if (confirm('Bu ek soru kaldırılsın mı?')) { d.calisma.ekSorular.splice(Number(b.dataset.eksil), 1); d.kirli = true; formuYenile(); } }));
  document.getElementById('kaydet').onclick = () => kaydet(false);
  document.getElementById('onayla').onclick = () => kaydet(true);
  document.getElementById('onayKaldir').onclick = async () => { const s = mevcut(); if (s?.onayli) await kaydet(false, true); };
  document.getElementById('sil').onclick = async () => {
    if (!confirm(`Gün ${d.secili} silinsin mi? Bu geri alınamaz.`)) return;
    await depo.gunSil(d.sinav, d.secili);
    d.satirlar = d.satirlar.filter((r) => r.gun !== d.secili); d.secili = d.satirlar[0]?.gun ?? null; calismayiAc(); ciz();
  };
}

function formuYenile() { const y = window.scrollY; document.getElementById('form').innerHTML = formHtml(); baglaForm(); guncelleDurum(); window.scrollTo(0, y); }
const mevcut = () => d.satirlar.find((r) => r.gun === d.secili);

async function guncelleDurum() {
  const g = d.calisma;
  const hatalar = denetle(g, d.sinav);
  const s = mevcut();
  const yeniImza = await imza(temizle(g));
  const sayac = document.getElementById('sayac');
  if (sayac) { sayac.textContent = `${g.bildirim.length} / 140`; sayac.className = 'sayac' + (g.bildirim.length > 140 ? ' asim' : ''); }
  document.getElementById('denetim').innerHTML = hatalar.length ? `<li><b>Onay için eksikler:</b></li>${hatalar.map((h) => `<li>${esc(h)}</li>`).join('')}` : '<li style="color:var(--yesil)">Denetim tamam: onaya hazır.</li>';
  document.getElementById('onayla').disabled = hatalar.length > 0;
  document.getElementById('onayKaldir').disabled = !s?.onayli;
  const degisti = s?.onayli && yeniImza !== s.imza;
  document.getElementById('durum').innerHTML = s?.onayli
    ? (degisti ? '<span class="rozet r-degisti">Onaylıydı; değişiklik kaydedilirse onay düşer</span>' : `<span class="rozet r-onay">Onaylı${s.onay_zamani ? ' · ' + new Date(s.onay_zamani).toLocaleString('tr-TR') : ''}</span>`)
    : '<span class="rozet r-taslak">Onaylanmadı</span>';
  onizlemeCiz();
}

async function kaydet(onayla, onayKaldir = false) {
  const g = d.calisma;
  if (onayla && denetle(g, d.sinav).length) return;
  const veri = temizle(g);
  const yeniImza = await imza(veri);
  const s = mevcut();
  const onayli = onayKaldir ? false : onayla ? true : (s?.onayli && s.imza === yeniImza);
  try {
    const kayit = await depo.gunKaydet(d.sinav, { gun: g.gun, veri, imza: yeniImza, onayli, not: g.not });
    d.satirlar = d.satirlar.map((r) => (r.gun === g.gun ? kayit : r));
    d.mesaj = '';
    d.kirli = false;
    ciz();
  } catch (e) { alert('Kaydedilemedi: ' + (e.message ?? e)); }
}

// ---------------- Önizleme ----------------
function onizlemeCiz() {
  const g = d.calisma;
  const sorular = [g, ...(g.ekSorular ?? [])];
  const harf = harfler(d.sinav);
  document.getElementById('onizleme').innerHTML = `<div class="kutu" style="position:sticky;top:14px"><h2>Önizleme</h2>
  <div class="tel">
    <div class="c"><div class="m">TürkçeP · 07:30</div><b>Bugünün kuralı: ${esc(g.konu)}</b><div class="m" style="font-size:12.5px">${alti(g.bildirim)}</div></div>
    <div class="m">${esc(g.alan)} · ${d.sinav}</div>
    <div class="serif" style="font-size:17px"><span class="hl">${esc(g.konu || 'Konu')}</span></div>
    <div>${alti(g.kural)}</div>
    ${(g.ornekler ?? []).filter(Boolean).map((o, i) => `<div class="c"${i === 0 ? ' style="border-color:#F5C518"' : ''}><div class="m">${i ? 'Bir örnek daha' : 'Örnek'}</div>${alti(o)}</div>`).join('')}
    ${g.hata ? `<div class="c"><div class="m" style="color:#E08A6E">Sık yapılan hata</div>${alti(g.hata)}</div>` : ''}
    ${(g.sozcukler ?? []).some(([s]) => s) ? `<div class="c"><div class="m" style="color:#F5C518">Günün sözcükleri</div>${g.sozcukler.filter(([s]) => s).map(([s, a]) => `<div><b>${esc(s)}</b>: ${esc(a)}</div>`).join('')}</div>` : ''}
    ${sorular.map((q, n) => `<div class="m" style="margin-top:8px">Soru ${n + 1}/${sorular.length} · ${d.sinav} tarzı</div>
      ${q.metin ? `<div class="metin serif">${alti(q.metin)}</div>` : ''}
      <div class="serif"><b>${alti(q.kok)}</b></div>
      ${harf.map((h, i) => `<div class="o ${q.dogru === h ? 'k' : ''}">${h}) ${alti(q.siklar?.[i])}</div>`).join('')}`).join('')}
  </div><p class="ipucu">Yeşil kenarlı şık doğru cevaptır.</p></div>`;
}

// ---------------- Yayın ve içe aktarma ----------------
async function yayinEt() {
  if (kirliyse()) return;
  const dosya = await yayinDosyasi(d.sinav, d.satirlar);
  const atlanan = d.satirlar.length - dosya.gunler.length;
  if (!dosya.gunler.length) return alert('Yayınlanacak onaylı gün yok.');
  if (!confirm(`${d.sinav}: ${dosya.gunler.length} onaylı gün yayınlanacak.${atlanan ? ` ${atlanan} gün (onaysız ya da eksik) yayına girmeyecek.` : ''}\nÖğrenciler uygulamayı açtıklarında yeni içerik gelir. Devam edilsin mi?`)) return;
  try { await depo.yayinla(d.sinav, dosya); alert(depo.YEREL ? 'Yayın dosyası indirildi (yerel mod).' : `Yayınlandı: ${depo.yayinAdresi(d.sinav)}`); }
  catch (e) { alert('Yayınlanamadı: ' + (e.message ?? e)); }
}

async function iceAktar(e) {
  const dosya = e.target.files[0];
  if (!dosya) return;
  let veri;
  try { veri = JSON.parse(await dosya.text()); } catch { return alert('Dosya okunamadı (JSON değil).'); }
  const gunler = veri.sinavlar?.[d.sinav]?.gunler ?? veri.gunler ?? (Array.isArray(veri) ? veri : []);
  if (!gunler.length) return alert(`Dosyada ${d.sinav} günü bulunamadı.`);
  const cakisan = gunler.filter((g) => d.satirlar.some((r) => r.gun === g.gun)).length;
  if (!confirm(`${gunler.length} gün içe aktarılacak${cakisan ? `; ${cakisan} mevcut günün üzerine yazılacak` : ''}. İçe aktarılan günler onaysız gelir. Devam edilsin mi?`)) return;
  for (const g of gunler) {
    const { onayli: _o, ...temiz } = g;
    const t = temizle({ ...bosGun(d.sinav, g.gun), ...temiz, ekSorular: (temiz.ekSorular ?? []).map((q) => ({ ...bosSoru(d.sinav), ...q })) });
    await depo.gunKaydet(d.sinav, { gun: g.gun, veri: t, imza: await imza(t), onayli: false });
  }
  await yukle();
}

window.addEventListener('beforeunload', (e) => { if (d.kirli) { e.preventDefault(); e.returnValue = ''; } });
basla();
