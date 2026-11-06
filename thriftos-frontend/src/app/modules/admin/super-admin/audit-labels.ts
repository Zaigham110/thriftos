/**
 * Audit actions in plain words for the super admin console (v2 review). Unknown actions fall back to their code in
 * sentence case, so nothing is hidden.
 */
const LABELS: Record<string, string> = {
  TENANT_CREATED: 'Business created',
  TENANT_UPDATED: 'Business changed',
  TENANT_DEACTIVATED: 'Business switched off',
  TENANT_ACTIVATED: 'Business switched on',
  TENANT_SETUP_DONE: 'Owner finished setup',
  TENANT_MARKED_TEST: 'Marked as a test business',
  TENANT_MARKED_REAL: 'Marked as a real business',
  TENANT_SAMPLE_DATA: 'Sample data added',
  TENANT_DELETED: 'Test business deleted',
  AUTH_LOGIN_SUCCESS: 'Signed in',
  AUTH_LOGIN_FAILED: 'Sign-in failed',
  AUTH_PIN_LOGIN: 'Signed in with PIN',
  AUTH_PIN_FAILED: 'Wrong PIN',
  AUTH_PIN_LOCKED: 'Locked out (wrong PINs)',
  AUTH_LOGOUT: 'Signed out',
  AUTH_TOKEN_REFRESH: 'Session renewed',
  USER_PIN_RESET: 'New PIN made',
  USER_PASSWORD_RESET: 'New password made',
  USER_UPDATED: 'Person changed',
  USER_CREATED: 'Person added',
  SUPERADMIN_IMPERSONATE: 'Support view opened',
  SUPERADMIN_EXIT_IMPERSONATION: 'Support view closed',
  SUPPORT_VIEW_WRITE_BLOCKED: 'Change blocked in support view',
  SUPERADMIN_SYSTEM_SETTINGS_UPDATED: 'Platform settings changed',
  KHATA_REMINDER_SENT: 'Payment reminder sent',
  TENANT_SETTINGS_UPDATED: 'Business settings changed',
  USER_BLOCKED: 'Person blocked',
  USER_UNBLOCKED: 'Person unblocked',
  SUPER_ADMIN_ROUTE_ACCESS: 'Console change',
  SUPER_ADMIN_ROUTE_DENIED: 'Console blocked (not a super admin)',
  SALE_CREATED: 'Sale recorded',
  PAYMENT_RECORDED: 'Payment received',
  CONTAINER_CREATED: 'Container received',
};

export function auditLabel(action: string): string {
  if (LABELS[action]) return LABELS[action];
  const words = action.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
