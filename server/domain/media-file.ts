export function identifyMedia(buffer: Buffer) {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { extension: "png", kind: "image" as const };
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return { extension: "jpg", kind: "image" as const };
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return { extension: "webp", kind: "image" as const };
  if (
    buffer.toString("ascii", 4, 8) === "ftyp" &&
    ["isom", "iso2", "mp41", "mp42", "avc1"].includes(
      buffer.toString("ascii", 8, 12),
    )
  )
    return { extension: "mp4", kind: "video" as const };
  return null;
}
