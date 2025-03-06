"use client";
import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

const ACKNOWLEDGEMENT_LOCAL_STORAGE_KEY = "acknoledge-terms";

type AcknowledgeTermsContextType = {
  acknowledgedTerms: boolean;
  setAcknowledgement: () => void;
};

const AcknowledgeTermsContext = createContext<AcknowledgeTermsContextType | undefined>(undefined);

export function AcknowledgeTermsProvider({ children }: { children: ReactNode }) {
  const [acknowledgedTerms, setAcknowledgedTerms] = useState(false);

  // On load, check if we alrady accepted the terms before
  useEffect(() => {
    const storedAcknoledgement = localStorage.getItem(ACKNOWLEDGEMENT_LOCAL_STORAGE_KEY);
    setAcknowledgedTerms(storedAcknoledgement === "true");
  }, [setAcknowledgedTerms]);

  const setAcknowledgement = useCallback(() => {
    localStorage.setItem(ACKNOWLEDGEMENT_LOCAL_STORAGE_KEY, "true");
    setAcknowledgedTerms(true);
  }, [setAcknowledgedTerms]);

  return (
    <AcknowledgeTermsContext.Provider
      value={{
        acknowledgedTerms,
        setAcknowledgement,
      }}
    >
      {children}
    </AcknowledgeTermsContext.Provider>
  );
}

export function useAcknowledgeTermsContext() {
  const context = useContext(AcknowledgeTermsContext);
  if (!context) {
    throw new Error("useAcknowledgeTermsContext must be used within an AcknowledgeTermsProvider");
  }
  return context;
}
