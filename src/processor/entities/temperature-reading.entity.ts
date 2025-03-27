import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { DeviceStatus } from './device-status.entity';

export enum TemperatureType {
  BATTERY = 'battery',
  CPU = 'cpu',
  GPU = 'gpu',
  AMBIENT = 'ambient',
}

@Entity()
@Index(['deviceStatus', 'type'])
@Index(['type', 'value'])
export class TemperatureReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DeviceStatus, (status) => status.temperatureReadings)
  deviceStatus: DeviceStatus;

  @Column({
    type: 'text',
    enum: TemperatureType,
  })
  type: TemperatureType;

  @Column('float')
  value: number;
}
