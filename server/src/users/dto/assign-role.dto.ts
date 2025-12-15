import { IsString, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  @IsNotEmpty()
  roleId: string;
}

export class AssignMultipleRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleIds: string[];
}

