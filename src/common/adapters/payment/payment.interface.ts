export interface PaymentOrderInfo {
  invoiceId: string;
  tripId: string;
  amount: number;
  orderDescription: string;
  clientIp: string;
}

export interface PaymentUrlResult {
  paymentUrl: string;
  transactionRef: string;
}

export interface IpnVerificationResult {
  isValid: boolean;
  isSuccess: boolean;
  invoiceId: string;
  gatewayTransactionId: string;
  amount: number;
  responseCode: string;
  rawPayload: Record<string, unknown>;
}

export interface IPaymentGateway {
  /**
   * Sinh URL thanh toán có chữ ký số HMAC
   */
  createPaymentUrl(order: PaymentOrderInfo): Promise<PaymentUrlResult>;

  /**
   * Kiểm tra tính toàn vẹn và chữ ký số HMAC của webhook IPN từ cổng thanh toán
   */
  verifyIpnWebhook(query: Record<string, unknown>): IpnVerificationResult;
}
