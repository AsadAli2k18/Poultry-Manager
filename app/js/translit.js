/* Roman Urdu -> Urdu script.
 * Online: Google Input Tools transliteration (more accurate).
 * Offline: built-in word list + phonetic rules. Always available.
 */
(function () {
  'use strict';
  const WORDS = {
    muhammad: 'محمد', mohammad: 'محمد', muhammed: 'محمد', m: 'محمد', bilal: 'بلال', aslam: 'اسلم', toor: 'طور', tur: 'طور', saeed: 'سعید', saeid: 'سعید',
    diwan: 'دیوان', dewan: 'دیوان', butt: 'بٹ', but: 'بٹ', ali: 'علی', ahmed: 'احمد', ahmad: 'احمد', khan: 'خان', haji: 'حاجی', hajji: 'حاجی',
    rafiq: 'رفیق', shahid: 'شاہد', nadeem: 'ندیم', zafar: 'ظفر', imran: 'عمران', tauseef: 'توصیف', tousif: 'توصیف', usman: 'عثمان', abdul: 'عبدال',
    rehman: 'رحمان', rahman: 'رحمان', noor: 'نور', nur: 'نور', madina: 'مدینہ', madinah: 'مدینہ', al: 'ال', bhai: 'بھائی', sons: 'سنز', brothers: 'برادرز',
    hassan: 'حسن', hasan: 'حسن', hussain: 'حسین', husain: 'حسین', umar: 'عمر', omar: 'عمر', faisal: 'فیصل', kamran: 'کامران', irfan: 'عرفان', asif: 'آصف',
    tariq: 'طارق', javed: 'جاوید', iqbal: 'اقبال', sheikh: 'شیخ', shaikh: 'شیخ', chaudhry: 'چوہدری', chaudhary: 'چوہدری', raja: 'راجہ', mirza: 'مرزا',
    qureshi: 'قریشی', malik: 'ملک', akram: 'اکرم', akbar: 'اکبر', asghar: 'اصغر', nawaz: 'نواز', shah: 'شاہ', abbas: 'عباس', zahid: 'زاہد', khalid: 'خالد',
    sajid: 'ساجد', waqas: 'وقاص', waseem: 'وسیم', naveed: 'نوید', adeel: 'عدیل', arshad: 'ارشد', rashid: 'راشد', majid: 'ماجد', amjad: 'امجد', yasir: 'یاسر',
    burhan: 'برہان', kashi: 'کاشی', zubair: 'زبیر', farooq: 'فاروق', ghulam: 'غلام', rasool: 'رسول', rasul: 'رسول', allah: 'اللہ', ullah: 'اللہ', din: 'دین',
    nasir: 'ناصر', naseer: 'نصیر', mehmood: 'محمود', mahmood: 'محمود', pervaiz: 'پرویز', pervez: 'پرویز', zeeshan: 'ذیشان', saleem: 'سلیم', salim: 'سلیم', kaleem: 'کلیم',
    akhtar: 'اختر', anwar: 'انور', aziz: 'عزیز', azhar: 'اظہر', bashir: 'بشیر', fayyaz: 'فیاض', ghafoor: 'غفور', habib: 'حبیب', hamid: 'حامد', haroon: 'ہارون', idrees: 'ادریس',
    ilyas: 'الیاس', ishaq: 'اسحاق', ismail: 'اسماعیل', jamil: 'جمیل', jameel: 'جمیل', junaid: 'جنید', latif: 'لطیف', mansoor: 'منصور', mazhar: 'مظہر', mushtaq: 'مشتاق', nadir: 'نادر',
    naeem: 'نعیم', nasar: 'نثار', nisar: 'نثار', qasim: 'قاسم', rizwan: 'رضوان', sabir: 'صابر', sadiq: 'صادق', safdar: 'صفدر', shafiq: 'شفیق', shakeel: 'شکیل', sohail: 'سہیل',
    sultan: 'سلطان', tahir: 'طاہر', talha: 'طلحہ', tanveer: 'تنویر', yaqoob: 'یعقوب', yousaf: 'یوسف', yusuf: 'یوسف', zaheer: 'ظہیر', zulfiqar: 'ذوالفقار', ejaz: 'اعجاز', ijaz: 'اعجاز',
    abid: 'عابد', adil: 'عادل', afzal: 'افضل', aamir: 'عامر', amir: 'عامر', arif: 'عارف', ashraf: 'اشرف', atif: 'عاطف', awais: 'اویس', babar: 'بابر', danish: 'دانش', fahad: 'فہد',
    farhan: 'فرحان', hafiz: 'حافظ', hamza: 'حمزہ', kashif: 'کاشف', mubashir: 'مبشر', mudassar: 'مدثر', noman: 'نعمان', obaid: 'عبید', raheel: 'راحیل', saad: 'سعد', shoaib: 'شعیب',
    sufyan: 'سفیان', umair: 'عمیر', usama: 'اسامہ', waleed: 'ولید', zain: 'زین', bibi: 'بی بی', begum: 'بیگم', meat: 'میٹ', centre2: 'سینٹر', kabab: 'کباب', biryani: 'بریانی',
    poultry: 'پولٹری', farm: 'فارم', farms: 'فارمز', chicken: 'چکن', broiler: 'برائلر', hotel: 'ہوٹل', restaurant: 'ریسٹورنٹ', shop: 'شاپ', store: 'سٹور',
    traders: 'ٹریڈرز', trader: 'ٹریڈر', catering: 'کیٹرنگ', karahi: 'کڑاہی', tikka: 'تکہ', fish: 'فش', mandi: 'منڈی', murgh: 'مرغ', gosht: 'گوشت',
    jhelum: 'جہلم', dina: 'دینہ', road: 'روڈ', mohalla: 'محلہ', bazar: 'بازار', bazaar: 'بازار', chowk: 'چوک', town: 'ٹاؤن', colony: 'کالونی', street: 'سٹریٹ',
    hall: 'ہال', marriage: 'میرج', centre: 'سینٹر', center: 'سینٹر', point: 'پوائنٹ', corner: 'کارنر', and: 'اینڈ', company: 'کمپنی', co: 'کمپنی',
  };
  const DIGRAPHS = [
    ['kh', 'خ'], ['gh', 'غ'], ['sh', 'ش'], ['ch', 'چ'], ['th', 'تھ'], ['ph', 'پھ'], ['bh', 'بھ'], ['dh', 'دھ'], ['jh', 'جھ'], ['kh', 'خ'], ['zh', 'ژ'],
    ['rh', 'ڑھ'], ['tt', 'ٹ'], ['dd', 'ڈ'], ['rr', 'ڑ'],
  ];
  const CONS = { b: 'ب', c: 'ک', d: 'د', f: 'ف', g: 'گ', h: 'ہ', j: 'ج', k: 'ک', l: 'ل', m: 'م', n: 'ن', p: 'پ', q: 'ق', r: 'ر', s: 'س', t: 'ت', v: 'و', w: 'و', x: 'کس', y: 'ی', z: 'ز' };

  function word(w) {
    const lw = w.toLowerCase();
    if (WORDS[lw]) return WORDS[lw];
    if (!/^[a-z]+$/.test(lw)) return w;
    let out = '', i = 0;
    const n = lw.length;
    while (i < n) {
      const two = lw.slice(i, i + 2), ch = lw[i], start = i === 0, endAt = (k) => i + k >= n;
      if (two === 'aa') { out += start ? 'آ' : 'ا'; i += 2; continue; }
      if (two === 'ee' || two === 'ii') { out += start ? 'ای' : 'ی'; i += 2; continue; }
      if (two === 'oo' || two === 'ou' || two === 'uu') { out += start ? 'او' : 'و'; i += 2; continue; }
      if (two === 'ai' || two === 'ay' || two === 'ei') { out += start ? 'اے' : endAt(2) ? 'ے' : 'ی'; i += 2; continue; }
      const dg = DIGRAPHS.find((d) => d[0] === two);
      if (dg) { out += dg[1]; i += 2; continue; }
      if ('aeiou'.includes(ch)) {
        if (start) out += ch === 'o' ? 'او' : ch === 'e' ? 'ای' : 'ا';
        else if (endAt(1)) out += ch === 'a' ? 'ا' : ch === 'e' ? 'ے' : ch === 'i' ? 'ی' : 'و';
        else if (ch === 'o' || ch === 'u') out += 'و';
        else if (ch === 'e') out += 'ی';
        // short a / i inside a word are not written
        i += 1; continue;
      }
      if (ch === lw[i + 1] && CONS[ch]) { out += CONS[ch]; i += 2; continue; } // doubled consonant
      out += CONS[ch] || ch; i += 1;
    }
    return out;
  }
  function offline(text) {
    return String(text || '').split(/(\s+|[-,./()&]+)/).map((p) => (/^[A-Za-z]+$/.test(p) ? word(p) : p)).join('').replace(/-/g, ' ');
  }
  async function online(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 3500);
    try {
      const parts = await Promise.all(words.map(async (w) => {
        if (!/^[A-Za-z]+$/.test(w)) return w;
        const res = await fetch('https://inputtools.google.com/request?itc=ur-t-i0-und&num=1&text=' + encodeURIComponent(w), { signal: ctl.signal });
        const j = await res.json();
        return (j && j[0] === 'SUCCESS' && j[1] && j[1][0] && j[1][0][1] && j[1][0][1][0]) || word(w);
      }));
      return parts.join(' ');
    } finally { clearTimeout(timer); }
  }
  /** Returns {text, mode:'online'|'offline'} */
  async function toUrdu(text) {
    if (!text || !text.trim()) return { text: '', mode: 'offline' };
    if (navigator.onLine) {
      try { return { text: await online(text), mode: 'online' }; } catch (e) { /* fall through */ }
    }
    return { text: offline(text), mode: 'offline' };
  }
  window.Translit = { toUrdu, offline };
})();
