// "use client";
// import { useMemo } from "react";
// import { useAccount, useBlock, useWalletClient } from "wagmi";
// import { addresses, ChainId, getChainAddresses, MarketId, NATIVE_ADDRESS } from "@morpho-org/blue-sdk";
// import { SimulationStateLike, useSimulationState } from "@morpho-org/simulation-sdk-wagmi";
// import { ReadContractErrorType } from "viem";
// import { Button } from "./ui/button";
// import { encodeBundle, finalizeBundle, InputBundlerOperation, populateBundle } from "@morpho-org/bundler-sdk-viem";

// export function usePopulatedSimulationState(marketId: MarketId) {
//   const client = useWalletClient();
//   const { data: block } = useBlock({
//     chainId: undefined,
//     watch: true,
//   });

//   const address = client.data?.account.address;
//   const targetChainId = client.data?.chain.id ?? 1;
//   // If we're on Anvil (31337), use mainnet addresses for testing
//   // const effectiveChainId = targetChainId === 31337 ? 1 : (targetChainId ?? 1);
//   const effectiveChainId = targetChainId;

//   // Derive the bundler address from the SDK for the current chain
//   // Use effectiveChainId instead of targetChainId
//   const bundler = useMemo(() => {
//     const chainAddresses = getChainAddresses(effectiveChainId);
//     return chainAddresses?.bundler;
//   }, [effectiveChainId]);

//   // Create the list of users (only the account and bundler, for example)
//   const users = useMemo(() => {
//     const list: string[] = [];
//     if (address) list.push(address);
//     if (bundler) list.push(bundler);
//     return list;
//   }, [address, bundler]);

//   // Use effectiveChainId for tokens
//   // below we are using the sUSDe/DAI market, so we need the following tokens:
//   // - DAI
//   // - sUSDe
//   // - DAI_sUSDe
//   const tokens = useMemo<string[]>(() => {
//     const chainAddresses = getChainAddresses(effectiveChainId);

//     // const dai = chainAddresses.dai!;
//     // const { dai_sUsde } = markets[effectiveChainId as keyof typeof markets];

//     // return [NATIVE_ADDRESS, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "0x4200000000000000000000000000000000000006"]; // TODO: manaully add the tokens for now
//     return [NATIVE_ADDRESS, "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"]; // TODO: manaully add the tokens for now
//   }, [effectiveChainId]);

//   // if any vaults are needed, add them here
//   const vaults = useMemo<string[]>(() => [], []);

//   // Helper function to extract a meaningful error message
//   const getSimulationErrorMessage = (error: SimulationStateLike<ReadContractErrorType | null>): string | null => {
//     if (!error) return null;
//     if (error instanceof Error) return error.message;
//     // Define keys that represent error details from the simulation
//     const errorKeys = [
//       "global",
//       "markets",
//       "users",
//       "tokens",
//       "vaults",
//       "positions",
//       "holdings",
//       "vaultMarketConfigs",
//       "vaultUsers",
//     ];

//     // Check if at least one key has a non-null/non-undefined error value.
//     // For the global error, check its nested property.
//     const hasRealError = errorKeys.some((key) => {
//       if (key === "global") {
//         return error.global?.feeRecipient != null;
//       }
//       // @ts-expect-error error is a SimulationStateLike
//       return error[key] != null;
//     });
//     return hasRealError ? JSON.stringify(error, null, 2) : null;
//   };

//   let simulation;

//   try {
//     simulation = useSimulationState({
//       marketIds: [marketId],
//       users: users as `0x${string}`[],
//       tokens: tokens as `0x${string}`[],
//       vaults: vaults as `0x${string}`[],
//       block: block
//         ? {
//             number: block.number,
//             timestamp: block.timestamp,
//           }
//         : undefined,
//     });

//     const errorMessage = getSimulationErrorMessage(simulation.error);
//     if (errorMessage) {
//       console.error("Simulation error details:", {
//         error: simulation.error,
//         errorMessage,
//       });
//     }
//   } catch (error) {
//     console.error("Error in useSimulationState:", {
//       error,
//       errorMessage: error instanceof Error ? error.message : String(error),
//       stack: error instanceof Error ? error.stack : undefined,
//     });
//     throw error;
//   }

//   return {
//     simulationState: simulation.data,
//     isPending: simulation.isPending,
//     error: getSimulationErrorMessage(simulation.error),
//     config: {
//       marketIds: [marketId],
//       users,
//       tokens,
//       vaults,
//     },
//   };
// }

// export default function SupplyCollateralDemo() {
//   // const marketId = "0x3b3769cfca57be2eaed03fcc5299c25691b77781a1e124e7a8d520eb9a7eabb5" as MarketId;
//   const marketId = "0xe558a51e10f1fdf7156c9470d2f68b93b3fd1ad5e775c020ae4a7f805e8d5674" as MarketId;
//   const { simulationState } = usePopulatedSimulationState(marketId);

//   const { address } = useAccount();
//   const { data: client } = useWalletClient();
//   const { morpho } = addresses[ChainId.EthMainnet];

//   async function handleClick() {
//     if (!simulationState || !address || !client) return;

//     const inputOperations: InputBundlerOperation[] = [
//       {
//         type: "Blue_SupplyCollateral",
//         sender: address,
//         address: morpho,
//         args: {
//           id: marketId,
//           assets: BigInt(1000),
//           onBehalf: address,
//         },
//       },
//       {
//         type: "Blue_Borrow",
//         sender: address,
//         address: morpho,
//         args: {
//           id: marketId,
//           assets: BigInt(100),
//           onBehalf: address,
//           receiver: address,
//         },
//       },
//     ];
//     const { operations, steps } = populateBundle(inputOperations, simulationState, {});
//     const finalizedOperations = finalizeBundle(
//       operations,
//       simulationState,
//       address,
//       new Set(["0x4200000000000000000000000000000000000006"]), // unwrap tokens
//       BigInt(1)
//     );

//     const bundle = encodeBundle(finalizedOperations, simulationState, true);

//     console.log("TODO: supply collateral", { operations, steps, finalizedOperations, bundle });

//     // Sign the required signatures
//     // await Promise.all(bundle.requirements.signatures.map((requirement) => requirement.sign(client, client.account)));
//     const sigs = bundle.requirements.signatures.map((requirement) => () => requirement.sign(client, client.account));
//     for (const sig of sigs) {
//       await sig();
//     }

//     // All transactions
//     const txs = bundle.requirements.txs.map(({ tx }) => tx).concat([bundle.tx()]);

//     console.log("TXNS", txs);

//     // Send each txn
//     for (const tx of txs) {
//       await client.sendTransaction({ ...tx, account: client.account });
//     }
//   }

//   return (
//     <div>
//       <h1>Supply Collaterla Demo: </h1>
//       <Button onClick={handleClick}>Supply collateral</Button>
//     </div>
//   );
// }
