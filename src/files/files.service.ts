import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly uploadsDir: string;
  private readonly publicDir: string;

  constructor(private configService: ConfigService) {
    // Configuration des dossiers
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.publicDir = path.join(process.cwd(), 'public');

    // Créer les dossiers s'ils n'existent pas
    this.ensureDirectoryExists(this.uploadsDir);
    this.ensureDirectoryExists(this.publicDir);
    this.ensureDirectoryExists(path.join(this.publicDir, 'qr-codes'));
    this.ensureDirectoryExists(path.join(this.publicDir, 'receipts'));
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async saveFile(buffer: Buffer, filename: string, subfolder?: string): Promise<string> {
    const targetDir = subfolder 
      ? path.join(this.publicDir, subfolder)
      : this.publicDir;

    this.ensureDirectoryExists(targetDir);
    
    const filePath = path.join(targetDir, filename);
    await fs.promises.writeFile(filePath, buffer);
    
    // Retourner l'URL publique
    const publicUrl = subfolder 
      ? `/public/${subfolder}/${filename}`
      : `/public/${filename}`;
    
    return publicUrl;
  }

  async deleteFile(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur suppression fichier:', error);
      return false;
    }
  }

  getPublicUrl(relativePath: string): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://nomo-app.vercel.app';
    return `${frontendUrl}${relativePath}`;
  }

  async getFileBuffer(relativePath: string): Promise<Buffer | null> {
    try {
      const fullPath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(fullPath)) {
        return await fs.promises.readFile(fullPath);
      }
      return null;
    } catch (error) {
      console.error('Erreur lecture fichier:', error);
      return null;
    }
  }

  generateUniqueFilename(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    
    return prefix 
      ? `${prefix}_${name}_${timestamp}_${random}${ext}`
      : `${name}_${timestamp}_${random}${ext}`;
  }

  async cleanOldFiles(subfolder: string, maxAgeMs: number) {
    try {
      const targetDir = path.join(this.publicDir, subfolder);
      if (!fs.existsSync(targetDir)) return;

      const files = await fs.promises.readdir(targetDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(targetDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.promises.unlink(filePath);
          console.log(`Fichier ancien supprimé: ${file}`);
        }
      }
    } catch (error) {
      console.error('Erreur nettoyage fichiers:', error);
    }
  }
}












