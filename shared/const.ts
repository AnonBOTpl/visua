export const COOKIE_NAME = "visua_session";

export const SEARCH_SOURCES = [
  { id: 'serpapi', label: 'Google' },
  { id: 'bing', label: 'Bing' },
  { id: 'yandex', label: 'Yandex' }
] as const;

export type SearchSourceId = typeof SEARCH_SOURCES[number]['id'];
