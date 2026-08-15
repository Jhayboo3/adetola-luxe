export const MALE_MEASUREMENTS = [
  ["back", "Back"],
  ["chest", "Chest"],
  ["sleeveLength", "Sleeve Length"],
  ["sleeveRound", "Sleeve Round"],
  ["waist", "Waist"],
  ["neckRound", "Neck Round"],
  ["shirtLength", "Shirt Length"],
] as const;

export const FEMALE_MEASUREMENTS = [
  ["back", "Back"], ["bust", "Bust"], ["underBust", "Under Bust"],
  ["shoulderToUnderBust", "Shoulder to Under Bust"], ["waist", "Waist"],
  ["shoulderToNipple", "Shoulder to Nipple"], ["nippleToNipple", "Nipple to Nipple"],
  ["armholeRound", "Armhole Round"], ["halfLength", "Half Length"], ["hip", "Hip"],
  ["crotch", "Crotch"], ["skirtTrouserWaist", "Skirt and Trouser Waist"],
  ["gownLength", "Gown Length"], ["trouserLength", "Trouser Length"],
  ["skirtLength", "Skirt Length"], ["waistToKnee", "Waist to Knee"],
  ["kneeRound", "Knee Round"], ["ankleRound", "Ankle Round"],
  ["sleeveRound", "Sleeve Round"], ["sleeveLength", "Sleeve Length"],
  ["neckRound", "Neck Round"], ["shirtLength", "Shirt Length"],
] as const;

export type Gender = "Male" | "Female";
export type Measurements = Record<string, number>;

export function measurementFields(gender: string | null | undefined) {
  return gender === "Male" ? MALE_MEASUREMENTS : gender === "Female" ? FEMALE_MEASUREMENTS : [];
}

export function parseMeasurements(value: string | null | undefined): Measurements {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function validMeasurement(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 200;
}

export function missingMeasurements(gender: string | null | undefined, measurements: Measurements) {
  return measurementFields(gender).filter(([key]) => !validMeasurement(measurements[key])).map(([, label]) => label);
}

export function measurementLines(gender: string | null | undefined, measurements: Measurements, unit = "inches") {
  return measurementFields(gender).filter(([key]) => validMeasurement(measurements[key])).map(([key, label]) => `${label}: ${measurements[key]} ${unit}`);
}

export function profileMissing(user: { name: string; phone: string | null; whatsapp: string | null; gender: string | null; address: string | null; state: string | null; city: string | null; measurements: string }) {
  const missing: string[] = [];
  if (!user.name.trim()) missing.push("Full Name");
  if (!user.phone?.trim()) missing.push("Phone Number");
  if (!user.whatsapp?.trim()) missing.push("WhatsApp Number");
  if (!user.address?.trim()) missing.push("Delivery Address");
  if (!user.state?.trim()) missing.push("State");
  if (!user.city?.trim()) missing.push("City");
  if (user.gender !== "Male" && user.gender !== "Female") missing.push("Gender");
  else missing.push(...missingMeasurements(user.gender, parseMeasurements(user.measurements)));
  return missing;
}
