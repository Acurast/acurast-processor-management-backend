import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { DeviceStatus } from './device-status.entity';

@Entity()
export class Processor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  address: string;

  @OneToMany(() => DeviceStatus, (status) => status.processor)
  statuses: DeviceStatus[];
}
