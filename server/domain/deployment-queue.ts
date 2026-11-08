import type { Store } from "../repository/store.js";
export function deploymentCommand(
  store: Store,
  args: string[],
  now = new Date().toISOString(),
) {
  if (args[0] === "recover") {
    store.recoverDeployments();
    return "";
  }
  if (args[0] === "claim") {
    const job = store.claimDeployment(now);
    return job ? `${job.id}\t${job.version}\t${job.scheduledAt}` : "";
  }
  if (
    args[0] === "finish" &&
    args[1] &&
    ["succeeded", "failed"].includes(args[2])
  ) {
    const status = args[2] as "succeeded" | "failed";
    if (
      !store.finishDeployment(
        args[1],
        status,
        status === "succeeded"
          ? "Обновление завершено, проверка готовности пройдена."
          : "Обновление не завершено. Проверьте журнал исполнителя на VPS.",
      )
    )
      throw new Error("Задание не выполняется.");
    return "";
  }
  throw new Error("Используйте claim, recover или finish ID succeeded|failed.");
}
