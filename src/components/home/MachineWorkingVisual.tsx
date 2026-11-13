"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { MachineOperationPreset } from './machine-operation-presets';
import type { createMachineScene } from './machine-3d-runtime';
import styles from './MachineWorkingVisual.module.css';

type Props = { source: string; alt: string; preset: MachineOperationPreset; paused: boolean };
type SceneController = Awaited<ReturnType<typeof createMachineScene>>;

export default function MachineWorkingVisual({ source, alt, preset, paused }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<SceneController | null>(null);
  const playback = useRef({ paused, reduced: false });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      playback.current = { paused, reduced: media.matches };
      controller.current?.setPlayback(paused, media.matches);
    };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [paused]);

  useEffect(() => {
    let cancelled = false;
    let scene: SceneController | null = null;
    setReady(false); setFailed(false);
    import('./machine-3d-runtime').then(async ({ createMachineScene }) => {
      if (cancelled || !host.current) return;
      try {
        scene = await createMachineScene(host.current, preset, source);
        if (cancelled) { scene.dispose(); return; }
        controller.current = scene;
        scene.setPlayback(playback.current.paused, playback.current.reduced);
        setReady(true);
      } catch {
        // Browsers without WebGL retain the real machine photograph.
        host.current?.replaceChildren(); setFailed(true);
      }
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; scene?.dispose(); controller.current = null; };
  }, [preset, source]);

  return (
    <div className={styles.visual} data-machine-operation={preset.kind} data-scene-ready={ready ? 'true' : 'false'}>
      {!ready && (
        <Image src={source} alt={alt} fill sizes="(max-width: 900px) 100vw, 65vw" className={styles.poster} />
      )}
      <div
        ref={host}
        className={styles.canvasHost}
        role="img"
        aria-hidden={!ready}
        aria-label={`${alt}. Original machine working preview. Drag or use arrow keys for subtle depth.`}
        tabIndex={ready ? 0 : -1}
        data-machine-scene={preset.kind}
        data-fallback={failed ? 'true' : undefined}
        style={{ opacity: ready ? 1 : 0 }}
      />
    </div>
  );
}
