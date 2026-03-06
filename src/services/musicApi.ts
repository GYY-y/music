import type { MusicTrack } from '../types'

type AudiusHostResponse = {
  data: string[]
}

type AudiusArtist = {
  name: string
}

type AudiusArtwork = {
  '150x150'?: string
  '480x480'?: string
  '1000x1000'?: string
}

type AudiusTrack = {
  id: string
  title: string
  duration: number
  artwork?: AudiusArtwork | null
  user: AudiusArtist
}

type AudiusTrackResponse = {
  data: AudiusTrack[]
}

const AUDIUS_HOST_DISCOVERY = 'https://api.audius.co'
const APP_NAME = 'wegeme_indie_music'
const DEFAULT_PAGE_SIZE = 20
const MAX_SEARCH_LIMIT = 100
const TRENDING_LIMIT = 100
let cachedHostPromise: Promise<string> | null = null

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

const containsChinese = (text: string) => /[\u4e00-\u9fff]/.test(text)

const toUniqueTracks = (tracks: MusicTrack[]): MusicTrack[] => {
  const visited = new Set<string>()
  const result: MusicTrack[] = []

  for (const track of tracks) {
    const key = `${track.title}::${track.artist}`.toLowerCase()
    if (visited.has(key)) {
      continue
    }
    visited.add(key)
    result.push(track)
  }

  return result
}

const prioritizeChineseTracks = (tracks: MusicTrack[]): MusicTrack[] => {
  const chinese: MusicTrack[] = []
  const others: MusicTrack[] = []

  for (const track of tracks) {
    const isChinese = containsChinese(track.title) || containsChinese(track.artist)
    if (isChinese) {
      chinese.push(track)
    } else {
      others.push(track)
    }
  }

  return [...chinese, ...others]
}

const getAudiusHost = async (): Promise<string> => {
  if (!cachedHostPromise) {
    cachedHostPromise = fetchJson<AudiusHostResponse>(AUDIUS_HOST_DISCOVERY)
      .then((hostData) => {
        if (!hostData.data?.length) {
          throw new Error('No available Audius host')
        }
        return hostData.data[0]
      })
      .catch((error) => {
        cachedHostPromise = null
        throw error
      })
  }

  return cachedHostPromise
}

const formatAudiusTrack = (baseHost: string, item: AudiusTrack): MusicTrack | null => {
  if (!item.id || !item.title || !item.user?.name) {
    return null
  }

  const art = item.artwork
  const cover = art?.['1000x1000'] ?? art?.['480x480'] ?? art?.['150x150'] ?? 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop'

  return {
    id: `audius-${item.id}`,
    title: item.title,
    artist: item.user.name,
    album: 'Independent Release',
    cover,
    previewUrl: `${baseHost}/v1/tracks/${item.id}/stream?app_name=${encodeURIComponent(APP_NAME)}`,
    duration: Math.max(1, Math.round(item.duration || 0)),
    source: 'audius',
  }
}

type AudiusSearchPage = {
  tracks: MusicTrack[]
  rawCount: number
  safeLimit: number
  safeOffset: number
}

const fetchAudiusSearchPage = async (query: string, limit: number, offset = 0): Promise<AudiusSearchPage> => {
  const host = await getAudiusHost()
  const safeLimit = Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT)
  const safeOffset = Math.max(0, offset)
  const params = new URLSearchParams({
    app_name: APP_NAME,
    query,
    limit: String(safeLimit),
    offset: String(safeOffset),
  })

  const data = await fetchJson<AudiusTrackResponse>(`${host}/v1/tracks/search?${params.toString()}`)
  const tracks = data.data
    .map((item) => formatAudiusTrack(host, item))
    .filter((track): track is MusicTrack => Boolean(track))

  return {
    tracks,
    rawCount: data.data.length,
    safeLimit,
    safeOffset,
  }
}

