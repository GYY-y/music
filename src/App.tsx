import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { FormEvent, UIEvent } from 'react'
import { getChartSongsPage, getDiscoverSongsPage, searchSongsPage } from './services/musicApi'
import { getLyrics } from './services/lyricsApi'
import type { LyricLine } from './services/lyricsApi'
import type { MusicTrack } from './types'

const STORAGE_KEY = 'music-web-playlist-v1'
const SEARCH_HISTORY_KEY = 'music-web-search-history-v1'
const QUICK_TAGS = ['华语', '中文', '国语', '粤语', '国风', 'mandopop', 'c-pop']
const PAGE_SIZE = 20
const HISTORY_MAX = 12

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00'
  }

  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

const mergeTracksById = (current: MusicTrack[], incoming: MusicTrack[]) => {
  const seen = new Set(current.map((item) => item.id))
  const extra = incoming.filter((item) => !seen.has(item.id))
  return [...current, ...extra]
}

function App() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricsCacheRef = useRef<Map<string, LyricLine[]>>(new Map())
  const initializedRef = useRef(false)

  const [discover, setDiscover] = useState<MusicTrack[]>([])
  const [discoverOffset, setDiscoverOffset] = useState(0)
  const [discoverHasMore, setDiscoverHasMore] = useState(false)
  const [discoverLoadingMore, setDiscoverLoadingMore] = useState(false)
  const [chartTracks, setChartTracks] = useState<MusicTrack[]>([])
  const [chartOffset, setChartOffset] = useState(0)
  const [chartHasMore, setChartHasMore] = useState(false)
  const [chartLoadingMore, setChartLoadingMore] = useState(false)
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([])
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchOffset, setSearchOffset] = useState(0)
  const [searchHasMore, setSearchHasMore] = useState(false)
  const [searchLoadingMore, setSearchLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [queue, setQueue] = useState<MusicTrack[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)

  const [playlist, setPlaylist] = useState<MusicTrack[]>([])
  const [playlistHydrated, setPlaylistHydrated] = useState(false)
  const [menu, setMenu] = useState<'recommend' | 'chart' | 'favorites'>('recommend')

  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [showPlayerPage, setShowPlayerPage] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setPlaylistHydrated(true)
      return
    }

    try {
      const parsed = JSON.parse(raw) as MusicTrack[]
      setPlaylist(parsed)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      setPlaylistHydrated(true)
    }
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as string[]
      setSearchHistory(parsed.filter(Boolean).slice(0, HISTORY_MAX))
    } catch {
      localStorage.removeItem(SEARCH_HISTORY_KEY)
    }
  }, [])

  useEffect(() => {
    if (!playlistHydrated) {
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlist))
  }, [playlist, playlistHydrated])

  useEffect(() => {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory))
  }, [searchHistory])

  useEffect(() => {
    if (initializedRef.current) {
      return
    }
    initializedRef.current = true

    const loadData = async () => {
      setLoading(true)
      setError('')
      try {
        const [discoverPage, rankTracks] = await Promise.all([
          getDiscoverSongsPage(PAGE_SIZE, 0),
          getChartSongsPage(PAGE_SIZE, 0),
        ])
        setDiscover(discoverPage.tracks)
        setDiscoverOffset(discoverPage.nextOffset)
        setDiscoverHasMore(discoverPage.hasMore)
        setChartTracks(rankTracks.tracks)
        setChartOffset(rankTracks.nextOffset)
        setChartHasMore(rankTracks.hasMore)
        setQueue(discoverPage.tracks)
      } catch {
        setError('加载失败，请稍后重试。')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const recommendList = useMemo(
    () => (hasSearched ? searchResults : discover),
    [discover, hasSearched, searchResults],
  )
  const chartList = useMemo(() => chartTracks, [chartTracks])
  const activeList = useMemo(() => {
    if (menu === 'favorites') {
      return playlist
    }
    if (menu === 'chart') {
      return chartList
    }
    return recommendList
  }, [chartList, menu, playlist, recommendList])

  const displayedList = useMemo(() => activeList, [activeList])
  const hasMore = useMemo(() => {
    if (menu === 'recommend' && hasSearched) {
      return searchHasMore
    }
    if (menu === 'recommend') {
      return discoverHasMore
    }
    if (menu === 'chart') {
      return chartHasMore
    }
    return false
  }, [chartHasMore, discoverHasMore, hasSearched, menu, searchHasMore])

  const currentTrack = useMemo(() => {
    if (!currentId) {
      return null
    }

    return queue.find((item) => item.id === currentId)
      ?? discover.find((item) => item.id === currentId)
      ?? chartTracks.find((item) => item.id === currentId)
      ?? searchResults.find((item) => item.id === currentId)
      ?? playlist.find((item) => item.id === currentId)
      ?? null
  }, [chartTracks, currentId, discover, playlist, queue, searchResults])

  const currentIndex = useMemo(() => queue.findIndex((item) => item.id === currentId), [currentId, queue])

  const activeLyricIndex = useMemo(() => {
    if (!lyrics.length) {
      return -1
    }

    for (let i = lyrics.length - 1; i >= 0; i -= 1) {
      if (currentTime >= lyrics[i].time) {
        return i
      }
    }

    return 0
  }, [currentTime, lyrics])

  const progressPercent = useMemo(() => {
    if (!duration || !Number.isFinite(duration)) {
      return 0
    }
    return Math.max(0, Math.min(100, (currentTime / duration) * 100))
  }, [currentTime, duration])

  useEffect(() => {
    if (activeLyricIndex < 0) {
      return
    }

    const node = document.querySelector<HTMLLIElement>(`.player-page-lyrics li[data-idx="${activeLyricIndex}"]`)
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeLyricIndex])

  useEffect(() => {
    const loadLyrics = async () => {
      if (!currentTrack) {
        setLyrics([])
        return
      }

      const cached = lyricsCacheRef.current.get(currentTrack.id)
      if (cached) {
        setLyrics(cached)
        return
      }

      setLyricsLoading(true)
      const data = await getLyrics(currentTrack.title, currentTrack.artist)
      lyricsCacheRef.current.set(currentTrack.id, data)
      setLyrics(data)
      setLyricsLoading(false)
    }

    void loadLyrics()
  }, [currentTrack])

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    const keyword = query.trim()
    if (!keyword) {
      setError('请输入搜索关键词。')
      setSearchResults([])
      setHasSearched(false)
      return
    }

    setMenu('recommend')
    setError('')
    setLoading(true)
    setSearchKeyword(keyword)
    setSearchOffset(0)
    setSearchHasMore(false)
    setSearchHistory((prev) => [keyword, ...prev.filter((item) => item !== keyword)].slice(0, HISTORY_MAX))
    try {
      const page = await searchSongsPage(keyword, { limit: PAGE_SIZE, offset: 0 })
      setSearchResults(page.tracks)
      setHasSearched(true)
      setQueue(page.tracks)
      setSearchOffset(page.nextOffset)
      setSearchHasMore(page.hasMore)
      if (!page.tracks.length) {
        setError('')
      }
    } catch {
      setSearchResults([])
      setHasSearched(true)
      setQueue([])
      setError('搜索失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  const quickSearch = async (keyword: string) => {
    const normalized = keyword.trim()
    if (!normalized) {
      setError('请输入搜索关键词。')
      return
    }

    setQuery(normalized)
    setMenu('recommend')
    setError('')
    setLoading(true)
    setSearchKeyword(normalized)
    setSearchOffset(0)
    setSearchHasMore(false)
    setSearchHistory((prev) => [normalized, ...prev.filter((item) => item !== normalized)].slice(0, HISTORY_MAX))
    try {
      const page = await searchSongsPage(normalized, { limit: PAGE_SIZE, offset: 0 })
      setSearchResults(page.tracks)
      setHasSearched(true)
      setQueue(page.tracks)
      setSearchOffset(page.nextOffset)
      setSearchHasMore(page.hasMore)
      if (!page.tracks.length) {
        setError('')
      }
    } catch {
      setSearchResults([])
      setHasSearched(true)
      setQueue([])
      setError('搜索失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  const playTrack = async (track: MusicTrack, fromList: MusicTrack[]) => {
    if (fromList.length) {
      setQueue(fromList)
    }

    setCurrentId(track.id)

    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (audio.src !== track.previewUrl) {
      audio.src = track.previewUrl
    }

    try {
      await audio.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio || !audio.src) {
      return
    }

    if (audio.paused) {
      await audio.play()
      setIsPlaying(true)
      return
    }

    audio.pause()
    setIsPlaying(false)
  }

  const playNext = async () => {
    if (!queue.length || currentIndex < 0) {
      return
    }

    const nextIndex = (currentIndex + 1) % queue.length
    await playTrack(queue[nextIndex], queue)
  }

  const playPrev = async () => {
    if (!queue.length || currentIndex < 0) {
      return
    }

    const prevIndex = (currentIndex - 1 + queue.length) % queue.length
    await playTrack(queue[prevIndex], queue)
  }

  const isSaved = (id: string) => playlist.some((item) => item.id === id)

  const toggleSaveTrack = (track: MusicTrack) => {
    if (isSaved(track.id)) {
      setPlaylist((prev) => prev.filter((item) => item.id !== track.id))
      return
    }

    setPlaylist((prev) => [track, ...prev])
  }

  const searchByHistory = async (keyword: string) => {
    setQuery(keyword)
    await quickSearch(keyword)
  }

  const loadMoreSearch = useCallback(async () => {
    if (!searchKeyword || searchLoadingMore || !searchHasMore || loading) {
      return
    }

    setSearchLoadingMore(true)
    try {
      const page = await searchSongsPage(searchKeyword, { limit: PAGE_SIZE, offset: searchOffset })
      setSearchResults((prev) => mergeTracksById(prev, page.tracks))
      setSearchOffset(page.nextOffset)
      setSearchHasMore(page.hasMore)
    } catch {
      setSearchHasMore(false)
      setError('加载更多失败，请稍后重试。')
    } finally {
      setSearchLoadingMore(false)
    }
  }, [loading, searchHasMore, searchKeyword, searchLoadingMore, searchOffset])

  const loadMoreDiscover = useCallback(async () => {
    if (discoverLoadingMore || !discoverHasMore || loading || hasSearched || menu !== 'recommend') {
      return
    }

    setDiscoverLoadingMore(true)
    try {
      const page = await getDiscoverSongsPage(PAGE_SIZE, discoverOffset)
      setDiscover((prev) => mergeTracksById(prev, page.tracks))
      setDiscoverOffset(page.nextOffset)
      setDiscoverHasMore(page.hasMore)
    } catch {
      setDiscoverHasMore(false)
      setError('加载更多失败，请稍后重试。')
    } finally {
      setDiscoverLoadingMore(false)
    }
  }, [discoverHasMore, discoverLoadingMore, discoverOffset, hasSearched, loading, menu])

  const loadMoreChart = useCallback(async () => {
    if (chartLoadingMore || !chartHasMore || loading || menu !== 'chart') {
      return
    }

    setChartLoadingMore(true)
    try {
      const page = await getChartSongsPage(PAGE_SIZE, chartOffset)
      setChartTracks((prev) => mergeTracksById(prev, page.tracks))
      setChartOffset(page.nextOffset)
      setChartHasMore(page.hasMore)
    } catch {
      setChartHasMore(false)
      setError('加载更多失败，请稍后重试。')
    } finally {
      setChartLoadingMore(false)
    }
  }, [chartHasMore, chartLoadingMore, chartOffset, loading, menu])

  useEffect(() => {
    if ((menu !== 'recommend' && menu !== 'chart') || !hasMore) {
      return
    }

    const onWindowScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80
      if (!nearBottom) {
        return
      }

      if (menu === 'recommend') {
        if (hasSearched) {
          void loadMoreSearch()
          return
        }
        void loadMoreDiscover()
        return
      }
      void loadMoreChart()
    }

    window.addEventListener('scroll', onWindowScroll, { passive: true })
    return () => window.removeEventListener('scroll', onWindowScroll)
  }, [hasMore, hasSearched, loadMoreChart, loadMoreDiscover, loadMoreSearch, menu])

  const handleSongTableScroll = (event: UIEvent<HTMLUListElement>) => {
    const target = event.currentTarget
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 48
    if (!nearBottom) {
      return
    }

    if (menu === 'recommend' && hasSearched) {
      void loadMoreSearch()
      return
    }

    if (menu === 'recommend') {
      void loadMoreDiscover()
      return
    }

    if (menu === 'chart' && hasMore) {
      void loadMoreChart()
      return
    }

    if (!hasMore) {
      return
    }
  }

  return (
    <div className="qq-shell">
      <aside className="qq-sidebar">
        <nav>
          <button type="button" className={menu === 'recommend' ? 'active' : ''} onClick={() => { setMenu('recommend'); setQueue(recommendList) }}>推荐</button>
          <button type="button" className={menu === 'chart' ? 'active' : ''} onClick={() => { setMenu('chart'); setQueue(chartList) }}>排行榜</button>
          <button type="button" className={menu === 'favorites' ? 'active' : ''} onClick={() => setMenu('favorites')}>我的收藏</button>
        </nav>
      </aside>

      <main className="qq-main">
        <header className="qq-header">
          {menu === 'recommend' ? (
            <>
              <p className="indie-badge">Independent Music Only · Audius</p>
              <form onSubmit={handleSearch}>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索独立音乐（英文关键词效果更好）" />
                <button type="submit">搜索</button>
              </form>
              <div className="quick-tags">
                {QUICK_TAGS.map((item) => (
                  <button key={item} type="button" onClick={() => void quickSearch(item)}>{item}</button>
                ))}
              </div>
              <div className="history-row">
                <div className="history-head">
                  <span>搜索历史</span>
                  {searchHistory.length ? (
                    <button type="button" className="history-clear" onClick={() => setSearchHistory([])}>清空</button>
                  ) : null}
                </div>
                <div className="history-tags">
                  {searchHistory.length ? searchHistory.map((item) => (
                    <button key={item} type="button" onClick={() => void searchByHistory(item)}>{item}</button>
                  )) : <span className="history-empty">暂无搜索历史</span>}
                </div>
              </div>
            </>
          ) : null}
        </header>

        <section className="song-section">
          <h2 className="song-section-title">
            {menu === 'recommend' ? '推荐歌曲' : menu === 'chart' ? '排行榜' : '我的收藏'}
          </h2>
          <div className="song-header">
            <span>#</span>
            <span>标题</span>
            <span>专辑</span>
            <span>喜欢</span>
            <span>播放时间</span>
          </div>
          <ul className="song-table" onScroll={handleSongTableScroll}>
            {loading ? <li className="state">加载中...</li> : null}
            {error ? <li className="state error">{error}</li> : null}
            {menu === 'recommend' && hasSearched && !loading && !error && searchResults.length === 0 ? <li className="state">列表为空</li> : null}
            {menu === 'favorites' && !playlist.length ? <li className="state">暂无收藏</li> : null}
            {displayedList.map((track, index) => (
              <li key={track.id} className={currentId === track.id ? 'active' : ''}>
                <span className="song-rank">{String(index + 1).padStart(2, '0')}</span>
                <button className="song-name" type="button" onClick={() => void playTrack(track, activeList)}>
                  <img src={track.cover} alt={track.title} />
                  <span className="song-title-block">
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                </button>
                <span className="song-album">{track.album || 'Single'}</span>
                <button className={`song-like ${isSaved(track.id) ? 'saved' : ''}`} type="button" onClick={() => toggleSaveTrack(track)} aria-label={isSaved(track.id) ? '取消喜欢' : '喜欢'}>
                  {isSaved(track.id) ? '♥' : '♡'}
                </button>
                <span className="song-play-time">{formatTime(track.duration)}</span>
              </li>
            ))}
            {hasMore ? <li className="state">继续下滑加载更多...</li> : null}
          </ul>
        </section>
      </main>

      <footer className={`qq-player ${showPlayerPage ? 'floating compact' : ''}`}>
        <button
          type="button"
          className="now-playing-entry"
          aria-label={showPlayerPage ? '返回列表' : '打开播放详情'}
          title={showPlayerPage ? '返回列表' : '打开播放详情'}
          onClick={() => setShowPlayerPage((prev) => !prev)}
        >
          {currentTrack?.cover ? <img src={currentTrack.cover} alt={currentTrack.title} /> : <div className="now-cover-empty" />}
          <span className="meta">
            <strong>{currentTrack?.title ?? '未播放'}</strong>
            <span>{currentTrack?.artist ?? '请选择歌曲'}</span>
          </span>
        </button>

        <div className="transport">
          <div className="controls">
            <button type="button" className="icon-btn" aria-label="上一首" title="上一首" onClick={() => void playPrev()}>
              ⏮
            </button>
            <button type="button" className="play icon-btn" aria-label={isPlaying ? '暂停' : '播放'} title={isPlaying ? '暂停' : '播放'} onClick={() => void togglePlay()}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button type="button" className="icon-btn" aria-label="下一首" title="下一首" onClick={() => void playNext()}>
              ⏭
            </button>
          </div>

          <div className="progress">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (audioRef.current) {
                  audioRef.current.currentTime = value
                }
                setCurrentTime(value)
              }}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="volume-panel">
          <button
            type="button"
            className="volume-icon"
            onClick={() => setVolume((prev) => (prev > 0 ? 0 : 0.8))}
            aria-label={volume > 0 ? '静音' : '取消静音'}
            title={volume > 0 ? '静音' : '取消静音'}
          >
            {volume > 0 ? '🔊' : '🔇'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="音量"
          />
          <span>{Math.round(volume * 100)}%</span>
        </div>
      </footer>

      <audio
        ref={audioRef}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => void playNext()}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {showPlayerPage ? (
        <section className="player-page">
          <div className="player-page-bg" style={{ backgroundImage: currentTrack?.cover ? `url(${currentTrack.cover})` : 'none' }} />
          <div className="player-page-content">
            <div className="player-page-cover-wrap">
              <div className="player-page-cover-ring" style={{ '--progress': `${progressPercent}%` } as CSSProperties}>
                {currentTrack?.cover ? <img className={`player-page-cover ${isPlaying ? 'spin' : ''}`} src={currentTrack.cover} alt={currentTrack.title} /> : <div className="player-page-cover empty">暂无封面</div>}
              </div>
              <h2>{currentTrack?.title ?? '未播放'}</h2>
              <p>{currentTrack?.artist ?? '请选择歌曲'}</p>
            </div>
            <div className="player-page-lyrics-wrap">
              <h3>歌词</h3>
              {lyricsLoading ? <p className="state">歌词加载中...</p> : null}
              <ul className="player-page-lyrics">
                {lyrics.map((line, index) => (
                  <li key={`${line.time}-${index}`} data-idx={index} className={index === activeLyricIndex ? 'active' : ''}>
                    {line.text}
                  </li>
                ))}
              </ul>
              {!lyrics.length && !lyricsLoading ? <p className="state">暂无歌词</p> : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default App
