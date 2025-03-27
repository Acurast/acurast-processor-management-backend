import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessorController } from './processor.controller';
import { ProcessorService } from './processor.service';
import { CacheService } from './cache.service';
import { BatchService } from './batch.service';
import { DeviceStatus } from './entities/device-status.entity';
import { Processor } from './entities/processor.entity';
import { NetworkType } from './entities/network-type.entity';
import { BatteryHealth } from './entities/battery-health.entity';
import { Ssid } from './entities/ssid.entity';
import { TemperatureReading } from './entities/temperature-reading.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceStatus,
      Processor,
      NetworkType,
      BatteryHealth,
      Ssid,
      TemperatureReading,
    ]),
  ],
  controllers: [ProcessorController],
  providers: [ProcessorService, CacheService, BatchService],
})
export class ProcessorModule {}
