import { fetchUciDiningSummaries } from './uciDining';

export type DiningMenuItem = {
  id: string;
  name: string;
  traits?: string[];
};

export type DiningMenuStation = {
  id: string;
  name: string;
  items: DiningMenuItem[];
};

export type DiningMenuMeal = {
  id: string;
  name: string;
  timeLabel?: string;
  /** Minutes after midnight, campus time — lets the UI open on the meal being served. */
  startMinutes?: number;
  endMinutes?: number;
  stations: DiningMenuStation[];
};

export type DiningLocationMenu = {
  id: string;
  name: string;
  officialUrl: string;
  meals: DiningMenuMeal[];
  itemCount: number;
  isExternalLinkOnly?: boolean;
  isOpen?: boolean | null;
  statusLabel?: string;
  statusDetail?: string;
};

type DateParts = {
  iso: string;
  slash: string;
};

type MyDiningHubConfig = {
  graphQlUrl: string;
  locationUrl: string;
  headers: Record<string, string>;
  campusUrlKey?: string;
  mealPeriods?: MyDiningHubMealPeriod[];
};

type MyDiningHubMealPeriod = {
  id: number;
  name: string;
};

const UCI_DINING_GRAPHQL_URL = 'https://api.elevate-dxp.com/api/mesh/c087f756-cc72-4649-a36f-3a41b700c519/graphql';
const UCI_DINING_LOCATION_URL = 'https://uci.mydininghub.com/en/location';
const CORNELL_DINING_API_URL = 'https://admin-now.dining.cornell.edu/api/1.0/dining/eateries.json';
const PURDUE_DINING_GRAPHQL_URL = 'https://api.hfs.purdue.edu/menus/v3/GraphQL';
const UIUC_DINING_MENU_API_URL = 'https://web.housing.illinois.edu/DiningMenus/api/DiningMenu/GetOption/';
const UIUC_DINING_MENU_URL = 'https://web.housing.illinois.edu/diningmenus';
const UMD_NUTRITION_URL = 'https://nutrition.umd.edu';

const UCI_DINING_HEADERS = {
  'content-type': 'application/json',
  'X-Api-Key': 'ElevateAPIProd',
  'magento-store-code': 'ch_uci',
  'magento-website-code': 'ch_uci',
  'magento-store-view-code': 'ch_uci_en',
  Store: 'ch_uci_en',
  'magento-customer-group': 'b6589fc6ab0dc82cf12099d1c2d40ab994e8410c',
  'AEM-Elevate-ClientPath': 'ch/uci/en',
};

const UCI_DINING_LOCATIONS = [
  { id: 'the-anteatery', name: 'The Anteatery' },
  { id: 'brandywine', name: 'Brandywine' },
];

const PURDUE_DINING_COURTS = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];

const UIUC_DINING_OPTIONS = [
  { id: 1, name: 'Ikenberry Dining Center' },
  { id: 3, name: 'ISR Dining Center' },
  { id: 2, name: 'PAR Dining Hall' },
  { id: 5, name: 'Lincoln/Allen Dining Hall' },
  { id: 12, name: 'Field of Greens' },
  { id: 23, name: 'Kosher Kitchen' },
];

const UMD_DINING_OPTIONS = [
  { id: 16, name: 'South Campus Dining Hall' },
];

const EXTERNAL_DINING_MENU_CONFIGS: Record<string, { id: string; name: string; url: string; itemName?: string }> = {};

export function schoolDiningMenusSupported(school: string) {
  return school in EXTERNAL_DINING_MENU_CONFIGS || [
    'UC Irvine',
    'University of Maryland, College Park',
    'Cornell University',
    'Purdue University',
    'University of Illinois Urbana-Champaign',
  ].includes(school);
}

