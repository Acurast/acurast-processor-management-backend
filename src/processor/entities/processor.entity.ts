import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DeviceStatus } from './device-status.entity';
import { Manager } from './manager.entity';

@Entity()
export class Processor {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ unique: true })
  address: string;

  @OneToMany(() => DeviceStatus, (status) => status.processor)
  statuses: DeviceStatus[];

  @ManyToOne(() => Manager, (manager) => manager.processors)
  @JoinColumn({
    name: 'managerId',
    referencedColumnName: 'id',
  })
  manager: Manager;

  @Index()
  @Column({ type: 'int', nullable: true })
  managerId: number | null;

  // @Column({
  //   type: 'timestamp',
  //   nullable: true,
  //   default: () => 'CURRENT_TIMESTAMP',
  // })
  // lastUpdated: Date | null;
}
