/**
 * Virtuální trasa Ostrava -> Barcelona (cca 2185 km)
 * Podrobná struktura waypointů s přibližnými souřadnicemi a typy.
 */

import type { VirtualRoutePoint } from './TachoTypes'

export const VIRTUAL_ROUTE_POINTS: VirtualRoutePoint[] = [
  { name: 'Ostrava', kmFromStart: 0, country: 'CZ', coordinates: { lat: 49.8356, lng: 18.2820 }, type: 'city' },
  { name: 'Přerov', kmFromStart: 55, country: 'CZ', coordinates: { lat: 49.4550, lng: 17.4508 }, type: 'city' },
  { name: 'Olomouc', kmFromStart: 95, country: 'CZ', coordinates: { lat: 49.5938, lng: 17.2509 }, type: 'city' },
  { name: 'Vyškov', kmFromStart: 135, country: 'CZ', coordinates: { lat: 49.2774, lng: 16.9990 }, type: 'city' },
  { name: 'Brno', kmFromStart: 170, country: 'CZ', coordinates: { lat: 49.1951, lng: 16.6068 }, type: 'city' },
  { name: 'Břeclav', kmFromStart: 240, country: 'CZ', coordinates: { lat: 48.7587, lng: 16.8820 }, type: 'border_crossing' },
  { name: 'Vídeň', kmFromStart: 330, country: 'AT', coordinates: { lat: 48.2082, lng: 16.3738 }, type: 'city' },
  { name: 'St. Pölten', kmFromStart: 385, country: 'AT', coordinates: { lat: 48.2047, lng: 15.6256 }, type: 'city' },
  { name: 'Linz', kmFromStart: 455, country: 'AT', coordinates: { lat: 48.3069, lng: 14.2858 }, type: 'city' },
  { name: 'Salzburg', kmFromStart: 530, country: 'AT', coordinates: { lat: 47.8095, lng: 13.0550 }, type: 'city' },
  { name: 'Freilassing', kmFromStart: 555, country: 'DE', coordinates: { lat: 47.8377, lng: 12.9814 }, type: 'border_crossing' },
  { name: 'Rosenheim', kmFromStart: 620, country: 'DE', coordinates: { lat: 47.8564, lng: 12.1286 }, type: 'city' },
  { name: 'Mnichov', kmFromStart: 770, country: 'DE', coordinates: { lat: 48.1351, lng: 11.5820 }, type: 'city' },
  { name: 'Memmingen', kmFromStart: 850, country: 'DE', coordinates: { lat: 47.9837, lng: 10.1807 }, type: 'city' },
  { name: 'Lindau', kmFromStart: 925, country: 'DE', coordinates: { lat: 47.5461, lng: 9.6848 }, type: 'border_crossing' },
  { name: 'St. Gallen', kmFromStart: 995, country: 'CH', coordinates: { lat: 47.4245, lng: 9.3767 }, type: 'city' },
  { name: 'Curych', kmFromStart: 1100, country: 'CH', coordinates: { lat: 47.3769, lng: 8.5417 }, type: 'city' },
  { name: 'Bern', kmFromStart: 1185, country: 'CH', coordinates: { lat: 46.9480, lng: 7.4474 }, type: 'city' },
  { name: 'Lausanne', kmFromStart: 1285, country: 'CH', coordinates: { lat: 46.5197, lng: 6.6323 }, type: 'city' },
  { name: 'Ženeva', kmFromStart: 1325, country: 'CH', coordinates: { lat: 46.2044, lng: 6.1432 }, type: 'border_crossing' },
  { name: 'Annecy', kmFromStart: 1385, country: 'FR', coordinates: { lat: 45.8992, lng: 6.1294 }, type: 'city' },
  { name: 'Chambéry', kmFromStart: 1465, country: 'FR', coordinates: { lat: 45.5646, lng: 5.9178 }, type: 'city' },
  { name: 'Lyon', kmFromStart: 1600, country: 'FR', coordinates: { lat: 45.7640, lng: 4.8357 }, type: 'city' },
  { name: 'Valence', kmFromStart: 1720, country: 'FR', coordinates: { lat: 44.9334, lng: 4.8916 }, type: 'city' },
  { name: 'Montélimar', kmFromStart: 1785, country: 'FR', coordinates: { lat: 44.5588, lng: 4.7509 }, type: 'city' },
  { name: 'Orange', kmFromStart: 1825, country: 'FR', coordinates: { lat: 44.1361, lng: 4.8108 }, type: 'city' },
  { name: 'Nîmes', kmFromStart: 1855, country: 'FR', coordinates: { lat: 43.8367, lng: 4.3601 }, type: 'city' },
  { name: 'Montpellier', kmFromStart: 1900, country: 'FR', coordinates: { lat: 43.6108, lng: 3.8767 }, type: 'city' },
  { name: 'Béziers', kmFromStart: 1945, country: 'FR', coordinates: { lat: 43.3442, lng: 3.2159 }, type: 'city' },
  { name: 'Narbonne', kmFromStart: 1985, country: 'FR', coordinates: { lat: 43.1839, lng: 2.9883 }, type: 'city' },
  { name: 'Perpignan', kmFromStart: 2045, country: 'FR', coordinates: { lat: 42.6986, lng: 2.8956 }, type: 'border_crossing' },
  { name: 'Figueres', kmFromStart: 2080, country: 'ES', coordinates: { lat: 42.2675, lng: 2.9614 }, type: 'city', region: 'Catalunya' },
  { name: 'Girona', kmFromStart: 2120, country: 'ES', coordinates: { lat: 41.9819, lng: 2.8241 }, type: 'city', region: 'Catalunya' },
  { name: 'Barcelona', kmFromStart: 2185, country: 'ES', coordinates: { lat: 41.3851, lng: 2.1734 }, type: 'city', region: 'Catalunya' },
]

export const VIRTUAL_ROUTE_LENGTH_KM = VIRTUAL_ROUTE_POINTS[VIRTUAL_ROUTE_POINTS.length - 1].kmFromStart

export function getVirtualLocationForDistance(distanceKm: number): VirtualRoutePoint {
  const clamped = Math.max(0, Math.min(distanceKm, VIRTUAL_ROUTE_LENGTH_KM))
  for (let i = VIRTUAL_ROUTE_POINTS.length - 1; i >= 0; i -= 1) {
    if (clamped >= VIRTUAL_ROUTE_POINTS[i].kmFromStart) {
      return VIRTUAL_ROUTE_POINTS[i]
    }
  }
  return VIRTUAL_ROUTE_POINTS[0]
}
