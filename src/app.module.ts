import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProcessorModule } from './processor/processor.module';
import { DeviceStatus } from './processor/entities/device-status.entity';
import { Processor } from './processor/entities/processor.entity';
import { NetworkType } from './processor/entities/network-type.entity';
import { BatteryHealth } from './processor/entities/battery-health.entity';
import { Ssid } from './processor/entities/ssid.entity';
import { TemperatureReading } from './processor/entities/temperature-reading.entity';
import { CacheService } from './processor/cache.service';
import { WhitelistModule } from './whitelist/whitelist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db.sqlite',
      entities: [
        DeviceStatus,
        Processor,
        NetworkType,
        BatteryHealth,
        Ssid,
        TemperatureReading,
      ],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([DeviceStatus, Processor]),
    ProcessorModule,
    WhitelistModule,
  ],
  controllers: [AppController],
  providers: [AppService, CacheService],
})
export class AppModule {}
