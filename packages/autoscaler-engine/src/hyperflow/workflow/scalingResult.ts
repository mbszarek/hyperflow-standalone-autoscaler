import ResourceRequirements from '../../kubernetes/resourceRequirements';

interface ScoreOptions {
  skipOverProvision?: boolean;
}

class ScalingResult {
  private price?: number;

  private totalCpuUnderprovisionSupply = 0;
  private totalCpuUnderprovisionDemand = 0;
  private totalCpuOverprovisionSupply = 0;
  private totalCpuOverprovisionDemand = 0;

  private totalMemUnderprovisionSupply = 0;
  private totalMemUnderprovisionDemand = 0;
  private totalMemOverprovisionSupply = 0;
  private totalMemOverprovisionDemand = 0;

  private totalFrames: number;

  private workloadCpuBuffer = 0;
  private workloadMemBuffer = 0;

  public constructor() {
    this.totalFrames = 0;
  }

  /**
   * Setter for price.
   * @param price
   */
  public setPrice(price: number): void {
    this.price = price;
    return;
  }

  /**
   * Getter for price.
   */
  public getPrice(): number {
    if (this.price === undefined) {
      throw Error('Price is not set');
    }
    return this.price;
  }

  /**
   * Getter for totalFrames.
   */
  public getFramesAmount(): number {
    return this.totalFrames;
  }

  /**
   * Feed object with frame, that will affect score.
   * @param supply
   * @param demand
   */
  public addFrame(
    supply: ResourceRequirements,
    demand: ResourceRequirements
  ): void {
    /* We have to account missing supply from previous frames
     * to simulate workload being executed later due to missing
     * supply. */
    const adjustedDemand = new ResourceRequirements({
      cpu: (demand.getCpuMillis() + this.workloadCpuBuffer).toString() + 'm',
      mem: (demand.getMemBytes() + this.workloadMemBuffer).toString()
    });
    /* Update missing workload buffer with new value. */
    this.workloadCpuBuffer = Math.max(
      0,
      adjustedDemand.getCpuMillis() - supply.getCpuMillis()
    );
    this.workloadMemBuffer = Math.max(
      0,
      adjustedDemand.getMemBytes() - supply.getMemBytes()
    );

    /* Increase total counters. */
    this.totalFrames += 1;

    /* Count CPU under/overprovisioning. */
    if (adjustedDemand.getCpuMillis() > supply.getCpuMillis()) {
      this.totalCpuUnderprovisionDemand += adjustedDemand.getCpuMillis();
      this.totalCpuUnderprovisionSupply += supply.getCpuMillis();
    } else if (adjustedDemand.getCpuMillis() < supply.getCpuMillis()) {
      this.totalCpuOverprovisionDemand += adjustedDemand.getCpuMillis();
      this.totalCpuOverprovisionSupply += supply.getCpuMillis();
    }
    /* Count memory under/overprovisioning. */
    if (adjustedDemand.getMemBytes() > supply.getMemBytes()) {
      this.totalMemUnderprovisionDemand += adjustedDemand.getMemBytes();
      this.totalMemUnderprovisionSupply += supply.getMemBytes();
    } else if (adjustedDemand.getMemBytes() < supply.getMemBytes()) {
      this.totalMemOverprovisionDemand += adjustedDemand.getMemBytes();
      this.totalMemOverprovisionSupply += supply.getMemBytes();
    }

    return;
  }

  /**
   * Caclulates score based on feeded frames.
   * The better option, the bigger score.
   *
   * TODO: Think if 0 is great default value
   */
  public getScore({ skipOverProvision = false }: ScoreOptions): number {
    /* Base scores. */
    let cpuUnderWaste = 0; // percentage of missing demand
    if (this.totalCpuUnderprovisionDemand != 0) {
      cpuUnderWaste =
        (this.totalCpuUnderprovisionDemand -
          this.totalCpuUnderprovisionSupply) /
        this.totalCpuUnderprovisionDemand; // equivalent: (supply / demand) - 1) * -1
    }
    let cpuOverWaste = 0; // percentage of too much supply
    if (this.totalCpuOverprovisionDemand != 0 && skipOverProvision == false) {
      cpuOverWaste =
        (this.totalCpuOverprovisionSupply - this.totalCpuOverprovisionDemand) /
        this.totalCpuOverprovisionDemand; // equivalent: (supply / demand) - 1)
    }
    let memUnderWaste = 0; // percentage of missing demand
    if (this.totalMemUnderprovisionDemand != 0) {
      memUnderWaste =
        (this.totalMemUnderprovisionDemand -
          this.totalMemUnderprovisionSupply) /
        this.totalMemUnderprovisionDemand; // equivalent: (supply / demand) - 1) * -1
    }
    let memOverWaste = 0; // percentage of too much supply
    if (this.totalMemOverprovisionDemand != 0 && skipOverProvision == false) {
      memOverWaste =
        (this.totalMemOverprovisionSupply - this.totalMemOverprovisionDemand) /
        this.totalMemOverprovisionDemand; // equivalent: (supply / demand) - 1)
    }

    /* Temporary idea - aggresive minimization of underProvision: ignore
     * single resource overProvision, to make sure we provide enough
     * resources. */
    if (cpuUnderWaste > 0 && memOverWaste > 0) {
      memOverWaste = 0;
    }
    if (cpuOverWaste > 0 && memUnderWaste > 0) {
      cpuOverWaste = 0;
    }

    /* Grouped scores - average of both percentages. */
    const underWaste = (cpuUnderWaste + memUnderWaste) / 2;
    const overWaste = (cpuOverWaste + memOverWaste) / 2;

    /* Total score */
    const resourcesWaste = underWaste + overWaste;
    const score = 1 / resourcesWaste;
    return score;
  }
}

export { ScoreOptions, ScalingResult };
