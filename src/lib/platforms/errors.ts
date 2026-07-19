export class ProviderProfileNotFoundError extends Error {
  constructor() {
    super("Provider profile not found");
    this.name = "ProviderProfileNotFoundError";
  }
}