const fetchAudiusSearch = async (query: string, limit: number, offset = 0): Promise<MusicTrack[]> => {
  const page = await fetchAudiusSearchPage(query, limit, offset)
  return page.tracks
}

type AudiusTrendingPage = {
  tracks: MusicTrack[]
  rawCount: number
  safeLimit: number
  safeOffset: number
}

const fetchAudiusTrendingPage = async (limit: number, offset = 0, time: 'week' | 'month' = 'month'): Promise<AudiusTrendingPage> => {
  const host = await getAudiusHost()
  const safeLimit = Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT)
  const safeOffset = Math.max(0, offset)
  const params = new URLSearchParams({
    app_name: APP_NAME,
    limit: String(safeLimit),
    offset: String(safeOffset),
    time,
  })

  const data = await fetchJson<AudiusTrackResponse>(`${host}/v1/tracks/trending?${params.toString()}`)
  const tracks = data.data
    .map((item) => formatAudiusTrack(host, item))
    .filter((track): track is MusicTrack => Boolean(track))

  return {
    tracks,
    rawCount: data.data.length,
    safeLimit,
    safeOffset,
  }
}

const fetchAudiusTrending = async (): Promise<MusicTrack[]> => {
  const page = await fetchAudiusTrendingPage(TRENDING_LIMIT, 0, 'month')
  return page.tracks
}

type SearchSongsOptions = {
  limit?: number
  offset?: number
}

export const searchSongs = async (query: string, options: SearchSongsOptions = {}): Promise<MusicTrack[]> => {
  if (!query.trim()) {
    return []
  }

  const limit = options.limit ?? DEFAULT_PAGE_SIZE
  const offset = options.offset ?? 0
  const tracks = await fetchAudiusSearch(query, limit, offset)
  return prioritizeChineseTracks(toUniqueTracks(tracks))
}

export type SearchSongsPageResult = {
  tracks: MusicTrack[]
  hasMore: boolean
  nextOffset: number
}

export const searchSongsPage = async (query: string, options: SearchSongsOptions = {}): Promise<SearchSongsPageResult> => {
  if (!query.trim()) {
    return {
      tracks: [],
      hasMore: false,
      nextOffset: 0,
    }
  }

  const limit = options.limit ?? DEFAULT_PAGE_SIZE
  const offset = options.offset ?? 0
  const page = await fetchAudiusSearchPage(query, limit, offset)
  return {
    tracks: prioritizeChineseTracks(toUniqueTracks(page.tracks)),
    hasMore: page.rawCount >= page.safeLimit,
    nextOffset: page.safeOffset + page.rawCount,
  }
}

export type DiscoverSongsPageResult = {
  tracks: MusicTrack[]
  hasMore: boolean
  nextOffset: number
}

export const getDiscoverSongsPage = async (limit = DEFAULT_PAGE_SIZE, offset = 0): Promise<DiscoverSongsPageResult> => {
  const page = await fetchAudiusTrendingPage(limit, offset, 'week')
  return {
    tracks: prioritizeChineseTracks(toUniqueTracks(page.tracks)),
    hasMore: page.rawCount >= page.safeLimit,
    nextOffset: page.safeOffset + page.rawCount,
  }
}

export type ChartSongsPageResult = {
  tracks: MusicTrack[]
  hasMore: boolean
  nextOffset: number
}

export const getChartSongsPage = async (limit = DEFAULT_PAGE_SIZE, offset = 0): Promise<ChartSongsPageResult> => {
  const page = await fetchAudiusTrendingPage(limit, offset, 'month')
  return {
    tracks: prioritizeChineseTracks(toUniqueTracks(page.tracks)),
    hasMore: page.rawCount >= page.safeLimit,
    nextOffset: page.safeOffset + page.rawCount,
  }
}

export const getChartSongs = async (): Promise<MusicTrack[]> => {
  try {
    const tracks = await fetchAudiusTrending()
    return prioritizeChineseTracks(toUniqueTracks(tracks))
  } catch {
    return []
  }
}
