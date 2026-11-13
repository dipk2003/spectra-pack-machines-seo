import * as T from 'three';
import { buildWorkingMachine } from './machine-3d-model';
import type { MachineOperationPreset } from './machine-operation-presets';

export async function createMachineScene(host: HTMLDivElement, preset: MachineOperationPreset, source: string) {
  const model = await buildWorkingMachine(preset, source);
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.transmissionResolutionScale = 0.5;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
  scene.add(model.root);
  host.dataset.machineSource = source;
  host.dataset.machineLayers = String(model.root.children.length);
  host.dataset.visualStyle = 'original-photographic-layers';

  let playing = true;
  let reduced = false;
  let inView = true;
  let disposed = false;
  let frame = 0;
  let seconds = 2.8;
  let previous = 0;
  let dragX = 0;
  let dragY = 0;
  let azimuth = 0;
  let elevation = 0;
  let desiredAzimuth = azimuth;
  let desiredElevation = elevation;
  let distance = 15;
  let dragging = false;
  let currentCycle = -1;

  function resize() {
    const width = host.clientWidth; const height = host.clientHeight;
    if (!width || !height || disposed) return;
    renderer.setSize(width, height, false); camera.aspect = width / height;
    const halfFov = T.MathUtils.degToRad(camera.fov / 2);
    distance = Math.max(model.span / (2 * Math.tan(halfFov) * camera.aspect), model.height / (2 * Math.tan(halfFov))) * 1.08;
    camera.updateProjectionMatrix(); draw();
  }
  function draw() {
    camera.position.set(
      model.target.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      model.target.y + Math.sin(elevation) * distance,
      model.target.z + Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    camera.lookAt(model.target); renderer.render(scene, camera);
  }
  function tick(timestamp: number) {
    if (disposed) return;
    const delta = previous ? Math.min((timestamp - previous) / 1000, 0.05) : 0;
    previous = timestamp;
    if (playing && !reduced && inView && !document.hidden) {
      seconds += delta; model.update(seconds);
      const cycle = Math.floor(seconds * 10);
      if (cycle !== currentCycle) { host.dataset.machineTime = seconds.toFixed(1); currentCycle = cycle; }
      draw();
    }
    if (Math.abs(azimuth - desiredAzimuth) > 0.0001 || Math.abs(elevation - desiredElevation) > 0.0001) {
      azimuth = T.MathUtils.lerp(azimuth, desiredAzimuth, 0.12);
      elevation = T.MathUtils.lerp(elevation, desiredElevation, 0.12); draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function pointerDown(event: PointerEvent) {
    if (!event.isPrimary) return;
    dragging = true; dragX = event.clientX; dragY = event.clientY;
    host.setPointerCapture(event.pointerId); host.dataset.dragging = 'true';
  }
  function pointerMove(event: PointerEvent) {
    if (!dragging) return;
    desiredAzimuth = T.MathUtils.clamp(desiredAzimuth + (event.clientX - dragX) * 0.0006, -0.035, 0.035);
    desiredElevation = T.MathUtils.clamp(desiredElevation + (event.clientY - dragY) * 0.0005, -0.025, 0.025);
    dragX = event.clientX; dragY = event.clientY;
  }
  function pointerUp() { dragging = false; host.dataset.dragging = 'false'; }
  function keyDown(event: KeyboardEvent) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'ArrowLeft') desiredAzimuth = Math.max(-0.035, desiredAzimuth - 0.015);
      if (event.key === 'ArrowRight') desiredAzimuth = Math.min(0.035, desiredAzimuth + 0.015);
      if (event.key === 'ArrowUp') desiredElevation = Math.min(0.025, desiredElevation + 0.01);
      if (event.key === 'ArrowDown') desiredElevation = Math.max(-0.025, desiredElevation - 0.01);
    }
  }
  const observer = new ResizeObserver(resize); observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }, { threshold: 0.05 }); intersection.observe(host);
  host.addEventListener('pointerdown', pointerDown); host.addEventListener('pointermove', pointerMove);
  host.addEventListener('pointerup', pointerUp); host.addEventListener('pointercancel', pointerUp); host.addEventListener('keydown', keyDown);
  const contextLost = (event: Event) => { event.preventDefault(); host.dataset.renderer = 'lost'; };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  resize(); frame = requestAnimationFrame(tick); host.dataset.renderer = 'webgl';

  return {
    setPlayback(paused: boolean, reducedMotion: boolean) {
      playing = !paused; reduced = reducedMotion;
      host.dataset.machinePaused = paused || reducedMotion ? 'true' : 'false';
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      host.removeEventListener('pointerdown', pointerDown); host.removeEventListener('pointermove', pointerMove);
      host.removeEventListener('pointerup', pointerUp); host.removeEventListener('pointercancel', pointerUp); host.removeEventListener('keydown', keyDown);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set<T.BufferGeometry>(); const materials = new Set<T.Material>(); const textures = new Set<T.Texture>();
      scene.traverse((object) => {
        if (object instanceof T.Mesh) {
          geometries.add(object.geometry);
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach((material) => { materials.add(material); if (material instanceof T.ShaderMaterial) Object.values(material.uniforms).forEach((uniform) => { if (uniform.value instanceof T.Texture) textures.add(uniform.value); }); Object.values(material).forEach((value) => { if (value instanceof T.Texture) textures.add(value); }); });
        }
      });
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose()); textures.forEach((item) => item.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
