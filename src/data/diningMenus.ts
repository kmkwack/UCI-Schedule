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
  stations: DiningMenuStation[];
};

export type DiningLocationMenu = {
  id: string;
  name: string;
  officialUrl: string;
  meals: DiningMenuMeal[];
  itemCount: number;
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
};

const UCI_DINING_GRAPHQL_URL = 'https://api.elevate-dxp.com/api/mesh/c087f756-cc72-4649-a36f-3a41b700c519/graphql';
const UCI_DINING_LOCATION_URL = 'https://uci.mydininghub.com/en/location';
const CORNELL_DINING_API_URL = 'https://admin-now.dining.cornell.edu/api/1.0/dining/eateries.json';
const PURDUE_DINING_GRAPHQL_URL = 'https://api.hfs.purdue.edu/menus/v3/GraphQL';
const UIUC_DINING_MENU_API_URL = 'https://web.housing.illinois.edu/DiningMenus/api/DiningMenu/GetOption/';
const UMD_NUTRITION_URL = 'https://nutrition.umd.edu';
const UCR_FOODPRO_URL = 'https://foodpro.ucr.edu/foodpro/shortmenu.aspx';
const UCR_DINING_SERVICE_NAME = 'University of California, Riverside Dining Services';
const TEMPLE_DINING_GRAPHQL_URL = 'https://api.elevate-dxp.com/api/mesh/c087f756-cc72-4649-a36f-3a41b700c519/graphql';
const TEMPLE_DINING_LOCATION_URL = 'https://temple.mydininghub.com/en/location';
const GSU_NUTRISLICE_API_URL = 'https://gsu.api.nutrislice.com/menu/api/weeks';
const GSU_NUTRISLICE_MENU_URL = 'https://gsu.nutrislice.com/menu';

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

const TEMPLE_DINING_HEADERS = {
  'content-type': 'application/json',
  'X-Api-Key': 'ElevateAPIProd',
  'magento-store-code': 'ch_temple',
  'magento-website-code': 'ch_temple',
  'magento-store-view-code': 'ch_temple_en',
  Store: 'ch_temple_en',
  'magento-customer-group': 'b6589fc6ab0dc82cf12099d1c2d40ab994e8410c',
  'AEM-Elevate-ClientPath': 'ch/temple/en',
};

const UCI_DINING_LOCATIONS = [
  { id: 'the-anteatery', name: 'The Anteatery' },
  { id: 'brandywine', name: 'Brandywine' },
];

const UCR_DINING_OPTIONS = [
  { id: 'glasgow', name: 'Glasgow', locationNum: '03' },
  { id: 'lothian', name: 'Lothian', locationNum: '02' },
];

const TEMPLE_DINING_LOCATIONS = [
  { id: 'esposito-dining-center', name: 'Esposito Dining Center' },
  { id: 'valaida-s-walker-fo-od-court', name: 'Howard Gittis Student Center Food Court' },
  { id: 'morgan-hall-food-court', name: 'Morgan Hall Food Court' },
];

const PURDUE_DINING_COURTS = ['Earhart', 'Ford', 'Hillenbrand', 'Wiley', 'Windsor'];

const UIUC_DINING_OPTIONS = [
  { id: 1, name: 'Ikenberry Dining Center' },
  { id: 3, name: 'ISR Dining Center' },
  { id: 2, name: 'PAR Dining Hall' },
  { id: 5, name: 'Lincoln/Allen Dining Hall' },
];

const UMD_DINING_OPTIONS = [
  { id: 16, name: 'South Campus Dining Hall' },
];

const GSU_DINING_LOCATIONS = [
  {
    id: 46511,
    name: 'Piedmont Central',
    slug: 'piedmont-central',
    menuTypes: [
      { id: 15755, name: 'Breakfast', slug: 'breakfast' },
      { id: 15756, name: 'Lunch', slug: 'lunch' },
      { id: 15757, name: 'Dinner', slug: 'dinner' },
      { id: 15758, name: 'Overnight', slug: 'over-night' },
    ],
  },
  {
    id: 46513,
    name: 'Piedmont North',
    slug: 'piedmont-north',
    menuTypes: [
      { id: 15755, name: 'Breakfast', slug: 'breakfast' },
      { id: 15756, name: 'Lunch', slug: 'lunch' },
      { id: 15757, name: 'Dinner', slug: 'dinner' },
    ],
  },
];

