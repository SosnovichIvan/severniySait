import "dotenv/config";
import { Store } from "../server/repository/store.js";
import { deploymentCommand } from "../server/domain/deployment-queue.js";
const store = new Store(process.env.DATABASE_PATH ?? "data/portal.sqlite");
try {
  const result = deploymentCommand(store, process.argv.slice(2));
  if (result) console.log(result);
} finally {
  store.close();
}
