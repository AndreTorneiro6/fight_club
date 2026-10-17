/** External booking/payment/push providers can be added without changing league rules. */
export interface BookingProvider {
  available(courtId: string, start: string, end: string): Promise<boolean>;
  reserve(input: {
    challengeId: string;
    courtId: string;
    start: string;
    end: string;
  }): Promise<{ externalId: string }>;
  cancel(externalId: string): Promise<void>;
}
export interface PaymentProvider {
  createCheckout(input: {
    playerId: string;
    amountCents: number;
    currency: "EUR";
    reference: string;
  }): Promise<{ url: string; externalId: string }>;
  verifyWebhook(
    body: string,
    signature: string,
  ): Promise<{ reference: string; paid: boolean }>;
}
export interface PushProvider {
  send(
    userId: string,
    notification: { title: string; body: string; url: string },
  ): Promise<void>;
}
// No external provider is enabled by default. Court reservation works in MongoDB.
