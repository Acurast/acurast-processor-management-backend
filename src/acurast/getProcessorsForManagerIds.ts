import { apiWithBlockHash } from './init';

export const getProcessorsByManagerIds = async (
  managerIds: number[],
  blockHash?: string,
): Promise<string[]> => {
  console.log('getProcessorsByManagerId', managerIds);
  const api = await apiWithBlockHash(blockHash);

  const processors =
    await api.query['acurastProcessorManager']['managedProcessors'].entries(
      managerIds,
    );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return processors.map(([key, _]) => key.args.at(1)!.toString());
};
