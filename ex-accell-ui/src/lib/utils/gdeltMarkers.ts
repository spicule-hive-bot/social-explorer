import { getCountryNameWithFallback } from '#lib/countryMapping.ts';
import { gdeltDateToInputDate } from '#lib/utils/gdeltDates.ts';
import { GDELT_EVENT_TYPES, getEventType, getEventTypeColor } from '#lib/utils/gdeltEventTypes.ts';
import type { GdeltEvent } from '#lib/utils/gdeltFilters.ts';

const MARKER_BASE_RADIUS = 4;
const MARKER_RADIUS_PER_GOLDSTEIN_POINT = 1.5;

/** What the popup buttons ask the map to do, read back by the delegated click listener on the map container. */
export const POPUP_ACTIONS = {
  filterCountry: 'filter-country',
  showMentions: 'show-mentions'
} as const;

/** Makes a data-derived string safe to interpolate into HTML text or a double-quoted attribute. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Marker radius grows with how strongly cooperative or conflictual the event is. */
export function markerRadius(event: GdeltEvent): number {
  return Math.abs(event.goldstein || 1) * MARKER_RADIUS_PER_GOLDSTEIN_POINT + MARKER_BASE_RADIUS;
}

/** Only events with coordinates can be placed on the map. */
export function hasCoordinates(event: GdeltEvent): boolean {
  return !!(event.lat && event.lng);
}

/** Leaflet circle marker options for an event; the outline is white, the fill follows the event type. */
export function markerOptions(event: GdeltEvent) {
  return {
    radius: markerRadius(event),
    fillColor: getEventTypeColor(event.eventCode),
    color: '#fff',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
  };
}

/**
 * The popup for an event marker. Every data-derived value is escaped, and the buttons carry data-action/data-*
 * attributes instead of inline handlers: the map component listens for clicks on the popup container and dispatches
 * them, which works under the production CSP (script-src 'self', no inline handlers allowed).
 */
export function buildEventPopupHtml(event: GdeltEvent): string {
  const color = getEventTypeColor(event.eventCode);
  const eventTypeConfig = GDELT_EVENT_TYPES[getEventType(event.eventCode)];
  const countryName = getCountryNameWithFallback(event.country, `Unknown (${event.country})`);
  return `
    <div class="p-3 max-w-sm">
      <h3 class="font-bold text-sm mb-2">Event ${escapeHtml(String(event.id))}</h3>
      <div class="flex items-center mb-2">
        <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${color}"></div>
        <span class="text-xs font-medium">${escapeHtml(eventTypeConfig?.label || 'Other')}</span>
      </div>
      <p class="text-xs mb-1"><strong>Type:</strong> ${escapeHtml(eventTypeConfig?.description || 'Unknown event type')}</p>
      <p class="text-xs mb-1"><strong>Location:</strong> ${escapeHtml(event.location || 'Unknown')}</p>
      <p class="text-xs mb-1"><strong>Country:</strong> ${escapeHtml(getCountryNameWithFallback(event.country, `Unknown (${event.country})`))}</p>
      <p class="text-xs mb-1"><strong>Actor 1:</strong> ${escapeHtml(event.actor1 || 'Unknown')}</p>
      <p class="text-xs mb-1"><strong>Actor 2:</strong> ${escapeHtml(event.actor2 || 'Unknown')}</p>
      <p class="text-xs mb-1"><strong>Event Code:</strong> ${escapeHtml(event.eventCode)}</p>
      <p class="text-xs mb-1"><strong>Goldstein Scale:</strong> ${event.goldstein?.toFixed(2) || 'N/A'}</p>
      <p class="text-xs mb-1"><strong>Tone:</strong> ${event.tone?.toFixed(2) || 'N/A'}</p>
      <p class="text-xs mb-2"><strong>Date:</strong> ${escapeHtml(String(gdeltDateToInputDate(event.date ?? 0)))}</p>
      <div class="flex gap-2">
        <button type="button" data-action="${POPUP_ACTIONS.filterCountry}" data-country="${escapeHtml(event.country)}" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl transition-colors">
          Filter by ${escapeHtml(countryName)}
        </button>
        <button type="button" data-action="${POPUP_ACTIONS.showMentions}" data-event-id="${escapeHtml(String(event.id))}" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl transition-colors">
          Show Related Mentions
        </button>
      </div>
    </div>
  `;
}
