import { useEffect, useState } from "react";
export function getMoscowDate(date = new Date()) {
  const local = new Date(date.getTime() + 3 * 3600000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
  };
}
export function useMoscowToday() {
  const [today, setToday] = useState(() => getMoscowDate());
  useEffect(() => {
    const update = () => setToday(getMoscowDate());
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return today;
}
