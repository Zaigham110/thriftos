/**
 * A customer's form, page and statement open from two places: Customers (under Sales) and Receivables. Each
 * keeps its own addresses, so Back and the breadcrumb lead to the list the person came from.
 */
export const customerBase = (url: string): '/sell/customers' | '/khata/records' => (url.startsWith('/sell/customers') ? '/sell/customers' : '/khata/records');
