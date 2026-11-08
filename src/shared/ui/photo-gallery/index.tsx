import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

export function PhotoGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [selected, setCurrent] = useState(0);
  const current = Math.min(selected, Math.max(0, images.length - 1));
  const dialog = useRef<HTMLDialogElement>(null);
  const pointer = useRef<number | null>(null);
  const swiped = useRef(false);
  function show(index: number) {
    setCurrent((index + images.length) % images.length);
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && dialog.current?.open) {
      event.preventDefault();
      dialog.current.close();
    }
    const index = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: images.length - 1,
    }[event.key];
    if (index !== undefined) {
      event.preventDefault();
      show(index);
    }
  }
  function start(event: PointerEvent<HTMLElement>) {
    pointer.current = event.clientX;
    swiped.current = false;
  }
  function end(event: PointerEvent<HTMLElement>) {
    if (pointer.current === null) return;
    const distance = event.clientX - pointer.current;
    pointer.current = null;
    if (Math.abs(distance) >= 40) {
      swiped.current = true;
      show(current + (distance < 0 ? 1 : -1));
    }
  }
  const controls = (
    <div className="gallery-controls">
      <span aria-live="polite" aria-atomic="true">
        {String(current + 1).padStart(2, "0")} /{" "}
        {String(images.length).padStart(2, "0")}
      </span>
      <button
        className="icon-button"
        type="button"
        disabled={images.length < 2}
        aria-label="Предыдущее изображение"
        onClick={() => show(current - 1)}
      >
        <ChevronLeft />
      </button>
      <button
        className="icon-button"
        type="button"
        disabled={images.length < 2}
        aria-label="Следующее изображение"
        onClick={() => show(current + 1)}
      >
        <ChevronRight />
      </button>
    </div>
  );
  if (!images.length) return null;
  return (
    <section
      className="photo-gallery"
      role="region"
      aria-label={`Галерея: ${title}`}
      tabIndex={0}
      onKeyDown={keyboard}
    >
      <button
        className="gallery-stage"
        type="button"
        aria-label={`Открыть изображение ${current + 1} на полный экран`}
        onPointerDown={start}
        onPointerUp={end}
        onClick={() => {
          if (!swiped.current) dialog.current!.showModal();
          swiped.current = false;
        }}
      >
        <img
          key={images[current]}
          src={images[current]}
          alt={`${title}, кадр ${current + 1}`}
          draggable={false}
        />
        <span className="gallery-expand" aria-hidden="true">
          <Maximize2 size={18} />
        </span>
      </button>
      {controls}
      {images.length > 1 && (
        <ul className="gallery-thumbnails" aria-label="Миниатюры галереи">
          {images.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                aria-label={`Показать кадр ${index + 1}`}
                aria-current={index === current}
                onClick={() => show(index)}
              >
                <img src={url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-label={`Полноэкранный просмотр: ${title}`}
      >
        <button
          className="icon-button gallery-close"
          type="button"
          aria-label="Закрыть полноэкранный просмотр"
          onClick={() => dialog.current!.close()}
        >
          <X />
        </button>
        <img
          src={images[current]}
          alt={`${title}, кадр ${current + 1}`}
          onPointerDown={start}
          onPointerUp={end}
          draggable={false}
        />
        {controls}
      </dialog>
    </section>
  );
}
