import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { Processor } from './processor.entity';
import { NetworkType } from './network-type.entity';
import { BatteryHealth } from './battery-health.entity';
import { Ssid } from './ssid.entity';
import { TemperatureReading } from './temperature-reading.entity';

@Entity()
@Index(['processor', 'timestamp']) // Index for faster queries by processor and timestamp
export class DeviceStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Processor, (processor) => processor.statuses)
  processor: Processor;

  @Column('bigint')
  timestamp: number;

  @Column('float')
  batteryLevel: number;

  @Column()
  isCharging: boolean;

  @ManyToOne(() => BatteryHealth, (batteryHealth) => batteryHealth.statuses, {
    nullable: true,
  })
  batteryHealth: BatteryHealth;

  @OneToMany(() => TemperatureReading, (reading) => reading.deviceStatus)
  temperatureReadings: TemperatureReading[];

  @ManyToOne(() => NetworkType, (networkType) => networkType.statuses)
  networkType: NetworkType;

  @ManyToOne(() => Ssid, (ssid) => ssid.statuses)
  ssid: Ssid;

  @CreateDateColumn()
  createdAt: Date;
}
