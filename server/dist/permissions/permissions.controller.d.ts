import { PermissionsService } from './permissions.service';
export declare class PermissionsController {
    private readonly permissionsService;
    constructor(permissionsService: PermissionsService);
    findAll(): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        group: string;
    }[]>;
    findByGroup(): Promise<Record<string, {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        group: string;
    }[]>>;
}
