import crypto from "crypto";
import { IPaymentGateway, PaymentOrderInfo, PaymentUrlResult, IpnVerificationResult } from "./payment.interface";
import { logger } from "../../utils/logger";

export class VNPayPaymentAdapter implements IPaymentGateway {
  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly vnpUrl: string;

  constructor() {
    this.tmnCode = process.env.VNPAY_TMN_CODE || "GRABDEMO";
    this.hashSecret = process.env.VNPAY_HASH_SECRET || "GRABPLATFORMSECRETKEYFORVNPAYHMACSHA512";
    this.vnpUrl = process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  }

  public async createPaymentUrl(order: PaymentOrderInfo): Promise<PaymentUrlResult> {
    const createDate = this.formatDate(new Date());
    const txnRef = `${order.tripId}_${Date.now()}`;

    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: order.orderDescription,
      vnp_OrderType: "other",
      vnp_Amount: (order.amount * 100).toString(), // VNPay yêu cầu nhân 100
      vnp_ReturnUrl: process.env.VNPAY_RETURN_URL || "http://localhost:3000/payment/result",
      vnp_IpAddr: order.clientIp || "127.0.0.1",
      vnp_CreateDate: createDate,
    };

    // Sắp xếp tham số theo alphabet (bắt buộc theo tài liệu VNPay)
    const sortedParams = this.sortObject(params);
    const signData = new URLSearchParams(sortedParams).toString();

    // Sinh chữ ký HMAC-SHA512
    const hmac = crypto.createHmac("sha512", this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    sortedParams["vnp_SecureHash"] = signed;
    const paymentUrl = `${this.vnpUrl}?${new URLSearchParams(sortedParams).toString()}`;

    logger.debug({ txnRef, amount: order.amount }, "[VNPAY ADAPTER] Đã sinh URL thanh toán");

    return {
      paymentUrl,
      transactionRef: txnRef,
    };
  }

  public verifyIpnWebhook(query: Record<string, unknown>): IpnVerificationResult {
    const secureHash = query["vnp_SecureHash"] as string;
    const cleanParams: Record<string, string> = {};

    for (const [key, value] of Object.entries(query)) {
      if (key !== "vnp_SecureHash" && key !== "vnp_SecureHashType" && typeof value === "string") {
        cleanParams[key] = value;
      }
    }

    const sortedParams = this.sortObject(cleanParams);
    const signData = new URLSearchParams(sortedParams).toString();

    const hmac = crypto.createHmac("sha512", this.hashSecret);
    const calculatedHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    const isValid = secureHash?.toLowerCase() === calculatedHash.toLowerCase();
    const responseCode = query["vnp_ResponseCode"] as string;
    const isSuccess = isValid && responseCode === "00";
    const txnRef = (query["vnp_TxnRef"] as string) || "";
    const tripId = txnRef.split("_")[0] || "";
    const gatewayTxnId = (query["vnp_TransactionNo"] as string) || "";
    const amount = Number(query["vnp_Amount"]) / 100;

    return {
      isValid,
      isSuccess,
      invoiceId: tripId,
      gatewayTransactionId: gatewayTxnId,
      amount,
      responseCode,
      rawPayload: query,
    };
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        sorted[key] = obj[key]!;
      }
    }
    return sorted;
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => (n < 10 ? "0" + n : n.toString());
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
  }
}

export const paymentGateway = new VNPayPaymentAdapter();
