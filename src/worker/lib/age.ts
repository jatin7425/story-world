/** Whole years between a YYYY-MM-DD birthdate and today (UTC). Null if unparseable. */
export function ageFromBirthdate(birthdate: string | null): number | null {
  if (!birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return null;
  const [year, month, day] = birthdate.split("-").map(Number);
  const now = new Date();
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) age--;
  return age;
}
