import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { loadContent } from "../../../shared/api";
import { TextWithLinks } from "../../../shared/ui/text-with-links";
import { PhotoGallery } from "../../../shared/ui/photo-gallery";

export function MediaDetail() {
  const { id } = useParams();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["content"],
    queryFn: () => loadContent(),
  });
  const item = data?.media.find((media) => media.id === id);
  return (
    <main id="main" className="container media-detail">
      <Link to="/media" className="text-link">
        <ArrowLeft size={18} /> Вернуться в медиа
      </Link>
      {isPending ? (
        <p className="empty" role="status">
          Загружаем материал…
        </p>
      ) : error ? (
        <div className="empty" role="alert">
          Не удалось загрузить материал.{" "}
          <button onClick={() => void refetch()}>Повторить</button>
        </div>
      ) : !item ? (
        <div className="empty">
          <h1>Материал не найден</h1>
          <p>Возможно, публикация снята с сайта.</p>
        </div>
      ) : (
        <article>
          <header className="media-detail-heading">
            <p className="eyebrow">
              ХРОНИКА ОБЪЕДИНЕНИЯ{" "}
              {item.eventDate && (
                <>
                  ·{" "}
                  <time dateTime={item.eventDate}>
                    {new Date(
                      `${item.eventDate}T12:00:00+03:00`,
                    ).toLocaleDateString("ru", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "Europe/Moscow",
                    })}
                  </time>
                </>
              )}
            </p>
            <h1>{item.title}</h1>
          </header>
          {item.kind === "video" && (
            <video
              className="detail-video"
              controls
              preload="metadata"
              src={item.url}
              aria-label={item.title}
            />
          )}
          <PhotoGallery
            key={item.id}
            title={item.title}
            images={[
              ...(item.kind === "image" ? [item.url] : []),
              ...(item.images ?? []).map((image) => image.url),
            ]}
          />
          <div className="media-story">
            <h2>О событии</h2>
            <TextWithLinks text={item.description} />
          </div>
        </article>
      )}
    </main>
  );
}
