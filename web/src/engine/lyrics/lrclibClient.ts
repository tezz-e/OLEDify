import { LrclibTrack } from './types';

const LRCLIB_BASE_URL = 'https://lrclib.net/api';
const USER_AGENT = 'PureLyricsOledStudio/1.0 (https://github.com/tezz-e/OLEDify; contact@oledstudio.local)';

/**
 * Searches LRCLIB for matching tracks.
 * Returns up to 20 tracks with synced/plain lyrics metadata.
 */
export async function searchLrclib(query: string): Promise<LrclibTrack[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = `${LRCLIB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (response.status === 429) {
      console.warn('LRCLIB Rate limit reached. Retrying after brief delay...');
      await new Promise(r => setTimeout(r, 1000));
      return searchLrclib(query);
    }

    if (!response.ok) {
      throw new Error(`LRCLIB search failed with status ${response.status}`);
    }

    const data: LrclibTrack[] = await response.json();
    return data;
  } catch (error) {
    console.error('LRCLIB search error:', error);
    // Fallback: try secondary search or return empty
    return [];
  }
}

/**
 * Fetches exact track lyrics from LRCLIB using specific metadata tags.
 */
export async function getLrclibExact(
  trackName: string,
  artistName: string,
  albumName?: string,
  durationSeconds?: number
): Promise<LrclibTrack | null> {
  const params = new URLSearchParams({
    track_name: trackName,
    artist_name: artistName,
  });

  if (albumName) params.append('album_name', albumName);
  if (durationSeconds) params.append('duration', Math.round(durationSeconds).toString());

  const url = `${LRCLIB_BASE_URL}/get?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`LRCLIB get failed with status ${response.status}`);
    }

    const data: LrclibTrack = await response.json();
    return data;
  } catch (error) {
    console.error('LRCLIB exact match error:', error);
    return null;
  }
}

/**
 * Plain-text fallback via lyrics.ovh when no timed LRC is found anywhere.
 */
export async function searchLyricsOvhFallback(artist: string, title: string): Promise<string | null> {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.lyrics || null;
  } catch {
    return null;
  }
}
