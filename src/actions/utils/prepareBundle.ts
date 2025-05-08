import { InputBundlerOperation } from "@morpho-org/bundler-sdk-viem";
import { SimulationResult, SimulationState } from "@morpho-org/simulation-sdk";
import { Address } from "viem";

import { subbundleFromInputOps } from "../subbundles/subbundleFromInputOps";

import { subbundlesToAction } from "./subbundlesToAction";
import { Action } from "./types";

export type MorphoAction =
  | (Extract<Action, { status: "success" }> & {
      status: "success";
      initialSimulationState: SimulationResult[number];
      finalSimulationState: SimulationResult[number];
    })
  | Extract<Action, { status: "error" }>;

export function prepareBundle(
  inputOps: InputBundlerOperation[],
  accountAddress: Address,
  isContract: boolean,
  simulationState: SimulationState,
  executeBundleName: string
): MorphoAction {
  try {
    const subbundle = subbundleFromInputOps({
      inputOps,
      accountAddress,
      accountSupportsSignatures: !isContract,
      simulationState,
    });

    return {
      ...subbundlesToAction([subbundle], executeBundleName),
      initialSimulationState: subbundle.initialSimulationState,
      finalSimulationState: subbundle.finalSimulationState,
    };
  } catch (e) {
    return {
      status: "error",
      message: `Simulation Error: ${(e instanceof Error ? e.message : JSON.stringify(e)).split("0x")[0]}`,
    };
  }
}
