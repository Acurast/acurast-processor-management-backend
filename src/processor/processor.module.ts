import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessorController } from './processor.controller';
import { ProcessorService } from './processor.service';
import { CacheService } from './cache.service';
import { SignatureService } from './signature.service';
import { DeviceStatus } from './entities/device-status.entity';
import { Processor } from './entities/processor.entity';
import { NetworkType } from './entities/network-type.entity';
import { BatteryHealth } from './entities/battery-health.entity';
import { Ssid } from './entities/ssid.entity';
import { TemperatureReading } from './entities/temperature-reading.entity';
import { Manager } from './entities/manager.entity';
import { WhitelistModule } from '../whitelist/whitelist.module';
import { ManagerService } from './manager.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceStatus,
      Processor,
      NetworkType,
      BatteryHealth,
      Ssid,
      TemperatureReading,
      Manager,
    ]),
    WhitelistModule,
  ],
  controllers: [ProcessorController],
  providers: [ProcessorService, CacheService, SignatureService, ManagerService],
  exports: [CacheService],
})
export class ProcessorModule {}
