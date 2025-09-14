import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from './files.service';
import * as QRCode from 'qrcode';

export interface QRCodeOptions {
  size?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

@Injectable()
export class QrCodeService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private filesService: FilesService,
  ) {}

  async generateTableQRCode(tableId: string, tenantId: string, options?: QRCodeOptions): Promise<string> {
    // Vérifier que la table existe et appartient au tenant
    const table = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        tenant: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
    });

    if (!table) {
      throw new BadRequestException('Table non trouvée ou inactive');
    }

    // Générer l'URL du menu public avec paramètres de table
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://nomo-app.vercel.app';
    const menuUrl = `${frontendUrl}/resto/${table.tenant.slug}/menu?table=${table.id}`;

    // Options par défaut pour le QR code
    const qrOptions = {
      width: options?.size || 300,
      margin: options?.margin || 2,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#FFFFFF',
      },
      errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
    };

    // Générer le QR code
    const qrBuffer = await QRCode.toBuffer(menuUrl, qrOptions);

    // Sauvegarder le fichier
    const filename = this.filesService.generateUniqueFilename(
      `table_${table.number}_qr.png`,
      'qr'
    );
    const relativePath = await this.filesService.saveFile(qrBuffer, filename, 'qr-codes');

    // Mettre à jour la table avec l'URL du QR code
    await this.prisma.table.update({
      where: { id: tableId },
      data: { qr_code_url: relativePath },
    });

    return relativePath;
  }

  async generateMenuQRCode(tenantSlug: string, options?: QRCodeOptions): Promise<string> {
    // Vérifier que le tenant existe
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug, is_active: true },
      select: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      throw new BadRequestException('Restaurant non trouvé');
    }

    // Générer l'URL du menu public
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://nomo-app.vercel.app';
    const menuUrl = `${frontendUrl}/resto/${tenant.slug}/menu`;

    // Options par défaut pour le QR code
    const qrOptions = {
      width: options?.size || 400,
      margin: options?.margin || 3,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#FFFFFF',
      },
      errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
    };

    // Générer le QR code
    const qrBuffer = await QRCode.toBuffer(menuUrl, qrOptions);

    // Sauvegarder le fichier
    const filename = this.filesService.generateUniqueFilename(
      `${tenant.slug}_menu_qr.png`,
      'menu'
    );
    const relativePath = await this.filesService.saveFile(qrBuffer, filename, 'qr-codes');

    return relativePath;
  }

  async generateCustomQRCode(data: string, options?: QRCodeOptions): Promise<Buffer> {
    const qrOptions = {
      width: options?.size || 300,
      margin: options?.margin || 2,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#FFFFFF',
      },
      errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
    };

    return await QRCode.toBuffer(data, qrOptions);
  }

  async generateAllTableQRCodes(tenantId: string): Promise<{ table: any; qr_url: string }[]> {
    // Récupérer toutes les tables actives du tenant
    const tables = await this.prisma.table.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        tenant: {
          select: {
            slug: true,
            name: true,
          },
        },
      },
      orderBy: { number: 'asc' },
    });

    const results = [];

    for (const table of tables) {
      try {
        const qrUrl = await this.generateTableQRCode(table.id, tenantId);
        results.push({
          table: {
            id: table.id,
            number: table.number,
            name: table.name,
            capacity: table.capacity,
          },
          qr_url: qrUrl,
        });
      } catch (error) {
        console.error(`Erreur génération QR pour table ${table.number}:`, error);
        results.push({
          table: {
            id: table.id,
            number: table.number,
            name: table.name,
            capacity: table.capacity,
          },
          qr_url: null,
          error: error.message,
        });
      }
    }

    return results;
  }

  async regenerateTableQRCode(tableId: string, tenantId: string): Promise<string> {
    // Récupérer l'ancien QR code pour le supprimer
    const table = await this.prisma.table.findFirst({
      where: { id: tableId, tenant_id: tenantId },
      select: { qr_code_url: true },
    });

    // Supprimer l'ancien fichier s'il existe
    if (table?.qr_code_url) {
      await this.filesService.deleteFile(table.qr_code_url);
    }

    // Générer un nouveau QR code
    return this.generateTableQRCode(tableId, tenantId);
  }

  async getQRCodeStats(tenantId: string) {
    const [
      totalTables,
      tablesWithQR,
      recentQRCodes,
    ] = await Promise.all([
      this.prisma.table.count({
        where: { tenant_id: tenantId, is_active: true },
      }),
      this.prisma.table.count({
        where: { 
          tenant_id: tenantId, 
          is_active: true,
          qr_code_url: { not: null },
        },
      }),
      this.prisma.table.findMany({
        where: { 
          tenant_id: tenantId,
          qr_code_url: { not: null },
          updated_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 jours
          },
        },
        select: {
          id: true,
          number: true,
          name: true,
          qr_code_url: true,
          updated_at: true,
        },
        orderBy: { updated_at: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalTables,
      tablesWithQR,
      tablesWithoutQR: totalTables - tablesWithQR,
      coveragePercentage: totalTables > 0 ? Math.round((tablesWithQR / totalTables) * 100) : 0,
      recentQRCodes,
    };
  }
}












