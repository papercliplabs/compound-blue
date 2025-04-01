export const bundler3Abi = [
  {
    type: "function",
    name: "initiator",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "multicall",
    inputs: [
      {
        name: "bundle",
        type: "tuple[]",
        internalType: "struct Call[]",
        components: [
          {
            name: "to",
            type: "address",
            internalType: "address",
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes",
          },
          {
            name: "value",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "skipRevert",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "callbackHash",
            type: "bytes32",
            internalType: "bytes32",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "reenter",
    inputs: [
      {
        name: "bundle",
        type: "tuple[]",
        internalType: "struct Call[]",
        components: [
          {
            name: "to",
            type: "address",
            internalType: "address",
          },
          {
            name: "data",
            type: "bytes",
            internalType: "bytes",
          },
          {
            name: "value",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "skipRevert",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "callbackHash",
            type: "bytes32",
            internalType: "bytes32",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reenterHash",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "error",
    name: "AlreadyInitiated",
    inputs: [],
  },
  {
    type: "error",
    name: "EmptyBundle",
    inputs: [],
  },
  {
    type: "error",
    name: "IncorrectReenterHash",
    inputs: [],
  },
  {
    type: "error",
    name: "MissingExpectedReenter",
    inputs: [],
  },
] as const;
