import { clearRememberedBrokerCash } from './brokerCash';

/** Drop cached values that belong to the previous Mintzy account. */
export function clearAccountClientState(): void {
  clearRememberedBrokerCash();
}
