import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { DeviceStatus } from './device-status.entity';

@Entity()
export class Ssid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @OneToMany(() => DeviceStatus, (status) => status.ssid)
  statuses: DeviceStatus[];
}
