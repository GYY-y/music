export type LyricLine = {
  time: number
  text: string
}

type LRCLibGetResponse = {
  syncedLyrics?: string
  plainLyrics?: string
}

type LRCLibSearchResponse = Array<{
  syncedLyrics?: string
  plainLyrics?: string
}>

const TIME_LINE_REGEX = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,2}))?](.*)/

const toSeconds = (min: string, sec: string, cs?: string) => {
  const minute = Number(min)
  const second = Number(sec)
  const centisecond = Number(cs ?? '0')
  return minute * 60 + second + centisecond / 100
}

export const parseSyncedLyrics = (raw: string): LyricLine[] => {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(TIME_LINE_REGEX)
      if (!match) {
        return null
      }

      const [, min, sec, cs, text] = match
      return {
        time: toSeconds(min, sec, cs),
        text: text.trim() || '...',
      }
    })
    .filter((line): line is LyricLine => Boolean(line))
    .sort((a, b) => a.time - b.time)
}

export const parsePlainLyrics = (plain: string): LyricLine[] => {
  return plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      time: index * 4,
      text: line,
    }))
}

const fallbackLyrics = (title: string, artist: string): LyricLine[] => [
  { time: 0, text: `${title} - ${artist}` },
  { time: 4, text: '当前音源未返回同步歌词。' },
  { time: 8, text: '你仍可以试听和收藏这首歌。' },
  { time: 12, text: '可继续搜索其它歌曲获取完整歌词。' },
]

export const getLyrics = async (title: string, artist: string): Promise<LyricLine[]> => {
  const params = new URLSearchParams({
    track_name: title,
    artist_name: artist,
  })

  try {
    const exactResp = await fetch(`https://lrclib.net/api/get?${params.toString()}`)
    if (exactResp.ok) {
      const exactData = (await exactResp.json()) as LRCLibGetResponse
      if (exactData.syncedLyrics) {
        const lines = parseSyncedLyrics(exactData.syncedLyrics)
        if (lines.length) {
          return lines
        }
      }
      if (exactData.plainLyrics) {
        const lines = parsePlainLyrics(exactData.plainLyrics)
        if (lines.length) {
          return lines
        }
      }
    }
  } catch {
    // ignore and fallback to search
  }

  try {
    const searchResp = await fetch(`https://lrclib.net/api/search?${params.toString()}`)
    if (searchResp.ok) {
      const searchData = (await searchResp.json()) as LRCLibSearchResponse
      const candidate = searchData[0]

      if (candidate?.syncedLyrics) {
        const lines = parseSyncedLyrics(candidate.syncedLyrics)
        if (lines.length) {
          return lines
        }
      }

      if (candidate?.plainLyrics) {
        const lines = parsePlainLyrics(candidate.plainLyrics)
        if (lines.length) {
          return lines
        }
      }
    }
  } catch {
    // ignore and fallback
  }

  return fallbackLyrics(title, artist)
}
