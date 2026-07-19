export const PROVIDER_PROFILE_NOT_FOUND_MESSAGE = "Provider profile not found";

export class ProviderProfileNotFoundError extends Error {
  constructor() {
    super(PROVIDER_PROFILE_NOT_FOUND_MESSAGE);
    this.name = "ProviderProfileNotFoundError";
  }
}
