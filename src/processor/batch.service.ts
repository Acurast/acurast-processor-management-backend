import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CheckInRequest } from './processor.controller';
import { Processor } from './entities/processor.entity';
import { NetworkType } from './entities/network-type.entity';
import { BatteryHealth } from './entities/battery-health.entity';
import { Ssid } from './entities/ssid.entity';
import { DeviceStatus } from './entities/device-status.entity';
import {
  TemperatureReading,
  TemperatureType,
} from './entities/temperature-reading.entity';
import { CacheService } from './cache.service';

@Injectable()
export class BatchService implements OnModuleInit, OnModuleDestroy {
  private readonly BATCH_SIZE = 1000; // Process 1000 check-ins at a time
  private readonly BATCH_INTERVAL = 50; // Process batch every 50ms
  private checkInQueue: CheckInRequest[] = [];
  private processing = false;
  private timer: NodeJS.Timeout;

  constructor(
    private dataSource: DataSource,
    private cacheService: CacheService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processBatch();
    }, this.BATCH_INTERVAL);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async addToBatch(checkIn: CheckInRequest): Promise<void> {
    this.checkInQueue.push(checkIn);
    if (this.checkInQueue.length >= this.BATCH_SIZE) {
      await this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.checkInQueue.length === 0) return;

    this.processing = true;
    const batch = this.checkInQueue.splice(0, this.BATCH_SIZE);

    try {
      await this.dataSource.transaction(async (manager) => {
        // Group check-ins by processor address
        const processorGroups = this.groupByProcessor(batch);

        // Process each processor's check-ins
        for (const [address, checkIns] of processorGroups.entries()) {
          await this.processProcessorCheckIns(manager, address, checkIns);
        }
      });
    } finally {
      this.processing = false;
    }
  }

  private groupByProcessor(
    checkIns: CheckInRequest[],
  ): Map<string, CheckInRequest[]> {
    return checkIns.reduce((groups, checkIn) => {
      const group = groups.get(checkIn.deviceAddress) || [];
      group.push(checkIn);
      groups.set(checkIn.deviceAddress, group);
      return groups;
    }, new Map<string, CheckInRequest[]>());
  }

  private async processProcessorCheckIns(
    manager: EntityManager,
    address: string,
    checkIns: CheckInRequest[],
  ): Promise<void> {
    // Get or create processor
    const processor = await this.getOrCreateProcessor(manager, address);

    // Process each check-in
    for (const checkIn of checkIns) {
      const [networkType, ssid, batteryHealth] = await Promise.all([
        this.getOrCreateNetworkType(manager, checkIn.networkType),
        this.getOrCreateSsid(manager, checkIn.ssid),
        this.getOrCreateBatteryHealth(manager, checkIn.batteryHealth),
      ]);

      // Create device status
      const deviceStatus = manager.create(DeviceStatus, {
        processor,
        timestamp: checkIn.timestamp,
        batteryLevel: checkIn.batteryLevel,
        isCharging: checkIn.isCharging,
        batteryHealth: batteryHealth || undefined,
        networkType,
        ssid,
        signature: checkIn.signature,
      });
      const savedDeviceStatus = await manager.save(deviceStatus);

      // Create temperature readings if provided
      if (checkIn.temperature) {
        const temperatureReadings = Object.entries(checkIn.temperature)
          .filter(([, value]) => value !== undefined)
          .map(([type, value]) =>
            manager.create(TemperatureReading, {
              deviceStatus: savedDeviceStatus,
              type: type as TemperatureType,
              value,
            }),
          );
        await manager.save(temperatureReadings);
      }

      // Load the complete device status with all relations
      const completeDeviceStatus = await manager.findOne(DeviceStatus, {
        where: { id: savedDeviceStatus.id },
        relations: [
          'processor',
          'networkType',
          'ssid',
          'batteryHealth',
          'temperatureReadings',
        ],
      });

      // Update cache with the complete device status
      if (completeDeviceStatus) {
        this.cacheService.setDeviceStatus(address, completeDeviceStatus);
      }
    }
  }

  private async getOrCreateProcessor(
    manager: EntityManager,
    address: string,
  ): Promise<Processor> {
    // Check cache first
    const cached = this.cacheService.getProcessor(address);
    if (cached) {
      return cached;
    }

    let processor = await manager.findOne(Processor, {
      where: { address },
    });
    if (!processor) {
      processor = manager.create(Processor, { address });
      processor = await manager.save(processor);
    }
    // Update cache with the processor
    this.cacheService.setProcessor(processor);
    return processor;
  }

  private async getOrCreateNetworkType(
    manager: EntityManager,
    type: 'wifi' | 'cellular' | 'usb',
  ): Promise<NetworkType> {
    // Check cache first
    const cached = this.cacheService.getNetworkType(type);
    if (cached) {
      return cached;
    }

    let networkType = await manager.findOne(NetworkType, {
      where: { type },
    });
    if (!networkType) {
      networkType = manager.create(NetworkType, { type });
      networkType = await manager.save(networkType);
    }
    // Update cache with the network type
    this.cacheService.setNetworkType(networkType.type, networkType);
    return networkType;
  }

  private async getOrCreateSsid(
    manager: EntityManager,
    name: string,
  ): Promise<Ssid> {
    // Check cache first
    const cached = this.cacheService.getSsid(name);
    if (cached) {
      return cached;
    }

    let ssid = await manager.findOne(Ssid, {
      where: { name },
    });
    if (!ssid) {
      ssid = manager.create(Ssid, { name });
      ssid = await manager.save(ssid);
    }
    // Update cache with the SSID
    this.cacheService.setSsid(ssid.name, ssid);
    return ssid;
  }

  private async getOrCreateBatteryHealth(
    manager: EntityManager,
    state: 'good' | 'bad' | 'critical' | undefined,
  ): Promise<BatteryHealth | null> {
    if (!state) return null;

    // Check cache first
    const cached = this.cacheService.getBatteryHealth(state);
    if (cached) {
      return cached;
    }

    let batteryHealth = await manager.findOne(BatteryHealth, {
      where: { state },
    });
    if (!batteryHealth) {
      batteryHealth = manager.create(BatteryHealth, { state });
      batteryHealth = await manager.save(batteryHealth);
    }
    // Update cache with the battery health
    this.cacheService.setBatteryHealth(batteryHealth.state, batteryHealth);
    return batteryHealth;
  }
}
