export type LatLng = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(from: LatLng, to: LatLng): number {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function greatCircle(from: LatLng, to: LatLng, steps = 32): Array<[number, number]> {
  const safeSteps = Math.max(1, steps);
  const latitude1 = toRadians(from.latitude);
  const longitude1 = toRadians(from.longitude);
  const latitude2 = toRadians(to.latitude);
  const longitude2 = toRadians(to.longitude);
  const angularDistance = 2 * Math.asin(
    Math.min(
      1,
      Math.sqrt(
        Math.sin((latitude2 - latitude1) / 2) ** 2 +
          Math.cos(latitude1) * Math.cos(latitude2) * Math.sin((longitude2 - longitude1) / 2) ** 2,
      ),
    ),
  );
  if (angularDistance === 0) return [[from.latitude, from.longitude]];

  const points: Array<[number, number]> = [];
  for (let index = 0; index <= safeSteps; index += 1) {
    const fraction = index / safeSteps;
    const weightFrom = Math.sin((1 - fraction) * angularDistance) / Math.sin(angularDistance);
    const weightTo = Math.sin(fraction * angularDistance) / Math.sin(angularDistance);
    const x = weightFrom * Math.cos(latitude1) * Math.cos(longitude1) + weightTo * Math.cos(latitude2) * Math.cos(longitude2);
    const y = weightFrom * Math.cos(latitude1) * Math.sin(longitude1) + weightTo * Math.cos(latitude2) * Math.sin(longitude2);
    const z = weightFrom * Math.sin(latitude1) + weightTo * Math.sin(latitude2);
    const latitude = Math.atan2(z, Math.sqrt(x * x + y * y));
    const longitude = Math.atan2(y, x);
    points.push([(latitude * 180) / Math.PI, (longitude * 180) / Math.PI]);
  }
  points[0] = [from.latitude, from.longitude];
  points[points.length - 1] = [to.latitude, to.longitude];
  return points;
}
