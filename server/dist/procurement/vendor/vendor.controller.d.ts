import { Request } from 'express';
import { VendorService } from './vendor.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
export declare class VendorController {
    private readonly vendorService;
    constructor(vendorService: VendorService);
    create(dto: CreateVendorDto, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        country: string | null;
        contactInfo: string | null;
    }>;
    findAll(includeInactive: boolean, user: CurrentUserData, req: Request): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        isActive: boolean;
        updatedAt: Date;
        country: string | null;
        contactInfo: string | null;
    }[]>;
}
