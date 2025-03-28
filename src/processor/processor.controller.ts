import { Controller, Post, Get, Body, Query, Param, Res } from '@nestjs/common';
import { ProcessorService } from './processor.service';
import { DeviceStatusDto } from './dto/device-status.dto';
import { Response } from 'express';
import type { BatteryHealthStateEnum, NetworkTypeEnum } from './types';
import * as fs from 'fs';
import * as path from 'path';

export interface CheckInRequest {
  deviceAddress: string;
  timestamp: number;
  batteryLevel: number;
  isCharging: boolean;
  batteryHealth?: BatteryHealthStateEnum;
  temperature?: {
    battery?: number;
    cpu?: number;
    gpu?: number;
    ambient?: number;
  };
  networkType: NetworkTypeEnum;
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
  constructor(private readonly processorService: ProcessorService) {}

  @Post('check-in')
  async checkIn(
    @Body() checkInRequest: CheckInRequest,
  ): Promise<CheckInResponse> {
    console.log(`New check-in received from ${checkInRequest.deviceAddress}`);
    return this.processorService.handleCheckIn(checkInRequest);
  }

  @Get('api/devices/:address/status')
  async getDeviceStatusApi(
    @Param('address') address: string,
  ): Promise<StatusResponse> {
    return this.processorService.getDeviceStatus(address);
  }

  @Get('api/devices/:address/history')
  async getDeviceHistoryApi(
    @Param('address') address: string,
    @Query('limit') limit: number = 10,
  ): Promise<HistoryResponse> {
    return this.processorService.getDeviceHistory(address, limit);
  }

  @Get('api/devices/status')
  async getAllDeviceStatusesApi(): Promise<HistoryResponse> {
    return this.processorService.getAllDeviceStatuses();
  }

  @Get('web/list')
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
                        <a href="/processor/web/${device.address}/status" class="status-link">Status</a> |
                        <a href="/processor/web/${device.address}/history" class="status-link">History</a> |
                        <a href="/processor/web/${device.address}/graph" class="status-link">Graph</a>
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

  @Get('web/:address/status')
  async getDeviceStatus(
    @Param('address') address: string,
    @Res() res: Response,
  ): Promise<void> {
    const { deviceStatus } =
      await this.processorService.getDeviceStatus(address);
    if (!deviceStatus) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Device Status - ${address}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              background: #f5f5f5;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .status-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-top: 20px;
            }
            .status-card {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 6px;
              border: 1px solid #dee2e6;
            }
            .status-card h3 {
              margin-top: 0;
              color: #495057;
            }
            .status-value {
              font-size: 1.2em;
              font-weight: 500;
              color: #212529;
            }
            .timestamp {
              color: #6c757d;
              font-size: 0.9em;
              margin-top: 10px;
            }
            .back-link {
              display: inline-block;
              margin-top: 20px;
              color: #007bff;
              text-decoration: none;
            }
            .back-link:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Device Status</h1>
            <p>Address: ${address}</p>
            <div class="status-grid">
              <div class="status-card">
                <h3>Battery Level</h3>
                <div class="status-value">${deviceStatus.batteryLevel}%</div>
                <div>Charging: ${deviceStatus.isCharging ? 'Yes' : 'No'}</div>
                <div>Health: ${deviceStatus.batteryHealth || 'Unknown'}</div>
              </div>
              <div class="status-card">
                <h3>Network</h3>
                <div class="status-value">${deviceStatus.networkType}</div>
                <div>SSID: ${deviceStatus.ssid || 'N/A'}</div>
              </div>
              <div class="status-card">
                <h3>Temperature</h3>
                <div>Battery: ${deviceStatus.temperature?.battery}°C</div>
                <div>CPU: ${deviceStatus.temperature?.cpu}°C</div>
                <div>GPU: ${deviceStatus.temperature?.gpu}°C</div>
                <div>Ambient: ${deviceStatus.temperature?.ambient}°C</div>
              </div>
              <div class="status-card">
                <h3>Last Update</h3>
                <div class="timestamp">${new Date(deviceStatus.timestamp).toLocaleString()}</div>
              </div>
            </div>
            <a href="/processor/web/list" class="back-link">← Back to Device List</a>
          </div>
        </body>
      </html>
    `;
    res.send(html);
  }

  @Get('web/:address/history')
  async getDeviceHistory(
    @Param('address') address: string,
    @Res() res: Response,
  ): Promise<void> {
    const { history } = await this.processorService.getDeviceHistory(
      address,
      10,
    );
    if (!history || history.length === 0) {
      res.status(404).json({ error: 'No history found for device' });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Device History - ${address}</title>
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
            .back-link {
              display: inline-block;
              margin-top: 20px;
              color: #007bff;
              text-decoration: none;
            }
            .back-link:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Device History</h1>
            <p>Address: ${address}</p>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Battery Level</th>
                  <th>Charging</th>
                  <th>Network</th>
                  <th>Temperature</th>
                </tr>
              </thead>
              <tbody>
                ${history
                  .map(
                    (status: DeviceStatusDto) => `
                    <tr>
                      <td>${new Date(status.timestamp).toLocaleString()}</td>
                      <td>${status.batteryLevel}%</td>
                      <td>${status.isCharging ? 'Yes' : 'No'}</td>
                      <td>${status.networkType}</td>
                      <td>
                        Battery: ${status.temperature?.battery}°C<br>
                        CPU: ${status.temperature?.cpu}°C<br>
                        GPU: ${status.temperature?.gpu}°C<br>
                        Ambient: ${status.temperature?.ambient}°C
                      </td>
                    </tr>
                  `,
                  )
                  .join('')}
              </tbody>
            </table>
            <a href="/processor/web/list" class="back-link">← Back to Device List</a>
          </div>
        </body>
      </html>
    `;
    res.send(html);
  }

  @Get('web/:address/graph')
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
