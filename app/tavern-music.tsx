'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
type Player = {
  setVolume: (n: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
  unMute: () => void;
};
type API = {
  Player: new (el: HTMLElement, options: Record<string, unknown>) => Player;
};
declare global {
  interface Window {
    YT?: API;
    onYouTubeIframeAPIReady?: () => void;
  }
}
const MusicContext = createContext({
  status: "",
  playing: true,
  volume: 15,
  setVolume: (_n: number) => {},
  toggle: () => {},
});
export function useTavernMusic() {
  return useContext(MusicContext);
}
export function MusicProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(true),
    [volume, setVolume] = useState(15),
    [status, setStatus] = useState('Cargando música…');
  const host = useRef<HTMLDivElement>(null),
    player = useRef<Player | null>(null),
    desired = useRef(true),
    level = useRef(15);
  useEffect(() => {
    desired.current = playing;
    if (playing) player.current?.playVideo?.();
    else player.current?.pauseVideo?.();
  }, [playing]);
  useEffect(() => {
    level.current = volume;
    player.current?.setVolume?.(volume);
  }, [volume]);
  useEffect(() => {
    let disposed = false;
    const mount = document.createElement('div');
    host.current?.appendChild(mount);
    const init = () => {
      if (disposed || !window.YT) return;
      player.current = new window.YT.Player(mount, {
        height: '200',
        width: '320',
        videoId: 'vyg5jJrZ42s',
        playerVars: {
          playsinline: 1,
          autoplay: 1,
          loop: 1,
          playlist: 'vyg5jJrZ42s',
          origin: location.origin,
        },
        events: {
          onReady: () => {
            player.current?.setVolume?.(level.current);
            player.current?.unMute?.();
            if (desired.current) player.current?.playVideo?.();
            setStatus('Música al 15 % · puedes ajustar el volumen');
          },
          onAutoplayBlocked: () => {
            setPlaying(false);
            setStatus('Pulsa Reproducir para iniciar la música');
          },
          onError: () =>
            setStatus(
              'YouTube no pudo reproducir este video. Prueba abrirlo en YouTube.',
            ),
        },
      });
    };
    if (window.YT) init();
    else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        init();
      };
      if (!document.querySelector('script[data-youtube-api]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.dataset.youtubeApi = 'true';
        script.onerror = () => {
          if (!disposed) setStatus('No se pudo conectar con YouTube');
        };
        document.head.appendChild(script);
      }
    }
    const unlock = () => {
      if (desired.current) {
        player.current?.setVolume?.(level.current);
        player.current?.playVideo?.();
      }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener('pointerdown', unlock);
      player.current?.destroy?.();
      player.current = null;
      mount.remove();
    };
  }, []);
  return (
    <MusicContext.Provider
      value={{
        playing,
        status,
        volume,
        setVolume,
        toggle: () => setPlaying((v) => !v),
      }}
    >
      {children}
      <div className="background-music-frame" ref={host} aria-hidden="true" />

    </MusicContext.Provider>
  );
}
