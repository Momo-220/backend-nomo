import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface RequestWithTenant extends Request {
  tenant?: {
    id: string;
    slug: string;
    name: string;
  };
  user?: {
    id: string;
    tenant_id: string;
    email: string;
    role: string;
  };
  headers: any;
  params: any;
  query: any;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async use(req: RequestWithTenant, res: Response, next: NextFunction) {
    try {
      // Extraire le tenant_id depuis différentes sources
      let tenantId = this.extractTenantId(req);

      if (!tenantId) {
        // Si pas de tenant_id dans les headers/params, essayer de l'extraire du JWT
        tenantId = this.extractTenantFromJWT(req);
      }

      if (tenantId) {
        // Vérifier que le tenant existe et est actif
        const tenant = await this.prisma.tenant.findFirst({
          where: {
            id: tenantId,
            is_active: true,
          },
          select: {
            id: true,
            slug: true,
            name: true,
          },
        });

        if (!tenant) {
          throw new UnauthorizedException('Tenant non trouvé ou inactif');
        }

        // Ajouter le tenant à la requête
        req.tenant = tenant;

        // Vérifier que l'utilisateur appartient bien à ce tenant
        if (req.user && req.user.tenant_id !== tenantId) {
          throw new UnauthorizedException('Accès non autorisé à ce tenant');
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  private extractTenantId(req: RequestWithTenant): string | null {
    // 1. Depuis les headers
    const headerTenant = req.headers['x-tenant-id'] as string;
    if (headerTenant) return headerTenant;

    // 2. Depuis les paramètres de route (pour les URLs publiques comme /resto/:slug)
    const slugParam = req.params.slug;
    if (slugParam) {
      // Note: dans ce cas, on devra faire une requête DB pour convertir slug -> id
      // Ce sera géré dans les contrôleurs spécifiques
      return null;
    }

    // 3. Depuis les paramètres de requête
    const queryTenant = req.query.tenant_id as string;
    if (queryTenant) return queryTenant;

    return null;
  }

  private extractTenantFromJWT(req: RequestWithTenant): string | null {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7);
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      return payload.tenant_id || null;
    } catch (error) {
      // Token invalide ou expiré - pas d'erreur, on continue sans tenant
      return null;
    }
  }
}
