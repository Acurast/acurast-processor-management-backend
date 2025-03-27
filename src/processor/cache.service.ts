import { Injectable } from '@nestjs/common';
import { Processor } from './entities/processor.entity';
import { NetworkType } from './entities/network-type.entity';
import { BatteryHealth } from './entities/battery-health.entity';
import { Ssid } from './entities/ssid.entity';
import { DeviceStatus } from './entities/device-status.entity';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

@Injectable()
export class CacheService {
  private processorCache = new Map<string, CacheEntry<Processor>>();
  private networkTypeCache = new Map<string, CacheEntry<NetworkType>>();
  private batteryHealthCache = new Map<string, CacheEntry<BatteryHealth>>();
  private ssidCache = new Map<string, CacheEntry<Ssid>>();
  private deviceStatusCache = new Map<string, CacheEntry<DeviceStatus>>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  // Processor cache
  getProcessor(address: string): Processor | undefined {
    return this.processorCache.get(address)?.value;
  }

  setProcessor(processor: Processor): void {
    this.processorCache.set(processor.address, {
      value: processor,
      timestamp: Date.now(),
    });
  }

  // NetworkType cache
  getNetworkType(type: string): NetworkType | undefined {
    return this.networkTypeCache.get(type)?.value;
  }

  setNetworkType(networkType: NetworkType): void {
    this.networkTypeCache.set(networkType.type, {
      value: networkType,
      timestamp: Date.now(),
    });
  }

  // BatteryHealth cache
  getBatteryHealth(state: string): BatteryHealth | undefined {
    return this.batteryHealthCache.get(state)?.value;
  }

  setBatteryHealth(batteryHealth: BatteryHealth): void {
    this.batteryHealthCache.set(batteryHealth.state, {
      value: batteryHealth,
      timestamp: Date.now(),
    });
  }

  // SSID cache
  getSsid(name: string): Ssid | undefined {
    return this.ssidCache.get(name)?.value;
  }

  setSsid(ssid: Ssid): void {
    this.ssidCache.set(ssid.name, {
      value: ssid,
      timestamp: Date.now(),
    });
  }

  // DeviceStatus cache
  getDeviceStatus(processorAddress: string): DeviceStatus | undefined {
    return this.deviceStatusCache.get(processorAddress)?.value;
  }

  setDeviceStatus(processorAddress: string, status: DeviceStatus): void {
    this.deviceStatusCache.set(processorAddress, {
      value: status,
      timestamp: Date.now(),
    });
  }

  private clearExpiredCache<T>(cache: Map<string, CacheEntry<T>>): void {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        cache.delete(key);
      }
    }
  }

  // Clear expired cache entries
  clearExpired(): void {
    this.clearExpiredCache(this.processorCache);
    this.clearExpiredCache(this.networkTypeCache);
    this.clearExpiredCache(this.batteryHealthCache);
    this.clearExpiredCache(this.ssidCache);
    this.clearExpiredCache(this.deviceStatusCache);
  }
}
