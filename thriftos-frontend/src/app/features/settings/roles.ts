import { I18nService } from '../../core/i18n/i18n.service';

/** Roles every business has from the start; their names are shown in the person's language (v2 review: Settings). */
export const BUILT_IN_ROLES = ['Admin', 'Manager', 'Worker', 'ReadOnly', 'Munshi'];

/** "Admin" → "Owner" / "مالک"; a role the owner named themselves stays as written. */
export function roleName(i18n: I18nService, name: string): string {
  return BUILT_IN_ROLES.includes(name) ? i18n.t(`settings.role.${name}`) : name;
}
