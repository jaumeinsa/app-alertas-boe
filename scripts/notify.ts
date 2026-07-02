/**
 * Worker de avisos: envía por email las coincidencias en estado NEW.
 * Alternativa al endpoint /api/cron/notify para ejecutarlo desde el worker:
 *   docker compose exec -T worker sh -c "npx tsx scripts/notify.ts"
 */

import { notifyNewMatches } from "@/lib/notify";

notifyNewMatches()
  .then((summary) => {
    console.log(JSON.stringify(summary));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
