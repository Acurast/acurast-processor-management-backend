import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Manager } from './entities/manager.entity';
import { Processor } from './entities/processor.entity';
import { getManagerIdsForAddress } from '../acurast/getManagerIdsForAddress';
import { getProcessorsByManagerIds } from '../acurast/getProcessorsForManagerIds';

@Injectable()
export class ManagerService {
  constructor(
    @InjectRepository(Manager)
    private readonly managerRepository: Repository<Manager>,
    @InjectRepository(Processor)
    private readonly processorRepository: Repository<Processor>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Ensure the manager (by address) and its processors exist in the database.
   * Returns the list of processor addresses linked to the manager.
   */
  async populateManagerAndProcessorsByAddress(
    managerAddress: string,
  ): Promise<string[]> {
    const managerIds = await getManagerIdsForAddress(managerAddress);
    if (!managerIds || managerIds.length === 0) {
      return [];
    }

    // Assuming one managerId per address (address is unique in schema)
    const managerId = managerIds[0];

    const processorAddresses = await getProcessorsByManagerIds([managerId]);

    await this.dataSource.transaction(async (trx) => {
      // Upsert manager
      const existingManager = await trx.findOne(Manager, {
        where: { id: managerId },
      });
      if (existingManager) {
        existingManager.lastUpdated = new Date();
        await trx.save(Manager, existingManager);
      } else {
        const newManager = trx.create(Manager, {
          id: managerId,
          address: managerAddress,
          lastUpdated: new Date(),
        });
        await trx.save(Manager, newManager);
      }

      // Upsert processors and link to manager
      for (const address of processorAddresses) {
        let processor = await trx.findOne(Processor, { where: { address } });
        if (!processor) {
          processor = trx.create(Processor, {
            address,
            managerId: managerId,
          });
        } else if (processor.managerId !== managerId) {
          processor.managerId = managerId;
        }
        await trx.save(Processor, processor);
      }
    });

    return processorAddresses;
  }
}
