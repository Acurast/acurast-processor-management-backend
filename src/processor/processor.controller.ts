import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { BatchService } from './batch.service';
import { DeviceStatus } from './entities/device-status.entity';

export interface CheckInRequest {
  deviceAddress: string;
  timestamp: number;
  batteryLevel: number;
  isCharging: boolean;
  batteryHealth?: 'good' | 'bad' | 'critical';
  temperature?: {
    battery?: number;
    cpu?: number;
    gpu?: number;
    ambient?: number;
  };
  networkType: 'wifi' | 'cellular' | 'usb' | 'offline';
  ssid: string;
  signature: string;
}

export interface CheckInResponse {
  success: boolean;
}

export interface StatusResponse {
  deviceStatus: DeviceStatus;
}

export interface HistoryResponse {
  history: DeviceStatus[];
}

@Controller('processor')
export class ProcessorController {
  constructor(
    private readonly processorService: ProcessorService,
    private readonly batchService: BatchService,
  ) {}

  @Post('check-in')
  async checkIn(
    @Body() checkInRequest: CheckInRequest,
  ): Promise<CheckInResponse> {
    await this.batchService.addToBatch(checkInRequest);
    return { success: true };
  }

  @Get('devices/:deviceAddress/status')
  async getDeviceStatus(
    @Param('deviceAddress') deviceAddress: string,
  ): Promise<StatusResponse> {
    return this.processorService.getDeviceStatus(deviceAddress);
  }

  @Get('devices/:deviceAddress/history')
  async getDeviceHistory(
    @Param('deviceAddress') deviceAddress: string,
    @Query('limit') limit: number = 10,
  ): Promise<HistoryResponse> {
    return this.processorService.getDeviceHistory(deviceAddress, limit);
  }

  @Get('devices/status')
  async getAllDeviceStatuses(): Promise<HistoryResponse> {
    return this.processorService.getAllDeviceStatuses();
  }
}
