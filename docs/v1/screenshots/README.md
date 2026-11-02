# Screens at 360px (English and Urdu)

Taken by `thriftos-frontend/e2e/screenshots.spec.ts` on a 360×760 phone against seeded test data.
Refresh with `SCREENSHOTS=1 npx playwright test -c e2e/playwright.config.ts screenshots` (from `thriftos-frontend/`).
Each screen has an `-en.png` and a `-ur.png`.

| Journey | Screen | Files |
|---|---|---|
| Sign in | Munshi: phone + PIN keypad (owner: email + password) | `j0-login-munshi` |
| 1 Container arrives | Maal aya: three choices | `j1-receive` |
| 1 | Container form: supplier tiles, weights, USD + rate, Duty chip | `j1-container-form` |
| 1 | Saved: landed cost per kg, ready to sort | `j1-container-saved` |
| 2 Sorting | Lots waiting | `j2-sort-lots` |
| 2 | Tile tapped → big keypad | `j2-sort-keypad` |
| 2 | Lines added, sorted / left, Undo toast | `j2-sort-lines` |
| 2 | Close with a remainder: confirm | `j2-sort-close-confirm` |
| 2 | Yield and cost per kg | `j2-sort-yield` |
| 3 Bales | Make bale: kind tiles with kg, weight | `j3-make-bale` |
| 3 | Bale saved → Print label | `j3-bale-saved` |
| 3 | Label: 50 × 30 mm sticker with QR, code, kind, kg, origin (A4 3×8 sheet on the same screen) | `j3-label-sticker` |
| 3 | Stock list | `j3-stock` |
| 4 Sell | Customer, item, price, part paid | `j4-sale-form` |
| 4 | Saved → Share bill on WhatsApp | `j4-sale-saved` |
| 5 Ready stock | What, counted in, how many, total cost | `j5-ready-stock` |
| 6 Khata | Customers by udhaar | `j6-khata` |
| 6 | Payment received: amount, JazzCash | `j6-payment` |
| 7 Owner home | Profit per container, udhaar owed, stock ready, today's sales | `j7-owner-home` |
| 7 | Behind profit per container: containers, by supplier, by country | `j7-containers` |
| 7 | Behind today's sales | `j7-today` |