function getDateParts(date: Date, timeZone: string): DateParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date).map((part) => [part.type, part.value])
  );

  const year = parts.year ?? String(date.getFullYear());
  const month = parts.month ?? String(date.getMonth() + 1).padStart(2, '0');
  const day = parts.day ?? String(date.getDate()).padStart(2, '0');

  return {
    iso: `${year}-${month}-${day}`,
    slash: `${Number(month)}/${Number(day)}/${year}`,
  };
}

function compactText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value: string) {
  return compactText(decodeHtml(value.replace(/<[^>]+>/g, ' ')));
}

function dedupeItems(items: DiningMenuItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.toLowerCase();
    if (!item.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function itemCountForMeals(meals: DiningMenuMeal[]) {
  return meals.reduce(
    (mealTotal, meal) => mealTotal + meal.stations.reduce((stationTotal, station) => stationTotal + station.items.length, 0),
    0
  );
}

function buildLocationMenu(id: string, name: string, officialUrl: string, meals: DiningMenuMeal[]): DiningLocationMenu | null {
  const cleanedMeals = meals
    .map((meal) => ({
      ...meal,
      stations: meal.stations
        .map((station) => ({ ...station, items: dedupeItems(station.items) }))
        .filter((station) => station.items.length > 0),
    }))
    .filter((meal) => meal.stations.length > 0);

  const itemCount = itemCountForMeals(cleanedMeals);
  if (itemCount === 0) return null;
  return { id, name, officialUrl, meals: cleanedMeals, itemCount };
}

function buildExternalDiningMenu(id: string, name: string, officialUrl: string, itemName = 'Open official dining menus and hours'): DiningLocationMenu {
  return {
    id,
    name,
    officialUrl,
    isExternalLinkOnly: true,
    meals: [{
      id: 'official',
      name: 'Official menus',
      stations: [{
        id: 'links',
        name: 'Official menu',
        items: [{ id: 'official-menu', name: itemName }],
      }],
    }],
    itemCount: 1,
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Dining request returned ${response.status}`);
  return response.json();
}

async function fetchMyDiningHubRecipeData(location: { id: string; name: string }, dateIso: string, config: MyDiningHubConfig, mealPeriod?: MyDiningHubMealPeriod) {
  const query = mealPeriod ? `
    query getLocationRecipes($campusUrlKey: String!, $locationUrlKey: String!, $date: String!, $mealPeriod: Int, $viewType: Commerce_MenuViewType!) {
      getLocationRecipes(
        campusUrlKey: $campusUrlKey
        locationUrlKey: $locationUrlKey
        date: $date
        mealPeriod: $mealPeriod
        viewType: $viewType
      ) {
        locationRecipesMap {
          skus
          stationSkuMap {
            id
            skus
          }
        }
        products {
          items {
            name
            sku
            attributes {
              name
              value
            }
          }
        }
      }
    }
  ` : `
    query getLocationRecipes($campusUrlKey: String!, $locationUrlKey: String!, $date: String!) {
      getLocationRecipes(campusUrlKey: $campusUrlKey, locationUrlKey: $locationUrlKey, date: $date) {
        locationRecipesMap {
          skus
          stationSkuMap {
            id
            skus
          }
        }
        products {
          items {
            name
            sku
            attributes {
              name
              value
            }
          }
        }
      }
    }
  `;
  const params = new URLSearchParams({
    operationName: 'getLocationRecipes',
    query,
    variables: JSON.stringify({
      campusUrlKey: config.campusUrlKey ?? 'campus',
      locationUrlKey: location.id,
      date: dateIso,
      ...(mealPeriod ? { mealPeriod: mealPeriod.id, viewType: 'DAILY' } : {}),
    }),
  });
  const json = await fetchJson(`${config.graphQlUrl}?${params.toString()}`, {
    method: 'GET',
    headers: config.headers,
  });
  return json?.data?.getLocationRecipes;
}

function buildMyDiningHubStations(data: any): DiningMenuStation[] {
  const products = (data?.products?.items ?? []) as Array<{ sku?: string; name?: string; attributes?: Array<{ name?: string; value?: unknown }> }>;
  const visibleBySku = new Map<string, DiningMenuItem>();

  products.forEach((product) => {
    const sku = compactText(product.sku);
    const name = compactText(product.name);
    if (!sku || !name) return;
    const hidden = product.attributes?.some((attribute) => attribute.name === 'is_hide_from_web_menu' && String(attribute.value).toLowerCase() === 'true');
    if (hidden) return;
    const traits = product.attributes
      ?.filter((attribute) => ['allergen_statement', 'marketing_name'].includes(attribute.name ?? ''))
      .map((attribute) => compactText(attribute.value))
      .filter(Boolean);
    visibleBySku.set(sku, { id: sku, name, traits });
  });

  const orderedSkus = ((data?.locationRecipesMap?.skus ?? []) as string[]).filter((sku) => visibleBySku.has(sku));
  const stationSkuMap = (data?.locationRecipesMap?.stationSkuMap ?? []) as Array<{ id?: string; skus?: string[] }>;
  const stations = stationSkuMap.length > 0
    ? stationSkuMap.map((station, index) => ({
        id: station.id ?? `station-${index}`,
        name: `Station ${index + 1}`,
        items: (station.skus ?? []).map((sku) => visibleBySku.get(sku)).filter((item): item is DiningMenuItem => Boolean(item)),
      }))
    : [{
        id: 'menu',
        name: 'Items',
        items: orderedSkus.map((sku) => visibleBySku.get(sku)).filter((item): item is DiningMenuItem => Boolean(item)),
      }];

  return stations;
}

async function fetchMyDiningHubLocationMenu(location: { id: string; name: string }, dateIso: string, config: MyDiningHubConfig) {
  if (config.mealPeriods?.length) {
    const meals = await Promise.all(config.mealPeriods.map(async (mealPeriod) => {
      const data = await fetchMyDiningHubRecipeData(location, dateIso, config, mealPeriod);
      const stations = buildMyDiningHubStations(data);
      return {
        id: String(mealPeriod.id),
        name: mealPeriod.name,
        stations,
      } as DiningMenuMeal;
    }));

    return buildLocationMenu(location.id, location.name, `${config.locationUrl}/${location.id}`, meals);
  }

  const data = await fetchMyDiningHubRecipeData(location, dateIso, config);
  const stations = buildMyDiningHubStations(data);
  return buildLocationMenu(location.id, location.name, `${config.locationUrl}/${location.id}`, [{
    id: 'today',
    name: 'Today',
    stations,
  }]);
}

// MyDiningHub meal-period ids, from the site's own meal list. The opening-hours
// feed labels each window with exactly these names.
const UCI_MEAL_PERIOD_IDS: Record<string, number> = {
  'Afternoon Snack': 1,
  'All Day': 4,
  Breakfast: 10,
  Brunch: 13,
  Dinner: 16,
  'Evening Snack': 22,
  Lunch: 25,
};

type StationInfo = { name: string; position: number };
let uciStationNamesPromise: Promise<Map<string, Map<string, StationInfo>>> | null = null;

/**
 * Real station names ("Sizzle Grill", "The Twisted Root") per location. The
 * recipe query returns station ids only, and the app used to label them
 * "Station 1..5", which is most of why the menu read as an undifferentiated
 * wall of items. Cached for the session; a failure is retried next time.
 */
function loadUciStationNames() {
  if (!uciStationNamesPromise) {
    const params = new URLSearchParams({
      operationName: 'getLocations',
      query: 'query getLocations($k: String!) { getLocations(campusUrlKey: $k) { commerceAttributes { url_key children { id name position } } } }',
      variables: JSON.stringify({ k: 'campus' }),
    });
    uciStationNamesPromise = fetchJson(`${UCI_DINING_GRAPHQL_URL}?${params.toString()}`, { method: 'GET', headers: UCI_DINING_HEADERS })
      .then((json) => {
        const byLocation = new Map<string, Map<string, StationInfo>>();
        for (const location of json?.data?.getLocations ?? []) {
          const key = location?.commerceAttributes?.url_key;
          if (!key) continue;
          const stations = new Map<string, StationInfo>();
          for (const child of location.commerceAttributes.children ?? []) {
            stations.set(String(child.id), { name: compactText(child.name), position: Number(child.position) || 999 });
          }
          byLocation.set(key, stations);
        }
        return byLocation;
      })
      .catch((error) => {
        console.warn('Could not load dining station names:', error);
        uciStationNamesPromise = null;
        return new Map<string, Map<string, StationInfo>>();
      });
  }
  return uciStationNamesPromise;
}

function nameStations(stations: DiningMenuStation[], names: Map<string, StationInfo> | undefined) {
  if (!names) return stations;
  return stations
    .map((station) => {
      const info = names.get(String(station.id));
      return { station: info ? { ...station, name: info.name } : station, position: info?.position ?? 999 };
    })
    .sort((a, b) => a.position - b.position)
    .map(({ station }) => station);
}

function formatMealWindow(startMinutes: number, endMinutes: number) {
  const fmt = (m: number) => {
    const h24 = Math.floor(m / 60) % 24;
    const min = m % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { text: min ? `${h12}:${String(min).padStart(2, '0')}` : `${h12}`, period: h24 < 12 ? 'AM' : 'PM' };
  };
  const a = fmt(startMinutes);
  const b = fmt(endMinutes);
  return a.period === b.period ? `${a.text}–${b.text} ${b.period}` : `${a.text} ${a.period}–${b.text} ${b.period}`;
}

async function fetchUciDiningMenus(date: Date) {
  const { iso } = getDateParts(date, 'America/Los_Angeles');
  const config = { graphQlUrl: UCI_DINING_GRAPHQL_URL, locationUrl: UCI_DINING_LOCATION_URL, headers: UCI_DINING_HEADERS };
  const [summaries, stationNames] = await Promise.all([
    fetchUciDiningSummaries(date).catch(() => []),
    loadUciStationNames(),
  ]);
  const summariesByKey = new Map(summaries.map((summary) => [summary.key, summary]));

  const menus = await Promise.all(UCI_DINING_LOCATIONS.map(async (location) => {
    const summary = summariesByKey.get(location.id as any);
    const names = stationNames.get(location.id);
    // One request per meal actually served today. Without a meal period the
    // API answers with breakfast, so the app showed the breakfast menu all day
    // and lunch or dinner never appeared.
    const windows = (summary?.todayMeals ?? [])
      .map((window) => ({ window, id: UCI_MEAL_PERIOD_IDS[window.label] }))
      .filter((entry): entry is { window: typeof entry.window; id: number } => entry.id != null);

    let meals: DiningMenuMeal[];
    if (windows.length > 0) {
      const fetched = await Promise.all(windows.map(async ({ window, id }) => {
        try {
          const data = await fetchMyDiningHubRecipeData(location, iso, config, { id, name: window.label });
          return {
            id: String(id),
            name: window.label,
            timeLabel: formatMealWindow(window.startMinutes, window.endMinutes),
            startMinutes: window.startMinutes,
            endMinutes: window.endMinutes,
            stations: nameStations(buildMyDiningHubStations(data), names),
          } as DiningMenuMeal;
        } catch (error) {
          console.warn(`Could not load ${location.name} ${window.label} menu:`, error);
          return null;
        }
      }));
      meals = fetched.filter((meal): meal is DiningMenuMeal => meal !== null);
    } else {
      // No hours for today (closed, or the hours feed failed): fall back to
      // the location's default menu rather than showing nothing.
      try {
        const data = await fetchMyDiningHubRecipeData(location, iso, config);
        meals = [{ id: 'today', name: 'Today', stations: nameStations(buildMyDiningHubStations(data), names) }];
      } catch {
        return null;
      }
    }

    const menu = buildLocationMenu(location.id, location.name, `${UCI_DINING_LOCATION_URL}/${location.id}`, meals);
    if (!menu || !summary) return menu;
    return { ...menu, isOpen: summary.isOpen, statusLabel: summary.statusLabel, statusDetail: summary.statusDetail };
  }));

  return menus.filter((menu): menu is DiningLocationMenu => Boolean(menu));
}

function cornellMealFromEvent(event: any): DiningMenuMeal | null {
  const menuGroups = (event?.menu ?? []) as Array<{ category?: string; items?: Array<{ item?: string; healthy?: boolean }> }>;
  const stations = menuGroups.map((group, index) => ({
    id: compactText(group.category) || `station-${index}`,
    name: compactText(group.category) || `Station ${index + 1}`,
    items: (group.items ?? []).map((item, itemIndex) => ({
      id: `${index}-${itemIndex}-${compactText(item.item)}`,
      name: compactText(item.item),
      traits: item.healthy ? ['Healthy'] : undefined,
    })),
  }));
  if (stations.every((station) => station.items.length === 0)) return null;
  return {
    id: compactText(event?.descr) || 'meal',
    name: compactText(event?.descr) || 'Meal',
    timeLabel: event?.start && event?.end ? `${event.start}-${event.end}` : undefined,
    stations,
  };
}

async function fetchCornellDiningMenus(date: Date) {
  const { iso } = getDateParts(date, 'America/New_York');
  const json = await fetchJson(CORNELL_DINING_API_URL);
  const eateries = (json?.data?.eateries ?? []) as any[];
  const menus = eateries.flatMap((eatery) => {
    const day = (eatery.operatingHours ?? []).find((entry: any) => entry.date === iso);
    const meals = (day?.events ?? []).map(cornellMealFromEvent).filter((meal: DiningMenuMeal | null): meal is DiningMenuMeal => Boolean(meal));
    const menu = buildLocationMenu(
      String(eatery.id ?? eatery.slug ?? eatery.name),
      compactText(eatery.name),
      'https://now.dining.cornell.edu/',
      meals
    );
    return menu ? [menu] : [];
  });
  return menus;
}

const PURDUE_LOCATION_MENU_QUERY = `
  query getLocationMenu($name: String!, $date: Date!) {
    diningCourtByName(name: $name) {
      formalName
      name
      dailyMenu(date: $date) {
        notes
        meals {
          name
          status
          startTime
          endTime
          stations {
            id
            name
            items {
              specialName
              item {
                itemId
                name
                traits {
                  name
                }
                components {
                  itemId
                  name
                  traits {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

function formatPurdueMealTime(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return undefined;
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  return `${start.toLocaleTimeString('en-US', options)}-${end.toLocaleTimeString('en-US', options)}`;
}

async function fetchPurdueLocationMenu(name: string, dateIso: string) {
  const json = await fetchJson(PURDUE_DINING_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: PURDUE_LOCATION_MENU_QUERY,
      variables: { name, date: dateIso },
    }),
  });
  const location = json?.data?.diningCourtByName;
  const meals = ((location?.dailyMenu?.meals ?? []) as any[]).map((meal, mealIndex) => ({
    id: compactText(meal.name) || `meal-${mealIndex}`,
    name: compactText(meal.name) || 'Meal',
    timeLabel: formatPurdueMealTime(meal.startTime, meal.endTime),
    stations: ((meal.stations ?? []) as any[]).map((station, stationIndex) => ({
      id: compactText(station.id) || `station-${stationIndex}`,
      name: compactText(station.name) || `Station ${stationIndex + 1}`,
      items: ((station.items ?? []) as any[]).flatMap((entry, itemIndex) => {
        const item = entry.item;
        if (!item) return [];
        const itemName = compactText(entry.specialName || item.name);
        const componentItems = (item.components ?? []).map((component: any) => ({
          id: String(component.itemId ?? `${itemIndex}-${compactText(component.name)}`),
          name: compactText(component.name),
          traits: (component.traits ?? []).map((trait: any) => compactText(trait.name)).filter(Boolean),
        }));
        return itemName
          ? [{
              id: String(item.itemId ?? `${stationIndex}-${itemIndex}`),
              name: itemName,
              traits: (item.traits ?? []).map((trait: any) => compactText(trait.name)).filter(Boolean),
            }]
          : componentItems;
      }),
    })),
  }));

  return buildLocationMenu(
    name.toLowerCase(),
    compactText(location?.formalName) || `${name} Dining Court`,
    `https://dining.purdue.edu/menus/${encodeURIComponent(name)}/`,
    meals
  );
}

async function fetchPurdueDiningMenus(date: Date) {
  const { iso } = getDateParts(date, 'America/Indiana/Indianapolis');
  const menus = await Promise.all(PURDUE_DINING_COURTS.map((name) => fetchPurdueLocationMenu(name, iso).catch(() => null)));
  return menus.filter((menu): menu is DiningLocationMenu => Boolean(menu));
}

function groupUiucRowsIntoMeals(rows: any[]): DiningMenuMeal[] {
  const meals = new Map<string, Map<string, DiningMenuStation>>();
  rows.forEach((row) => {
    const mealName = compactText(row.Meal) || 'Meal';
    const stationName = compactText(row.ServingUnit || row.Category) || 'Station 1';
    if (!meals.has(mealName)) meals.set(mealName, new Map());
    const stationMap = meals.get(mealName)!;
    if (!stationMap.has(stationName)) {
      stationMap.set(stationName, { id: stationName, name: stationName, items: [] });
    }
    stationMap.get(stationName)!.items.push({
      id: String(row.ItemID ?? row.DiningMenuID ?? `${mealName}-${stationName}-${row.FormalName}`),
      name: compactText(row.FormalName),
      traits: compactText(row.Traits).split(',').map((trait) => compactText(trait)).filter(Boolean),
    });
  });

  return Array.from(meals.entries()).map(([name, stationMap]) => ({
    id: name,
    name,
    stations: Array.from(stationMap.values()),
  }));
}

function parseUiucRows(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function fetchUiucLocationMenu(option: { id: number; name: string }, mealDate: string) {
  const json = await fetchJson(UIUC_DINING_MENU_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ DiningOptionID: String(option.id), mealDate }),
  });
  const rows = parseUiucRows(json);
  return buildLocationMenu(
    String(option.id),
    option.name,
    UIUC_DINING_MENU_URL,
    groupUiucRowsIntoMeals(rows)
  );
}

async function fetchUiucLocationMenuWithDateFallback(option: { id: number; name: string }, mealDates: string[]) {
  for (const mealDate of mealDates) {
    try {
      const menu = await fetchUiucLocationMenu(option, mealDate);
      if (menu) return menu;
    } catch {}
  }
  return null;
}

async function fetchUiucDiningMenus(date: Date) {
  const { iso, slash } = getDateParts(date, 'America/Chicago');
  const [year, month, day] = iso.split('-');
  const paddedSlash = `${month}/${day}/${year}`;
  const menus = await Promise.all(UIUC_DINING_OPTIONS.map((option) => fetchUiucLocationMenuWithDateFallback(option, [iso, paddedSlash, slash])));
  const liveMenus = menus.filter((menu): menu is DiningLocationMenu => Boolean(menu));
  return liveMenus.length > 0
    ? liveMenus
    : [buildExternalDiningMenu('uiuc-official-menus', 'Illinois Dining', UIUC_DINING_MENU_URL)];
}

function parseUmdMenuItems(html: string): DiningMenuItem[] {
  const items: DiningMenuItem[] = [];
  const pattern = /<a\s+[^>]*href=['"]label\.aspx[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const name = compactText(decodeHtml(match[1].replace(/<[^>]+>/g, ' ')));
    if (!name) continue;
    items.push({ id: `${items.length}-${name}`, name });
  }
  return dedupeItems(items);
}

async function fetchUmdLocationMenu(option: { id: number; name: string }, dateSlash: string) {
  const meals = await Promise.all(['Breakfast', 'Lunch', 'Dinner'].map(async (mealName) => {
    const params = new URLSearchParams({
      locationNum: String(option.id),
      dtdate: dateSlash,
      mealName,
    });
    const response = await fetch(`${UMD_NUTRITION_URL}/longmenu.aspx?${params.toString()}`);
    if (!response.ok) return null;
    const html = await response.text();
    const items = parseUmdMenuItems(html);
    if (items.length === 0) return null;
    return {
      id: mealName,
      name: mealName,
      stations: [{ id: 'menu', name: 'Items', items }],
    } as DiningMenuMeal;
  }));

  return buildLocationMenu(
    String(option.id),
    option.name,
    `${UMD_NUTRITION_URL}/location.aspx?locationNum=${option.id}`,
    meals.filter((meal): meal is DiningMenuMeal => Boolean(meal))
  );
}

async function fetchUmdDiningMenus(date: Date) {
  const { slash } = getDateParts(date, 'America/New_York');
  const menus = await Promise.all(UMD_DINING_OPTIONS.map((option) => fetchUmdLocationMenu(option, slash).catch(() => null)));
  return menus.filter((menu): menu is DiningLocationMenu => Boolean(menu));
}

export async function fetchDiningMenusForSchool(school: string, date = new Date()): Promise<DiningLocationMenu[]> {
  if (school === 'UC Irvine') return fetchUciDiningMenus(date);
  if (school === 'University of Maryland, College Park') return fetchUmdDiningMenus(date);
  if (school === 'Cornell University') return fetchCornellDiningMenus(date);
  if (school === 'Purdue University') return fetchPurdueDiningMenus(date);
  if (school === 'University of Illinois Urbana-Champaign') return fetchUiucDiningMenus(date);
  const external = EXTERNAL_DINING_MENU_CONFIGS[school];
  if (external) {
    return [buildExternalDiningMenu(external.id, external.name, external.url, external.itemName)];
  }
  return [];
}

// ─── Choosing what to show ──────────────────────────────────────────────────

function campusMinutesNow(date: Date, timeZone = 'America/Los_Angeles') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/**
 * The meal a student opening the app right now cares about: the one being
 * served, else the next one today, else the last one (after closing, tonight's
 * dinner is more useful than nothing). Meals without times fall back to the
 * first one.
 */
export function currentOrNextMeal(menu: DiningLocationMenu, date = new Date()): DiningMenuMeal | null {
  const meals = menu.meals.filter((meal) => meal.stations.some((station) => station.items.length > 0));
  if (meals.length === 0) return null;
  const timed = meals.filter((meal) => meal.startMinutes != null && meal.endMinutes != null);
  if (timed.length === 0) return meals[0];
  const now = campusMinutesNow(date);
  return timed.find((meal) => now >= meal.startMinutes! && now < meal.endMinutes!)
    ?? timed.find((meal) => now < meal.startMinutes!)
    ?? timed[timed.length - 1];
}

/**
 * Stations whose items are the same every day (salad bar, bakery, soup) —
 * shown last and collapsed, so the day's actual dishes lead.
 */
export function isStapleStation(name: string) {
  return /farmer'?s market|farm stand|salad|bakery|honeycakes|soups?\b|deli\b|beverage|condiment|cereal/i.test(name);
}

/** One dish per featured station, so a preview shows the range rather than the first station's list. */
export function featuredDishes(meal: DiningMenuMeal, limit = 4) {
  const ordered = [
    ...meal.stations.filter((station) => !isStapleStation(station.name)),
    ...meal.stations.filter((station) => isStapleStation(station.name)),
  ];
  const picks: string[] = [];
  for (const station of ordered) {
    const item = station.items[0];
    if (item && !picks.includes(item.name)) picks.push(item.name);
    if (picks.length >= limit) break;
  }
  return picks;
}
