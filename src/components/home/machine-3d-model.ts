import * as T from 'three';
import type { MachineOperationPreset } from './machine-operation-presets';
import { getPhotoLayers, type PhotoRect } from './machine-photo-layers';

export type WorkingMachine = {
  root: T.Group;
  update: (seconds: number) => void;
  target: T.Vector3;
  span: number;
  height: number;
};

type Product = { mesh: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>; phase: number; height: number; baseline: number };

async function imageAt(source: string) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = source;
  await image.decode();
  return image;
}

function textureFor(image: HTMLImageElement | HTMLCanvasElement) {
  const texture = new T.Texture(image);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function canvasFor(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d')!;
  return { canvas, context };
}

function isolatedTexture(image: HTMLImageElement, rect: PhotoRect) {
  const { canvas, context } = canvasFor(image);
  const [x, y, w, h] = rect;
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = 'destination-in';
  context.fillRect(x * canvas.width / 1000, y * canvas.height / 1000, w * canvas.width / 1000, h * canvas.height / 1000);
  return textureFor(canvas);
}

function bodyTexture(image: HTMLImageElement, rect?: PhotoRect) {
  if (!rect) return textureFor(image);
  const { canvas, context } = canvasFor(image);
  context.drawImage(image, 0, 0);
  const [nx, ny, nw, nh] = rect;
  const x = nx * canvas.width / 1000, y = ny * canvas.height / 1000;
  const w = nw * canvas.width / 1000, h = nh * canvas.height / 1000;
  // The narrow backplate is sampled from the original metal immediately above
  // the moving part, so the opening never becomes a floating transparent hole.
  context.clearRect(x, y, w, h);
  context.drawImage(image, x, Math.max(0, y - 3), w, 3, x, y, w, h);
  return textureFor(canvas);
}

function trimmedProduct(image: HTMLImageElement, goldenBottle: boolean) {
  const initial = document.createElement('canvas');
  const crop = goldenBottle ? [132, 0, 192, 640] : [0, 0, image.naturalWidth, image.naturalHeight];
  initial.width = crop[2]; initial.height = crop[3];
  const context = initial.getContext('2d')!;
  context.drawImage(image, crop[0], crop[1], crop[2], crop[3], 0, 0, initial.width, initial.height);
  const pixels = context.getImageData(0, 0, initial.width, initial.height).data;
  let left = initial.width, top = initial.height, right = 0, bottom = 0;
  for (let y = 0; y < initial.height; y++) for (let x = 0; x < initial.width; x++) {
    if (pixels[(y * initial.width + x) * 4 + 3] > 20) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, right - left + 1); canvas.height = Math.max(1, bottom - top + 1);
  canvas.getContext('2d')!.drawImage(initial, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return { texture: textureFor(canvas), aspect: canvas.width / canvas.height };
}

/** Original photographs form the body, mechanism and foreground depth layers.
 * No surrogate machine geometry is drawn over the reference photograph. */
export async function buildWorkingMachine(preset: MachineOperationPreset, source: string): Promise<WorkingMachine> {
  const profile = getPhotoLayers(source);
  const goldenBottle = preset.kind === 'fill';
  const sample = preset.product === 'bottle'
    ? goldenBottle ? 'filled-liquid-bottles.webp' : source.includes('bottle-shrink') ? 'bottle-multipack.webp' : 'shrink-sleeved-bottle.webp'
    : preset.product === 'pouch' ? preset.kind === 'vacuum' ? 'vacuum-food-pouch.webp' : source.includes('atta') || preset.kind === 'powder' ? 'atta-pouch.webp' : 'sealed-grain-pouch.webp'
      : 'sealed-carton.webp';
  const [photo, productPhoto] = await Promise.all([imageAt(source), imageAt('/images/hero/samples/' + sample)]);
  const root = new T.Group();
  const width = 10;
  const height = width * photo.naturalHeight / photo.naturalWidth;
  const worldX = (x: number) => (x / 1000 - 0.5) * width;
  const worldY = (y: number) => (0.5 - y / 1000) * height;
  const clamp = T.MathUtils.clamp;
  const wrap = preset.kind === 'wrap';
  const productAsset = trimmedProduct(productPhoto, goldenBottle);
  const moving = profile.part && profile.stroke?.some(value => value !== 0);

  function photoPlane(texture: T.Texture, name: string, order: number, z: number) {
    const material = new T.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.01, depthWrite: false, toneMapped: false });
    const mesh = new T.Mesh(new T.PlaneGeometry(width, height), material);
    mesh.position.z = z; mesh.renderOrder = order; mesh.name = name; root.add(mesh);
    return mesh;
  }
  photoPlane(bodyTexture(photo, moving ? profile.part : undefined), 'original-machine-body', 1, 0);
  let part: T.Mesh | undefined;
  if (profile.part) part = photoPlane(isolatedTexture(photo, profile.part), 'original-moving-mechanism', 5, 0.055);
  if (profile.foreground) photoPlane(isolatedTexture(photo, profile.foreground), 'original-foreground-occlusion', 6, 0.08);

  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = 512; shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d')!;
  const shadowGradient = shadowContext.createRadialGradient(256, 64, 1, 256, 64, 235);
  shadowGradient.addColorStop(0, 'rgba(5,25,18,.17)'); shadowGradient.addColorStop(1, 'rgba(5,25,18,0)');
  shadowContext.scale(1, 0.25); shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0, 0, 512, 512);
  const shadow = new T.Mesh(new T.PlaneGeometry(width * 0.9, height * 0.13), new T.MeshBasicMaterial({ map: textureFor(shadowCanvas), transparent: true, depthWrite: false, toneMapped: false }));
  shadow.position.set(0, -height * 0.39, -0.01); shadow.renderOrder = 0; root.add(shadow);

  const products: Product[] = [];
  const productWidth = profile.width / 1000 * width;
  const productHeight = productWidth / productAsset.aspect;
  const count = profile.width === 0 ? 0 : profile.nozzles?.length ?? (preset.kind === 'turntable' || preset.kind === 'convey' ? 4 : 3);
  for (let index = 0; index < count; index++) {
    const nozzle = profile.nozzles?.[index];
    const beltProgress = nozzle ? clamp((nozzle[0] - profile.path[0][0]) / (profile.path[2][0] - profile.path[0][0] || 1), 0, 1) : 0;
    const baseline = T.MathUtils.lerp(profile.path[0][1], profile.path[2][1], beltProgress);
    const fittedHeight = nozzle ? Math.max(25, baseline - nozzle[1] - 8) / 1000 * height : productHeight;
    const fittedWidth = nozzle ? fittedHeight * productAsset.aspect : productWidth;
    const material = new T.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      uniforms: {
        photograph: { value: productAsset.texture }, opacity: { value: 1 }, fillLevel: { value: 1 },
        isFilling: { value: goldenBottle ? 1 : 0 }, capVisible: { value: 1 },
      },
      vertexShader: `varying vec2 imageUv;
        void main() { imageUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D photograph;
        uniform float opacity; uniform float fillLevel; uniform float isFilling; uniform float capVisible;
        varying vec2 imageUv;
        void main() {
          vec4 pixel = texture2D(photograph, imageUv);
          if (pixel.a < 0.025) discard;
          if (imageUv.y > 0.9 && capVisible < 0.5) discard;
          float aboveLiquid = smoothstep(fillLevel + 0.02, fillLevel + 0.045, imageUv.y);
          float golden = step(pixel.b * 1.45, pixel.r) * step(pixel.b * 1.2, pixel.g);
          float luminance = dot(pixel.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec3 emptyGlass = mix(pixel.rgb, vec3(luminance) * vec3(0.91, 1.0, 0.96), 0.91);
          pixel.rgb = mix(pixel.rgb, emptyGlass, aboveLiquid * golden * isFilling);
          gl_FragColor = vec4(pixel.rgb, pixel.a * opacity);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new T.Mesh(new T.PlaneGeometry(fittedWidth, fittedHeight), material);
    mesh.renderOrder = 3; mesh.position.z = 0.03; mesh.name = 'photographic-working-product'; root.add(mesh);
    products.push({ mesh, phase: profile.nozzles ? 0 : index / count, height: fittedHeight, baseline });
  }

  const streams = (profile.nozzles ?? []).map(([x, y]) => {
    const streamLength = height * 0.025;
    const mesh = new T.Mesh(new T.PlaneGeometry(width * (preset.kind === 'powder' ? 0.006 : 0.002), streamLength),
      new T.MeshBasicMaterial({ color: preset.kind === 'powder' ? '#dac195' : '#e3bf55', transparent: true, opacity: 0.65, depthWrite: false, toneMapped: false }));
    mesh.position.set(worldX(x), worldY(y + 8) - streamLength / 2, 0.042); mesh.renderOrder = 4; mesh.name = 'dispensing-stream'; root.add(mesh);
    return mesh;
  });

  // Film is a transparent optical layer, never an opaque replacement machine.
  let film: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial> | undefined;
  if (wrap) {
    const { canvas, context } = canvasFor(photo);
    const sheen = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.45, 'rgba(245,255,250,.03)');
    sheen.addColorStop(0.52, 'rgba(255,255,255,.36)'); sheen.addColorStop(0.61, 'rgba(255,255,255,.02)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
    context.drawImage(photo, 0, 0);
    context.globalCompositeOperation = 'source-in'; context.fillStyle = sheen; context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'destination-in';
    const [x, y, w, h] = profile.part!;
    context.fillStyle = 'white'; context.fillRect(x / 1000 * canvas.width, y / 1000 * canvas.height, w / 1000 * canvas.width, h / 1000 * canvas.height);
    film = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({ map: textureFor(canvas), transparent: true, depthWrite: false, toneMapped: false }));
    film.position.z = 0.085; film.renderOrder = 7; root.add(film);
  }

  function update(seconds: number) {
    const cycle = seconds % 7 / 7;
    const close = cycle < 0.25 ? 0 : cycle < 0.33 ? (cycle - 0.25) / 0.08 : cycle < 0.67 ? 1 : cycle < 0.75 ? 1 - (cycle - 0.67) / 0.08 : 0;
    const fill = clamp((cycle - 0.34) / 0.28, 0, 1);
    if (part && profile.stroke) {
      part.position.x = profile.stroke[0] / 1000 * width * close;
      part.position.y = -profile.stroke[1] / 1000 * height * close;
    }
    if (part && wrap) part.rotation.y = Math.sin(seconds * 0.65) * 0.1;
    if (film) {
      film.material.opacity = 0.55 + Math.sin(seconds * 1.8) * 0.2;
    }
    for (const stream of streams) { stream.visible = cycle > 0.34 && cycle < 0.64; stream.scale.x = 0.85 + Math.sin(seconds * 26) * 0.15; }
    products.forEach(({ mesh, phase, height: fittedHeight, baseline }, index) => {
      const p = (cycle + phase) % 1;
      const nozzle = profile.nozzles?.[index];
      const start = profile.path[0], end = profile.path[2];
      const station: [number, number] = nozzle
        ? [nozzle[0], baseline]
        : profile.path[1];
      let x: number, y: number;
      if (preset.kind === 'turntable') {
        const angle = seconds * 0.6 + index * Math.PI / 2;
        x = 500 + Math.cos(angle) * 255; y = 255 + Math.sin(angle) * 85;
        mesh.renderOrder = Math.sin(angle) > 0 ? 4 : 2;
      } else if (preset.kind === 'convey' || preset.kind === 'label' || source.includes('band-sealer')) {
        x = T.MathUtils.lerp(start[0], end[0], p); y = T.MathUtils.lerp(start[1], end[1], p);
      } else if (p < 0.25) {
        x = T.MathUtils.lerp(start[0] + (nozzle ? index * profile.width * 1.3 : 0), station[0], p / 0.25);
        y = T.MathUtils.lerp(start[1], station[1], p / 0.25);
      } else if (p < 0.75) { [x, y] = station; }
      else { x = T.MathUtils.lerp(station[0], end[0], (p - 0.75) / 0.25); y = T.MathUtils.lerp(station[1], end[1], (p - 0.75) / 0.25); }
      mesh.position.x = worldX(x); mesh.position.y = worldY(y) + fittedHeight / 2;
      mesh.material.uniforms.opacity.value = Math.min(clamp(p / 0.055, 0, 1), clamp((1 - p) / 0.055, 0, 1));
      mesh.material.uniforms.fillLevel.value = nozzle ? fill * 0.78 + 0.08 : 0.9;
      mesh.material.uniforms.capVisible.value = preset.kind === 'fill' ? (p > 0.8 ? 1 : 0) : preset.kind === 'cap' ? (p > 0.66 ? 1 : 0) : 1;
      if (preset.kind === 'vacuum') { mesh.scale.set(1 - close * 0.08, 1 - close * 0.04, 1); }
    });
  }
  update(2.9);
  return { root, update, target: new T.Vector3(), span: width * 1.045, height: height * 1.06 };
}
