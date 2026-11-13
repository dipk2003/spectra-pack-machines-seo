type Point = [number, number];
export type PhotoRect = [number, number, number, number];
export type PhotoLayerProfile = {
  path: [Point, Point, Point];
  width: number;
  part?: PhotoRect;
  stroke?: Point;
  foreground?: PhotoRect;
  nozzles?: Point[];
};

// Measured in source-image coordinates (0–1000), not viewport pixels. Keeping
// every layer registered to the photograph prevents detached/floating overlays.
const layers: Record<string, PhotoLayerProfile> = {
  'automatic-liquid-filling-line-cutout.png': {
    path: [[205, 432], [355, 432], [960, 432]], width: 14,
    part: [319, 315, 76, 45], stroke: [0, 12], foreground: [198, 433, 770, 27],
    nozzles: [[335, 355], [350, 355], [365, 355], [380, 355]],
  },
  'automatic-atta-packaging-line-cutout.png': {
    path: [[65, 610], [405, 365], [925, 365]], width: 28,
    part: [458, 259, 45, 50], stroke: [0, 18], foreground: [780, 245, 155, 220],
  },
  'automatic-bottle-shrink-wrap-machine.png': {
    path: [[880, 563], [650, 490], [155, 375]], width: 44,
    part: [640, 320, 166, 32], stroke: [0, 20], foreground: [170, 190, 390, 250],
  },
  'l-sealer-shrink-tunnel-v2.png': {
    path: [[700, 480], [555, 440], [430, 410]], width: 50,
    part: [488, 326, 158, 110], stroke: [0, 18], foreground: [280, 230, 190, 200],
  },
  'band-sealer-machine-v2.webp': {
    path: [[115, 737], [480, 737], [845, 737]], width: 58,
    foreground: [125, 725, 750, 24],
  },
  'pneumatic-impulse-sealer-v3.png': {
    path: [[315, 435], [430, 435], [560, 435]], width: 70,
    part: [160, 290, 515, 66], stroke: [0, 25],
  },
  'conveyor-machine-v2.png': {
    path: [[140, 440], [490, 305], [815, 185]], width: 77,
  },
  'pallet-stretch-wrapper-v2.png': {
    path: [[330, 820], [330, 820], [330, 820]], width: 0,
    part: [87, 350, 482, 573], stroke: [0, 0],
  },
  'shrink-sleeve-machine-v2.png': {
    path: [[62, 331], [440, 445], [893, 566]], width: 30,
    foreground: [207, 80, 477, 340],
  },
  'automatic-web-sealer-line-v2.png': {
    path: [[605, 510], [500, 472], [360, 452]], width: 45,
    part: [375, 370, 206, 43], stroke: [0, 18],
  },
  'semi-automatic-web-sealer-v2.png': {
    path: [[710, 650], [505, 550], [330, 520]], width: 110,
    part: [160, 364, 520, 28], stroke: [0, 18],
  },
  'automatic-carton-taping-strapping-v2.png': {
    path: [[465, 465], [565, 485], [660, 515]], width: 62,
    foreground: [500, 255, 43, 318],
  },
  'double-door-vacuum-line-v3.png': {
    path: [[290, 728], [585, 400], [665, 300]], width: 60,
    part: [580, 157, 101, 180], stroke: [0, 32],
  },
  'heavy-duty-shrink-tunnel-v2.png': {
    path: [[715, 728], [520, 665], [328, 566]], width: 85,
    foreground: [310, 280, 335, 300],
  },
  'six-head-liquid-filling-machine.png': {
    path: [[75, 553], [430, 627], [665, 670]], width: 28,
    part: [310, 436, 266, 100], stroke: [0, 12], foreground: [50, 585, 630, 20],
    nozzles: [[354, 535], [387, 545], [424, 551], [460, 559], [499, 566], [535, 574]],
  },
  'auger-filler-machine.png': {
    path: [[350, 620], [435, 620], [580, 620]], width: 115,
    nozzles: [[435, 505]],
  },
  'automatic-bottle-labeling-machine.png': {
    path: [[70, 437], [410, 440], [900, 490]], width: 30,
    part: [354, 335, 124, 57], stroke: [0, 0],
  },
  'automatic-capping-machine.png': {
    path: [[75, 527], [497, 536], [910, 588]], width: 27,
    part: [447, 352, 87, 132], stroke: [0, 15],
  },
  'automatic-turntable-machine.png': {
    path: [[250, 260], [500, 300], [750, 260]], width: 46,
  },
  'piston-paste-filling-machine.png': {
    path: [[58, 875], [123, 875], [210, 875]], width: 32,
    nozzles: [[123, 788]], part: [555, 615, 215, 24], stroke: [-18, 0],
  },
  'semi-automatic-volumetric-piston-liquid-filling-machine.png': {
    path: [[285, 520], [478, 520], [710, 520]], width: 70,
    nozzles: [[359, 455], [619, 455]],
  },
};

export function getPhotoLayers(source: string) {
  const profile = layers[source.split('/').pop() ?? ''];
  if (!profile) throw new Error('No photographic layer registration for this machine.');
  return profile;
}
