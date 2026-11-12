import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

/** What a read-only business may still do: sign in and out, pay, and the billing page itself. */
const ALWAYS = [/\/api\/auth\//, /\/api\/billing(\/|$)/];

/**
 * Phase 7.4: after the grace period a business is read-only until it pays. Everything can be seen and exported
 * (GET), nothing changed; paying is always possible. Its data is never deleted. Runs after the guards, so the
 * signed-in user is known; the super admin is never blocked.
 */
@Injectable()
export class ReadOnlyInterceptor implements NestInterceptor {
  constructor(private readonly billing: BillingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; originalUrl?: string; url: string; user?: CurrentUserData }>();
    const user = req.user;
    const url = req.originalUrl ?? req.url;
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || !user?.tenantId || user.isSuperAdmin || ALWAYS.some((r) => r.test(url))) {
      return next.handle();
    }
    return from(this.billing.state(user.tenantId)).pipe(
      switchMap((state) => {
        if (state === 'READ_ONLY') {
          throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'READ_ONLY', message: 'Your plan has ended. Pay in Settings → Plan and billing to make changes again; everything can still be seen and exported.' });
        }
        return next.handle();
      }),
    );
  }
}
