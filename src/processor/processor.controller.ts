import { Controller, Post, Get, Body, Query, Param, Res } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { BatchService } from './batch.service';
import { DeviceStatusDto } from './dto/device-status.dto';
import { Response } from 'express';
import { CacheService } from './cache.service';
import * as fs from 'fs';
import * as path from 'path';

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
  deviceStatus: DeviceStatusDto;
}

export interface HistoryResponse {
  history: DeviceStatusDto[];
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
    private readonly cacheService: CacheService,
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
              max-width: 1400px;
              margin: 0 auto;
              padding: 2rem;
              color: #333;
            }
            h1 {
              color: #2c3e50;
              border-bottom: 2px solid #eee;
              padding-bottom: 0.5rem;
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
            .table-container {
              overflow-x: auto;
              margin: 2rem 0;
              background: #fff;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.9rem;
            }
            th, td {
              padding: 0.75rem 1rem;
              text-align: left;
              border-bottom: 1px solid #e9ecef;
            }
            th {
              background: #f8f9fa;
              font-weight: 600;
              color: #2c3e50;
              white-space: nowrap;
            }
            tr:hover {
              background: #f8f9fa;
            }
            .status-link {
              color: #007bff;
              text-decoration: none;
            }
            .status-link:hover {
              text-decoration: underline;
            }
            .battery-level {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
            }
            .battery-level::before {
              content: '';
              display: inline-block;
              width: 1rem;
              height: 0.5rem;
              background: currentColor;
              border-radius: 2px;
            }
            .battery-level[data-level="high"] { color: #28a745; }
            .battery-level[data-level="medium"] { color: #ffc107; }
            .battery-level[data-level="low"] { color: #dc3545; }
            .network-type {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
            }
            .network-type::before {
              content: '';
              display: inline-block;
              width: 0.5rem;
              height: 0.5rem;
              border-radius: 50%;
              background: currentColor;
            }
            .network-type[data-type="wifi"] { color: #28a745; }
            .network-type[data-type="cellular"] { color: #007bff; }
            .network-type[data-type="usb"] { color: #6c757d; }
            .network-type[data-type="offline"] { color: #dc3545; }
            .timestamp {
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            }
          </style>
        </head>
        <body>
          <a href="/" class="back-link">← Back to Dashboard</a>
          <h1>Device List</h1>
          
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Last Seen</th>
                  <th>Battery</th>
                  <th>Network</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${devices.devices
                  .map((device) => {
                    const batteryLevel = device.batteryLevel;
                    const batteryLevelClass =
                      batteryLevel > 50
                        ? 'high'
                        : batteryLevel > 20
                          ? 'medium'
                          : 'low';
                    return `
                    <tr>
                      <td><code>${device.address}</code></td>
                      <td class="timestamp">${new Date(device.lastSeen).toLocaleString()}</td>
                      <td>
                        <span class="battery-level" data-level="${batteryLevelClass}">
                          ${batteryLevel}% ${device.isCharging ? '(Charging)' : ''}
                        </span>
                      </td>
                      <td>
                        <span class="network-type" data-type="${device.networkType.toLowerCase()}">
                          ${device.networkType} (${device.ssid})
                        </span>
                      </td>
                      <td>
                        <a href="/processor/devices/${device.address}/status" class="status-link">Status</a> |
                        <a href="/processor/devices/${device.address}/history" class="status-link">History</a> |
                        <a href="/processor/history/${device.address}/graph" class="status-link">Graph</a>
                      </td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('history/:address/graph')
  async getDeviceHistoryGraph(
    @Param('address') address: string,
    @Res() res: Response,
  ) {
    try {
      // Try both development and production paths
      const possiblePaths = [
        path.join(__dirname, 'templates', 'device-history.html'),
        path.join(
          process.cwd(),
          'dist',
          'src',
          'processor',
          'templates',
          'device-history.html',
        ),
      ];

      let templatePath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          templatePath = p;
          break;
        }
      }

      if (!templatePath) {
        throw new Error('Template file not found');
      }

      const template = fs.readFileSync(templatePath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.send(template);
    } catch (error) {
      console.error('Error serving template:', error);
      res.status(500).send('Error loading template');
    }
  }
}
