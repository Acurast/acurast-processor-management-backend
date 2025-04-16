import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { DeviceStatus } from './device-status.entity';

@Entity()
@Index(['deviceStatus', 'type'])
@Index(['type', 'value'])
export class TemperatureReading {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DeviceStatus, (status) => status.temperatureReadings)
  deviceStatus: DeviceStatus;

  @Column()
  type: string;

  @Column('float')
  value: number;
}
