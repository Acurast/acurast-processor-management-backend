import { Module } from '@nestjs/common';
import { WhitelistService } from './whitelist.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [WhitelistService],
  exports: [WhitelistService],
})
export class WhitelistModule {}
