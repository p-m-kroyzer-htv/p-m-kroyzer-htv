# Portmap: מנויומטר (Next.js 16, React 19, CSS רגיל)

מקור: `design/chat-5628/prototype.html`. כל ה-CSS שם הוא המקור, מועבר ל-`app/globals.css` (tokens) ול-CSS Modules או קבצי CSS לפי רכיב. ללא Tailwind.

## 1. Tokens (`:root`)
צבעים (oklch): `--bg .978 .004 95`, `--surface .995 .002 95`, `--sunk .962 .005 100`, `--ink .23 .02 215`, `--ink2 .43 .016 215`, `--ink3 .58 .012 215`, `--line .918 .006 110`, `--line2 .87 .008 110`, `--accent .37 .07 215` (petrol), `--accent-2 .52 .1 205`, `--accent-soft .968 .011 205`.
שימוש (טקסט + רקע): `--daily/--daily-bg` (152), `--some/--some-bg` (245), `--rare/--rare-bg` (72/88), `--none/--none-bg` (38/45, ember), `--unk/--unk-bg`.
מד הדליפה: `--m-none .52 .18 38`, `--m-rare .74 .13 58`, `--m-some .8 .045 205`, `--m-daily` = petrol, `--m-unk .86 .006 215` (פסים אפורים).
צורה: `--r:10px`, `--shadow`, `--font:'Heebo','Assistant',sans-serif`, `--mono:'IBM Plex Mono'`, `--tab-h:58px`.
Safe areas: `--sat/--sab/--sal/--sar` = `env(safe-area-inset-*, 0px)`.
מצב כהה: לא בהיקף. אם יתווסף: להפוך `--bg/--surface/--ink*` ולהשאיר את משפחות ה-hue.
Hue לסמל אות: `--h` inline לכל מנוי (שדה `hue` נגזר מהספק).
Theme: `#1e4a57`.

## 2. רכיבים (props)
- `AppShell({screen, children})`: top bar (sticky, padding-top sat), nav עליון (מעל 760px), `TabBar` (עד 760px). `body.sub-view` מחליף את ה-brand ב-`BackButton` + כותרת.
- `TabBar({current})`: 3 קישורים (מנויים, תיבות, יציאה), `aria-current`, padding-bottom sab.
- `LeakCard({leakM, leakY, leakSubs, totalM, subs, noPriceSubs, onReview})`: מספר ember ענק, שמות, כפתור סקירה, `LeakMeter`, `LeakLegend`, הערת מחיר לא ידוע.
- `LeakMeter({subs})`: שתי קבוצות flex (`.mgrp.lk` דליפה, `.mgrp.ok` השאר), גדלי הסגמנטים `flex: <monthlyIls> 1 0`, סוגר (`::before`) וכיתוב עליון. סגמנט הוא `<button>` לדף המנוי. תוויות שם: מעל 7% מהסכום, ובטלפון רק מעל 16%.
- `KpiCard({label,value,sub})` x3 (חודשי, שנתי, פעילים).
- `RenewalStrip({items})`: כפתור לכל חידוש ב-30 יום. גלילה אופקית עם snap בטלפון, גריד בדסקטופ.
- `SubList({items, filters, sort, onUse})`: טולבר (`StatusSeg`, 3 selects סינון, sort), `SubCardRow` (עד 1099px) ו-`SubTable` (מ-1100px). שתיהן מרנדרות מאותו מערך. `UsageChip({value,onChange})` הוא select מעוצב עם טקסט + עמודות.
- `SubDetail({sub})`: `UsageSegmented`, `PriceRiseAlert`, `FactsGrid`, `VendorButton`, `CancelToggle`, `Notes`, `Alternatives({state})`, `ChargeHistory`.
- `Alternatives({state:'idle'|'loading'|'results'|'error', items, checkedAt, onRun})`, `AlternativeCard({type,name,priceIls,priceOrig,saving,why,downside,url})`.
- `InboxCard({email,status,lastScan,mailsRead,subsFound})`, `ScanPanel({read,total,found,done})`, `GoogleButton`, `ConfirmDialog({email,onConfirm})` (bottom sheet בטלפון).
- `LoginForm`, `EmptyState`, `Money({value})`, `Orig({amount,currency})`, `Toast`.

