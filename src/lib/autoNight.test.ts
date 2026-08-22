import { describe, expect, it } from "vitest";
import { calcSunTimes, isNight } from "./autoNight";

const LONDON = { latitude: 51.5074, longitude: -0.1278 };

function daylightHours(
  date: Date,
  latitude: number,
  longitude: number,
): number {
  const { sunrise, sunset } = calcSunTimes(date, latitude, longitude);
  return (sunset.getTime() - sunrise.getTime()) / 3600000;
}

describe("calcSunTimes", () => {
  it("returns a sunrise before its sunset", () => {
    const { sunrise, sunset } = calcSunTimes(
      new Date(2024, 5, 21, 12),
      LONDON.latitude,
      LONDON.longitude,
    );
    expect(sunrise.getTime()).toBeLessThan(sunset.getTime());
  });

  it("gives London a long day on the summer solstice", () => {
    const hours = daylightHours(
      new Date(2024, 5, 21, 12),
      LONDON.latitude,
      LONDON.longitude,
    );
    expect(hours).toBeGreaterThan(16);
    expect(hours).toBeLessThan(17);
  });

  it("gives London a short day on the winter solstice", () => {
    const hours = daylightHours(
      new Date(2024, 11, 21, 12),
      LONDON.latitude,
      LONDON.longitude,
    );
    expect(hours).toBeGreaterThan(7);
    expect(hours).toBeLessThan(9);
  });

  it("gives the southern hemisphere the opposite seasons", () => {
    const sydney = { latitude: -33.8688, longitude: 151.2093 };
    const june = daylightHours(
      new Date(2024, 5, 21, 12),
      sydney.latitude,
      sydney.longitude,
    );
    const december = daylightHours(
      new Date(2024, 11, 21, 12),
      sydney.latitude,
      sydney.longitude,
    );
    expect(june).toBeLessThan(december);
  });
});

describe("isNight", () => {
  const sunrise = new Date("2024-06-21T03:45:00Z");
  const sunset = new Date("2024-06-21T20:23:00Z");

  it("is true before sunrise", () => {
    expect(isNight(new Date("2024-06-21T00:00:00Z"), sunrise, sunset)).toBe(
      true,
    );
  });

  it("is false during the day", () => {
    expect(isNight(new Date("2024-06-21T12:00:00Z"), sunrise, sunset)).toBe(
      false,
    );
  });

  it("is true after sunset", () => {
    expect(isNight(new Date("2024-06-21T22:00:00Z"), sunrise, sunset)).toBe(
      true,
    );
  });

  it("treats the sunrise and sunset instants as boundaries", () => {
    expect(isNight(sunrise, sunrise, sunset)).toBe(false);
    expect(isNight(sunset, sunrise, sunset)).toBe(true);
  });
});
