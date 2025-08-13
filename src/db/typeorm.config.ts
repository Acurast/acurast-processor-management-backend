import 'dotenv/config';
import { DataSource } from 'typeorm';
import { DataSourceOptions } from 'typeorm/data-source/DataSourceOptions';
import { DeviceStatus } from '../processor/entities/device-status.entity';
import { NetworkType } from '../processor/entities/network-type.entity';
import { Processor } from '../processor/entities/processor.entity';
import { BatteryHealth } from '../processor/entities/battery-health.entity';
import { TemperatureReading } from '../processor/entities/temperature-reading.entity';
import { Manager } from '../processor/entities/manager.entity';
import { Ssid } from '../processor/entities/ssid.entity';

export const getTypeormConfig = (): DataSourceOptions => {
  const entities = [
    DeviceStatus,
    Processor,
    NetworkType,
    BatteryHealth,
    Ssid,
    TemperatureReading,
    Manager,
  ];

  const sharedConfig = {
    migrations: ['./dist/db/migrations/*.js'],
  };

  if (process.env.ENVIRONMENT === 'local') {
    if (!process.env.DB) {
      throw new Error('DB environment variable is required');
    }
    return {
      ...sharedConfig,
      type: 'sqlite',
      database: process.env.DB /* ?? ':memory:' */,
      // synchronize: true,
      entities: entities,
      logging: false,
      // dropSchema: true,
    };
  }

  return {
    ...sharedConfig,
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    password: process.env.DB_PASSWORD,
    username: process.env.DB_USER,
    entities: entities,
    database: process.env.DB_NAME,
    // logging: 'all', // ['query', 'error'],
    // logger: 'simple-console',
    maxQueryExecutionTime: 500,
    // dropSchema: true,
    // synchronize: true,
  };
};

export const datasource = new DataSource({
  ...getTypeormConfig(),
});
