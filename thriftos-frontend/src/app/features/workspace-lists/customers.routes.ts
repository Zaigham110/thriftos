import { Routes } from '@angular/router';
import { moduleGuard } from '../../core/guards/module.guard';
import { unsavedChangesGuard } from '../../core/nav/unsaved-changes.guard';
import type { ListConfig } from './list-config';

/**
 * Customers (owner, 2026-11-17: "can't see Customer module"): everybody the business sells to, with what they
 * bought and what they owe. Receivables stays the list of who owes and the collections work.
 */
const CUSTOMERS_LIST: ListConfig = {
  resource: 'customers',
  title: 'ws.customers.title',
  count: 'ws.customers.count',
  searchPlaceholder: 'ws.customers.search',
  emptyHeading: 'ws.customers.emptyHeading',
  emptyMessage: 'ws.suppliers.emptyMessage',
  emptyNew: { heading: 'ws.customers.emptyNewHeading', message: 'ws.customers.emptyNewMessage' },
  columns: [
    { key: 'name', label: 'ws.col.customer' },
    { key: 'phone', label: 'ws.suppliers.col.phone', hideIfEmpty: true },
    { key: 'city', label: 'ws.col.city', hideIfEmpty: true },
    { key: 'priceGroup', label: 'ws.customers.col.priceGroup', hideIfEmpty: true, module: 'PRICE_LISTS' },
    { key: 'bills', label: 'ws.customers.col.bills', format: 'number', computed: true },
    { key: 'bought', label: 'ws.customers.col.bought', format: 'money', computed: true, total: true },
    { key: 'lastSale', label: 'ws.customers.col.lastSale', format: 'date', computed: true },
    // What they owe now; a customer who paid ahead reads as an advance on their page.
    { key: 'balance', label: 'ws.customers.col.balance', format: 'money', computed: true, total: true, module: 'KHATA', info: 'ws.customers.balanceInfo' },
    { key: 'status', label: 'ws.col.status', enumPrefix: 'ws.customers.status.', computed: true },
    { key: 'since', label: 'ws.customers.col.since', format: 'date' },
  ],
  defaultColumns: ['name', 'phone', 'city', 'priceGroup', 'bills', 'bought', 'lastSale', 'balance'],
  groupBy: [
    { key: 'city', label: 'ws.col.city' },
    { key: 'priceGroup', label: 'ws.customers.col.priceGroup' },
  ],
  quickFilters: [],
  cards: { title: 'name', sub: ['city', 'phone'], amount: 'bought' },
  rowLink: (id) => ['/sell/customers', id],
  create: { label: 'ws.customers.new', link: '/sell/customers/new' },
};

/**
 * /sell/customers: loaded when first opened, so the list's set-up is not in the app's first download. The same
 * form, page and statement as under Receivables, which keeps its own addresses.
 */
export const CUSTOMERS_ROUTES: Routes = [
  { path: '', data: { list: CUSTOMERS_LIST }, loadComponent: () => import('./list-page.component').then((m) => m.ListPageComponent), title: 'ThriftOS' },
  { path: 'new', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./customer-form.component').then((m) => m.CustomerFormComponent), title: 'ThriftOS' },
  { path: ':id', loadComponent: () => import('./customer-record.component').then((m) => m.CustomerRecordComponent), title: 'ThriftOS' },
  { path: ':id/edit', canDeactivate: [unsavedChangesGuard], loadComponent: () => import('./customer-form.component').then((m) => m.CustomerFormComponent), title: 'ThriftOS' },
  { path: ':id/statement', canActivate: [moduleGuard], data: { module: 'KHATA' }, loadComponent: () => import('./statement.component').then((m) => m.StatementComponent), title: 'ThriftOS' },
];
