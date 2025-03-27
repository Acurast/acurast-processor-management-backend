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
  async getDeviceList(@Res() res: Response) {
    const { devices } = await this.processorService.getDeviceList();
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Device List</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              background: #f5f5f5;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f8f9fa;
              font-weight: 600;
            }
            tr:hover {
              background-color: #f8f9fa;
            }
            .status-link {
              color: #007bff;
              text-decoration: none;
            }
            .status-link:hover {
              text-decoration: underline;
            }
            .charging {
              color: #28a745;
              font-weight: 500;
            }
            .not-charging {
              color: #dc3545;
            }
            .network-type {
              text-transform: capitalize;
            }
            .unknown-network {
              color: #6c757d;
              font-style: italic;
            }
            .battery-good {
              color: #28a745;
              font-weight: 500;
            }
            .battery-warning {
              color: #ffc107;
              font-weight: 500;
            }
            .battery-critical {
              color: #dc3545;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Device List</h1>
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Battery Level</th>
                  <th>Charging</th>
                  <th>Network</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${devices
                  .sort(
                    (
                      a: ListResponse['devices'][0],
                      b: ListResponse['devices'][0],
                    ) => a.address.localeCompare(b.address),
                  )
                  .map((device: ListResponse['devices'][0]) => {
                    const batteryClass =
                      device.batteryLevel >= 40 && device.batteryLevel <= 70
                        ? 'battery-good'
                        : device.batteryLevel > 70
                          ? 'battery-warning'
                          : 'battery-critical';
                    return `
                    <tr>
                      <td>${device.address}</td>
                      <td class="${batteryClass}">${device.batteryLevel}%</td>
                      <td class="${device.isCharging ? 'charging' : 'not-charging'}">
                        ${device.isCharging ? 'Charging' : 'Not Charging'}
                      </td>
                      <td>
                        ${
                          device.networkType === 'unknown'
                            ? '<span class="unknown-network">Unknown</span>'
                            : `<span class="network-type">${device.networkType}</span>`
                        }
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
