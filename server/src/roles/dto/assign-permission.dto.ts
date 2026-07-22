import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class AssignPermissionDto {
  @IsString()
  @IsNotEmpty()
  permissionId: string;
}

export class AssignMultiplePermissionsDto {
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  permissionIds: string[];
}

