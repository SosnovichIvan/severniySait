/** Render editorial source URLs without interpreting user text as HTML. */
export function TextWithLinks({ text }: { text: string }) {
  return text.split(/(https:\/\/[^\s]+)/g).map((part, index) =>
    part.startsWith("https://") ? (
      <a key={index} href={part} title={part} target="_blank" rel="noreferrer">
        Открыть источник ↗
      </a>
    ) : (
      part
    ),
  );
}
