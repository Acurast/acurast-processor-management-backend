import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
  QueryFailedError,
} from 'typeorm';
import {
  CheckInRequest,
  CheckInResponse,
  StatusResponse,
  HistoryResponse,
  ListResponse,
  ProcessorListItem,
  BulkStatusResponse,
  type StatusesResponse,
} from './types';
import { ProcessorStatusDto } from './dto/device-status.dto';
import { DeviceStatus } from './entities/device-status.entity';
import { Processor } from './entities/processor.entity';
import { NetworkType } from './entities/network-type.entity';
import { BatteryHealth } from './entities/battery-health.entity';
import { Ssid } from './entities/ssid.entity';
import { TemperatureReading } from './entities/temperature-reading.entity';
import { CacheService } from './cache.service';
import { SignatureService } from './signature.service';
import { NetworkTypeEnum, type BatteryHealthState } from './enums';
import { ManagerService } from './manager.service';
import { Manager } from './entities/manager.entity';

@Injectable()
export class ProcessorService {
  private readonly BATCH_SIZE = 1000; // Process 1000 check-ins at a time
  private readonly BATCH_INTERVAL = 50; // Process batch every 50ms
  private checkInQueue: CheckInRequest[] = [];
  private processing = false;
  private timer: NodeJS.Timeout;

  constructor(
    @InjectRepository(DeviceStatus)
    private processorStatusRepository: Repository<DeviceStatus>,
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
    @InjectRepository(Manager)
    private managerRepository: Repository<Manager>,
    private dataSource: DataSource,
    public cacheService: CacheService,
    private signatureService: SignatureService,
    private managerService: ManagerService,
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
    this.cacheService.setNetworkType(networkType);
    return networkType;
  }

  private async getOrCreateSsid(
    manager: EntityManager,
    ssidName: string | undefined,
  ): Promise<Ssid | undefined> {
    if (!ssidName) {
      return undefined;
    }

    const cached = this.cacheService.getSsid(ssidName);
    if (cached) {
      return cached;
    }

    const ssid = await manager.findOne(Ssid, {
      where: { name: ssidName },
    });

    if (ssid) {
      this.cacheService.setSsid(ssid);
      return ssid;
    }

    const newSsid = manager.create(Ssid, { name: ssidName });
    await manager.save(newSsid);
    this.cacheService.setSsid(newSsid);
    return newSsid;
  }

  private async getOrCreateBatteryHealth(
    manager: EntityManager,
    state: BatteryHealthState | undefined,
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
    this.cacheService.setBatteryHealth(batteryHealth);
    return batteryHealth;
  }

  private transformToDto(deviceStatus: DeviceStatus): ProcessorStatusDto {
    const temperatures: ProcessorStatusDto['temperatures'] = {
      battery: undefined,
      ambient: undefined,
      forecast: undefined,
    };

    deviceStatus.temperatureReadings?.forEach((reading) => {
      const type = reading.type.toLowerCase() as keyof typeof temperatures;
      if (type in temperatures) {
        temperatures[type] = reading.value;
      }
    });

    return {
      address: deviceStatus.processor.address,
      timestamp: deviceStatus.timestamp,
      batteryLevel: deviceStatus.batteryLevel,
      isCharging: deviceStatus.isCharging,
      batteryHealth: deviceStatus.batteryHealth?.state,
      networkType: deviceStatus.networkType.type as NetworkTypeEnum,
      temperatures,
      ssid: deviceStatus.ssid?.name,
    };
  }

  async handleCheckIn(
    checkInRequest: CheckInRequest,
    signature: string,
  ): Promise<CheckInResponse> {
    // Verify the signature first
    const isValid = await this.signatureService.verifySignature(
      checkInRequest,
      signature,
    );
    if (!isValid) {
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }

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
      try {
        // Check for duplicate in cache first
        if (
          this.cacheService.hasNewerProcessorStatus(address, checkIn.timestamp)
        ) {
          console.warn(
            'Duplicate or newer report detected in cache',
            address,
            checkIn.timestamp,
          );
          continue;
        }

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
        });

        // Save to database
        const savedDeviceStatus = await manager.save(deviceStatus);

        // Create temperature readings if provided
        if (checkIn.temperatures) {
          const temperatureReadings = Object.entries(checkIn.temperatures)
            .filter(([type, value]) => {
              // Only include valid temperature types
              const validTypes = ['battery', 'cpu', 'gpu', 'ambient'] as const;
              return (
                value !== undefined &&
                validTypes.includes(type as (typeof validTypes)[number])
              );
            })
            .map(([type, value]) =>
              manager.create(TemperatureReading, {
                deviceStatus: savedDeviceStatus,
                type: type as 'battery' | 'cpu' | 'gpu' | 'ambient',
                value: value as number,
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
          this.cacheService.setProcessorStatus(completeDeviceStatus);
        }
      } catch (error) {
        // Handle unique constraint error for duplicate reports (fallback)
        if (
          error instanceof QueryFailedError &&
          (error.driverError as { code?: string })?.code === '23505' &&
          error.message.includes(
            'duplicate key value violates unique constraint',
          )
        ) {
          console.warn(
            'Duplicate report detected in database',
            address,
            checkIn.timestamp,
          );
          continue;
        }
        // Re-throw other errors
        throw error;
      }
    }
  }

  async getProcessorStatus(processorAddress: string): Promise<StatusResponse> {
    // Check cache first
    const cached = this.cacheService.getLatestProcessorStatus(processorAddress);
    if (cached) {
      return { processorStatus: this.transformToDto(cached) };
    }

    const latestStatus = await this.processorStatusRepository
      .createQueryBuilder('status')
      .innerJoinAndSelect('status.processor', 'processor')
      .where('processor.address = :address', { address: processorAddress })
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
    this.cacheService.setProcessorStatus(latestStatus);

    return { processorStatus: this.transformToDto(latestStatus) };
  }

