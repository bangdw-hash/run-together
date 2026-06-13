/** Geographic primitives shared by the app and the realtime gateway. */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface LocationPing extends LatLng {
  /** epoch milliseconds */
  ts: number;
}

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in meters. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing from `a` to `b`, degrees clockwise from north in [0, 360). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Destination point given a start, a bearing (deg) and a distance (m). */
export function projectPoint(origin: LatLng, bearing: number, distanceM: number): LatLng {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = toRad(bearing);
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lng);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

/**
 * Privacy snap: round coordinates to a grid of roughly `gridM` meters so a
 * runner's precise position is never exposed before mutual accept.
 */
export function snapToGrid(loc: LatLng, gridM = 150): LatLng {
  const latStep = gridM / 111_320; // meters per degree latitude
  const lngStep = gridM / (111_320 * Math.max(0.1, Math.cos(toRad(loc.lat))));
  return {
    lat: Math.round(loc.lat / latStep) * latStep,
    lng: Math.round(loc.lng / lngStep) * lngStep,
  };
}

/** Pace (seconds per km) → speed in m/s. */
export const paceToMps = (secPerKm: number) => 1000 / secPerKm;

/** Speed in m/s → pace in seconds per km. */
export const mpsToPace = (mps: number) => 1000 / mps;
