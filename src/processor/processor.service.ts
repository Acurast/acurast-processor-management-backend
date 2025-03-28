import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import {
  CheckInRequest,
  CheckInResponse,
  StatusResponse,
  HistoryResponse,
  ListResponse,
} from './processor.controller';
import { DeviceStatus } from './entities/device-status.entity';
import { Processor } from './entities/processor.entity';
import { NetworkType } from './entities/network-type.entity';
import { BatteryHealth } from './entities/battery-health.entity';
import { Ssid } from './entities/ssid.entity';
import {
  TemperatureReading,
  TemperatureType,
} from './entities/temperature-reading.entity';
import { CacheService } from './cache.service';
import {
  DeviceStatusDto,
  NetworkTypeEnum as NetworkTypeEnum,
  BatteryHealthStateEnum,
  TemperatureType as TemperatureTypeEnum,
} from './types';

@Injectable()
export class ProcessorService {
  private readonly BATCH_SIZE = 1000; // Process 1000 check-ins at a time
  private readonly BATCH_INTERVAL = 50; // Process batch every 50ms
  private checkInQueue: CheckInRequest[] = [];
  private processing = false;
  private timer: NodeJS.Timeout;

  constructor(
    @InjectRepository(DeviceStatus)
    private deviceStatusRepository: Repository<DeviceStatus>,
    @InjectRepository(Processor)
    private processorRepository: Repository<Processor>,
    @InjectRepository(NetworkType)
    private networkTypeRepository: Repository<NetworkType>,
    @InjectRepository(BatteryHealth)
    private batteryHealthRepository: Repository<BatteryHealth>,
    @InjectRepository(Ssid)
    private ssidRepository: Repository<Ssid>,
    @InjectRepository(TemperatureReading)
    private temperatureReadingRepository: Repository<TemperatureReading>,
    private dataSource: DataSource,
    private cacheService: CacheService,
  ) {
    // Initialize batch processing
    this.timer = setInterval(() => {
      void this.processBatch();
    }, this.BATCH_INTERVAL);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
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
    type: NetworkTypeEnum,
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
    state: BatteryHealthStateEnum | undefined,
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

  private transformToDto(deviceStatus: DeviceStatus): DeviceStatusDto {
    const temperature: DeviceStatusDto['temperature'] = {
      battery: undefined,
      cpu: undefined,
      gpu: undefined,
      ambient: undefined,
    };

    deviceStatus.temperatureReadings?.forEach((reading) => {
      const type = reading.type.toLowerCase() as TemperatureTypeEnum;
      temperature[type] = reading.value;
    });

    return {
      address: deviceStatus.processor.address,
      timestamp: deviceStatus.timestamp,
      batteryLevel: deviceStatus.batteryLevel,
      isCharging: deviceStatus.isCharging,
      batteryHealth: deviceStatus.batteryHealth
        ?.state as BatteryHealthStateEnum,
      networkType: deviceStatus.networkType.type as NetworkTypeEnum,
      ssid: deviceStatus.ssid?.name,
      temperature,
    };
  }

  async handleCheckIn(
    checkInRequest: CheckInRequest,
  ): Promise<CheckInResponse> {
    // Add to batch queue
    this.checkInQueue.push(checkInRequest);
    if (this.checkInQueue.length >= this.BATCH_SIZE) {
      await this.processBatch();
    }
    return { success: true };
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

  async getDeviceStatus(deviceAddress: string): Promise<StatusResponse> {
    // Check cache first
    const cached = this.cacheService.getDeviceStatus(deviceAddress);
    if (cached) {
      return { deviceStatus: this.transformToDto(cached) };
    }

    const latestStatus = await this.deviceStatusRepository
      .createQueryBuilder('status')
      .innerJoinAndSelect('status.processor', 'processor')
      .where('processor.address = :address', { address: deviceAddress })
      .leftJoinAndSelect('status.networkType', 'networkType')
      .leftJoinAndSelect('status.ssid', 'ssid')
      .leftJoinAndSelect('status.batteryHealth', 'batteryHealth')
      .leftJoinAndSelect('status.temperatureReadings', 'temperatureReadings')
      .orderBy('status.timestamp', 'DESC')
      .take(1)
      .getOne();

    if (!latestStatus) {
      throw new NotFoundException('Device not found');
    }

    // Update cache
    this.cacheService.setDeviceStatus(deviceAddress, latestStatus);

    return { deviceStatus: this.transformToDto(latestStatus) };
  }

  async getDeviceHistory(
    deviceAddress: string,
    limit: number,
  ): Promise<HistoryResponse> {
    const history = await this.deviceStatusRepository.find({
      where: { processor: { address: deviceAddress } },
      order: { timestamp: 'DESC' },
      take: limit,
      relations: [
        'processor',
        'networkType',
        'ssid',
        'batteryHealth',
        'temperatureReadings',
      ],
    });

    if (!history.length) {
      throw new NotFoundException('Device not found');
    }

    return {
      history: history.map((status) => this.transformToDto(status)),
    };
  }

  async getAllDeviceStatuses(): Promise<HistoryResponse> {
    const history = await this.deviceStatusRepository.find({
      order: { timestamp: 'DESC' },
      relations: [
        'processor',
        'networkType',
        'ssid',
        'batteryHealth',
        'temperatureReadings',
      ],
    });

    return {
      history: history.map((status) => this.transformToDto(status)),
    };
  }

  async getDeviceList(): Promise<ListResponse> {
    // Get all processors with their latest status
    const processors = await this.processorRepository
      .createQueryBuilder('processor')
      .leftJoinAndSelect('processor.statuses', 'status')
      .orderBy('status.timestamp', 'DESC')
      .getMany();

    // Transform the data to include only the latest status for each processor
    const devices = processors.map((processor) => {
      const latestStatus = processor.statuses[0];
      return {
        address: processor.address,
        lastSeen: latestStatus?.timestamp || 0,
        batteryLevel: latestStatus?.batteryLevel || 0,
        isCharging: latestStatus?.isCharging || false,
        networkType: latestStatus?.networkType?.type || 'unknown',
        ssid: latestStatus?.ssid?.name || 'unknown',
      };
    });

    return { devices };
  }
}
