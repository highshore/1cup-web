import { NextRequest, NextResponse } from "next/server";

import {
  AdminGiftError,
  getAdminGifts,
  listAdminGiftProducts,
  lookupAdminGiftProduct,
  sendAdminGift,
} from "../../../lib/features/gifts/services/admin_gift_service";
import type { SendAdminGiftInput } from "../../../lib/features/gifts/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function parseSendInput(value: Record<string, unknown>): SendAdminGiftInput | null {
  const memberId = nullableString(value.memberId);
  const recipientName = nullableString(value.recipientName);
  const phoneNumber = nullableString(value.phoneNumber);
  if (memberId === undefined || recipientName === undefined || phoneNumber === undefined) return null;
  if (
    typeof value.goodsCode !== "string" ||
    typeof value.mmsTitle !== "string" ||
    typeof value.mmsMessage !== "string"
  ) {
    return null;
  }
  return {
    memberId,
    recipientName,
    phoneNumber,
    goodsCode: value.goodsCode,
    mmsTitle: value.mmsTitle,
    mmsMessage: value.mmsMessage,
  };
}

function errorResponse(error: unknown) {
  if (error instanceof AdminGiftError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error("Admin gift route failed:", error);
  return NextResponse.json(
    { error: "The gift center is temporarily unavailable." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  try {
    const data = await getAdminGifts();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Invalid gift request." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (body.action === "lookup-product") {
      if (typeof body.goodsCode !== "string") {
        return NextResponse.json(
          { error: "A Giftishow product code is required." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      const product = await lookupAdminGiftProduct(body.goodsCode);
      return NextResponse.json(product, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.action === "list-products") {
      const page = typeof body.page === "number" ? body.page : 1;
      const catalog = await listAdminGiftProducts(page);
      return NextResponse.json(catalog, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.action !== "send") {
      return NextResponse.json(
        { error: "Unsupported gift action." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const input = parseSendInput(body);
    if (!input) {
      return NextResponse.json(
        { error: "Invalid gift details." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await sendAdminGift(input);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