## 3. Selectors לפי מסך
- דשבורד: `.leak .meter .mgrp.lk .mgrp.ok .mseg.s-{none,rare,some,daily,unk} .mleg .mnote .kpis .kpi .ren .rn .toolbar .seg .sel .rows .srow table.t .use .acct .tfoot .banner`.
- מנוי: `.dr .dr-h .dr-grid .useseg .facts .alert .vendor .altbox(.idle/.err) .alts .alt(.best) .atype.t-{free,cheap,comp,incl,cancel} .save .hist .hrow .stchip`.
- תיבות: `.ibx .ib(.bad) .ib-facts .scanp .prog .gbtn .ov .dlg`.
- כניסה: `.login .lcard .pw`. ריק: `.empty .state-tag .zero`.
- מספרים: `.num` (tabular-nums, dir ltr, isolate) עם `<bdi>`, `₪` בתוך `.cur` נפרד.

## 4. מצבים
- שימוש: unk, daily, some, rare, none (תוויות: לא סימן, כל יום, לפעמים, לעיתים רחוקות, לא משתמש). דליפה = none + rare.
- סטטוס: פעיל, בוטל, הוסתר (`.stchip`, `.c`, `.h`).
- חלופות: idle, loading (progress + שלד, 30 עד 60 שניות), results, error ("לא הצלחתי לבדוק חלופות כרגע, אפשר לנסות שוב").
- תיבה: מחוברת, צריך לחבר מחדש (חם, לא אדום; באנר בדשבורד).
- סריקה: `read/340`, `found`. ניתוק: דיאלוג אישור.
- מנוי בלי מחיר: `.nop` ו-`m = 0`, מוחרג מהמד ומהסיכומים, נספר ב-"X ללא מחיר ידוע".
- נתיבי מסך: `/`, `/subscriptions/[id]`, `/inboxes`, `/login`; ריק מוצג כשאין תיבות.

## 5. שדות נתונים
subscription: name, vendor, category, plan, lastAmount, currency, monthlyIls, yearlyIls, frequency, lastCharge, nextRenewal, users, inboxes[], manageUrl, notes, usage, status, cancelledAt, hue (נגזר). summary: activeCount, monthly, yearly, monthlyLeak, noPriceCount. alternative: type, priceIls, priceOrig, monthlySaving, why, downside, url, checkedAt. charge: date, amount, currency, ils, inbox, subject. inbox: email, status, lastScan, mailsRead, subsFound.

## 6. PWA
```json
{
  "name": "מנויומטר",
  "short_name": "מנויומטר",
  "lang": "he",
  "dir": "rtl",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1e4a57",
  "background_color": "#f8f7f3",
  "icons": [
    {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
    {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}
```
PNG מיוצאים מ-`icon.svg` ו-`icon-maskable.svg`. ב-`app/layout.tsx`: `viewport = {viewportFit:'cover', themeColor:'#1e4a57'}`, `appleWebApp: {capable:true, statusBarStyle:'black-translucent'}`, ו-`apple-touch-icon` 180 מ-icon.svg.

## 7. Safe areas
`viewport-fit=cover` חובה. top bar: `padding-top: env(safe-area-inset-top)`. tab bar: `padding-bottom: calc(6px + env(safe-area-inset-bottom))`, ובגוף `padding-bottom: calc(var(--tab-h) + env(safe-area-inset-bottom))`. צדדים: `max(14px, env(safe-area-inset-left/right))`. Toast ודיאלוג מעל ה-tab bar. כל הריווחים לוגיים (inline-start/end), בלי left/right.
