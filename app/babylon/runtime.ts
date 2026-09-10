import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import '@babylonjs/core/Culling/ray';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import type { Card, Player, Room } from '../page';
import type { TableCallbacks } from '../babylon-table';
import { playerColor } from '../player-colors';
import { initiativeDice } from './initiative-dice';

export type TableSnapshot = { room: Room; focus: string; busy: boolean };
export type TableRuntime = {
  sync: (state: TableSnapshot) => void;
  dispose: () => void;
  zoom: (delta: number) => void;
  resetCamera: () => void;
  showHand: (show: boolean) => void;
};
type ZoneMeta = { kind: 'zone' | 'pile'; player: string; zone: string };
type CardMeta = { kind: 'card'; player: string; cardId: string };
type Meta = ZoneMeta | CardMeta;
type Slot = { x: number; z: number; w: number; h: number };
type Seat = {
  player: Player;
  x: number;
  z: number;
  angle: number;
  scale: number;
};
type Visual = {
  mesh: Mesh;
  shadow: Mesh;
  face: Mesh;
  material: StandardMaterial;
  signature: string;
  target: Vector3;
  angle: number;
  from: Vector3;
  progress: number;
  zone: string;
  player: string;
  flip: boolean;
  shuffleEnd: number;
};
const slots: Record<string, Slot> = {
  ataque: { x: 2.5, z: 3, w: 9.1, h: 2.7 },
  defensa: { x: 2.5, z: 0, w: 9.1, h: 2.7 },
  apoyo: { x: 2.5, z: -3, w: 9.1, h: 2.7 },
  pagado: { x: -3.65, z: 3, w: 2.65, h: 2.7 },
  reserva: { x: -3.65, z: -3, w: 2.65, h: 2.7 },
  castillo: { x: -3.65, z: 0, w: 2.65, h: 2.7 },
  cementerio: { x: -6.65, z: 0, w: 2.65, h: 2.7 },
  destierro: { x: -6.65, z: -3, w: 2.65, h: 2.7 },
};
const names: Record<string, string> = {
  ataque: 'ATAQUE',
  defensa: 'DEFENSA',
  apoyo: 'APOYO',
  pagado: 'ORO PAGADO',
  reserva: 'RESERVA',
  castillo: 'CASTILLO',
  cementerio: 'CEMENTERIO',
  destierro: 'DESTIERRO',
  mano: 'MANO',
};

