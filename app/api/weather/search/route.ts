import { NextRequest, NextResponse } from "next/server";
import { getCityWeatherByCoordinates, searchCityWeather } from "@/app/lib/briefing/sources/weather";
import { getCurrentUserId } from "@/app/lib/supabase/current-user";

// Backs the Today page's "check another city" search (app/(shell)/today/city-weather-search.tsx).
// Auth-gated the same way every other API route here is — not because the
// lookup itself is sensitive, but so this doesn't sit as an open proxy onto
// Open-Meteo for anyone who finds the URL.
//
// Two ways to call this: `?lat=&lon=&name=` when the user picked a specific
// suggestion from the autocomplete dropdown (no re-geocoding, no ambiguity
// about which match was meant), or `?city=` free text as a fallback for
// submitting without picking one.
export async function GET(request: NextRequest) {
  try {
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");
  const name = request.nextUrl.searchParams.get("name");
  if (lat && lon && name) {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    const result = await getCityWeatherByCoordinates(latitude, longitude, name);
    if (!result) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  const city = request.nextUrl.searchParams.get("city")?.trim();
  if (!city) {
    return NextResponse.json({ error: "Missing city" }, { status: 400 });
  }

  const result = await searchCityWeather(city);
  if (!result) {
    return NextResponse.json({ error: "City not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
