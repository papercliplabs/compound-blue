import JSONbig from "json-bigint";

export const JSONbigNative = JSONbig({ useNativeBigInt: true, alwaysParseAsBig: true });

const BIGINT_MARKER = "__bigint__";

// Serialize supporting bigint
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeBigInts(data: any): any {
  if (data == null || data == undefined) {
    return data;
  }

  if (typeof data === "bigint") {
    return { [BIGINT_MARKER]: data.toString() };
  } else if (Array.isArray(data)) {
    return data.map(serializeBigInts);
  } else if (typeof data === "object") {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, serializeBigInts(value)]));
  }
  return data;
}

// Deserialize supporting bigint
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deserializeBigInts(serializedData: any): any {
  if (Array.isArray(serializedData)) {
    return serializedData.map(deserializeBigInts);
  } else if (serializedData && typeof serializedData === "object") {
    if (BIGINT_MARKER in serializedData) {
      return BigInt(serializedData[BIGINT_MARKER]);
    } else {
      return Object.fromEntries(Object.entries(serializedData).map(([key, value]) => [key, deserializeBigInts(value)]));
    }
  } else return serializedData;
}