export function createTable(
  canvas: HTMLCanvasElement,
  callbacks: () => TableCallbacks,
  onError: (message: string) => void,
): TableRuntime {
  const engine = new Engine(canvas, true, {
    stencil: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  // Keep the card scans at native canvas resolution.  Shadows and idle renders
  // are already capped below, so reducing the whole renderer only made text
  // and scanned art look soft.
  engine.setHardwareScalingLevel(1);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.018, 0.026, 0.028, 1);
  scene.ambientColor = new Color3(0.28, 0.25, 0.21);
  const camera = new FreeCamera('table-camera', new Vector3(0, 40, -1), scene);
  camera.upVector = new Vector3(0, 0, 1);
  camera.setTarget(new Vector3(0, 0, -1));
  camera.mode = Camera.PERSPECTIVE_CAMERA;
  camera.minZ = 0.5;
  camera.maxZ = 300;
  camera.fov = 0.72;
  // No attachControl: moving the pointer never moves the camera.
  const ambient = new HemisphericLight(
    'soft-fill',
    new Vector3(0, 1, 0),
    scene,
  );
  ambient.intensity = 0.8;
  ambient.groundColor = new Color3(0.12, 0.08, 0.05);
  const light = new DirectionalLight(
    'tavern-light',
    new Vector3(0.35, -1, 0.45),
    scene,
  );
  light.position = new Vector3(-12, 24, -8);
  light.intensity = 0.85;
  light.diffuse = new Color3(1, 0.84, 0.64);
  // Cards use their lightweight contact shadows below. Reserve the real shadow
  // map for the D20 only, where the changing shape is visible to the player.
  const shadows = new ShadowGenerator(512, light);
  shadows.usePercentageCloserFiltering = true;
  shadows.bias = 0.002;
  shadows.normalBias = 0.02;
  const dice = initiativeDice(scene,shadows);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const visuals = new Map<string, Visual>();
  let state: TableSnapshot | undefined,
    seatKey = '',
    seats: Seat[] = [],
    decorations: Mesh[] = [],
    lines: Mesh[] = [],
    disposed = false,
    handVisible = true;
  let pendingClick: ReturnType<typeof setTimeout> | undefined,
    hold: ReturnType<typeof setTimeout> | undefined;
  let lastClick = { key: '', time: 0 };
  let lastEvent = '';
  let hoverCard = '';
  let dropOutline: Mesh | undefined,
    dropKey = '';
  function showDrop(meta?: ZoneMeta) {
    const key = meta ? meta.player + ':' + meta.zone : '';
    if (key === dropKey) return;
    dropKey = key;
    dropOutline?.dispose();
    dropOutline = undefined;
    if (!meta) return;
    const seat = seats.find((s) => s.player.id === meta.player),
      slot = slots[meta.zone];
    if (!seat || !slot) return;
    const points = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ].map(([x, z]) =>
      world(seat, slot.x + (x * slot.w) / 2, slot.z + (z * slot.h) / 2, 0.05),
    );
    const outline = MeshBuilder.CreateLines('drop-target', { points }, scene);
    outline.color = new Color3(1, 0.82, 0.34);
    outline.isPickable = false;
    dropOutline = outline;
  }
  let drag:
    | {
        meta: Meta;
        mesh?: Mesh;
        startX: number;
        startY: number;
        moved: boolean;
        held: boolean;
        pointer: number;
      }
    | undefined;
  let desiredTarget = new Vector3(0, 0, -1),
    desiredRadius = 10.5,
    resetRadius = 10.5,
    currentRadius = 10.5;
  const labelsRoot = document.createElement('div');
  labelsRoot.className = 'scene-zone-labels';
  canvas.parentElement!.appendChild(labelsRoot);
  const screenLabels: {
    element: HTMLButtonElement;
    position: Vector3;
    key: string;
  }[] = [];
  let needsFrames = 2;
  const mat = (name: string, color: string) => {
    const m = new StandardMaterial(name, scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(0.12, 0.1, 0.07);
    return m;
  };
  const edge = mat('card-edge', '#bca879');
  const shadowTexture = new DynamicTexture(
    'contact-shadow',
    { width: 128, height: 192 },
    scene,
    true,
  );
  const shadowContext = shadowTexture.getContext() as CanvasRenderingContext2D;
  shadowContext.shadowColor = '#000';
  shadowContext.shadowBlur = 15;
  shadowContext.fillStyle = '#000';
  shadowContext.fillRect(20, 20, 88, 152);
  shadowTexture.hasAlpha = true;
  shadowTexture.update();
  const contactMaterial = new StandardMaterial('soft-contact', scene);
  contactMaterial.diffuseTexture = shadowTexture;
  contactMaterial.useAlphaFromDiffuseTexture = true;
  contactMaterial.disableLighting = true;
  contactMaterial.emissiveColor = Color3.Black();
  contactMaterial.alpha = 0.38;
  const zoneMats: Record<string, StandardMaterial> = {};
  for (const z of Object.keys(names)) {
    zoneMats[z] = mat(
      'zone-' + z,
      z === 'ataque' ? '#512920' : z === 'defensa' ? '#233329' : '#30261c',
    );
    zoneMats[z].alpha = 0.32;
  }
  const back = new StandardMaterial('card-back', scene);
  back.diffuseTexture = new Texture(
    '/backgrounds/reverso.jpg',
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => {
      needsFrames = 4;
    },
  );
  back.specularColor = Color3.Black();
  function box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: StandardMaterial,
  ) {
    const m = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    m.position.set(x, y, z);
    m.material = material;
    m.isPickable = false;
    return m;
  }
  const tableMaterial = mat('tavern-table', '#ffffff');
  tableMaterial.diffuseTexture = new Texture(
    '/backgrounds/taberna-cenital.png',
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => {
      needsFrames = 4;
    },
  );
  tableMaterial.specularColor = Color3.Black();
  const tabletop = MeshBuilder.CreatePlane(
    'tavern-surface',
    { width: 2, height: 2 },
    scene,
  );
  tabletop.rotation.x = Math.PI / 2;
  tabletop.position.y = -0.05;
  tabletop.material = tableMaterial;
  tabletop.isPickable = false;
  tabletop.receiveShadows = true;
  const countLabels = new Map<
    string,
    { texture: DynamicTexture; last: string }
  >();
  const world = (seat: Seat, x: number, z: number, y = 0.035) =>
    new Vector3(
      seat.x +
        (x * 1.6 * Math.cos(seat.angle) + z * Math.sin(seat.angle)) *
          seat.scale,
      y,
      seat.z +
        (-x * 1.6 * Math.sin(seat.angle) + z * Math.cos(seat.angle)) *
          seat.scale,
    );
  function label(
    text: string,
    w: number,
    h: number,
    pos: Vector3,
    angle: number,
    color = '#dbc999',
  ) {
    const texture = new DynamicTexture(
      'label',
      { width: 1024, height: 128 },
      scene,
      true,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    texture.hasAlpha = true;
    const c = texture.getContext() as CanvasRenderingContext2D;
    c.clearRect(0, 0, 1024, 128);
    c.font = 'bold 52px Georgia';
    c.fillStyle = color;
    c.textAlign = 'center';
    c.fillText(text, 512, 82);
    texture.update();
    const material = new StandardMaterial('label-material', scene);
    material.diffuseTexture = texture;
    material.emissiveColor = Color3.White();
    material.disableLighting = true;
    material.useAlphaFromDiffuseTexture = true;
    material.backFaceCulling = false;
    const m = MeshBuilder.CreatePlane(
      'label-' + text,
      { width: w, height: h },
      scene,
    );
    m.rotation.x = Math.PI / 2;
    m.rotation.y = angle;
    m.position.copyFrom(pos);
    m.material = material;
    m.isPickable = false;
    m.setEnabled(false); // Labels stay upright and readable in the screen overlay.
    decorations.push(m);
    return texture;
  }
  function rebuild() {
    for (const d of decorations) {
      const material = d.material;
      d.dispose();
      if (
        material &&
        !Object.values(zoneMats).includes(material as StandardMaterial)
      )
        material.dispose(true, true);
    }
    decorations = [];
    countLabels.clear();
    labelsRoot.replaceChildren();
    screenLabels.length = 0;
    if (!state) return;
    const players = [...state.room.players];
    const own = players.findIndex((p) => p.id === state!.room.me);
    if (own > 0) players.unshift(...players.splice(own, 1));
    const visible =
      state.focus === 'all'
        ? players
        : players.filter((p) => p.id === state!.focus);
    const count = visible.length;
    seats = visible.map((player, i) => {
      if (count === 1) return { player, x: 0, z: 0, angle: 0, scale: 1 };
      if (i === 0) return { player, x: 0, z: -2.4, angle: 0, scale: 1 };
      const columns = count <= 3 ? count - 1 : 3;
      const row = Math.floor((i - 1) / columns),
        col = (i - 1) % columns;
      const inRow = Math.min(columns, count - 1 - row * columns);
      return {
        player,
        x: (col - (inRow - 1) / 2) * (count <= 3 ? 14 : 10),
        z: 7.2 + row * 5.2,
        angle: Math.PI,
        scale: count === 2 ? 0.58 : count === 3 ? 0.48 : 0.34,
      };
    });
    resetRadius = Math.max(
      count <= 1 ? 8 : count <= 4 ? 10.5 : 12,
      15 / (canvas.clientWidth / Math.max(1, canvas.clientHeight)),
    );
    desiredRadius = resetRadius;
    desiredTarget = new Vector3(0, 0, count > 4 ? 1 : -1);
    for (const seat of seats) {
      const title = label(
        seat.player.name,
        7,
        0.55,
        world(seat, -6.65, 3.3, 0.06),
        seat.angle,
        seat.player.id === state.room.active ? '#ffe097' : '#e2d5bb',
      );
      countLabels.set(seat.player.id + ':name', {
        texture: title,
        last: seat.player.name,
      });
      const playerLabel = document.createElement('button');
      playerLabel.type = 'button';
      playerLabel.disabled = true;
      playerLabel.className = 'scene-zone-label scene-player-label';
      const color=playerColor(state.room,seat.player.id);playerLabel.style.backgroundColor=color;playerLabel.style.color='#fff';playerLabel.style.borderColor=seat.player.id===state.room.host?'#cdb68b':color;
      labelsRoot.appendChild(playerLabel);
      if (state.room.me && seat.player.id !== state.room.me) {
        const attack = document.createElement('button');
        attack.type = 'button';
        attack.className = 'scene-zone-label rival-attack';
        attack.dataset.action = 'attack';
        attack.setAttribute('aria-label', 'Atacar a ' + seat.player.name);
        attack.addEventListener('click', () => callbacks().attack(seat.player));
        labelsRoot.appendChild(attack);
        screenLabels.push({
          element: attack,
          position: world(seat, -6.65, 3.3, 0.08).add(new Vector3(0,0,.6)),
          key: seat.player.id + ':attack',
        });
      }
      screenLabels.push({
        element: playerLabel,
        position: world(seat, -6.65, 3.3, 0.06),
        key: seat.player.id + ':name',
      });
      for (const [zone, s] of Object.entries(slots)) {
        // Hands have their own fan at the front of each player's field.
        // Rendering them again in the central slot made the rival's backs
        // overlap the board or fall outside the camera on two-player tables.
        if (zone === 'mano') continue;
        const mesh = MeshBuilder.CreateBox(
          'zone-' + seat.player.id + '-' + zone,
          {
            width: s.w * 1.6 * seat.scale,
            height: 0.018,
            depth: s.h * seat.scale,
          },
          scene,
        );
        mesh.position.copyFrom(world(seat, s.x, s.z, 0.007));
        mesh.rotation.y = seat.angle;
        mesh.material = zoneMats[zone];
        mesh.receiveShadows = true;
        mesh.metadata = {
          kind: 'zone',
          player: seat.player.id,
          zone,
        } satisfies ZoneMeta;
        decorations.push(mesh);
        const points = [
          [-s.w / 2, -s.h / 2],
          [s.w / 2, -s.h / 2],
          [s.w / 2, s.h / 2],
          [-s.w / 2, s.h / 2],
          [-s.w / 2, -s.h / 2],
        ].map(([x, z]) => world(seat, s.x + x, s.z + z, 0.028));
        const outline = MeshBuilder.CreateLines(
          'zone-outline',
          { points },
          scene,
        );
        outline.color = new Color3(0.48, 0.43, 0.29);
        outline.isPickable = false;
        decorations.push(outline);
        const texture = label(
          names[zone],
          Math.min((s.w - 0.2) * 1.6, 5.5),
          0.4,
          world(seat, s.x, s.z + s.h / 2 - 0.13, 0.04),
          seat.angle,
        );
        countLabels.set(seat.player.id + ':' + zone, { texture, last: '' });
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'scene-zone-label';
        button.dataset.zone = zone;
        button.dataset.player = seat.player.id;
        button.setAttribute(
          'aria-label',
          names[zone] + ' de ' + seat.player.name,
        );
        button.addEventListener('click', () =>
          callbacks().pile(seat.player, zone),
        );
        labelsRoot.appendChild(button);
        if (zone === 'castillo' && seat.player.id === state.room.me) {
          const shuffle = document.createElement('button');
          shuffle.type = 'button';
          shuffle.className = 'scene-zone-label castle-shuffle';
          shuffle.dataset.action = 'shuffle';
          shuffle.setAttribute('aria-label', 'Barajar mi Castillo');
          shuffle.title = 'Barajar mi Castillo';
          shuffle.addEventListener('click', () => {
            if (!state?.busy) callbacks().shuffle();
          });
          labelsRoot.appendChild(shuffle);
          screenLabels.push({
            element: shuffle,
            position: world(
              seat,
              s.x + s.w / 2 - 0.4,
              s.z - s.h / 2 + 0.38,
              0.15,
            ),
            key: seat.player.id + ':shuffle',
          });
        }
        screenLabels.push({
          element: button,
          position: world(seat, s.x, s.z + s.h / 2 + 0.08, 0.06),
          key: seat.player.id + ':' + zone,
        });
      }
    }
    // A real zone on the front edge of the table receives cards returned to hand.
    const owner = state.room.players.find((p) => p.id === state!.room.me);
    if (owner) {
      const handZ = seats.length <= 1 ? -6 : -8.7;
      const hand = box(
        'hand-zone',
        0,
        0.001,
        handZ,
        22,
        0.02,
        2.5,
        zoneMats.mano,
      );
      hand.isPickable = true;
      hand.metadata = { kind: 'zone', player: owner.id, zone: 'mano' };
      decorations.push(hand);
      label('TU MANO', 4, 0.4, new Vector3(0, 0.04, handZ - 1.25), 0);
    }
    needsFrames = 10;
  }
  function writeCard(card: Card): StandardMaterial {
    if (card.hidden) return back;
    const m = new StandardMaterial('face-' + card.id, scene);
    m.specularColor = Color3.Black();
    m.disableLighting = true;
    m.emissiveColor = Color3.White();
    if (card.image) {
      m.diffuseTexture = new Texture(
        card.image,
        scene,
        false,
        true,
        Texture.TRILINEAR_SAMPLINGMODE,
        () => {
          needsFrames = 4;
        },
      );
      m.emissiveTexture = m.diffuseTexture;
      m.diffuseTexture.anisotropicFilteringLevel = 8;
      return m;
    }
    const texture = new DynamicTexture(
      'card-' + card.id,
      { width: 840, height: 1224 },
      scene,
      true,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    // Render generated cards at 2×, while keeping the drawing layout in its
    // original 420×612 coordinate system.
    ctx.scale(2, 2);
    ctx.fillStyle = card.type === 'Oro' ? '#715121' : '#244442';
    ctx.fillRect(0, 0, 420, 612);
    ctx.strokeStyle = '#d5bb78';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, 408, 600);
    ctx.fillStyle = '#fff0c8';
    ctx.font = 'bold 26px Georgia';
    ctx.textAlign = 'left';
    ctx.fillText(card.type || 'Carta', 22, 40);
    ctx.textAlign = 'right';
    ctx.fillText(String(card.cost ?? 0), 395, 40);
    ctx.textAlign = 'left';
    function lines(text: string, y: number, font: string, max: number) {
      ctx.font = font;
      let line = '',
        row = 0;
      for (const word of text.split(/\s+/)) {
        const next = line ? line + ' ' + word : word;
        if (ctx.measureText(next).width > 370 && line) {
          ctx.fillText(line, 24, y + row * 29);
          line = word;
          row++;
          if (row >= max) return;
        } else line = next;
      }
      ctx.fillText(line, 24, y + row * 29);
    }
    lines(card.name || 'Carta', 92, 'bold 32px Georgia', 3);
    ctx.fillStyle = '#102928';
    ctx.fillRect(24, 190, 372, 155);
    ctx.strokeStyle = '#b99854';
    ctx.lineWidth = 2;
    ctx.strokeRect(32, 198, 356, 139);
    ctx.fillStyle = '#d8bd7b';
    ctx.font = '52px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(card.type === 'Oro' ? '◈' : '✦', 210, 291);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff0d5';
    lines(card.effect || 'Sin habilidad', 385, '22px Georgia', 5);
    ctx.font = 'bold 25px Georgia';
    ctx.fillText(card.race || card.type, 24, 581);
    ctx.textAlign = 'right';
    if (card.type === 'Aliado') ctx.fillText('F ' + card.strength, 392, 581);
    texture.update();
    m.diffuseTexture = texture;
    m.emissiveTexture = texture;
    return m;
  }
  function addVisual(
    key: string,
    card: Card,
    player: string,
    position: Vector3,
    angle: number,
    meta: Meta,
    origin?: Vector3,
  ) {
    const mesh = box(
      'card-' + key,
      position.x,
      position.y,
      position.z,
      1.55,
      0.16,
      2.24,
      edge,
    );
    mesh.isPickable = true;
    mesh.metadata = meta;
    mesh.rotation.y = angle;
    const face = MeshBuilder.CreatePlane(
      'front-' + key,
      { width: 1.54, height: 2.23 },
      scene,
    );
    face.parent = mesh;
    face.position.y = 0.09;
    face.rotation.x = Math.PI / 2;
    face.isPickable = true;
    face.metadata = meta;
    const material = writeCard(card);
    face.material = material;
    const underside = MeshBuilder.CreatePlane(
      'back-' + key,
      { width: 1.54, height: 2.23 },
      scene,
    );
    underside.parent = mesh;
    underside.position.y = -0.09;
    underside.rotation.x = -Math.PI / 2;
    underside.material = back;
    underside.isPickable = false;
    const shadow = MeshBuilder.CreatePlane(
      'shadow-' + key,
      { width: 2.1, height: 2.95 },
      scene,
    );
    shadow.rotation.x = Math.PI / 2;
    shadow.material = contactMaterial;
    shadow.isPickable = false;
    const v = {
      mesh,
      shadow,
      face,
      material,
      signature: JSON.stringify([
        card.image,
        card.name,
        card.cost,
        card.strength,
        card.effect,
        card.hidden,
      ]),
      target: position.clone(),
      angle,
      from: (origin || position).clone(),
      progress: origin ? 0 : 1,
      zone: card.zone,
      player,
      flip: !!origin && card.zone === 'mano',
      shuffleEnd: 0,
    };
    mesh.position.copyFrom(v.from);
    visuals.set(key, v);
    return v;
  }
  function disposeVisual(v: Visual) {
    v.mesh.dispose();
    v.shadow.dispose();
    if (v.material !== back) v.material.dispose(true, true);
  }
  function updateCards() {
    if (!state) return;
    const wanted = new Set<string>();
    function place(
      key: string,
      card: Card,
      player: string,
      pos: Vector3,
      angle: number,
      meta: Meta,
      size = 1,
    ) {
      wanted.add(key);
      let v = visuals.get(key);
      const signature = JSON.stringify([
        card.image,
        card.name,
        card.cost,
        card.strength,
        card.effect,
        card.hidden,
      ]);
      if (!v) {
        const seat = seats.find((s) => s.player.id === player);
        const origin =
          visuals.size && card.zone === 'mano' && seat
            ? world(seat, slots.castillo.x, slots.castillo.z, 0.25)
            : undefined;
        v = addVisual(key, card, player, pos, angle, meta, origin);
      } else {
        v.mesh.metadata = meta;
        v.face.metadata = meta;
        if (v.signature !== signature) {
          if (v.material !== back) v.material.dispose(true, true);
          v.material = writeCard(card);
          v.face.material = v.material;
          v.signature = signature;
        }
        if (!v.target.equalsWithEpsilon(pos, 0.005)) {
          v.from.copyFrom(v.mesh.position);
          v.target.copyFrom(pos);
          v.progress = 0;
        }
        v.angle = angle;
        v.zone = card.zone;
      }
      const cardScale =
        card.zone === 'mano' && player === state!.room.me
          ? 1
          : seats.find((s) => s.player.id === player)?.scale || 1;
      v.mesh.scaling.setAll(
        cardScale * size * (card.type === 'Aliado' && card.zone !== 'mano' ? 1.16 : 1),
      );
      v.shadow.scaling.setAll(cardScale * size);
      v.mesh.setEnabled(
        card.zone !== 'mano' || player !== state!.room.me || handVisible,
      );
      v.shadow.setEnabled(v.mesh.isEnabled());
    }
    for (const seat of seats) {
      const player = state.room.players.find((p) => p.id === seat.player.id)!;
      seat.player = player;
      for (const [zone, s] of Object.entries(slots)) {
        const cards = player.cards.filter(
          (c) => c.zone === zone && !c.attachedTo,
        );
        const label = countLabels.get(player.id + ':' + zone);
        const text = names[zone] + '  ' + cards.length;
        if (label && label.last !== text) {
          const ctx = label.texture.getContext() as CanvasRenderingContext2D;
          ctx.clearRect(0, 0, 1024, 128);
          ctx.font = 'bold 52px Georgia';
          ctx.fillStyle = '#e6d6a9';
          ctx.textAlign = 'center';
          ctx.fillText(text, 512, 82);
          label.texture.update();
          label.last = text;
        }
        if (['castillo', 'cementerio', 'destierro'].includes(zone)) {
          if (cards.length) {
            const top = cards[cards.length - 1];
            const layers = Math.min(5, cards.length);
            for (let j = 0; j < layers; j++)
              place(
                player.id + ':' + zone + ':' + j,
                {
                  ...top,
                  id: player.id + zone + j,
                  hidden: zone === 'castillo' || j < layers - 1,
                  zone,
                },
                player.id,
                world(seat, s.x + j * 0.035, s.z - j * 0.025, 0.13 + j * 0.13),
                seat.angle,
                { kind: 'pile', player: player.id, zone },
              );
          }
        } else {
          const gold = zone === 'reserva' || zone === 'pagado';
          let columns = Math.max(1, cards.length), size = 1;
          if (gold && cards.length) {
            size = 0;
            for(let cols=1;cols<=cards.length;cols++){
              const fit=Math.min(1,(s.w*1.6-.2)/(cols*1.9),(s.h-.35)/(Math.ceil(cards.length/cols)*2.7));
              if(fit>size){size=fit;columns=cols;}
            }
          }
          const rows = Math.ceil(cards.length / columns);
          const spacing = gold ? 1.9 * size / 1.6 : Math.min(1.18, (s.w - 1.2) / Math.max(1, cards.length - 1));
          cards.forEach((c, i) =>
            place(c.id, c, player.id,
              world(seat,
                s.x + ((i % columns) - (columns - 1) / 2) * spacing,
                s.z - .12 + ((rows - 1) / 2 - Math.floor(i / columns)) * 2.7 * size,
                .075 + i * .002),
              seat.angle,
              { kind: 'card', player: player.id, cardId: c.id }, size,
            ),
          );
        }
      }
      if (player.id !== state.room.me) {
        const hand = player.cards.filter((c) => c.zone === 'mano');
        hand.forEach((c, i) =>
          place(
            c.id,
            { ...c, hidden: true },
            player.id,
            world(
              seat,
              (i - (hand.length - 1) / 2) *
                Math.min(0.9, 10 / Math.max(1, hand.length)),
              // Rivals are rotated 180°. Their front edge points toward the
              // centre of the table, which is +Z in their local coordinates.
              // This keeps the card backs visible and clickable for a request.
              6.1,
              0.09,
            ),
            seat.angle,
            { kind: 'pile', player: player.id, zone: 'mano' },
          ),
        );
      }
    }
    const own = state.room.players.find((p) => p.id === state!.room.me);
    if (own) {
      const hand = own.cards.filter((c) => c.zone === 'mano');
      const spacing = Math.min(1.75, 20 / Math.max(1, hand.length - 1));
      hand.forEach((c, i) =>
        place(
          c.id,
          c,
          own.id,
          new Vector3(
            (i - (hand.length - 1) / 2) * spacing,
            0.17 + i * 0.004,
            seats.length <= 1 ? -6 : -8.7,
          ),
          0,
          { kind: 'card', player: own.id, cardId: c.id },
        ),
      );
    }
    // Weapons stay under their bearer, with a visible lower edge.
    for (const seat of seats)
      for (const card of seat.player.cards.filter((c) => c.attachedTo)) {
        const host = visuals.get(card.attachedTo!);
        if (host) {
          const offset = world({ ...seat, x: 0, z: 0 }, 0, -0.42, 0);
          place(
            card.id,
            card,
            seat.player.id,
            host.target.add(offset).add(new Vector3(0, -0.035, 0)),
            seat.angle,
            { kind: 'card', player: seat.player.id, cardId: card.id },
          );
        }
      }
    for (const [key, v] of visuals) {
      if (!wanted.has(key)) {
        disposeVisual(v);
        visuals.delete(key);
      }
    }
    needsFrames = 6;
  }
  function current(meta: Meta) {
    const player = state?.room.players.find((p) => p.id === meta.player);
    const card =
      meta.kind === 'card'
        ? player?.cards.find((c) => c.id === meta.cardId)
        : undefined;
    return { player, card };
  }
  function pick(event: PointerEvent, onlyZones = false) {
    const rect = canvas.getBoundingClientRect();
    return scene.pick(
      event.clientX - rect.left,
      event.clientY - rect.top,
      (m) => !!m.metadata && (!onlyZones || m.metadata.kind === 'zone'),
    );
  }
  function point(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const ray = scene.createPickingRay(
      event.clientX - rect.left,
      event.clientY - rect.top,
      Matrix.Identity(),
      camera,
    );
    const d = (0.75 - ray.origin.y) / ray.direction.y;
    return ray.origin.add(ray.direction.scale(Math.max(0, d)));
  }
  function click(meta: Meta, dbl = false) {
    const { player, card } = current(meta);
    if (!player) return;
    if (card && !card.hidden) {
      if (dbl && player.id === state?.room.me)
        callbacks().playCard(card, player);
      else callbacks().select(card, player);
    } else if (meta.kind !== 'card') {
      if (
        dbl &&
        meta.zone === 'castillo' &&
        meta.player === state?.room.me &&
        !state.busy
      )
        callbacks().draw();
      else callbacks().pile(player, meta.zone);
    }
  }
  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    const hit = pick(event);
    const meta = hit?.pickedMesh?.metadata as Meta | undefined;
    if (!meta) return;
    canvas.focus();
    const { card, player } = current(meta);
    const mesh =
      meta.kind === 'card' ? visuals.get(meta.cardId)?.mesh : undefined;
    drag = {
      meta,
      mesh,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      held: false,
      pointer: event.pointerId,
    };
    canvas.setPointerCapture(event.pointerId);
    if (event.pointerType === 'touch')
      hold = setTimeout(() => {
        if (drag && !drag.moved) {
          drag.held = true;
          click(meta);
        }
      }, 550);
    if (!player || card?.hidden) return;
  }
  function moving(event: PointerEvent) {
    if (!drag) {
      const hit = pick(event),
        meta = hit?.pickedMesh?.metadata as Meta | undefined;
      const nextHover = meta?.kind === 'card' ? meta.cardId : '';
      if (nextHover !== hoverCard) {
        hoverCard = nextHover;
        const card = meta ? current(meta).card : undefined;
        callbacks().hover?.(card && !card.hidden ? card : null);
        if (card && !card.hidden) callbacks().sound('hover');
        needsFrames = 10;
      }
      canvas.style.cursor = hit?.hit ? 'grab' : '';
      return;
    }
    const { player, card } = current(drag.meta);
    const canMove =
      !state?.busy &&
      !!state?.room.me &&
      !card?.hidden &&
      (drag.meta.kind === 'card' ||
        (drag.meta.kind === 'pile' &&
          drag.meta.zone === 'castillo' &&
          player?.id === state.room.me));
    if (!canMove) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7
    )
      return;
    if (!drag.moved) {
      clearTimeout(hold);
      clearTimeout(pendingClick);
      callbacks().sound('pick');
      drag.moved = true;
    }
    if (drag.mesh) {
      drag.mesh.position.copyFrom(point(event));
      drag.mesh.rotation.x = -0.2;
      drag.mesh.rotation.z = Math.max(
        -0.14,
        Math.min(0.14, (event.clientX - drag.startX) / 1000),
      );
    }
    canvas.style.cursor = 'grabbing';
    showDrop(pick(event, true)?.pickedMesh?.metadata as ZoneMeta | undefined);
    needsFrames = 3;
  }
  function up(event: PointerEvent) {
    showDrop();
    clearTimeout(hold);
    const d = drag;
    if (!d) return;
    drag = undefined;
    canvas.style.cursor = '';
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    if (d.moved) {
      const hit = pick(event, true);
      const target = hit?.pickedMesh?.metadata as ZoneMeta | undefined;
      const { card, player } = current(d.meta);
      if (d.mesh) {
        d.mesh.rotation.x = 0;
        d.mesh.rotation.z = 0;
        const v = card && visuals.get(card.id);
        if (v) {
          v.from.copyFrom(d.mesh.position);
          v.progress = 0;
        }
      }
      const rect = canvas.getBoundingClientRect();
      const onCard = scene.pick(
        event.clientX - rect.left,
        event.clientY - rect.top,
        (m) => m.metadata?.kind === 'card' && m.metadata.cardId !== card?.id,
      )?.pickedMesh?.metadata as Meta | undefined;
      if (
        card?.type === 'Arma' &&
        player?.id === state?.room.me &&
        onCard?.kind === 'card' &&
        onCard.cardId !== card.id
      ) {
        const host = current(onCard).card;
        if (host?.type === 'Aliado' && onCard.player === state?.room.me) {
          callbacks().attach(card, host);
          needsFrames = 6;
          return;
        }
      }
      if (target && player) {
        const recipient = state?.room.players.find(
          (p) => p.id === target.player,
        );
        if (
          d.meta.kind === 'pile' &&
          target.zone === 'mano' &&
          target.player === state?.room.me
        )
          callbacks().draw();
        else if (card && recipient)
          void callbacks().move(card, player, target.zone, recipient);
        callbacks().sound('drop');
      }
      needsFrames = 6;
      return;
    }
    if (d.held) return;
    const key = JSON.stringify(d.meta);
    const now = performance.now();
    if (lastClick.key === key && now - lastClick.time < 330) {
      clearTimeout(pendingClick);
      click(d.meta, true);
      lastClick = { key: '', time: 0 };
    } else {
      lastClick = { key, time: now };
      clearTimeout(pendingClick);
      pendingClick = setTimeout(() => click(d.meta), 340);
    }
  }
  function cancel() {
    showDrop();
    clearTimeout(hold);
    if (drag?.mesh) {
      const meta = drag.meta;
      if (meta.kind === 'card') {
        const v = visuals.get(meta.cardId);
        if (v) {
          v.from.copyFrom(v.mesh.position);
          v.progress = 0;
          v.mesh.rotation.x = 0;
        }
      }
    }
    drag = undefined;
    canvas.style.cursor = '';
    needsFrames = 6;
  }
  function context(event: MouseEvent) {
    event.preventDefault();
    clearTimeout(pendingClick);
    const meta = pick(event as PointerEvent)?.pickedMesh?.metadata as
      | Meta
      | undefined;
    if (meta) click(meta);
  }
  canvas.addEventListener('pointerdown', down);
  const leave=()=>{if(!drag){hoverCard='';callbacks().hover?.(null);needsFrames=10;}};
  canvas.addEventListener('pointerleave',leave);
  canvas.addEventListener('pointermove', moving);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('contextmenu', context);
  let blockingKey = '';
  function updateLines() {
    const nextKey = state
      ? state.room.players
          .flatMap((player) =>
            player.cards.filter((card) => card.blocks).map((card) => `${card.id}:${card.blocks}`),
          )
          .join('|')
      : '';
    if (nextKey === blockingKey) return;
    blockingKey = nextKey;
    for (const line of lines) line.dispose();
    lines = [];
    if (!state) return;
    for (const player of state.room.players)
      for (const c of player.cards) {
        if (!c.blocks) continue;
        const a = visuals.get(c.id),
          b = visuals.get(c.blocks);
        if (a && b) {
          const line = MeshBuilder.CreateLines(
            'blocking-line',
            {
              points: [
                a.mesh.position.add(new Vector3(0, 0.14, 0)),
                b.mesh.position.add(new Vector3(0, 0.14, 0)),
              ],
            },
            scene,
          );
          line.color = new Color3(1, 0.57, 0.19);
          line.isPickable = false;
          lines.push(line);
        }
      }
  }
  const resize = () => {
    engine.resize();
    resetRadius = Math.max(
      seats.length <= 1 ? 8 : seats.length <= 4 ? 10.5 : 12,
      15 / (canvas.clientWidth / Math.max(1, canvas.clientHeight)),
    );
    desiredRadius = resetRadius;
    needsFrames = 5;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const contextLost = (event: Event) => {
    event.preventDefault();
    onError(
      'Se perdió la conexión con los gráficos. Puedes usar la vista clásica y volver a intentar.',
    );
  };
  canvas.addEventListener('webglcontextlost', contextLost);
  let last = performance.now();
  engine.runRenderLoop(() => {
    if (disposed || document.hidden) return;
    const now = performance.now(),
      dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    let movingNow = dice.tick(reduced.matches);
    if (Math.abs(currentRadius - desiredRadius) > 0.01) {
      currentRadius += (desiredRadius - currentRadius) * 0.14;
      movingNow = true;
    }
    for (const v of visuals.values()) {
      const elevation = Math.max(0, v.mesh.position.y);
      v.shadow.position.set(
        v.mesh.position.x + 0.1 + elevation * 0.2,
        0.035,
        v.mesh.position.z - 0.1 - elevation * 0.16,
      );
      v.shadow.rotation.y = v.mesh.rotation.y;
      if (drag?.mesh === v.mesh && drag.moved) continue;
      if (v.progress < 1) {
        v.progress = reduced.matches ? 1 : Math.min(1, v.progress + dt / 0.36);
        const t = v.progress;
        const smooth = t * t * (3 - 2 * t);
        v.mesh.position.copyFrom(Vector3.Lerp(v.from, v.target, smooth));
        v.mesh.position.y += Math.sin(t * Math.PI) * 0.65;
        v.mesh.rotation.x = v.flip
          ? (1 - t) * Math.PI
          : -Math.sin(t * Math.PI) * 0.09;
        movingNow = true;
      }
      if (v.progress >= 1) {
        const hovered = v.mesh.metadata?.cardId === hoverCard;
        const height = v.target.y + (hovered && !reduced.matches ? 0.25 : 0);
        if (Math.abs(v.mesh.position.y - height) > 0.003) {
          v.mesh.position.y += (height - v.mesh.position.y) * 0.3;
          movingNow = true;
        }
        v.mesh.rotation.x = hovered && !reduced.matches ? -0.1 : 0;
      }
      v.mesh.rotation.y = v.angle;
      if (v.shuffleEnd > now) {
        const wave = Math.sin(((v.shuffleEnd - now) / 780) * Math.PI * 6);
        v.mesh.position.x =
          v.target.x +
          wave *
            (v.mesh.name.endsWith('0') || v.mesh.name.endsWith('2')
              ? -0.65
              : 0.65);
        v.mesh.position.y = v.target.y + Math.abs(wave) * 0.15;
        movingNow = true;
      } else if (v.shuffleEnd) {
        v.mesh.position.copyFrom(v.target);
        v.shuffleEnd = 0;
      }
    }
    if (movingNow || needsFrames > 0 || scene.getWaitingItemsCount() > 0) {
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      camera.orthoLeft = -currentRadius * aspect;
      camera.orthoRight = currentRadius * aspect;
      camera.orthoTop = currentRadius;
      camera.orthoBottom = -currentRadius;
      const altitude = currentRadius / Math.tan(camera.fov / 2);
      camera.position.set(0, altitude, desiredTarget.z - altitude * 0.07);
      camera.setTarget(desiredTarget);
      tabletop.scaling.set(resetRadius * aspect, resetRadius, 1);
      tabletop.position.z = desiredTarget.z;
      updateLines();
      scene.render();
      const viewport = camera.viewport.toGlobal(
        engine.getRenderWidth(),
        engine.getRenderHeight(),
      );
      for (const item of screenLabels) {
        const p = Vector3.Project(
          item.position,
          Matrix.Identity(),
          scene.getTransformMatrix(),
          viewport,
        );
        item.element.style.left = (p.x / engine.getRenderWidth()) * 100 + '%';
        item.element.style.top = (p.y / engine.getRenderHeight()) * 100 + '%';
        item.element.hidden = p.z < 0 || p.z > 1;
        item.element.textContent =
          item.element.dataset.action === 'shuffle'
            ? '⤨'
            : countLabels.get(item.key)?.last || '';
        if (item.element.dataset.action === 'shuffle')
          item.element.disabled = !!state?.busy;
        item.element.style.display =
          seats.length > 3 &&
          !item.key.endsWith(':name') &&
          !item.key.startsWith(state?.room.me + ':')
            ? 'none'
            : '';
        if (item.element.dataset.action === 'attack') {
          item.element.textContent = '⚔ Atacar';
          item.element.style.display = state?.room.players
            .find((p) => p.id === state?.room.me)
            ?.cards.some((c) => c.zone === 'ataque' && c.type === 'Aliado')
            ? ''
            : 'none';
          item.element.disabled =
            !!state?.busy || state?.room.active !== state?.room.me;
        }
      }
      needsFrames = Math.max(0, needsFrames - 1);
    }
  });
  return {
    sync(next) {
      state = next;
      dice.sync(next.room);
      const key =
        next.room.players.map((p) => p.id).join(',') +
        '|' +
        next.focus +
        '|' +
        next.room.me;
      if (key !== seatKey) {
        seatKey = key;
        rebuild();
      }
      updateCards();
      const event = next.room.log[0];
      if (event && event.id !== lastEvent) {
        if (
          lastEvent &&
          event.message.includes('barajó su Castillo') &&
          !reduced.matches
        ) {
          const player = next.room.players.find((p) =>
            event.message.startsWith(p.name + ':'),
          );
          if (player)
            for (const [id, v] of visuals) {
              if (id.startsWith(player.id + ':castillo:')) {
                const layer = Number(id.split(':').at(-1));
                v.from
                  .copyFrom(v.target)
                  .addInPlace(new Vector3(layer % 2 ? 0.75 : -0.75, 0.15, 0));
                v.progress = 1;
                v.shuffleEnd = performance.now() + 780;
              }
            }
        }
        lastEvent = event.id;
      }
    },
    zoom(delta) {
      desiredRadius = Math.max(5, Math.min(40, desiredRadius + delta * 0.5));
      needsFrames = 5;
    },
    resetCamera() {
      desiredRadius = resetRadius;
      desiredTarget = new Vector3(0, 0, seats.length > 4 ? 1 : -1);
      needsFrames = 5;
    },
    showHand(show) {
      handVisible = show;
      updateCards();
    },
    dispose() {
      disposed = true;
      clearTimeout(pendingClick);
      clearTimeout(hold);
      observer.disconnect();
      labelsRoot.remove();
      dice.dispose();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerleave',leave);
      canvas.removeEventListener('pointermove', moving);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('contextmenu', context);
      canvas.removeEventListener('webglcontextlost', contextLost);
      scene.dispose();
      engine.dispose();
    },
  };
}
