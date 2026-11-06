import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';

/** A form that knows whether it holds changes not saved yet. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Leaving a form with changes not saved asks first (v2 review: nothing typed is lost by a stray click on the
 * menu, a breadcrumb or Back). Closing or reloading the tab is covered by the form's own `beforeunload`.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.hasUnsavedChanges?.()) return true;
  return window.confirm(inject(I18nService).t('ws.leave.unsaved'));
};

/** For `@HostListener('window:beforeunload', ['$event'])`: the browser's own "Leave site?" when changes are not saved. */
export function warnBeforeUnload(e: BeforeUnloadEvent, dirty: boolean): void {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = '';
}
