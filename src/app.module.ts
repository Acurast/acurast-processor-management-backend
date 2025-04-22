import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProcessorModule } from './processor/processor.module';
import { CacheService } from './processor/cache.service';
import { WhitelistModule } from './whitelist/whitelist.module';
import { getTypeormConfig } from './db/typeorm.config';
import { DeviceStatus } from './processor/entities/device-status.entity';
import { Processor } from './processor/entities/processor.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(getTypeormConfig()),
    TypeOrmModule.forFeature([DeviceStatus, Processor]),
    ProcessorModule,
    WhitelistModule,
  ],
  controllers: [AppController],
  providers: [AppService, CacheService],
})
export class AppModule {}
