// ===============================
// THRIFTOS DESIGN SYSTEM - PUBLIC API
// ===============================
// ⚠️ ONLY app-* COMPONENTS ARE ALLOWED IN SCREENS
// ⚠️ NO ui-* PRIMITIVES ALLOWED
// ⚠️ NO CUSTOM LAYOUT COMPONENTS ALLOWED

// ===========================
// DESIGN SYSTEM PRIMITIVES (app-*)
// ===========================

// Layout Primitives
export { AppPageComponent } from './page/app-page.component';
export { AppPageHeaderComponent } from './page-header/app-page-header.component';
export { AppPageBodyComponent } from './page-body/app-page-body.component';
export { AppSectionComponent } from './section/app-section.component';
export { AppSectionHeaderComponent } from './section-header/app-section-header.component';
export { AppSectionBodyComponent } from './section-body/app-section-body.component';
export { AppStackComponent } from './app-stack/app-stack.component';
export { AppGridComponent } from './app-grid/app-grid.component';
export { AppSplitComponent, AppSplitMainComponent, AppSplitAsideComponent, type SplitRatio } from './app-split/app-split.component';
export { AppWorkspace3PanelComponent } from './app-workspace-3panel/app-workspace-3panel.component';

// Navigation Primitives
export { AppBreadcrumbComponent, type BreadcrumbItem } from './app-breadcrumb/app-breadcrumb.component';
export { AppTopbarComponent } from './app-topbar/app-topbar.component';
export {
    AppSidebarComponent,
    type SidebarNavConfig,
    type SidebarNavGroup,
    type SidebarNavItem,
} from './app-sidebar/app-sidebar.component';
export { AppNavGroupComponent, type AppNavGroupItem } from './app-nav-group/app-nav-group.component';
export { AppNavItemComponent } from './app-nav-item/app-nav-item.component';
export { AppShellLayoutComponent } from './app-shell-layout/app-shell-layout.component';

// Auth Primitives
export { AppAuthLayoutComponent } from './app-auth-layout/app-auth-layout.component';
export { AppBrandPanelComponent, type BrandPanelVariant, type BrandPanelSize } from './app-brand-panel/app-brand-panel.component';

// Container Primitives
export { AppCardComponent } from './card/app-card.component';

// Data Primitives
export { AppTableComponent } from './table/app-table.component';
export { AppTableColumnComponent, type TableColumn } from './app-table-column/app-table-column.component';
export {
    AppDataTableComponent,
    type DataTableState,
    type DataTableAlign,
    type DataTableSortDir,
    type DataTableColumn,
} from './data-table/data-table';
export { AppKpiCardComponent } from './kpi-card/app-kpi-card.component';
export { AppChartComponent, type ChartPoint, type ChartType, type ChartVariant } from './app-chart/app-chart.component';
export { AppBadgeComponent } from './app-badge/app-badge.component';
export { AppIconComponent } from './app-icon/app-icon.component';

// Form Primitives
export { AppFormComponent } from './form/app-form.component';
export { AppFormFieldComponent } from './form-field/app-form-field.component';
export { AppInputComponent } from './app-input/app-input.component';
export { AppPasswordInputComponent } from './app-password-input/app-password-input.component';
export { AppSelectComponent, type SelectOption } from './app-select/app-select.component';
export { AppTextareaComponent } from './app-textarea/app-textarea.component';
export { AppCheckboxComponent } from './app-checkbox/app-checkbox.component';
export { AppRadioComponent } from './app-radio/app-radio.component';
export { AppSwitchComponent } from './app-switch/app-switch.component';

// Action Primitives
export { AppButtonComponent } from './button/app-button.component';
export { AppLinkComponent } from './app-link/app-link.component';
export { AppDropdownComponent, type DropdownItem } from './app-dropdown/app-dropdown.component';

// Feedback Primitives
export { AppEmptyStateComponent } from './app-empty-state/app-empty-state.component';
export { AppLoadingComponent } from './app-loading/app-loading.component';
export { AppErrorStateComponent } from './app-error-state/app-error-state.component';

// Dialog Primitives
export { AppDialogComponent, type DialogVariant } from './app-dialog/app-dialog.component';

// ===========================
// DESIGN SYSTEM TYPES
// ===========================
export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type CardVariant = 'data' | 'info';
export type KpiChangeType = 'positive' | 'negative' | 'neutral';

// ===========================
// LEGACY UI COMPONENTS (DEPRECATED - DO NOT USE IN NEW SCREENS)
// ===========================
// ThriftUI Component Library
// ==========================
// All reusable UI components for ThriftOS

// Core Form Components
export { ButtonComponent } from './button/button.component';

export { InputComponent } from './input/input';
export { InputDirective } from './input/input.directive';

export { SelectComponent } from './select/select';
export type { SelectOption as LegacySelectOption } from './select/select';
export { SelectDirective } from './select/select.directive';

export { TextareaComponent } from './textarea/textarea';
export { TextareaDirective } from './textarea/textarea.directive';

export { CheckboxComponent } from './checkbox/checkbox';

export { RadioComponent } from './radio/radio';
export type { RadioOption } from './radio/radio';

export { ToggleComponent } from './toggle/toggle';

// Display Components
export { BadgeComponent } from './badge/badge.component';
export { AlertComponent } from './alert/alert.component';

export { TooltipComponent } from './tooltip/tooltip'; // TooltipDirective? Check
export type { TooltipPosition } from './tooltip/tooltip';

// Layout Components
export {
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent
} from './card/card.component';

export { DataTableComponent } from './data-table/data-table';
export type { DataTableColumn as LegacyTableColumn } from './data-table/data-table';

export {
    TableComponent,
    TableHeaderComponent,
    TableBodyComponent,
    TableRowComponent,
    TableHeadComponent,
    TableCellComponent
} from './table/table.component';

export { ModalComponent } from './modal/modal';
export type { ModalSize } from './modal/modal';

export { DrawerComponent } from './drawer/drawer';
export type { DrawerPosition, DrawerSize } from './drawer/drawer';

export { TabsComponent } from './tabs/tabs';
export type { Tab } from './tabs/tabs';

export { BreadcrumbComponent } from './breadcrumb/breadcrumb.component';
export type { BreadcrumbItem as LegacyBreadcrumbItem } from './breadcrumb/breadcrumb.component';

// Feedback Components
export { ToastComponent } from './toast/toast';
export type { ToastVariant, ToastData } from './toast/toast';

export { SkeletonComponent } from './skeleton/skeleton.component';
export { EmptyStateComponent } from './empty-state/empty-state.component';

export { PaginationComponent } from './pagination/pagination.component';
export { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog';
export type { ConfirmVariant } from './confirm-dialog/confirm-dialog';
export { SheetContentComponent } from './sheet/sheet.component';
export type { SheetSide } from './sheet/sheet.component';
