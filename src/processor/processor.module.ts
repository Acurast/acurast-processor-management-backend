import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessorController } from './processor.controller';
import { ProcessorService } from './processor.service';
import { CacheService } from './cache.service';
import { Processor } from './entities/processor.entity';
import { DeviceStatus } from './entities/device-status.entity';
import { NetworkType } from './entities/network-type.entity';
import { BatteryHealth } from './entities/battery-health.entity';
import { Ssid } from './entities/ssid.entity';
import { TemperatureReading } from './entities/temperature-reading.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Processor,
      DeviceStatus,
      NetworkType,
      BatteryHealth,
      Ssid,
      TemperatureReading,
    ]),
  ],
  controllers: [ProcessorController],
  providers: [ProcessorService, CacheService],
})
export class ProcessorModule {}
