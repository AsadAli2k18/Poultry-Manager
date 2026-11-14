/* Language layer: English keys, Urdu dictionary in i18n-ur.js.
 * t('Text') returns Urdu when the app language is Urdu, else the English text.
 */
(function () {
  'use strict';
  const subs = new Set();
  let lang = 'ur';
  try { lang = localStorage.getItem('pm.lang') || 'ur'; } catch (e) { /* ignore */ }
  const UR = () => window.I18N_UR || {};
  const tr = (s, l) => (l === 'ur' ? (UR()[s] != null ? UR()[s] : s) : s);
  const t = (s) => tr(s, lang);
  const tf = (s, vars) => { let r = t(s); Object.keys(vars || {}).forEach((k) => (r = r.split('{' + k + '}').join(vars[k]))); return r; };
  function apply() { const d = document.documentElement; d.lang = lang; d.dir = lang === 'ur' ? 'rtl' : 'ltr'; }
  function setLang(l) { lang = l; try { localStorage.setItem('pm.lang', l); } catch (e) { /* ignore */ } apply(); subs.forEach((f) => f()); }
  const nm = (o) => (!o ? '' : lang === 'ur' ? o.name_ur || o.name_en || '' : o.name_en || o.name_ur || '');
  const nfmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const qfmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
  const money = (n) => { n = Math.round(+n || 0); return (n < 0 ? '-' : '') + nfmt.format(Math.abs(n)); };
  const qty = (n) => qfmt.format(+n || 0);
  const dmy = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return +d + '/' + +m + '/' + y.slice(2); };
  const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTHS_UR = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
  const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAYS_UR = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  const monthName = (i) => (lang === 'ur' ? MONTHS_UR : MONTHS_EN)[i];
  const dayName = (i) => (lang === 'ur' ? DAYS_UR : DAYS_EN)[i];
  apply();
  window.I18N = { t, tf, tr, setLang, get lang() { return lang; }, subscribe: (f) => (subs.add(f), () => subs.delete(f)), nm, money, qty, dmy, monthName, dayName };
})();
