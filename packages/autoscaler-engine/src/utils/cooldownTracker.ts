import { getBaseLogger } from '@hyperflow/logger';

const Logger = getBaseLogger();

class CooldownTracker {
  private cooldownEndMsTimestamp: number;

  constructor(seconds?: number) {
    Logger.trace('[CountdownTracker] Constructor');
    if (seconds) {
      this.setNSeconds(seconds);
    }
  }

  public setNSeconds(n: number): void {
    const msNow = new Date().getTime();
    if (
      this.cooldownEndMsTimestamp !== undefined &&
      this.cooldownEndMsTimestamp > msNow
    ) {
      throw Error('Unable to set cooldown until previous is expired');
    }
    const targetTimestamp = msNow + 1000 * n;
    this.cooldownEndMsTimestamp = targetTimestamp;
    Logger.debug(
      '[CountdownTracker] Setting cooldown end time to ' + targetTimestamp
    );
    return;
  }

  public isExpired(): boolean {
    Logger.debug('[CountdownTracker] Checking if cooldown is expired');
    if (this.cooldownEndMsTimestamp === undefined) {
      return true;
    }
    const msNow = new Date().getTime();
    if (this.cooldownEndMsTimestamp <= msNow) {
      return true;
    }
    return false;
  }
}

export default CooldownTracker;
