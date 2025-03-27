import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { DeviceStatus } from './device-status.entity';

@Entity()
export class NetworkType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  type: string;

  @OneToMany(() => DeviceStatus, (status) => status.networkType)
  statuses: DeviceStatus[];
}
