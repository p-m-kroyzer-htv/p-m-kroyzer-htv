# מנויומטר

כלי אישי שסורק כמה תיבות Gmail, מוצא חיובים של מנויים, ומראה כמה כל מנוי עולה, כמה משתמשים בו, ומה החלופות הזולות יותר.
אפליקציית רשת שאפשר להתקין על מסך הבית (PWA).

## איך זה עובד

- **חיבור תיבות:** כל תיבה מתחברת דרך מסך ההרשאה של Google (OAuth), בהרשאת קריאה בלבד (`gmail.readonly`). אפשר לחבר כמה תיבות.
  ההרשאה נשמרת מוצפנת (AES-256-GCM), וניתוק תיבה מבטל אותה אצל Google.
- **סריקה:** מחפשת קבלות, חשבוניות והודעות חידוש מ-12 החודשים האחרונים (`SCAN_MONTHS`), וכל מייל נקרא על ידי Claude שמחלץ שירות, סכום, מטבע ותדירות.
  סכומים במטבע זר מומרים לשקלים לפי השער היציג של בנק ישראל.
- **חלופות:** לפי בקשה, למנוי אחד, Claude מחפש ברשת מחירים עדכניים ומציע מסלול זול יותר, מתחרה, חינם, או משהו שכבר משולם אצלך.
- **כניסה:** משתמש אחד, בסיסמה (`ADMIN_PASSWORD`).

## משתני סביבה

| משתנה | מה זה |
|---|---|
| `APP_URL` | הכתובת הציבורית של האפליקציה, למשל `https://subs.example.com` (בלי `/` בסוף) |
| `APP_SECRET` | מחרוזת אקראית ארוכה, להצפנה ולחתימת העוגייה. אסור להחליף אחרי שחוברו תיבות |
| `ADMIN_PASSWORD` | סיסמת הכניסה |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | לקוח OAuth מ-Google Cloud (למטה) |
| `ANTHROPIC_API_KEY` | מפתח ל-Claude |
| `DATA_DIR` | תיקיית מסד הנתונים (ברירת מחדל `./data`) |
| `SCAN_MONTHS` | כמה חודשים אחורה לסרוק (ברירת מחדל 12) |

## הקמת לקוח OAuth ב-Google Cloud

1. ב-[Google Cloud Console](https://console.cloud.google.com/) יוצרים פרויקט ומפעילים את **Gmail API**.
2. **OAuth consent screen:** סוג External, ומוסיפים את ה-scope `https://www.googleapis.com/auth/gmail.readonly`.
3. תחת **Test users** מוסיפים כל כתובת Gmail שתחובר.
4. **Credentials > Create credentials > OAuth client ID**, סוג Web application, ו-Authorized redirect URI:
   `<APP_URL>/api/auth/google/callback`.

שימו לב: כל עוד האפליקציה במצב Testing אצל Google, ההרשאה פגה אחרי 7 ימים, והתיבה תסומן "צריך לחבר מחדש".
כדי שזה לא יקרה צריך להעביר את האפליקציה ל-In production; לשימוש אישי זה מציג אזהרה "האפליקציה לא אומתה" במסך ההרשאה, ואפשר להמשיך דרכה.

## הרצה

```bash
npm install
npm run build
npm start          # פורט 3000, או PORT=...
```

לפיתוח: `npm run dev`. בדיקת טיפוסים: `npm run typecheck`.

השרת צריך דיסק קבוע ל-`DATA_DIR` (SQLite), ולכן הוא רץ כתהליך Node רגיל ולא על פלטפורמה ללא שרת.

## מבנה

- `src/lib`: מסד נתונים, Google, סריקה, חילוץ עם Claude, שערים, חלופות.
- `src/app/api`: הנתיבים שהמסכים קוראים להם.
- `src/components`, `src/app`: המסכים, לפי העיצוב ב-`design/chat-5628`.
