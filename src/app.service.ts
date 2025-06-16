import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { DeviceStatus } from './processor/entities/device-status.entity';
import { Processor } from './processor/entities/processor.entity';

interface StatsCache {
  totalCheckIns: number;
  totalProcessors: number;
  lastHourCheckIns: number;
  last24HoursCheckIns: number;
  timestamp: number;
}

@Injectable()
export class AppService {
  private statsCache: StatsCache | null = null;
  private readonly CACHE_TTL = 1; // 1ms

  constructor(
    @InjectRepository(DeviceStatus)
    private deviceStatusRepository: Repository<DeviceStatus>,
    @InjectRepository(Processor)
    private processorRepository: Repository<Processor>,
  ) {}

  async getStats(): Promise<StatsCache> {
    const now = Date.now();

    // Return cached stats if they're still valid
    if (this.statsCache && now - this.statsCache.timestamp < this.CACHE_TTL) {
      return this.statsCache;
    }

    // Calculate new stats
    const [
      totalCheckIns,
      totalProcessors,
      lastHourCheckIns,
      last24HoursCheckIns,
    ] = await Promise.all([
      this.deviceStatusRepository.count(),
      this.processorRepository.count(),
      this.deviceStatusRepository.count({
        where: {
          timestamp: MoreThan(now - 60 * 60 * 1000), // Last hour
        },
      }),
      this.deviceStatusRepository.count({
        where: {
          timestamp: MoreThan(now - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      }),
    ]);

    // Update cache
    this.statsCache = {
      totalCheckIns,
      totalProcessors,
      lastHourCheckIns,
      last24HoursCheckIns,
      timestamp: now,
    };

    return this.statsCache;
  }
}
