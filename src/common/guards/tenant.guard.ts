import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequestWithTenant } from '../middleware/tenant.middleware';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    
    // Vérifier que le tenant est présent
    if (!request.tenant) {
      throw new ForbiddenException('Tenant requis pour cette opération');
    }

    // Vérifier que l'utilisateur appartient au tenant (si authentifié)
    if (request.user && request.user.tenant_id !== request.tenant.id) {
      throw new ForbiddenException('Accès non autorisé à ce tenant');
    }

    return true;
  }
}












