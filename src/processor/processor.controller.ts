import { Controller, Post, Get, Body, Query, Param, Res } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { BatchService } from './batch.service';
import { DeviceStatus } from './entities/device-status.entity';
import { Response } from 'express';

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

export interface ListResponse {
  devices: Array<{
    address: string;
    lastSeen: number;
    batteryLevel: number;
    isCharging: boolean;
    networkType: string;
    ssid: string;
  }>;
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

  @Get('list')
  async getDeviceList(@Res() res: Response): Promise<void> {
    const devices = await this.processorService.getDeviceList();

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Device List - Acurast Processor Management</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              max-width: 1200px;
              margin: 0 auto;
              padding: 2rem;
              color: #333;
            }
            h1 {
              color: #2c3e50;
              border-bottom: 2px solid #eee;
              padding-bottom: 0.5rem;
            }
            .device-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
              gap: 1rem;
              margin: 2rem 0;
            }
            .device-card {
              background: #fff;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              padding: 1rem;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .device-card h2 {
              margin: 0 0 1rem 0;
              color: #2c3e50;
              font-size: 1.2rem;
            }
            .device-info {
              display: grid;
              grid-template-columns: auto 1fr;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            }
            .device-info span:first-child {
              color: #6c757d;
              font-weight: 500;
            }
            .device-actions {
              margin-top: 1rem;
              display: flex;
              gap: 1rem;
            }
            .btn {
              display: inline-block;
              padding: 0.5rem 1rem;
              border-radius: 4px;
              text-decoration: none;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            .btn-primary {
              background: #007bff;
              color: white;
            }
            .btn-primary:hover {
              background: #0056b3;
            }
            .btn-secondary {
              background: #6c757d;
              color: white;
            }
            .btn-secondary:hover {
              background: #545b62;
            }
            .back-link {
              display: inline-block;
              margin-bottom: 1rem;
              color: #007bff;
              text-decoration: none;
            }
            .back-link:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <a href="/" class="back-link">← Back to Dashboard</a>
          <h1>Device List</h1>
          
          <div class="device-grid">
            ${devices.devices
              .map(
                (device) => `
              <div class="device-card">
                <h2>${device.address}</h2>
                <div class="device-info">
                  <span>Last Seen:</span>
                  <span>${new Date(device.lastSeen).toLocaleString()}</span>
                </div>
                <div class="device-info">
                  <span>Battery:</span>
                  <span>${device.batteryLevel}% ${device.isCharging ? '(Charging)' : ''}</span>
                </div>
                <div class="device-info">
                  <span>Network:</span>
                  <span>${device.networkType} (${device.ssid})</span>
                </div>
                <div class="device-actions">
                  <a href="/processor/devices/${device.address}/status" class="btn btn-primary">View Status</a>
                  <a href="/processor/devices/${device.address}/history" class="btn btn-secondary">View History</a>
                </div>
              </div>
            `,
              )
              .join('')}
          </div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
