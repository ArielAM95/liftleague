# LiftLeague

מעקב אימוני כוח שבו ההתקדמות שלך היא תחרות — "סטרבה לחדר הכושר". ניקוד הוגן
(DOTS + z-score מול הצפוי לרמתך), ליגות מפולחות לפי רמה, וגדרות תורת-משחקים נגד
sandbagging ו-ego-lifting.

## אפליקציית ווב חיה
נפרסת דרך GitHub Pages מתיקיית השורש. פותחים את הכתובת הציבורית של ה-repo ב-Pages.
עובדת עצמאית (נתונים מקומיים בדפדפן + יריבי ליגה מדומים) — בלי צורך בשרת.

## התקנה באנדרואיד
`LiftLeague.apk` — בנייה אמיתית (Gradle + AGP), עטיפת WebView. גרסת debug להתקנה ידנית.

## מבנה
- `index.html`, `exercises.json` — אפליקציית הווב (single-file, ללא build).
- `core/` — ספריית הניקוד המשותפת (TypeScript): e1RM, DOTS, מודל צפי, שני מנועי
  ניקוד מאחורי façade, סכימת Supabase/Postgres, טסטים.
- `android/` — פרויקט ה-APK (WebView wrapper). בנייה: `ANDROID_HOME=... gradle assembleDebug`.

## לפני production
חתימת release, אייקון אפליקציה, backend אמיתי (Supabase) עם auth וליגות משותפות,
וגדרות קומפליינס (waiver, consent, moderation).

מקור מאגר התרגילים: free-exercise-db (yuhonas), נחלת הכלל (The Unlicense).
