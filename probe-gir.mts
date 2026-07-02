import { bopGironaAdapter } from "./src/lib/sources/bop_girona";
console.time("girona");
const pubs = await bopGironaAdapter.fetchByDate(new Date("2025-06-16T00:00:00.000Z"));
console.timeEnd("girona");
const a = pubs[0];
console.log("Girona:", pubs.length, "docs | ej", a?.externalId, "len", a?.searchText?.length, "|", a?.title?.slice(0,45));
