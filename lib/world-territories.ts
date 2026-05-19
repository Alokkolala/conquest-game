import * as topojson from 'topojson-client'
import type { Topology } from 'topojson-specification'
import type { TerritoryStatus, CountryFeature } from './types'

// world-atlas 110m — bundled at build time, no runtime CDN fetch
// eslint-disable-next-line @typescript-eslint/no-require-imports
const worldData = require('world-atlas/countries-110m.json') as Topology

// ── ISO numeric → country name lookup ─────────────────────
export const ISO_NUMERIC_TO_NAME: Record<string, string> = {
  '4':'Afghanistan','8':'Albania','12':'Algeria','24':'Angola','32':'Argentina',
  '36':'Australia','40':'Austria','50':'Bangladesh','56':'Belgium','64':'Bhutan',
  '68':'Bolivia','76':'Brazil','100':'Bulgaria','104':'Myanmar','116':'Cambodia',
  '120':'Cameroon','124':'Canada','152':'Chile','156':'China','170':'Colombia',
  '178':'Congo','188':'Costa Rica','191':'Croatia','192':'Cuba','196':'Cyprus',
  '203':'Czech Republic','204':'Benin','208':'Denmark','218':'Ecuador',
  '818':'Egypt','222':'El Salvador','231':'Ethiopia','246':'Finland','250':'France',
  '266':'Gabon','276':'Germany','288':'Ghana','300':'Greece','320':'Guatemala',
  '332':'Haiti','340':'Honduras','348':'Hungary','356':'India','360':'Indonesia',
  '364':'Iran','368':'Iraq','372':'Ireland','376':'Israel','380':'Italy',
  '388':'Jamaica','392':'Japan','400':'Jordan','398':'Kazakhstan','404':'Kenya',
  '410':'South Korea','408':'North Korea','414':'Kuwait','418':'Laos','422':'Lebanon',
  '430':'Liberia','434':'Libya','442':'Luxembourg','454':'Malawi','458':'Malaysia',
  '484':'Mexico','504':'Morocco','508':'Mozambique','516':'Namibia','524':'Nepal',
  '528':'Netherlands','554':'New Zealand','558':'Nicaragua','562':'Niger',
  '566':'Nigeria','578':'Norway','586':'Pakistan','591':'Panama','598':'Papua New Guinea',
  '604':'Peru','608':'Philippines','616':'Poland','620':'Portugal','630':'Puerto Rico',
  '642':'Romania','643':'Russia','646':'Rwanda','682':'Saudi Arabia','686':'Senegal',
  '694':'Sierra Leone','706':'Somalia','710':'South Africa','724':'Spain',
  '729':'Sudan','752':'Sweden','756':'Switzerland','760':'Syria','762':'Tajikistan',
  '764':'Thailand','768':'Togo','780':'Trinidad and Tobago','788':'Tunisia',
  '792':'Turkey','800':'Uganda','804':'Ukraine','784':'United Arab Emirates',
  '826':'United Kingdom','840':'United States','858':'Uruguay','860':'Uzbekistan',
  '862':'Venezuela','704':'Vietnam','887':'Yemen','894':'Zambia','716':'Zimbabwe',
  '854':'Burkina Faso','140':'Central African Republic',
  '148':'Chad','174':'Djibouti','232':'Eritrea',
  '324':'Guinea','624':'Guinea-Bissau','426':'Lesotho','450':'Madagascar',
  '466':'Mali','478':'Mauritania','748':'Eswatini','834':'Tanzania',
}

// ── Default gameplay state for named countries ─────────────
export const DEFAULT_COUNTRY_STATUS: Record<string, {
  status: TerritoryStatus
  held?: number
  value: number
  owner?: string
  ownerElo?: number
}> = {
  'France':         { status: 'owned',     held: 47,  value: 12.4 },
  'Germany':        { status: 'owned',     held: 22,  value: 9.1  },
  'United Kingdom': { status: 'owned',     held: 81,  value: 14.8 },
  'United States':  { status: 'owned',     held: 134, value: 22.6 },
  'Brazil':         { status: 'owned',     held: 18,  value: 7.0  },
  'South Africa':   { status: 'owned',     held: 12,  value: 6.1  },
  'Italy':          { status: 'contested', held: 4,   value: 8.4,  owner: 'AzureCrown',  ownerElo: 1820 },
  'India':          { status: 'contested', held: 9,   value: 9.8,  owner: 'VerdantHold', ownerElo: 1755 },
  'Russia':         { status: 'enemy',               value: 18.2, owner: 'Korchnoi_IV', ownerElo: 1988 },
  'China':          { status: 'enemy',               value: 20.1, owner: 'TigerOf64',   ownerElo: 2011 },
  'Japan':          { status: 'enemy',               value: 11.3, owner: 'Hoshino',     ownerElo: 1901 },
  'Canada':         { status: 'enemy',               value: 10.8, owner: 'ObsidianPact',ownerElo: 1843 },
  'Australia':      { status: 'enemy',               value: 9.4,  owner: 'CrimsonGuard',ownerElo: 1776 },
  'Argentina':      { status: 'enemy',               value: 7.2,  owner: 'CrimsonGuard',ownerElo: 1776 },
}

