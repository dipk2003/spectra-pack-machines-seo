export type OperationKind = 'fill' | 'powder' | 'cap' | 'label' | 'seal' | 'shrink' | 'convey' | 'wrap' | 'vacuum' | 'turntable' | 'strap';
export type MachineOperationPreset = {
  kind: OperationKind;
  steps: [string, string, string];
  product: 'bottle' | 'pouch' | 'box';
};

// Match known reference assets only; an arbitrary admin upload must not silently
// inherit a model for an unrelated machine.
const presets: Record<string, MachineOperationPreset> = {
  "automatic-liquid-filling-line-cutout.png": {"kind":"fill","steps":["Bottle infeed","Dose & cap","Label & discharge"],"product":"bottle"},
  "automatic-atta-packaging-line-cutout.png": {"kind":"shrink","steps":["Bag infeed","Film sealing","Shrink & discharge"],"product":"pouch"},
  "automatic-bottle-shrink-wrap-machine.png": {"kind":"shrink","steps":["Bundle infeed","Film sealing","Tunnel discharge"],"product":"bottle"},
  "l-sealer-shrink-tunnel-v2.png": {"kind":"seal","steps":["Pack infeed","L-bar seals","Shrink tunnel"],"product":"box"},
  "band-sealer-machine-v2.webp": {"kind":"seal","steps":["Pouch infeed","Continuous seal","Sealed pouch out"],"product":"pouch"},
  "pneumatic-impulse-sealer-v3.png": {"kind":"seal","steps":["Position pouch","Jaw closes","Seal & release"],"product":"pouch"},
  "conveyor-machine-v2.png": {"kind":"convey","steps":["Load product","Belt transfers","Unload product"],"product":"box"},
  "pallet-stretch-wrapper-v2.png": {"kind":"wrap","steps":["Turntable rotates","Film carriage travels","Load wrapped"],"product":"box"},
  "shrink-sleeve-machine-v2.png": {"kind":"shrink","steps":["Bottle infeed","Sleeve shrinks","Bottle discharge"],"product":"bottle"},
  "automatic-web-sealer-line-v2.png": {"kind":"seal","steps":["Pack indexes","Sealing jaw cycles","Wrapped pack out"],"product":"box"},
  "semi-automatic-web-sealer-v2.png": {"kind":"seal","steps":["Load bundle","Seal film","Pack discharge"],"product":"box"},
  "automatic-carton-taping-strapping-v2.png": {"kind":"strap","steps":["Carton infeed","Tape & strap","Dispatch ready"],"product":"box"},
  "double-door-vacuum-line-v3.png": {"kind":"vacuum","steps":["Load pouch","Evacuate & seal","Conveyor discharge"],"product":"pouch"},
  "heavy-duty-shrink-tunnel-v2.png": {"kind":"shrink","steps":["Load pack","Heat shrinks film","Wrapped pack out"],"product":"box"},
  "six-head-liquid-filling-machine.png": {"kind":"fill","steps":["Bottles index","Nozzles fill","Filled bottles exit"],"product":"bottle"},
  "auger-filler-machine.png": {"kind":"powder","steps":["Position pouch","Auger doses powder","Filled pouch release"],"product":"pouch"},
  "automatic-bottle-labeling-machine.png": {"kind":"label","steps":["Bottle infeed","Label roll feeds","Labelled bottle out"],"product":"bottle"},
  "automatic-capping-machine.png": {"kind":"cap","steps":["Bottle indexes","Cap tightens","Capped bottle out"],"product":"bottle"},
  "automatic-turntable-machine.png": {"kind":"turntable","steps":["Bottle loading","Rotary accumulation","Bottle transfer"],"product":"bottle"},
  "piston-paste-filling-machine.png": {"kind":"fill","steps":["Position container","Piston dispenses","Filled container out"],"product":"bottle"},
  "semi-automatic-volumetric-piston-liquid-filling-machine.png": {"kind":"fill","steps":["Place containers","Measured filling","Remove filled bottles"],"product":"bottle"},
};

export function getMachineOperationPreset(source: string) {
  return presets[source.split('/').pop() ?? ''];
}

export const MACHINE_OPERATION_PRESETS = presets;
