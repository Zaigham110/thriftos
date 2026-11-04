# Releasing ThriftOS and putting demo data on the server

Two jobs you run yourself. Nothing here touches your laptop's dev database.

---

## 1. Release a new version (e.g. `v1.4.0`)

A release is just a tag. Pushing the tag starts the one GitHub workflow (`.github/workflows/release.yml`):
tests → server and web images → GitHub release → live check. The server watches GitHub every 2 minutes and
deploys the newest release by itself (backup first, then the new images, health check, automatic roll-back).

**1. Optional: run the same checks on your laptop first** (from a checkout of `v2-go-live`, about 10 minutes):

```bash
git switch v2-go-live && git pull
```

```bash
bash scripts/check-before-release.sh
```

**2. Tag the latest `v2-go-live` and push the tag** (works from any checkout; it tags what is on GitHub):

```bash
git fetch origin
```

```bash
git tag -a v1.4.0 origin/v2-go-live -m "ThriftOS v1.4.0"
```

```bash
git push origin v1.4.0
```

**3. Watch it** on GitHub → Actions → "Release", or in the terminal:

```bash
gh run watch --exit-status $(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')
```

All steps green (the last one, "live", waits until the server is on the new version) means it is live.

**4. Check it yourself**

- https://dyit6jcdpteuk.cloudfront.net/thriftos/api/health → `"status":"ok"`
- Sign in as super admin → Overview shows "Release v1.4.0" (from v1.4.0 on).

**If something is wrong:** on GitHub → Releases, mark the previous release as "Latest". Within 2 minutes the
server goes back to it. (Database changes are only ever additions, so going back is safe; the backup taken
before each deploy is in `/opt/thriftos/backups/` on the server.)

A tag with a dash (e.g. `v1.4.0-rc1`) makes a pre-release: it is built and tested but the server ignores it.

---

## 2. Put demo data on the server

This adds two demo businesses next to your real ones — **"Al-Madina Traders (Demo)"** (containers, sorting,
bales, 60 sales, khata) and **"Lahore Bale House (Demo)"** (a trader with ready stock). Each business only sees
its own data, so real businesses are not affected. Dates are the last three months up to today.

Needs **v1.4.0 or later** running on the server (the command and the data checks ship in that image).

**1. Open a shell on the server:** AWS console → EC2 → instance `i-0d706fa3c91337c3f` → **Connect** →
**EC2 Instance Connect** → Connect. Then:

```bash
sudo -i
```

```bash
cd /opt/thriftos
```

**2. Take a backup first** (takes a few seconds):

```bash
set -a; . ./.env.prod; set +a; docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > backups/pre-demo-$(date +%Y%m%d-%H%M%S).dump && ls -lh backups | tail -n 3
```

**3. Choose the demo password and PIN** (typed, not shown, not saved in the shell history). The password must
be at least 10 characters and the PIN 4 digits — the public defaults (`Demo@1234`, `1234`) are refused:

```bash
read -rsp "Demo password: " DEMO_PASSWORD; echo; read -rp "Munshi PIN (4 digits): " DEMO_PIN; export DEMO_PASSWORD DEMO_PIN
```

**4. Add the demo** (runs in a one-off container next to the live one, about 1–3 minutes):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm --no-deps --entrypoint node -e DEMO_PASSWORD -e DEMO_PIN server dist/demo/server-demo.js add
```

It ends with "Demo added in … s" and the logins:

| Who | Sign in with |
| --- | --- |
| Owner, Al-Madina Traders (Demo) | `owner@almadina.demo` + your demo password |
| Munshi, Al-Madina (phone screens) | phone `03007860786` + your PIN |
| Owner, Lahore Bale House (Demo) | `owner@lahorebales.demo` + your demo password |

If it says "Data checks found problems", send me the output (the demo is still there; remove it with step 5).

**5. Remove the demo later** (only the two "(Demo)" businesses and everything in them):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm --no-deps --entrypoint node -e CONFIRM=REMOVE_DEMO server dist/demo/server-demo.js remove
```

While it removes, you may see lines like "Foreign key constraint violated": that is expected (it deletes in
passes until nothing of the demo is left) and the last line says what was removed.

To start the demo again from scratch: remove it (step 5), then add it (steps 3–4).
