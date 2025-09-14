import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Public()
  async check() {
    try {
      // Vérifier la connexion à la base de données
      await this.prisma.$queryRaw`SELECT 1`;
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'connected',
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'disconnected',
        error: error.message,
      };
    }
  }

  @Get('ready')
  @Public()
  async ready() {
    // Vérification plus approfondie pour Kubernetes readiness probe
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (error) {
      throw new Error('Service not ready');
    }
  }

  @Get('live')
  @Public()
  async live() {
    // Vérification basique pour Railway healthcheck
    return { status: 'alive', timestamp: Date.now() };
  }

  @Get('simple')
  @Public()
  simple() {
    // Healthcheck ultra-simple sans async
    return 'OK';
  }
}











