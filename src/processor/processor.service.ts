import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import {
  CheckInRequest,
  CheckInResponse,
  StatusResponse,
  HistoryResponse,
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
        processor: { id: processor.id } as DeepPartial<Processor>,
        timestamp: checkInRequest.timestamp,
        batteryLevel: checkInRequest.batteryLevel,
        isCharging: checkInRequest.isCharging,
        batteryHealth: batteryHealth
          ? ({ id: batteryHealth.id } as DeepPartial<BatteryHealth>)
          : undefined,
        networkType: networkType
          ? ({ id: networkType.id } as DeepPartial<NetworkType>)
          : undefined,
        ssid: ssid ? ({ id: ssid.id } as DeepPartial<Ssid>) : undefined,
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
    return {
      deviceStatus: (await this.getDeviceHistory(deviceAddress, 1)).history[0],
    };
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
      history: history.map(() => ({
        success: true,
      })),
    };
  }
}
