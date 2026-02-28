import { useMemo } from "react";
import type { Abi, Address } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

export function useOwnedTokenIds(owner: Address | undefined, contractAddress: Address, abi: Abi) {
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: contractAddress,
    abi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: Boolean(owner) },
  });

  const balance = Number(balanceData ?? 0n);

  const contracts = useMemo(
    () =>
      owner
        ? Array.from({ length: balance }, (_, i) => ({
            address: contractAddress,
            abi,
            functionName: "tokenOfOwnerByIndex",
            args: [owner, BigInt(i)],
          }))
        : [],
    [abi, balance, contractAddress, owner],
  );

  const { data, isLoading, refetch: refetchTokenIds } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0 },
  });

  const tokenIds = useMemo(() => {
    if (!data) return [] as number[];
    return data
      .map((entry) => Number((entry.result as bigint | undefined) ?? 0n))
      .filter((id) => id > 0);
  }, [data]);

  async function refresh() {
    await refetchBalance();
    if (contracts.length > 0) {
      await refetchTokenIds();
    }
  }

  return { tokenIds, isLoading: isLoading || (!data && contracts.length > 0), refresh };
}
