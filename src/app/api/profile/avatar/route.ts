import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { JsonRequestError, readJsonBody } from "@/lib/security";

const MAX_DECODED_SIZE = 64 * 1024;
const MAX_DIMENSION = 2_048;
const MAX_PIXELS = 4_000_000;
const DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function getImageDimensions(data: Buffer, type: string) {
  if (type === "png" && data.length >= 24) {
    if (!data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }

  if (type === "webp" && data.length >= 30) {
    if (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") return null;
    const chunk = data.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        width: 1 + data.readUIntLE(24, 3),
        height: 1 + data.readUIntLE(27, 3),
      };
    }
    if (chunk === "VP8L" && data[20] === 0x2f) {
      return {
        width: 1 + data[21] + ((data[22] & 0x3f) << 8),
        height: 1 + (data[22] >> 6) + (data[23] << 2) + ((data[24] & 0x0f) << 10),
      };
    }
    if (
      chunk === "VP8 " &&
      data[23] === 0x9d &&
      data[24] === 0x01 &&
      data[25] === 0x2a
    ) {
      return {
        width: data.readUInt16LE(26) & 0x3fff,
        height: data.readUInt16LE(28) & 0x3fff,
      };
    }
    return null;
  }

  if (type === "jpeg" && data.length >= 12 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = data[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          height: data.readUInt16BE(offset + 5),
          width: data.readUInt16BE(offset + 7),
        };
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const segmentLength = data.readUInt16BE(offset + 2);
      if (segmentLength < 2) return null;
      offset += 2 + segmentLength;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await readJsonBody(req, 96 * 1024);
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const avatar =
    payload && typeof payload === "object" && "avatar" in payload
      ? (payload as { avatar?: unknown }).avatar
      : null;
  if (!avatar || typeof avatar !== "string") {
    return NextResponse.json({ error: "No avatar data" }, { status: 400 });
  }

  const match = avatar.match(DATA_URL_PATTERN);
  if (!match) {
    return NextResponse.json({ error: "Use a PNG, JPEG, or WebP image" }, { status: 400 });
  }
  const image = Buffer.from(match[2], "base64");
  const normalizedInput = match[2].replace(/=+$/, "");
  if (
    image.length === 0 ||
    image.length > MAX_DECODED_SIZE ||
    image.toString("base64").replace(/=+$/, "") !== normalizedInput
  ) {
    return NextResponse.json({ error: "Image must be 64KB or smaller" }, { status: 400 });
  }
  const dimensions = getImageDimensions(image, match[1]);
  if (
    !dimensions ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > MAX_DIMENSION ||
    dimensions.height > MAX_DIMENSION ||
    dimensions.width * dimensions.height > MAX_PIXELS
  ) {
    return NextResponse.json({ error: "Invalid or oversized image dimensions" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: avatar },
  });
  revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });

  return NextResponse.json({ success: true, avatarUrl: avatar });
}

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
  });
  revalidateTag(CACHE_TAGS.leaderboard, { expire: 0 });

  return NextResponse.json({ success: true });
}
