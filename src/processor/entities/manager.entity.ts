import { Entity, Column, PrimaryColumn, OneToMany, Index } from 'typeorm';
import { Processor } from './processor.entity';

@Entity()
export class Manager {
  @PrimaryColumn({ type: 'int', unique: true })
  id: number;

  @Index()
  @Column({ unique: true })
  address: string;

  @OneToMany(() => Processor, (processor) => processor.manager)
  processors: Processor[];
}
