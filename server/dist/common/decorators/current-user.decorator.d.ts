export interface CurrentUserData {
    userId: string;
    tenantId: string | null;
    email: string;
    isSuperAdmin: boolean;
    impersonatedTenantId?: string;
}
export declare const CurrentUser: (...dataOrPipes: (keyof CurrentUserData | import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>>)[]) => ParameterDecorator;