export function schoolDiningMenusSupported(school: string) {
  return [
    'UC Irvine',
    'University of Maryland, College Park',
    'Cornell University',
    'Purdue University',
    'University of Illinois Urbana-Champaign',
    'UC Riverside',
    'Temple University',
    'Georgia State University',
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

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Dining request returned ${response.status}`);
  return response.json();
}

async function fetchMyDiningHubLocationMenu(location: { id: string; name: string }, dateIso: string, config: MyDiningHubConfig) {
  const query = `
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
    query,
    variables: JSON.stringify({ campusUrlKey: config.campusUrlKey ?? 'campus', locationUrlKey: location.id, date: dateIso }),
  });
  const json = await fetchJson(`${config.graphQlUrl}?${params.toString()}`, {
    method: 'GET',
    headers: config.headers,
  });
  const data = json?.data?.getLocationRecipes;
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

  return buildLocationMenu(location.id, location.name, `${config.locationUrl}/${location.id}`, [{
    id: 'today',
    name: 'Today',
    stations,
  }]);
}

async function fetchUciDiningMenus(date: Date) {
  const { iso } = getDateParts(date, 'America/Los_Angeles');
  const menus = await Promise.all(UCI_DINING_LOCATIONS.map((location) => fetchMyDiningHubLocationMenu(location, iso, {
    graphQlUrl: UCI_DINING_GRAPHQL_URL,
    locationUrl: UCI_DINING_LOCATION_URL,
    headers: UCI_DINING_HEADERS,
  }).catch(() => null)));
  return menus.filter((menu): menu is DiningLocationMenu => Boolean(menu));
}

async function fetchTempleDiningMenus(date: Date) {
  const { iso } = getDateParts(date, 'America/New_York');
  const menus = await Promise.all(TEMPLE_DINING_LOCATIONS.map((location) => fetchMyDiningHubLocationMenu(location, iso, {
    graphQlUrl: TEMPLE_DINING_GRAPHQL_URL,
    locationUrl: TEMPLE_DINING_LOCATION_URL,
    headers: TEMPLE_DINING_HEADERS,
  }).catch(() => null)));
  return menus.filter((menu): menu is DiningLocationMenu => Boolean(menu));
}

function normalizeFoodProStationName(value: string) {
  return stripHtml(value).replace(/^[-\s]+|[-\s]+$/g, '').trim() || 'Items';
}

function parseFoodProMenuItems(mealHtml: string): DiningMenuStation[] {
  const stations: DiningMenuStation[] = [];
  let currentStation: DiningMenuStation | null = null;
  const tokenPattern = /<div[^>]*class=["'][^"']*(shortmenucats|shortmenurecipes)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(mealHtml))) {
    const kind = match[1];
    const content = match[2] ?? '';

    if (kind === 'shortmenucats') {
      const name = normalizeFoodProStationName(content);
      currentStation = { id: `${stations.length}-${name}`, name, items: [] };
      stations.push(currentStation);
      continue;
    }

    const itemName = stripHtml(content);
    if (!itemName) continue;
    if (!currentStation) {
      currentStation = { id: 'items', name: 'Items', items: [] };
      stations.push(currentStation);
    }
    currentStation.items.push({
      id: `${currentStation.items.length}-${itemName}`,
      name: itemName,
    });
  }

  return stations;
}

function parseUcrFoodProMeals(html: string): DiningMenuMeal[] {
  const headings: Array<{ name: string; index: number; end: number }> = [];
  const headingPattern = /<h3[^>]*class=["'][^"']*shortmenumeals[^"']*["'][^>]*>([\s\S]*?)<\/h3>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html))) {
    headings.push({
      name: stripHtml(match[1] ?? '') || `Meal ${headings.length + 1}`,
      index: match.index,
      end: headingPattern.lastIndex,
    });
  }

  return headings.map((heading, index) => {
    const nextHeading = headings[index + 1];
    const mealHtml = html.slice(heading.end, nextHeading?.index ?? html.length);
    return {
      id: heading.name,
      name: heading.name,
      stations: parseFoodProMenuItems(mealHtml),
    };
  });
}

async function fetchUcrLocationMenu(option: { id: string; name: string; locationNum: string }, dateSlash: string) {
  const params = new URLSearchParams({
    sName: UCR_DINING_SERVICE_NAME,
    locationName: option.name,
    locationNum: option.locationNum,
    naFlag: '1',
    dtdate: dateSlash,
  });
  const response = await fetch(`${UCR_FOODPRO_URL}?${params.toString()}`);
  if (!response.ok) throw new Error(`UCR dining request returned ${response.status}`);
  const html = await response.text();

  return buildLocationMenu(
    option.id,
    option.name,
    `https://dining.ucr.edu/menus`,
    parseUcrFoodProMeals(html)
  );
}

