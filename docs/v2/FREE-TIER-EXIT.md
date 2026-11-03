# ThriftOS — leaving the AWS free plan (v2 task 5.7)

Checked 2026-11-03 with `aws freetier get-account-plan-state` and the AWS Pricing API (Sydney, `ap-southeast-2`,
Linux, on-demand). Re-check prices before deciding; they change.

## Where things stand
- **AWS plan:** Free, active. **Credits left: USD 139.35. Plan ends: 30 April 2027.**
- On the free plan, AWS stops (and later closes) the account when the credits run out or the plan period ends,
  unless it is upgraded to the paid plan. Both ThriftOS and `tradebrain` run on this account.
- **Server:** one `t4g.small` (2 vCPU burstable, 2 GB RAM, ARM) shared by `tradebrain` and ThriftOS, 30 GB gp3
  disk, one Elastic IP. ThriftOS uses ~170 MB idle with limits adding up to ~500 MB; ~540 MB of RAM is free.
- **CloudFront** (the app's address and HTTPS): inside CloudFront's always-free allowance (1 TB out and
  10 million requests a month) for many businesses' worth of traffic.

## What it costs per month (730 hours)

| Item | Price | Per month |
|---|---|---|
| t4g.micro (1 GB) | USD 0.0106 / h | ≈ USD 7.74 |
| **t4g.small (2 GB) — today** | USD 0.0212 / h | **≈ USD 15.48** |
| t4g.medium (4 GB) | USD 0.0424 / h | ≈ USD 30.95 |
| 30 GB gp3 disk | USD 0.096 / GB-month | ≈ USD 2.88 |
| Public IPv4 (the Elastic IP) | USD 0.005 / h | ≈ USD 3.65 |
| CloudFront | free allowance | USD 0 |

Today's server ≈ **USD 22 a month** (shared with `tradebrain`), so the credits last about six months, which is close to
the plan end date. Expect to pay from around **April–May 2027** at the latest.

## When to move (whichever comes first)
1. **Before 30 April 2027, or when credits drop below USD 25**: upgrade the account to the paid plan
   (AWS Settings → Billing → upgrade). Only the account owner can do this. Nothing in ThriftOS changes.
2. **Memory**: free RAM on the server stays under ~300 MB for a week, or the API container is restarted for
   memory (`docker inspect` shows `OOMKilled`). Check with `free -m` and `docker stats` (Systems Manager).
3. **Load**: more than ~10 businesses using it daily, or the t4g CPU credit balance (CloudWatch
   `CPUCreditBalance`) keeps falling toward 0 during working hours.
4. **Risk**: `tradebrain` and ThriftOS should not be able to slow each other down once real customers pay.

## How to move
**A. Bigger server (simplest, ~5 minutes of downtime for both apps).** Upgrade to the paid plan first.
1. Take a database backup (5.3; until then: `deploy/deploy.sh` keeps the last 5 pre-deploy dumps in
   `/opt/thriftos/backups` — copy one off the server).
2. EC2 console → the instance → Stop → Actions → Instance settings → Change instance type → `t4g.medium` → Start.
3. The Elastic IP, the CloudFront address and both apps' Docker setups stay as they are; containers restart on
   their own (`restart: unless-stopped`). Check `https://dyit6jcdpteuk.cloudfront.net/thriftos/version.json`.

**B. ThriftOS on its own server (keeps the two apps apart).**
1. Launch a `t4g.small` (Ubuntu 24.04, ARM) in Sydney with an Elastic IP, Systems Manager agent and a security
   group that allows port 80 only from the CloudFront prefix list (`pl-b8a742d1`).
2. Run `deploy/server-setup.sh https://dyit6jcdpteuk.cloudfront.net` on it with the same `ORIGIN_SECRET`
   (copy `/opt/thriftos/.env.prod` from the old server instead, so the secrets stay the same).
3. Restore the latest backup into the new database, start the stack (`deploy/deploy.sh <current tag>`).
4. CloudFront → distribution `E6GTQQ0JJFQQ8` → Origins → change the origin domain to the new server's public DNS.
5. After a day without problems, stop ThriftOS on the old server (`docker compose -f docker-compose.prod.yml down`
   in `/opt/thriftos`, keep the volume until a backup is safely elsewhere) and remove its timer.
   Cost: about USD 22 a month more.

## What does not change
The address (CloudFront), the release flow (tag → images → the server deploys itself), the data and the
secrets. An own domain can be added to CloudFront at any time (5.5) independently of all this.
