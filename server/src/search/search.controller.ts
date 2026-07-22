import { Controller, Get, Query, ForbiddenException } from '@nestjs/common';
import { SearchService, GlobalSearchResultItem } from './search.service';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  private requireTenant(user: CurrentUserData): string {
    const tenantId = user?.impersonatedTenantId ?? user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context required');
    return tenantId;
  }

  @Get('global')
  async searchGlobal(
    @CurrentUser() user: CurrentUserData,
    @Query('q') query: string,
  ): Promise<GlobalSearchResultItem[]> {
    const tenantId = this.requireTenant(user);
    return this.searchService.searchGlobal(tenantId, query || '');
  }
}
