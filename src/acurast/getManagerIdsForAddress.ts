import { apiWithBlockHash } from './init';

export const getManagerIdsForAddress = async (
  address: string,
  blockHash?: string,
): Promise<number[] | undefined> => {
  console.log('getManagerIdsForAddress', address);
  const api = await apiWithBlockHash(blockHash);

  const tokens = await api.query['uniques']['account'].entries(address, 0);
  if (tokens.length > 0) {
    return tokens.map((value) => Number(value[0].args[2]));
  }
  return undefined;
};
