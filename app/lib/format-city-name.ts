const US_STATE_ABBREVIATIONS: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
  "District of Columbia": "DC",
};

// Open-Meteo/onboarding city names come as "City, Region, Country" — for a
// US city that's needlessly long ("Cerritos, California, United States") in
// a card header, so this drops the redundant "United States" and abbreviates
// the state the same way US addresses normally shorten it. Left untouched
// for every other country, where the region/country are the only way to
// disambiguate (e.g. "Tokyo, Tokyo, Japan" vs "Tokyo, ..., Papua New Guinea").
export function formatCityName(name: string): string {
  const parts = name.split(",").map((part) => part.trim());
  if (parts.length < 2 || parts[parts.length - 1] !== "United States") return name;

  const city = parts[0];
  const state = parts.length >= 3 ? parts[1] : undefined;
  const abbreviation = state ? (US_STATE_ABBREVIATIONS[state] ?? state) : undefined;
  return abbreviation ? `${city}, ${abbreviation}` : city;
}
