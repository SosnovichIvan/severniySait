/** Official emblem with a readable regional wordmark in both site headers. */
export function BrandLockup() {
  return (
    <span className="brand-lockup">
      <img
        className="brand-emblem"
        src="/logo.png"
        alt=""
        width="48"
        height="60"
      />
      <span className="brand-wordmark">
        <span className="brand-title">Северный человек</span>
        <span className="brand-region">Москва и Подмосковье</span>
      </span>
    </span>
  );
}
