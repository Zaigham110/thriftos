import { TenantStatus } from '@prisma/client';

export class CurrencyDto {
  code: string;
  symbol: string;
  decimalPlaces: number;
}

export class TenantResponseDto {
  id: string;
  name: string;
  companyCode: string;
  currencyCode: string;
  currency: CurrencyDto;
  currencyLocked?: boolean;
  locale: string;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    users: number;
    roles: number;
    categories: number;
    grades: number;
    warehouses: number;
  };
}

export class TenantListResponseDto {
  data: TenantResponseDto[];
  total: number;
  page: number;
  limit: number;
}