async function fetchUcrDiningMenus(date: Date) {
  const { slash } = getDateParts(date, 'America/Los_Angeles');
  const menus = await Promise.all(UCR_DINING_OPTIONS.map((option) => fetchUcrLocationMenu(option, slash).catch(() => null)));
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

async function fetchUiucLocationMenu(option: { id: number; name: string }, dateSlash: string) {
  const json = await fetchJson(UIUC_DINING_MENU_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ DiningOptionID: option.id, mealDate: dateSlash }),
  });
  const rows = typeof json === 'string' ? JSON.parse(json || '[]') : json;
  return buildLocationMenu(
    String(option.id),
    option.name,
    'https://web.housing.illinois.edu/diningmenus',
    groupUiucRowsIntoMeals(Array.isArray(rows) ? rows : [])
  );
}

async function fetchUiucDiningMenus(date: Date) {
  const { slash } = getDateParts(date, 'America/Chicago');
  const menus = await Promise.all(UIUC_DINING_OPTIONS.map((option) => fetchUiucLocationMenu(option, slash).catch(() => null)));
  return menus.filter((menu): menu is DiningLocationMenu => Boolean(menu));
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

function traitsFromNutrisliceFood(food: any) {
  return ((food?.icons?.food_icons ?? []) as any[])
    .map((icon) => compactText(icon?.name || icon?.slug || icon?.id))
    .filter(Boolean);
}

function parseNutrisliceMealItems(rows: any[]): DiningMenuStation[] {
  const stations: DiningMenuStation[] = [];
  let currentStation: DiningMenuStation = { id: 'items', name: 'Items', items: [] };
  stations.push(currentStation);

  rows.forEach((row, rowIndex) => {
    const rowText = compactText(row?.text);
    const foodName = compactText(row?.food?.name);
    if (row?.is_section_title) {
      const name = rowText || foodName || `Station ${stations.length + 1}`;
      currentStation = { id: `${stations.length}-${name}`, name, items: [] };
      stations.push(currentStation);
      return;
    }

    const name = foodName || rowText;
    if (!name) return;
    currentStation.items.push({
      id: String(row?.id ?? row?.food?.id ?? `${rowIndex}-${name}`),
      name,
      traits: traitsFromNutrisliceFood(row?.food),
    });
  });

  return stations;
}

async function fetchGsuMealMenu(location: typeof GSU_DINING_LOCATIONS[number], menuType: typeof GSU_DINING_LOCATIONS[number]['menuTypes'][number], dateIso: string) {
  const [year, month, day] = dateIso.split('-');
  const json = await fetchJson(`${GSU_NUTRISLICE_API_URL}/school/${location.id}/menu-type/${menuType.id}/${year}/${month}/${day}/`);
  const menuDay = ((json?.days ?? []) as any[]).find((entry) => entry?.date === dateIso);
  const stations = parseNutrisliceMealItems((menuDay?.menu_items ?? []) as any[]);
  if (stations.every((station) => station.items.length === 0)) return null;

  return {
    id: menuType.slug,
    name: menuType.name,
    stations,
  } as DiningMenuMeal;
}

async function fetchGsuLocationMenu(location: typeof GSU_DINING_LOCATIONS[number], dateIso: string) {
  const meals = await Promise.all(location.menuTypes.map((menuType) => fetchGsuMealMenu(location, menuType, dateIso).catch(() => null)));
  return buildLocationMenu(
    String(location.id),
    location.name,
    `${GSU_NUTRISLICE_MENU_URL}/${location.slug}`,
    meals.filter((meal): meal is DiningMenuMeal => Boolean(meal))
  );
}

async function fetchGsuDiningMenus(date: Date) {
  const { iso } = getDateParts(date, 'America/New_York');
  const menus = await Promise.all(GSU_DINING_LOCATIONS.map((location) => fetchGsuLocationMenu(location, iso).catch(() => null)));
  return menus.filter((menu): menu is DiningLocationMenu => Boolean(menu));
}

export async function fetchDiningMenusForSchool(school: string, date = new Date()): Promise<DiningLocationMenu[]> {
  if (school === 'UC Irvine') return fetchUciDiningMenus(date);
  if (school === 'University of Maryland, College Park') return fetchUmdDiningMenus(date);
  if (school === 'Cornell University') return fetchCornellDiningMenus(date);
  if (school === 'Purdue University') return fetchPurdueDiningMenus(date);
  if (school === 'University of Illinois Urbana-Champaign') return fetchUiucDiningMenus(date);
  if (school === 'UC Riverside') return fetchUcrDiningMenus(date);
  if (school === 'Temple University') return fetchTempleDiningMenus(date);
  if (school === 'Georgia State University') return fetchGsuDiningMenus(date);
  return [];
}