  async getDeviceHistory(
    processorAddress: string,
    limit: number,
  ): Promise<HistoryResponse> {
    // Get from database since we only cache the latest status
    const history = await this.processorStatusRepository.find({
      where: { processor: { address: processorAddress } },
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

    // Update cache with the latest status
    if (history.length > 0) {
      this.cacheService.setProcessorStatus(history[0]);
    }

    return {
      history: history.map((status) => this.transformToDto(status)),
    };
  }

  async getAllLatestProcessorStatuses(): Promise<StatusesResponse> {
    const processorStatuses = await this.processorStatusRepository
      .createQueryBuilder('status')
      .innerJoinAndSelect('status.processor', 'processor')
      .leftJoinAndSelect('status.networkType', 'networkType')
      .leftJoinAndSelect('status.ssid', 'ssid')
      .leftJoinAndSelect('status.batteryHealth', 'batteryHealth')
      .leftJoinAndSelect('status.temperatureReadings', 'temperatureReadings')
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .select('MAX(s2.timestamp)')
          .from(DeviceStatus, 's2')
          .innerJoin('s2.processor', 'p2')
          .where('p2.address = processor.address')
          .getQuery();
        return 'status.timestamp = ' + subQuery;
      })
      .orderBy('status.timestamp', 'DESC')
      .getMany();

    return {
      processorStatuses: processorStatuses.map((status) =>
        this.transformToDto(status),
      ),
    };
  }

  async getProcessorList(): Promise<ListResponse> {
    // Get all processors with their latest status
    const processors = await this.processorRepository
      .createQueryBuilder('processor')
      .leftJoinAndSelect('processor.statuses', 'status')
      .orderBy('status.timestamp', 'DESC')
      .getMany();

    // Transform the data to include only the latest status for each processor
    const devices: ProcessorListItem[] = processors.map((processor) => {
      const latestStatus = processor.statuses[0];
      return {
        address: processor.address,
        lastSeen: latestStatus?.timestamp || 0,
        batteryLevel: latestStatus?.batteryLevel || 0,
        isCharging: latestStatus?.isCharging || false,
        networkType: (latestStatus?.networkType?.type ||
          NetworkTypeEnum.UNKNOWN) as NetworkTypeEnum,
        ssid: latestStatus?.ssid?.name || 'unknown',
      };
    });

    return { devices };
  }

  async getBulkProcessorStatus(
    addresses: string[],
  ): Promise<BulkStatusResponse> {
    // Remove duplicates and empty addresses
    const uniqueAddresses = [...new Set(addresses)].filter(Boolean);

    if (uniqueAddresses.length === 0) {
      return { processorStatuses: {} };
    }

    // Get statuses from cache first
    const cachedStatuses = uniqueAddresses
      .map((address) => this.cacheService.getProcessorStatus(address))
      .filter((status): status is DeviceStatus => status !== undefined);

    // Find addresses that weren't in cache
    const uncachedAddresses = uniqueAddresses.filter(
      (address) => !this.cacheService.getProcessorStatus(address),
    );

    let uncachedStatuses: DeviceStatus[] = [];
    if (uncachedAddresses.length > 0) {
      // Query database for uncached statuses - only get latest status for each device
      uncachedStatuses = await this.processorStatusRepository
        .createQueryBuilder('status')
        .innerJoinAndSelect('status.processor', 'processor')
        .leftJoinAndSelect('status.networkType', 'networkType')
        .leftJoinAndSelect('status.ssid', 'ssid')
        .leftJoinAndSelect('status.batteryHealth', 'batteryHealth')
        .leftJoinAndSelect('status.temperatureReadings', 'temperatureReadings')
        .where('processor.address IN (:...addresses)', {
          addresses: uncachedAddresses,
        })
        .andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('MAX(s2.timestamp)')
            .from(DeviceStatus, 's2')
            .innerJoin('s2.processor', 'p2')
            .where('p2.address = processor.address')
            .getQuery();
          return 'status.timestamp = ' + subQuery;
        })
        .getMany();

      // Update cache with new statuses
      uncachedStatuses.forEach((status) => {
        this.cacheService.setProcessorStatus(status);
      });
    }

    // Combine cached and uncached statuses
    const allStatuses = [...cachedStatuses, ...uncachedStatuses];

    // Transform to DTOs and create a Record
    const statusMap: Record<string, ProcessorStatusDto> = {};
    allStatuses.forEach((status) => {
      statusMap[status.processor.address] = this.transformToDto(status);
    });

    return { processorStatuses: statusMap };
  }

  async getProcessorsByManagerAddress(
    managerAddress: string,
  ): Promise<string[]> {
    // If manager exists and is stale (> 24h), refresh from chain first
    const existingManager = await this.managerRepository.findOne({
      where: { address: managerAddress },
    });
    if (existingManager) {
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const lastUpdatedMs = existingManager.lastUpdated
        ? new Date(existingManager.lastUpdated).getTime()
        : 0;
      if (Date.now() - lastUpdatedMs > ONE_DAY_MS) {
        return this.managerService.populateManagerAndProcessorsByAddress(
          managerAddress,
        );
      }
    }

    const rows = await this.processorRepository
      .createQueryBuilder('processor')
      .innerJoin('processor.manager', 'manager', 'manager.address = :address', {
        address: managerAddress,
      })
      .select('processor.address', 'address')
      .getRawMany<{ address: string }>();

    if (rows.length > 0) {
      return rows.map((r) => r.address);
    }

    // Populate from chain if not found locally
    return this.managerService.populateManagerAndProcessorsByAddress(
      managerAddress,
    );
  }
}
