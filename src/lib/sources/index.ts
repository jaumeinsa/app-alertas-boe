/**
 * Registro de adaptadores activos.
 *
 * A medida que se implementen nuevos adaptadores (BORME, BOPs, autonómicos),
 * se añaden aquí y la ingesta los recogerá automáticamente.
 */

import { boaAdapter } from "./boa";
import { bocmAdapter } from "./bocm";
import { boeAdapter } from "./boe";
import { bocCantabriaAdapter } from "./boc_cantabria";
import { boibAdapter } from "./boib";
import { bojaAdapter } from "./boja";
import { bopACorunaAdapter } from "./bop_acoruna";
import { bopAlicanteAdapter } from "./bop_alicante";
import { bopAvilaAdapter } from "./bop_avila";
import { bopBadajozAdapter } from "./bop_badajoz";
import { bopCaceresAdapter } from "./bop_caceres";
import { bopMelillaAdapter } from "./bop_melilla";
import { bopGranadaAdapter, bopSevillaAdapter } from "./bop_opencms";
import { bopHuescaAdapter } from "./bop_huesca";
import { bopTarragonaAdapter } from "./bop_tarragona";
import { bopZaragozaAdapter } from "./bop_zaragoza";
import { bopMalagaAdapter } from "./bop_malaga";
import { bopCadizAdapter } from "./bop_cadiz";
import { bopHuelvaAdapter } from "./bop_huelva";
import { bopSoriaAdapter } from "./bop_soria";
import { bopCuencaAdapter } from "./bop_cuenca";
import { bopSegoviaAdapter } from "./bop_segovia";
import { bopLeonAdapter } from "./bop_leon";
import { bopBizkaiaAdapter } from "./bop_bizkaia";
import { bopAlavaAdapter } from "./bop_alava";
import { bopLleidaAdapter } from "./bop_lleida";
import { bopCeutaAdapter } from "./bop_ceuta";
import { bopAlbaceteAdapter } from "./bop_albacete";
import { bopGuadalajaraAdapter } from "./bop_guadalajara";
import { bopCastellonAdapter } from "./bop_castellon";
import { bopAlmeriaAdapter } from "./bop_almeria";
import { bopBarcelonaAdapter } from "./bop_barcelona";
import { bopBurgosAdapter } from "./bop_burgos";
import { bopLasPalmasAdapter, bopTenerifeAdapter } from "./bop_canarias";
import { bopCiudadRealAdapter } from "./bop_ciudadreal";
import { bopLugoAdapter } from "./bop_lugo";
import { bopCordobaAdapter } from "./bop_cordoba";
import { bopGipuzkoaAdapter } from "./bop_gipuzkoa";
import { bopGironaAdapter } from "./bop_girona";
import { bopJaenAdapter } from "./bop_jaen";
import { bopOurenseAdapter } from "./bop_ourense";
import { bopPalenciaAdapter, bopZamoraAdapter } from "./bop_palencia_zamora";
import { bopPontevedraAdapter } from "./bop_pontevedra";
import { bopSalamancaAdapter } from "./bop_salamanca";
import { bopTeruelAdapter } from "./bop_teruel";
import { bopToledoAdapter } from "./bop_toledo";
import { bopValladolidAdapter } from "./bop_valladolid";
import { bopaAdapter } from "./bopa";
import { docmAdapter } from "./docm";
import { doeAdapter } from "./doe";
import { bocCanariasAdapter } from "./boc_canarias";
import { bocylAdapter } from "./bocyl";
import { bonAdapter } from "./bon";
import { borAdapter } from "./bor";
import { bormCcaaAdapter } from "./borm_ccaa";
import { bormeAdapter } from "./borme";
import { bopvAdapter } from "./bopv";
import { bopValenciaAdapter } from "./bop_valencia";
import { dogAdapter } from "./dog";
import { dogcAdapter } from "./dogc";
import { dogvAdapter } from "./dogv";
import { SourceAdapter } from "./types";

export const ADAPTERS: SourceAdapter[] = [
  boeAdapter,
  bormeAdapter,
  dogvAdapter,
  bojaAdapter,
  dogcAdapter,
  bormCcaaAdapter,
  bopvAdapter,
  bocylAdapter,
  borAdapter,
  dogAdapter,
  bonAdapter,
  bocCanariasAdapter,
  bopValenciaAdapter,
  boaAdapter,
  docmAdapter,
  doeAdapter,
  bopaAdapter,
  bocmAdapter,
  bocCantabriaAdapter,
  boibAdapter,
  bopCordobaAdapter,
  bopJaenAdapter,
  bopAvilaAdapter,
  bopOurenseAdapter,
  bopACorunaAdapter,
  bopPontevedraAdapter,
  bopToledoAdapter,
  bopCiudadRealAdapter,
  bopValladolidAdapter,
  bopSalamancaAdapter,
  bopGipuzkoaAdapter,
  bopLasPalmasAdapter,
  bopTenerifeAdapter,
  bopLugoAdapter,
  bopTeruelAdapter,
  bopBurgosAdapter,
  bopBarcelonaAdapter,
  bopGironaAdapter,
  bopPalenciaAdapter,
  bopZamoraAdapter,
  bopAlicanteAdapter,
  bopGranadaAdapter,
  bopSevillaAdapter,
  bopBadajozAdapter,
  bopCaceresAdapter,
  bopMelillaAdapter,
  bopTarragonaAdapter,
  bopHuescaAdapter,
  bopZaragozaAdapter,
  bopMalagaAdapter,
  bopCadizAdapter,
  bopHuelvaAdapter,
  bopSoriaAdapter,
  bopCuencaAdapter,
  bopSegoviaAdapter,
  bopLeonAdapter,
  bopBizkaiaAdapter,
  bopAlavaAdapter,
  bopLleidaAdapter,
  bopCeutaAdapter,
  bopAlbaceteAdapter,
  bopGuadalajaraAdapter,
  bopCastellonAdapter,
  bopAlmeriaAdapter,
];

export function enabledAdapters(): SourceAdapter[] {
  // INGEST_ONLY="BORME" (o "BOE,BORME") limita la ingesta a esas fuentes,
  // útil para backfillear una sola fuente sin re-descargar las demás.
  const only = process.env.INGEST_ONLY?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  return ADAPTERS.filter((a) => a.enabled && (!only || only.length === 0 || only.includes(a.code)));
}

export function getAdapter(code: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.code === code);
}

export * from "./types";
export * from "./catalog";
