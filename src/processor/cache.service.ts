import { Injectable } from '@nestjs/common';
import { Processor } from './entities/processor.entity';
import { DeviceStatus } from './entities/device-status.entity';
import { NetworkType } from './entities/network-type.entity';
import { BatteryHealth } from './entities/battery-health.entity';
import { Ssid } from './entities/ssid.entity';
import { LRUCache } from 'mnemonist';

@Injectable()
export class CacheService {
  private readonly MAX_STATUS_CACHE_SIZE = 20000;
  private readonly MAX_NORMAL_CACHE_SIZE = 5000;

  private processorCache = new LRUCache<string, Processor>(
    this.MAX_STATUS_CACHE_SIZE,
  );
  private deviceStatusCache = new LRUCache<string, DeviceStatus>(
    this.MAX_STATUS_CACHE_SIZE,
  );
  private networkTypeCache = new LRUCache<string, NetworkType>(
    this.MAX_NORMAL_CACHE_SIZE,
  );
  private batteryHealthCache = new LRUCache<string, BatteryHealth>(
    this.MAX_NORMAL_CACHE_SIZE,
  );
  private ssidCache = new LRUCache<string, Ssid>(this.MAX_NORMAL_CACHE_SIZE);

  // Processor cache methods
  getProcessor(address: string): Processor | undefined {
    return this.processorCache.get(address);
  }

  setProcessor(processor: Processor): void {
    this.processorCache.set(processor.address, processor);
  }

  // DeviceStatus cache methods
  getDeviceStatus(processorAddress: string): DeviceStatus | undefined {
    return this.deviceStatusCache.get(processorAddress);
  }

  setDeviceStatus(processorAddress: string, status: DeviceStatus): void {
    this.deviceStatusCache.set(processorAddress, status);
  }

  // NetworkType cache methods
  getNetworkType(type: string): NetworkType | undefined {
    return this.networkTypeCache.get(type);
  }

  setNetworkType(type: string, networkType: NetworkType): void {
    this.networkTypeCache.set(type, networkType);
  }

  // BatteryHealth cache methods
  getBatteryHealth(state: string): BatteryHealth | undefined {
    return this.batteryHealthCache.get(state);
  }

  setBatteryHealth(state: string, batteryHealth: BatteryHealth): void {
    this.batteryHealthCache.set(state, batteryHealth);
  }

  // SSID cache methods
  getSsid(name: string): Ssid | undefined {
    return this.ssidCache.get(name);
  }

  setSsid(name: string, ssid: Ssid): void {
    this.ssidCache.set(name, ssid);
  }

  printCacheSizes(): void {
    console.log(`Processor cache size: \t${this.processorCache.size}`);
    console.log(`DeviceStatus cache size: \t${this.deviceStatusCache.size}`);
    console.log(`NetworkType cache size: \t${this.networkTypeCache.size}`);
    console.log(`BatteryHealth cache size: \t${this.batteryHealthCache.size}`);
    console.log(`Ssid cache size: \t\t${this.ssidCache.size}`);
  }
}
