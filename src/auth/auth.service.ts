import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  tenant_id: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  access_token: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    tenant_id: string;
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResult> {
    // Vérifier que le tenant existe et est actif
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: registerDto.tenant_id,
        is_active: true,
      },
    });

    if (!tenant) {
      throw new BadRequestException('Tenant non trouvé ou inactif');
    }

    // Vérifier l'unicité de l'email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Hasher le mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    // Créer l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        ...registerDto,
        password: hashedPassword,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Log de l'événement
    await this.prisma.event.create({
      data: {
        tenant_id: user.tenant_id,
        user_id: user.id,
        event_type: 'USER_LOGIN',
        description: `Nouvel utilisateur créé: ${user.email}`,
        metadata: {
          user_role: user.role,
          registration_method: 'email',
        },
      },
    });

    // Générer le JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant: user.tenant,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    // Valider l'utilisateur
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Log de l'événement
    await this.prisma.event.create({
      data: {
        tenant_id: user.tenant_id,
        user_id: user.id,
        event_type: 'USER_LOGIN',
        description: `Connexion utilisateur: ${user.email}`,
        metadata: {
          user_role: user.role,
          login_method: 'email',
        },
      },
    });

    // Générer le JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      role: user.role,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant: user.tenant,
      },
    };
  }

  async logout(userId: string, tenantId: string): Promise<{ message: string }> {
    // Log de l'événement
    await this.prisma.event.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        event_type: 'USER_LOGOUT',
        description: 'Déconnexion utilisateur',
        metadata: {
          logout_method: 'manual',
        },
      },
    });

    return { message: 'Déconnexion réussie' };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            address: true,
            description: true,
            website: true,
            logo_url: true,
            banner_url: true,
            payment_info: true,
            is_active: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Vérifier que l'utilisateur et le tenant sont actifs
    if (!user.is_active || !user.tenant.is_active) {
      return null;
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return null;
    }

    // Retourner l'utilisateur sans le mot de passe
    const { password: _, ...result } = user;
    return result;
  }

  async validateJwtPayload(payload: JwtPayload): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            address: true,
            description: true,
            website: true,
            logo_url: true,
            banner_url: true,
            payment_info: true,
            is_active: true,
          },
        },
      },
    });

    if (!user || !user.is_active || !user.tenant.is_active) {
      return null;
    }

    // Vérifier que les données du JWT sont toujours valides
    if (user.tenant_id !== payload.tenant_id || user.email !== payload.email) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  async getProfile(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        tenant_id: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            address: true,
            logo_url: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    return user;
  }
}












