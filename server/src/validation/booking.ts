export function assertPartySize(partySize: number): void {
  if (!Number.isInteger(partySize) || partySize < 1) {
    throw new Error('Party size must be a whole number of at least 1.')
  }
}

export function assertAmountEtb(amountEtb: number): void {
  if (!Number.isInteger(amountEtb) || amountEtb < 0) {
    throw new Error('Amount must be a whole number of birr, zero or greater.')
  }
}
