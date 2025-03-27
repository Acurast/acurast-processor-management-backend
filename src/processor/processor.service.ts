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
import { DeepPartial } from 'typeorm';
import { CacheService } from './cache.service';

@Injectable()
export class ProcessorService {
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
  ) {}

  private async getOrCreateProcessor(
    manager: EntityManager,
    address: string,
  ): Promise<Processor> {
    let processor = await manager.findOne(Processor, {
      where: { address },
    });
    if (!processor) {
      processor = manager.create(Processor, { address });
      processor = await manager.save(processor);
    }
    return processor;
  }

  private async getOrCreateNetworkType(
    manager: EntityManager,
    type: 'wifi' | 'cellular' | 'usb' | 'offline',
  ): Promise<NetworkType> {
    let networkType = await manager.findOne(NetworkType, {
      where: { type },
    });
    if (!networkType) {
      networkType = manager.create(NetworkType, { type });
      networkType = await manager.save(networkType);
    }
    return networkType;
  }

  private async getOrCreateSsid(
    manager: EntityManager,
    name: string,
  ): Promise<Ssid> {
    let ssid = await manager.findOne(Ssid, {
      where: { name },
    });
    if (!ssid) {
      ssid = manager.create(Ssid, { name });
      ssid = await manager.save(ssid);
    }
    return ssid;
  }

  private async getOrCreateBatteryHealth(
    manager: EntityManager,
    state: 'good' | 'bad' | 'critical' | undefined,
  ): Promise<BatteryHealth | null> {
    if (!state) return null;

    let batteryHealth = await manager.findOne(BatteryHealth, {
      where: { state },
    });
    if (!batteryHealth) {
      batteryHealth = manager.create(BatteryHealth, { state });
      batteryHealth = await manager.save(batteryHealth);
    }
    return batteryHealth;
  }

  async handleCheckIn(
    checkInRequest: CheckInRequest,
  ): Promise<CheckInResponse> {
    // TODO: Implement signature verification

    // Use a transaction to ensure data consistency
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const [processor, networkType, ssid, batteryHealth] = await Promise.all([
        this.getOrCreateProcessor(
          transactionalEntityManager,
          checkInRequest.deviceAddress,
        ),
        this.getOrCreateNetworkType(
          transactionalEntityManager,
          checkInRequest.networkType,
        ),
        this.getOrCreateSsid(transactionalEntityManager, checkInRequest.ssid),
        this.getOrCreateBatteryHealth(
          transactionalEntityManager,
          checkInRequest.batteryHealth,
        ),
      ]);

      // Create device status
      const deviceStatus = transactionalEntityManager.create(DeviceStatus, {
        processor,
        timestamp: checkInRequest.timestamp,
        batteryLevel: checkInRequest.batteryLevel,
        isCharging: checkInRequest.isCharging,
        batteryHealth: batteryHealth || undefined,
        networkType,
        ssid,
        signature: checkInRequest.signature,
      } as DeepPartial<DeviceStatus>);
      await transactionalEntityManager.save(deviceStatus);

      // Create temperature readings if provided
      if (checkInRequest.temperature) {
        const temperatureReadings = Object.entries(checkInRequest.temperature)
          .filter(([, value]) => value !== undefined)
          .map(([type, value]) =>
            transactionalEntityManager.create(TemperatureReading, {
              deviceStatus,
              type: type as TemperatureType,
              value,
            }),
          );
        await transactionalEntityManager.save(temperatureReadings);
      }

      return {
        success: true,
      };
    });
  }

  async getDeviceStatus(deviceAddress: string): Promise<StatusResponse> {
    // Check cache first
    const cached = this.cacheService.getDeviceStatus(deviceAddress);
    if (cached) {
      return { deviceStatus: cached };
    }

    const latestStatus = await this.deviceStatusRepository
      .createQueryBuilder('status')
      .innerJoin('status.processor', 'processor')
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

    return { deviceStatus: latestStatus };
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
      history,
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
      history,
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
