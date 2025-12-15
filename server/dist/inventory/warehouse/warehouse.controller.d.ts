import { Request } from 'express';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { InventoryWarehouseService } from './warehouse.service';
export declare class InventoryWarehouseController {
    private readonly service;
    constructor(service: InventoryWarehouseService);
    list(user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        code: string;
        location: string | null;
    }[]>;
}
