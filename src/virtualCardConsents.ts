type Decision = { isFirstInsertion: boolean; itsConsent?: boolean; vdoConsent?: boolean }
export type VirtualCardDecisions = Record<string, Decision>
