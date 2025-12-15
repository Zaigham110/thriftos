import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReportFiltersDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  gradeId?: string;

  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  workerId?: string;

  /**
   * If set to "csv", endpoints will return a CSV file and require REPORTS_EXPORT.
   * Otherwise returns JSON and requires REPORTS_VIEW.
   */
  @IsString()
  @IsOptional()
  export?: 'csv' | 'json';
}


