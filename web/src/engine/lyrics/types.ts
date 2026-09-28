export interface LyricWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface LyricLine {
  lineIndex: number;
  text: string;
  startMs: number;
  endMs: number;
  words: LyricWord[];
}

export interface ParsedLyrics {
  title?: string;
  artist?: string;
  album?: string;
  offsetMs: number;
  durationMs?: number;
  lines: LyricLine[];
}

export interface LrclibTrack {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number; // in seconds
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null; // Raw LRC format
}
