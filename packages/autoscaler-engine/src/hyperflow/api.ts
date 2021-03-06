import { getBaseLogger } from '@hyperflow/logger';
import { HFWflib, HFEngine } from '@hyperflow/types';
import { RedisClient } from 'redis';
import RPC from '../communication/rpc';

const Logger = getBaseLogger();

class API {
  private rcl: RedisClient;
  private wflib: HFWflib;
  private engine: HFEngine;
  private rpc?: RPC;
  private wfId: string;

  constructor(wfId: string, rcl: RedisClient, wflib: HFWflib, engine: HFEngine) {
    Logger.trace('[API] Constructor called');
    this.rcl = rcl;
    this.wflib = wflib;
    this.engine = engine;
    this.wfId = wfId;
  }

  /**
   * Example API function.
   * TODO: remove in future.
   */
  public addNumbers(a: number, b: number): number {
    Logger.debug('[API] Adding ' + a.toString() + ' to ' + b.toString());
    return a + b;
  }

  /**
   * We want to store RPC instance, because we would
   * like to make some calls to autoscaler API.
   * @param rpc
   */
  public assignRPC(rpc: RPC): void {
    if (this.rpc !== undefined) {
      throw Error('RPC is already assigned');
    }
    this.rpc = rpc;

    return;
  }

  /**
   * Binds to eventServer in engine to capture relevant data.
   */
  public listenForEvents(): void {
    /* Below hacky-line could be uncommented to get more events. */
    //this.engine.logProvenance = true;

    /* Listen for engine events and pass them autoscaler. */
    const cbBuilder = (name) => {
      return (...values) => {
        Logger.debug(
          '[API] Captured event from engine ' +
            name.toString() +
            ': ' +
            JSON.stringify(values)
        );
        if (this.rpc === undefined) {
          throw Error('No RPC assigned to API');
        }
        this.rpc.callAsync('onHFEngineEvent', [this.wfId, name, values]);
      };
    };
    ['persist', 'input', 'read', 'prov'].forEach(name => {
      this.engine.eventServer.on(name, cbBuilder(name));
    });

    return;
  }
}

export default API;
