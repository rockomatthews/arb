export class KillSwitch {
  private readonly maxErrors: number;
  private errorCount = 0;
  private tripped = false;

  constructor(maxErrors = 5) {
    this.maxErrors = maxErrors;
  }

  recordError(): void {
    this.errorCount += 1;
    if (this.errorCount >= this.maxErrors) {
      this.tripped = true;
    }
  }

  reset(): void {
    this.errorCount = 0;
    this.tripped = false;
  }

  isTripped(): boolean {
    return this.tripped;
  }
}
