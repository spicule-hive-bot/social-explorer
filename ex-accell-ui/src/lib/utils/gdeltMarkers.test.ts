import { describe, expect, it } from 'vitest';
import { getEventTypeColor } from './gdeltEventTypes';
import { buildEventPopupHtml, escapeHtml, hasCoordinates, markerOptions, markerRadius } from './gdeltMarkers';
import { GLOBAL_SOUTH_COUNTRIES, getCountryCodeByName, getGlobalSouthCountryCodes } from './gdeltCountries';

const event = { id: 12, eventCode: '40', country: 'US', goldstein: 2, tone: -1.234, date: 20260105, lat: 1, lng: 2, location: 'Place', actor1: 'A1', actor2: 'A2' };

describe('markers', () => {
  it('sizes the marker by the strength of the event, with a floor for missing values', () => {
    expect(markerRadius({ ...event, goldstein: 2 })).toBe(7);
    expect(markerRadius({ ...event, goldstein: -10 })).toBe(19);
    expect(markerRadius({ ...event, goldstein: 0 })).toBe(5.5);
    expect(markerRadius({ ...event, goldstein: null })).toBe(5.5);
  });

  it('places only events with coordinates', () => {
    expect(hasCoordinates(event)).toBe(true);
    expect(hasCoordinates({ ...event, lat: null })).toBe(false);
    expect(hasCoordinates({ ...event, lng: 0 })).toBe(false);
  });

  it('colours the marker by event type', () => {
    expect(markerOptions(event)).toEqual({ radius: 7, fillColor: getEventTypeColor('40'), color: '#fff', weight: 1, opacity: 1, fillOpacity: 0.8 });
  });
});

describe('buildEventPopupHtml', () => {
  it('describes the event and wires the two buttons', () => {
    const html = buildEventPopupHtml(event);
    expect(html).toContain('Event 12');
    expect(html).toContain('Support &amp; Agreements');
    expect(html).toContain('<strong>Location:</strong> Place');
    expect(html).toContain('<strong>Goldstein Scale:</strong> 2.00');
    expect(html).toContain('<strong>Tone:</strong> -1.23');
    expect(html).toContain('<strong>Date:</strong> 2026-01-05');
    expect(html).toContain('data-action="filter-country" data-country="US"');
    expect(html).toContain('data-action="show-mentions" data-event-id="12"');
    expect(html).toContain(`background-color: ${getEventTypeColor('40')}`);
  });

  it('uses fallbacks for missing details', () => {
    const html = buildEventPopupHtml({ id: 1, eventCode: '99', country: 'ZZ' });
    expect(html).toContain('Other');
    expect(html).toContain('Unknown event type');
    expect(html).toContain('<strong>Location:</strong> Unknown');
    expect(html).toContain('<strong>Actor 1:</strong> Unknown');
    expect(html).toContain('<strong>Goldstein Scale:</strong> N/A');
    expect(html).toContain('<strong>Tone:</strong> N/A');
  });

  it('escapes hostile text so it can never become markup or break out of an attribute', () => {
    const imgPayload = '<img src=x onerror=alert(1)>';
    const hostile = {
      ...event,
      eventCode: '40<script>alert(2)</script>',
      country: "US'\" onmouseover=alert(3)>",
      location: imgPayload,
      actor1: '</script><script>alert(4)</script>',
      actor2: '"\'&<>',
      id: 12
    };
    const html = buildEventPopupHtml(hostile);

    // No injected tag, no inline handler, no window global call
    expect(html).not.toMatch(/<(img|script|iframe|svg)\b/i);
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onerror="');
    expect(html).not.toContain('window.');

    // Every hostile field survives only as text or as a safely escaped attribute value
    expect(html).toContain(`<strong>Location:</strong> ${escapeHtml(imgPayload)}`);
    expect(html).toContain(`<strong>Event Code:</strong> ${escapeHtml(hostile.eventCode)}`);
    expect(html).toContain(`<strong>Actor 1:</strong> ${escapeHtml(hostile.actor1!)}`);
    expect(html).toContain(`<strong>Actor 2:</strong> ${escapeHtml(hostile.actor2!)}`);
    expect(html).toContain(`data-country="${escapeHtml(hostile.country)}"`);
    // The numeric id stays numeric in both the heading and the attribute
    expect(html).toContain('data-event-id="12"');
  });
});

describe('Global South countries', () => {
  it('finds a code by exact name', () => {
    expect(getCountryCodeByName('Brazil')).toBe('BR');
    expect(getCountryCodeByName('brazil')).toBe('BR');
  });

  it('finds a code by a partial name and is null for unknown ones', () => {
    expect(getCountryCodeByName('Not A Country 123')).toBeNull();
  });

  it('keeps only the Global South countries that are available', () => {
    expect(GLOBAL_SOUTH_COUNTRIES).toContain('Brazil');
    expect(getGlobalSouthCountryCodes(['BR', 'FR', 'US'])).toEqual(['BR']);
    expect(getGlobalSouthCountryCodes([])).toEqual([]);
  });
});
