import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { Room } from '../page';
import { playerColor } from '../player-colors';

export function initiativeDice(scene: Scene, shadows: ShadowGenerator) {
  const atlas = new DynamicTexture(
    'd20-numbers',
    { width: 640, height: 512 },
    scene,
    true,
  );
  atlas.hasAlpha = true;
  const ctx = atlas.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 66px Georgia';
  ctx.textAlign = 'center';
  for (let i = 0; i < 20; i++) {
    ctx.fillText(
      String(i + 1),
      (i % 5) * 128 + 64,
      Math.floor(i / 5) * 128 + 88,
    );
    if (i === 5 || i === 8)
      ctx.fillRect((i % 5) * 128 + 47, Math.floor(i / 5) * 128 + 96, 34, 3);
  }
  atlas.update();
  const numbers = new StandardMaterial('d20-ink', scene);
  numbers.diffuseTexture = atlas;
  numbers.useAlphaFromDiffuseTexture = true;
  numbers.disableLighting = true;
  numbers.emissiveColor = Color3.White();
  numbers.backFaceCulling = false;
  let room: Room | undefined,
    offset = 0,
    key = '',
    dice: {
      body: Mesh;
      material: StandardMaterial;
      settle: Quaternion;
      player: string;
      x: number;
      height: number;
      spin: Vector3;
      drift: number;
    }[] = [],
    aura: Mesh | undefined,
    auraMat: StandardMaterial | undefined;
  function clear() {
    for (const d of dice) {
      shadows.removeShadowCaster(d.body);
      d.body.dispose();
      d.material.dispose();
    }
    dice = [];
    aura?.dispose();
    auraMat?.dispose();
    aura = undefined;
  }
  function build(rows: { player: string; value: number }[]) {
    clear();
    rows.forEach((row, i) => {
      const body = MeshBuilder.CreatePolyhedron(
        'd20-' + row.player,
        { type: 3, size: 0.95, flat: true },
        scene,
      );
      body.isPickable = false;
      const material = new StandardMaterial('d20-color', scene);
      material.diffuseColor = Color3.FromHexString(
        playerColor(room!, row.player),
      );
      material.emissiveColor = material.diffuseColor.scale(0.12);
      material.specularColor = new Color3(0.7, 0.7, 0.7);
      material.specularPower = 48;
      body.material = material;
      shadows.addShadowCaster(body);
      const positions = body.getVerticesData('position')!,
        indices = body.getIndices()!;
      let resultNormal = Vector3.Up();
      for (let face = 0; face < 20; face++) {
        const points = Array.from(indices.slice(face * 3, face * 3 + 3)).map(
          (index) => Vector3.FromArray(positions, index * 3),
        );
        const center = points[0]
            .add(points[1])
            .add(points[2])
            .scale(1 / 3),
          normal = center.normalizeToNew();
        if (face + 1 === row.value) resultNormal = normal;
        const label = MeshBuilder.CreatePlane(
          'd20-face-' + (face + 1),
          { size: 0.62 },
          scene,
        );
        label.parent = body;
        label.position = center.add(normal.scale(0.012));
        label.rotationQuaternion = Quaternion.FromUnitVectorsToRef(
          new Vector3(0, 0, -1),
          normal,
          new Quaternion(),
        );
        label.material = numbers;
        label.isPickable = false;
        const u = (face % 5) / 5,
          v = 1 - (Math.floor(face / 5) + 1) / 4;
        label.setVerticesData('uv', [
          u,
          v,
          u + 0.2,
          v,
          u + 0.2,
          v + 0.25,
          u,
          v + 0.25,
        ]);
      }
      const settle = Quaternion.FromUnitVectorsToRef(
          resultNormal,
          Vector3.Up(),
          new Quaternion(),
        ),
        rotation = new Matrix();
      settle.toRotationMatrix(rotation);
      let bottom = 0;
      for (let j = 0; j < positions.length; j += 3)
        bottom = Math.min(
          bottom,
          Vector3.TransformCoordinates(
            Vector3.FromArray(positions, j),
            rotation,
          ).y,
        );
      dice.push({
        body,
        material,
        settle,
        player: row.player,
        x: (i - (rows.length - 1) / 2) * 2.8,
        height: -bottom + 0.03,
        // Each die uses a different angular path so a multiplayer throw does
        // not look like one object duplicated across the table.
        spin: new Vector3(17.5 + (i % 3) * 3.2, 13.4 + (i % 4) * 2.7, 20.2 + (i % 5) * 2.1),
        drift: i % 2 ? 0.4 : -0.4,
      });
    });
    auraMat = new StandardMaterial('initiative-aura', scene);
    auraMat.emissiveColor = new Color3(1, 0.72, 0.22);
    auraMat.disableLighting = true;
    aura = MeshBuilder.CreateTorus(
      'winner-aura',
      { diameter: 2.8, thickness: 0.08, tessellation: 64 },
      scene,
    );
    aura.material = auraMat;
    aura.isPickable = false;
    aura.setEnabled(false);
  }
  return {
    sync(next: Room) {
      room = next;
      offset = next.serverTime - Date.now();
    },
    tick(reduced: boolean) {
      const event = room?.initiative,
        now = Date.now() + offset;
      if (!event || now > event.endsAt) {
        if (dice.length) clear();
        return false;
      }
      const elapsed = Math.max(0, now - event.startedAt),
        round = Math.min(event.rounds.length - 1, Math.floor(elapsed / 4400)),
        nextKey = event.id + ':' + round;
      if (key !== nextKey) {
        key = nextKey;
        build(event.rounds[round]);
      }
      // Throw, rebound and settle: a continuous path with one short physical
      // bounce reads as a real d20 roll without the old repeating rotations.
      const t = reduced ? 1 : Math.min(1, (elapsed - round * 4400) / 3400);
      for (const d of dice) {
        const roll = Math.min(1, t / 0.76);
        const rebound = t < 0.76 ? 0 : Math.sin(((t - 0.76) / 0.24) * Math.PI) * 0.26;
        const travel = 1 - roll;
        d.body.position.set(
          d.x - 3.8 * travel + d.drift * Math.sin(roll * Math.PI),
          d.height +
            3.5 * travel +
            Math.sin(roll * Math.PI) * 2.15 * travel + rebound,
          -4.8 * travel + d.drift * Math.sin(roll * Math.PI),
        );
        const spin = Quaternion.FromEulerAngles(
          roll * d.spin.x,
          roll * d.spin.y,
          roll * d.spin.z,
        );
        d.body.rotationQuaternion =
          t < 0.76
            ? spin
            : Quaternion.Slerp(spin, d.settle, (t - 0.76) / 0.24);
        if (
          d.player === event.winner &&
          t === 1 &&
          round === event.rounds.length - 1 &&
          aura
        ) {
          aura.setEnabled(true);
          aura.position.set(d.x, 0.12, 0);
          const pulse = reduced ? 1 : 1 + Math.sin(now / 170) * 0.08;
          aura.scaling.set(pulse, 1, pulse);
        }
      }
      return true;
    },
    dispose() {
      clear();
      numbers.dispose();
      atlas.dispose();
    },
  };
}
