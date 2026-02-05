export type VenueHealth = {
  venueId: string;
  ok: boolean;
  lastCheckedMs: number;
  error?: string;
};

export class HealthRegistry {
  private state = new Map<string, VenueHealth>();

  update(health: VenueHealth): void {
    this.state.set(health.venueId, health);
  }

  all(): VenueHealth[] {
    return Array.from(this.state.values());
  }
}