// ── TopoJSON → GeoJSON conversion ─────────────────────────
type GeoFeature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>

let _features: GeoFeature[] | null = null
export function getWorldFeatures(): GeoFeature[] {
  if (_features) return _features
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geo = topojson.feature(worldData, worldData.objects.countries as any) as unknown as GeoJSON.FeatureCollection
  _features = geo.features as GeoFeature[]
  return _features
}

// ── SVG projection helpers ─────────────────────────────────
// Equirectangular projection: world fits into 1000 x 500 viewBox
export const VB_W = 1000
export const VB_H = 500

type Coord = [number, number]

export function project([lng, lat]: Coord): [number, number] {
  const x = (lng + 180) / 360 * VB_W
  const y = (90 - lat) / 180 * VB_H
  return [x, y]
}

function ringToPath(ring: Coord[]): string {
  let s = ''
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i])
    s += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
  }
  return s + 'Z'
}

export function geomToPath(geom: GeoJSON.Geometry): string {
  const parts: string[] = []
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) parts.push(ringToPath(ring as Coord[]))
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates)
      for (const ring of poly) parts.push(ringToPath(ring as Coord[]))
  }
  return parts.join(' ')
}

export function geomCentroid(geom: GeoJSON.Geometry): [number, number] {
  let bestArea = -1
  let bestCenter: [number, number] = [0, 0]

  const considerRing = (ring: Coord[]) => {
    let area = 0, cx = 0, cy = 0
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = project(ring[i])
      const [x2, y2] = project(ring[i + 1])
      const a = x1 * y2 - x2 * y1
      area += a; cx += (x1 + x2) * a; cy += (y1 + y2) * a
    }
    area /= 2
    if (Math.abs(area) > bestArea) {
      bestArea = Math.abs(area)
      bestCenter = area === 0 ? [0, 0] : [cx / (6 * area), cy / (6 * area)]
    }
  }
  if (geom.type === 'Polygon') geom.coordinates.forEach(r => considerRing(r as Coord[]))
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(r => considerRing(r as Coord[])))
  return bestCenter
}

// ── Build all CountryFeatures ──────────────────────────────
export function buildCountryFeatures(
  ownerMap: Record<string, string> = {},
  currentUsername = ''
): CountryFeature[] {
  const features = getWorldFeatures()
  return features.map(f => {
    const id    = String(f.id ?? '')
    const name  = ISO_NUMERIC_TO_NAME[id] ?? id
    const liveOwner = ownerMap[name]

    let status: TerritoryStatus = 'neutral'
    let ownerUsername: string | undefined
    let ownerElo: number | undefined
    let held: number | undefined
    let value = 5

    const def = DEFAULT_COUNTRY_STATUS[name]

    if (liveOwner !== undefined) {
      // Live Supabase data takes precedence
      if (liveOwner === currentUsername) {
        status = 'owned'
      } else {
        status = 'enemy'
        ownerUsername = liveOwner
      }
      if (def) { value = def.value; held = def.held }
    } else if (def) {
      // Fall back to static defaults
      status        = def.status
      ownerUsername = def.owner
      ownerElo      = def.ownerElo
      held          = def.held
      value         = def.value
    }

    return {
      id,
      name,
      path:   f.geometry ? geomToPath(f.geometry) : '',
      center: (f.geometry ? geomCentroid(f.geometry) : [0, 0]) as [number, number],
      status,
      owner: ownerUsername,
      ownerElo,
      value,
      held,
    }
  }).filter(f => f.path !== '')
}
