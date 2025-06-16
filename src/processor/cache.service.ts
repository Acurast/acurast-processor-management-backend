import { Injectable } from '@nestjs/common';
import { Processor } from './entities/processor.entity';
import { DeviceStatus } from './entities/device-status.entity';
import { NetworkType } from './entities/network-type.entity';
import { BatteryHealth } from './entities/battery-health.entity';
import { Ssid } from './entities/ssid.entity';
import { LRUCache } from 'mnemonist';

const DEBUG = false;

class CacheWrapper<T> {
  constructor(
    private readonly name: string,
    private cache: LRUCache<string, T>,
    private getKey: (item: T) => string,
  ) {}

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (DEBUG) {
      if (value === undefined) {
        console.debug(`Cache MISS for ${this.name} key: ${key}`);
      } else {
        console.debug(`Cache HIT for ${this.name} key: ${key}`);
      }
    }
    return value;
  }

  set(item: T): void {
    const key = this.getKey(item);
    const existing = this.cache.has(key);
    this.cache.set(key, item);
    if (DEBUG) {
      console.debug(
        `Cache ${existing ? 'UPDATE' : 'INSERT'} for ${this.name} key: ${key}`,
      );
    }
  }

  has(key: string): boolean {
    const exists = this.cache.has(key);
    if (DEBUG) {
      console.debug(
        `Cache ${exists ? 'HIT' : 'MISS'} check for ${this.name} key: ${key}`,
      );
    }
    return exists;
  }

  get size(): number {
    return this.cache.size;
  }

  get capacity(): number {
    return this.cache.capacity;
  }

  entries(): [string, T][] {
    return Array.from(this.cache.entries());
  }

  toObject(): Record<string, T> {
    return Object.fromEntries(this.entries());
  }
}

@Injectable()
export class CacheService {
  private readonly STATUS_CACHE_SIZE = 20000;
  private readonly NORMAL_CACHE_SIZE = 5000;

  private processorCache: CacheWrapper<Processor>;
  private processorStatusCache: CacheWrapper<DeviceStatus>;
  private networkTypeCache: CacheWrapper<NetworkType>;
  private batteryHealthCache: CacheWrapper<BatteryHealth>;
  private ssidCache: CacheWrapper<Ssid>;

  constructor() {
    this.processorCache = new CacheWrapper(
      'Processor',
      new LRUCache<string, Processor>(this.STATUS_CACHE_SIZE),
      (processor) => processor.address,
    );

    this.processorStatusCache = new CacheWrapper(
      'ProcessorStatus',
      new LRUCache<string, DeviceStatus>(this.STATUS_CACHE_SIZE),
      (status) => status.processor.address,
    );

    this.networkTypeCache = new CacheWrapper(
      'NetworkType',
      new LRUCache<string, NetworkType>(this.NORMAL_CACHE_SIZE),
      (type) => type.type,
    );

    this.batteryHealthCache = new CacheWrapper(
      'BatteryHealth',
      new LRUCache<string, BatteryHealth>(this.NORMAL_CACHE_SIZE),
      (health) => health.state,
    );

    this.ssidCache = new CacheWrapper(
      'Ssid',
      new LRUCache<string, Ssid>(this.NORMAL_CACHE_SIZE),
      (ssid) => ssid.name,
    );
  }

  // Cache size getters
  getProcessorStatusCacheSize(): number {
    return this.processorStatusCache.size;
  }

  getProcessorCacheSize(): number {
    return this.processorCache.size;
  }

  getNetworkTypeCacheSize(): number {
    return this.networkTypeCache.size;
  }

  getBatteryHealthCacheSize(): number {
    return this.batteryHealthCache.size;
  }

  getSsidCacheSize(): number {
    return this.ssidCache.size;
  }

  // Cache capacity getters
  getProcessorStatusCacheCapacity(): number {
    return this.processorStatusCache.capacity;
  }

  getProcessorCacheCapacity(): number {
    return this.processorCache.capacity;
  }

  getNetworkTypeCacheCapacity(): number {
    return this.networkTypeCache.capacity;
  }

  getBatteryHealthCacheCapacity(): number {
    return this.batteryHealthCache.capacity;
  }

  getSsidCacheCapacity(): number {
    return this.ssidCache.capacity;
  }

  // Processor cache methods
  getProcessor(address: string): Processor | undefined {
    return this.processorCache.get(address);
  }

  setProcessor(processor: Processor): void {
    this.processorCache.set(processor);
  }

  // ProcessorStatus cache methods
  getProcessorStatus(address: string): DeviceStatus | undefined {
    return this.processorStatusCache.get(address);
  }

  setProcessorStatus(status: DeviceStatus): void {
    const existingStatus = this.getProcessorStatus(status.processor.address);
    if (!existingStatus || status.timestamp > existingStatus.timestamp) {
      this.processorStatusCache.set(status);
    }
  }

  hasProcessorStatus(address: string): boolean {
    return this.processorStatusCache.has(address);
  }

  // Helper method to check if device status exists and is newer than the given timestamp
  hasNewerProcessorStatus(address: string, timestamp: number): boolean {
    const existingStatus = this.getProcessorStatus(address);
    return (
      existingStatus !== undefined && existingStatus.timestamp >= timestamp
    );
  }

  // Helper method to get latest device status by address
  getLatestProcessorStatus(address: string): DeviceStatus | undefined {
    return this.getProcessorStatus(address);
  }

  // NetworkType cache methods
  getNetworkType(type: string): NetworkType | undefined {
    return this.networkTypeCache.get(type);
  }

  setNetworkType(networkType: NetworkType): void {
    this.networkTypeCache.set(networkType);
  }

  // BatteryHealth cache methods
  getBatteryHealth(state: string): BatteryHealth | undefined {
    return this.batteryHealthCache.get(state);
  }

  setBatteryHealth(batteryHealth: BatteryHealth): void {
    this.batteryHealthCache.set(batteryHealth);
  }

  // SSID cache methods
  getSsid(name: string): Ssid | undefined {
    return this.ssidCache.get(name);
  }

  setSsid(ssid: Ssid): void {
    this.ssidCache.set(ssid);
  }

  printCacheSizes(): void {
    console.log(`Processor cache size: \t${this.processorCache.size}`);
    console.log(
      `ProcessorStatus cache size: \t${this.processorStatusCache.size}`,
    );
    console.log(`NetworkType cache size: \t${this.networkTypeCache.size}`);
    console.log(`BatteryHealth cache size: \t${this.batteryHealthCache.size}`);
    console.log(`Ssid cache size: \t\t${this.ssidCache.size}`);
  }

  // Cache contents getters
  getProcessorCacheContents(): Record<string, Processor> {
    return this.processorCache.toObject();
  }

  getProcessorStatusCacheContents(): Record<string, DeviceStatus> {
    return this.processorStatusCache.toObject();
  }

  getNetworkTypeCacheContents(): Record<string, NetworkType> {
    return this.networkTypeCache.toObject();
  }

  getBatteryHealthCacheContents(): Record<string, BatteryHealth> {
    return this.batteryHealthCache.toObject();
  }

  getSsidCacheContents(): Record<string, Ssid> {
    return this.ssidCache.toObject();
  }
}
