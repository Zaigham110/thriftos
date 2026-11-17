import { INestApplication } from '@nestjs/common';
import { strFromU8, unzipSync } from 'fflate';
import { PrismaService } from '../../src/prisma/prisma.service';
import { toCsv } from '../../src/tenant/data-export';
import { api, createTenantWithOwner, createTestApp, createUserWithoutPermissions, TestTenant } from './fixtures';

/** v2 5.6: an owner downloads everything that belongs to the business; nothing of anyone else's. */
describe('Whole-business data export (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let a: TestTenant;
  let b: TestTenant;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    a = await createTenantWithOwner(app);
    b = await createTenantWithOwner(app);
    await api(app, a).post('/customers', { name: 'Haji Rafiq, "Landa" House', phone: '+923001112233', openingBalance: 15000 }).expect(201);
    await api(app, b).post('/customers', { name: 'Other Business Buyer', phone: '03004445566' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const download = async (t: TestTenant) => {
    const res = await api(app, t).get('/tenant/export').buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    return res;
  };

  it('gives the owner a zip of CSVs with only this business, without password hashes', async () => {
    const res = await download(a);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="thriftos-.+\.zip"/);
    const files = unzipSync(new Uint8Array(res.body as Buffer));
    const names = Object.keys(files);
    // Files are named for what they hold, not after database tables (v2 review).
    expect(names).toEqual(expect.arrayContaining(['Business.csv', 'Customers.csv', 'People.csv', 'People and roles.csv', 'README.txt']));
    expect(names).not.toEqual(expect.arrayContaining(['Customer.csv']));

    const customers = strFromU8(files['Customers.csv']);
    // A phone number stays as written; it is not a formula.
    expect(customers).toContain(',+923001112233,');
    // An id column is followed by the name it stands for.
    const roles = strFromU8(files['People and roles.csv']).split('\r\n');
    expect(roles[0]).toMatch(/userId,person,roleId,role/);
    expect(roles[1]).toContain(',Owner');
    // The README lists the files and says what is left out.
    const readme = strFromU8(files['README.txt']);
    expect(readme).toContain('Customers.csv: 1 row');
    expect(readme).toMatch(/photos and files attached to records/);
    // UTF-8 byte-order mark (Excel then shows Urdu names right); text decoders drop it, so check the bytes.
    expect([...files['Customers.csv'].slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(customers).toContain('"Haji Rafiq, ""Landa"" House"');
    expect(customers).toContain('15000');
    expect(customers).not.toContain('Other Business Buyer');

    const users = strFromU8(files['People.csv']);
    expect(users.split('\r\n')[0]).not.toMatch(/passwordHash|pinHash/);
    expect(users).toContain(a.email);
    expect(users).not.toContain(b.email);

    const audit = await prisma.auditLog.findFirst({ where: { tenantId: a.tenantId, action: 'DATA_EXPORTED' } });
    expect(audit?.userId).toBe(a.userId);
  });

  it('is refused without the data.export permission and without a login', async () => {
    const plain = await createUserWithoutPermissions(app, a.tenantId);
    await api(app, plain).get('/tenant/export').expect(403);
    await api(app, { ...a, token: 'not-a-token' }).get('/tenant/export').expect(401);
  });

  it('writes CSV that spreadsheets will not run as a formula', () => {
    const csv = toCsv(['a', 'b', 'c'], [{ a: '=HYPERLINK("x")', b: -12.5, c: null }]);
    expect(csv.split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")",-12.5,`);
    // A phone number is left alone; a + that starts a formula is not.
    expect(toCsv(['p', 'f'], [{ p: '+92 300 1112233', f: '+1+cmd' }]).split('\r\n')[1]).toBe(`+92 300 1112233,'+1+cmd`);
  });
});
