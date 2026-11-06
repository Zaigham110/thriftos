import { crumbsFor, WS_CREATE, WS_CRUMBS, WS_NAV } from './workspace-nav';

describe('workspace navigation', () => {
  it('builds breadcrumbs from known segments only, skipping ids and query strings', () => {
    expect(crumbsFor('/sell/new')).toEqual([
      { label: 'ws.nav.sales', path: '/sell' },
      { label: 'ws.crumb.new', path: '/sell/new' },
    ]);
    expect(crumbsFor('/khata/clx9abc123?tab=ledger')).toEqual([{ label: 'ws.nav.receivables', path: '/khata' }]);
    expect(crumbsFor('/receive/ready/open/ckz1')).toEqual([
      { label: 'ws.nav.purchasing', path: '/receive' },
      { label: 'ws.new.ready', path: '/receive/ready' },
    ]);
    expect(crumbsFor('/')).toEqual([]);
  });

  it('skips the technical "records" segment (Purchasing › Containers, not Purchasing › Records › Containers)', () => {
    expect(crumbsFor('/receive/records/containers')).toEqual([
      { label: 'ws.nav.purchasing', path: '/receive' },
      { label: 'ws.crumb.containers', path: '/receive/records/containers' },
    ]);
    expect(crumbsFor('/sell/records')).toEqual([{ label: 'ws.nav.sales', path: '/sell' }]);
  });

  it('names a record whose page gave its name, linking to it', () => {
    expect(crumbsFor('/receive/records/containers/ck1/edit', { ck1: 'CONT-2026-006' })).toEqual([
      { label: 'ws.nav.purchasing', path: '/receive' },
      { label: 'ws.crumb.containers', path: '/receive/records/containers' },
      { label: 'CONT-2026-006', path: '/receive/records/containers/ck1', raw: true },
      { label: 'ws.crumb.edit', path: '/receive/records/containers/ck1/edit' },
    ]);
  });

  it('every menu and create item has a breadcrumb name for its first segment', () => {
    const paths = [...WS_NAV.flatMap((g) => g.items), ...WS_CREATE].map((i) => i.path.split('/')[1]);
    for (const p of paths) expect(WS_CRUMBS[p]).withContext(p).toBeTruthy();
  });
});
