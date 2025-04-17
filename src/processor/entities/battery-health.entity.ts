import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { DeviceStatus } from './device-status.entity';

@Entity()
export class BatteryHealth {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  state: string;

  @OneToMany(() => DeviceStatus, (status) => status.batteryHealth)
  statuses: DeviceStatus[];
}
