import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { QrCodeService, QRCodeOptions } from './qr-code.service';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentTenant } from '../common/decorators/tenant.decorator';
import { UserRole } from '../common/types/user.types';

@Controller('qr-codes')
export class QrCodeController {
  constructor(
    private readonly qrCodeService: QrCodeService,
    private readonly filesService: FilesService,
  ) {}

  @Post('table/:tableId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async generateTableQRCode(
    @Param('tableId') tableId: string,
    @CurrentTenant() tenant: any,
    @Query('size') size?: string,
    @Query('margin') margin?: string,
    @Query('dark_color') darkColor?: string,
    @Query('light_color') lightColor?: string,
  ) {
    const options: QRCodeOptions = {};
    
    if (size) options.size = parseInt(size);
    if (margin) options.margin = parseInt(margin);
    if (darkColor || lightColor) {
      options.color = {};
      if (darkColor) options.color.dark = darkColor;
      if (lightColor) options.color.light = lightColor;
    }

    const qrUrl = await this.qrCodeService.generateTableQRCode(tableId, tenant.id, options);
    
    return {
      table_id: tableId,
      qr_code_url: qrUrl,
      public_url: this.filesService.getPublicUrl(qrUrl),
    };
  }

  @Post('menu')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async generateMenuQRCode(
    @CurrentTenant() tenant: any,
    @Query('size') size?: string,
    @Query('margin') margin?: string,
    @Query('dark_color') darkColor?: string,
    @Query('light_color') lightColor?: string,
  ) {
    const options: QRCodeOptions = {};
    
    if (size) options.size = parseInt(size);
    if (margin) options.margin = parseInt(margin);
    if (darkColor || lightColor) {
      options.color = {};
      if (darkColor) options.color.dark = darkColor;
      if (lightColor) options.color.light = lightColor;
    }

    const qrUrl = await this.qrCodeService.generateMenuQRCode(tenant.slug, options);
    
    return {
      tenant_slug: tenant.slug,
      qr_code_url: qrUrl,
      public_url: this.filesService.getPublicUrl(qrUrl),
    };
  }

  @Public()
  @Post('public/menu/:tenantSlug')
  async generatePublicMenuQRCode(
    @Param('tenantSlug') tenantSlug: string,
    @Query('size') size?: string,
    @Query('margin') margin?: string,
  ) {
    const options: QRCodeOptions = {};
    
    if (size) options.size = parseInt(size);
    if (margin) options.margin = parseInt(margin);

    const qrUrl = await this.qrCodeService.generateMenuQRCode(tenantSlug, options);
    
    return {
      tenant_slug: tenantSlug,
      qr_code_url: qrUrl,
      public_url: this.filesService.getPublicUrl(qrUrl),
    };
  }

  @Post('tables/generate-all')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async generateAllTableQRCodes(@CurrentTenant() tenant: any) {
    const results = await this.qrCodeService.generateAllTableQRCodes(tenant.id);
    
    return {
      tenant_id: tenant.id,
      total_tables: results.length,
      results: results.map(result => ({
        ...result,
        public_url: result.qr_url ? this.filesService.getPublicUrl(result.qr_url) : null,
      })),
    };
  }

  @Post('table/:tableId/regenerate')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async regenerateTableQRCode(
    @Param('tableId') tableId: string,
    @CurrentTenant() tenant: any,
  ) {
    const qrUrl = await this.qrCodeService.regenerateTableQRCode(tableId, tenant.id);
    
    return {
      table_id: tableId,
      qr_code_url: qrUrl,
      public_url: this.filesService.getPublicUrl(qrUrl),
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getQRCodeStats(@CurrentTenant() tenant: any) {
    return this.qrCodeService.getQRCodeStats(tenant.id);
  }

  @Public()
  @Get('download/:filename')
  async downloadQRCode(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Sécurité: vérifier que le fichier est bien dans le dossier qr-codes
    if (!filename.match(/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg)$/)) {
      throw new BadRequestException('Nom de fichier invalide');
    }

    const relativePath = `/public/qr-codes/${filename}`;
    const buffer = await this.filesService.getFileBuffer(relativePath);
    
    if (!buffer) {
      return res.status(404).json({ message: 'QR Code non trouvé' });
    }

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=86400', // 24h cache
    });

    return res.send(buffer);
  }

  @Public()
  @Get('view/:filename')
  async viewQRCode(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Sécurité: vérifier que le fichier est bien dans le dossier qr-codes
    if (!filename.match(/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg)$/)) {
      throw new BadRequestException('Nom de fichier invalide');
    }

    const relativePath = `/public/qr-codes/${filename}`;
    const buffer = await this.filesService.getFileBuffer(relativePath);
    
    if (!buffer) {
      return res.status(404).json({ message: 'QR Code non trouvé' });
    }

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400', // 24h cache
    });

    return res.send(buffer);
  }
}












