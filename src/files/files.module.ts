import { Module } from '@nestjs/common';
import { QrCodeController } from './qr-code.controller';
import { QrCodeService } from './qr-code.service';
import { FilesService } from './files.service';

@Module({
  controllers: [QrCodeController],
  providers: [QrCodeService, FilesService],
  exports: [QrCodeService, FilesService],
})
export class FilesModule {}
