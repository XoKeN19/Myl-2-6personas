'use client';
/* eslint-disable @next/next/no-img-element -- Local compressed data URLs do not use a remote image optimizer. */
import { useState } from 'react';
export default function CardPhoto({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  const [source, setSource] = useState(''),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50),
    [rotation, setRotation] = useState(0),
    [error, setError] = useState('');
  async function read(file?: File) {
    if (!file) return;
    try {
      if (file.size > 15000000) throw Error('Usa una foto de hasta 15 MB');
      const reader = new FileReader();
      reader.onload = () => {
        setSource(typeof reader.result === 'string' ? reader.result : '');
        setZoom(1);
        setX(50);
        setY(50);
        setRotation(0);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    try {
      const img = new Image();
      img.src = source;
      await img.decode();
      const rotated = document.createElement('canvas');
      const swap = rotation % 180 !== 0;
      rotated.width = swap ? img.height : img.width;
      rotated.height = swap ? img.width : img.height;
      const r = rotated.getContext('2d')!;
      r.translate(rotated.width / 2, rotated.height / 2);
      r.rotate((rotation * Math.PI) / 180);
      r.drawImage(img, -img.width / 2, -img.height / 2);
      const out = document.createElement('canvas');
      out.width = 630;
      out.height = 920;
      const scale = Math.max(630 / rotated.width, 920 / rotated.height) * zoom;
      const w = rotated.width * scale,
        h = rotated.height * scale;
      out
        .getContext('2d')!
        .drawImage(rotated, ((630 - w) * x) / 100, ((920 - h) * y) / 100, w, h);
      let photo = '';
      for (let quality = 0.88; quality >= 0.28; quality -= 0.1) {
        photo = out.toDataURL('image/jpeg', quality);
        if (photo.length <= 180000) break;
      }
      if (photo.length > 180000)
        throw Error('La foto tiene demasiado detalle. Prueba otra toma.');
      onChange(photo);
      setSource('');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="photo-editor">
      <strong>Foto de la carta</strong>
      <div className="actions">
        <label>
          Subir foto
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
        <label>
          Tomar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {source ? (
        <>
          <div className="scan-preview">
            <img
              src={source}
              alt="Encuadre de la carta"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `${x}% ${y}%`,
                transform: `scale(${zoom})`,
                transformOrigin: `${x}% ${y}%`,
              }}
            />
          </div>
          <p>
            Centra la carta y evita reflejos. Recorta los bordes de la mesa.
          </p>
          <label>
            Acercar
            <input
              type="range"
              min="1"
              max="3"
              step=".05"
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
            />
          </label>
          <label>
            Horizontal
            <input
              type="range"
              value={x}
              onChange={(e) => setX(+e.target.value)}
            />
          </label>
          <label>
            Vertical
            <input
              type="range"
              value={y}
              onChange={(e) => setY(+e.target.value)}
            />
          </label>
          <div className="actions">
            <button
              onClick={async () => {
                const img = new Image();
                img.src = source;
                await img.decode();
                const canvas = document.createElement('canvas');
                canvas.width = img.height;
                canvas.height = img.width;
                const context = canvas.getContext('2d')!;
                context.translate(canvas.width / 2, canvas.height / 2);
                context.rotate(Math.PI / 2);
                context.drawImage(img, -img.width / 2, -img.height / 2);
                setSource(canvas.toDataURL('image/jpeg', 0.95));
              }}
            >
              Girar
            </button>
            <button onClick={() => void save()}>Usar foto recortada</button>
            <button onClick={() => setSource('')}>Cancelar foto</button>
          </div>
        </>
      ) : (
        value && (
          <>
            <a href={value} target="_blank" rel="noreferrer">
              <img
                className="saved-card-photo"
                src={value}
                alt="Foto guardada de la carta"
              />
            </a>
            <button onClick={() => onChange('')}>Quitar foto</button>
          </>
        )
      )}
    </section>
  );
}
