"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { COUNTRY_CODES_TO_DISABLE_LEVERAGE } from "@/config";
import { safeFetch } from "@/utils/fetch";

interface FeatureFlags {
  multiply: boolean;
}

export function useFeatureFlags() {
  const { data: countryCode } = useQuery({
    queryKey: ["country"],
    queryFn: async () => safeFetch<string>(`/api/country`, {}, true),
  });

  const featureFlags: FeatureFlags = useMemo(() => {
    return {
      multiply: countryCode ? !COUNTRY_CODES_TO_DISABLE_LEVERAGE.includes(countryCode) : false,
    };
  }, [countryCode]);

  return featureFlags;
}
