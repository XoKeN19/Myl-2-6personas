'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, BookOpen, Castle, Hand, Shield, Swords } from 'lucide-react';
import type { Room } from './page';

const interfaceSteps = [
  { icon: <BookOpen />, title: 'Prepara tu mazo', text: 'Abre Mis mazos para construir, guardar o cargar un mazo. En una sala, cada jugador debe dejar el suyo preparado.' },
  { icon: <Hand />, title: 'Tu mano está abajo', text: 'Abre Mi mano y arrastra una carta hasta una zona. Pulsa una carta para leerla y usar sus acciones.' },
  { icon: <Castle />, title: 'Las pilas también se abren', text: 'Pulsa Castillo, Cementerio o Destierro para robar, mirar, buscar, ordenar y mover cartas.' },
  { icon: <Swords />, title: 'La mesa sigue la jugada', text: 'Al mover aliados a Ataque podrás elegir rival, bloqueadores y daño. Las fases sirven como guía y puedes intervenir antes de resolver.' },
  { icon: <Shield />, title: 'Todo queda sincronizado', text: 'Comparte el enlace de la sala. Tu mano sigue oculta y las solicitudes privadas aparecen para que el dueño acepte o rechace.' },
];

export function InterfaceTutorial({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);
  const current = interfaceSteps[step];
  return <Dialog open={open} onOpenChange={(value) => { if (!value) setStep(0); onOpenChange(value); }}>
    <DialogContent className="onboarding-modal">
      <div className="tutorial-progress" aria-label={`Paso ${step + 1} de ${interfaceSteps.length}`}>
        {interfaceSteps.map((_, index) => <span key={index} className={index <= step ? 'done' : ''} />)}
      </div>
      <div className="tutorial-icon">{current.icon}</div>
      <DialogTitle>{current.title}</DialogTitle>
      <DialogDescription>{current.text}</DialogDescription>
      <small>Paso {step + 1} de {interfaceSteps.length}</small>
      <div className="tutorial-nav">
        <button disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft size={16} /> Atrás</button>
        {step < interfaceSteps.length - 1
          ? <button className="primary" onClick={() => setStep((value) => value + 1)}>Siguiente <ArrowRight size={16} /></button>
          : <button className="primary" onClick={() => onOpenChange(false)}>Entendido</button>}
      </div>
    </DialogContent>
  </Dialog>;
}

export function NewPlayerQuestion({ open, answer }: { open: boolean; answer: (wantsGuide: boolean) => void }) {
  return <Dialog open={open} onOpenChange={() => undefined}>
    <DialogContent className="new-player-modal" showCloseButton={false}>
      <div className="tutorial-icon"><Shield /></div>
      <DialogTitle>¿Eres nuevo por aquí?</DialogTitle>
      <DialogDescription>Podemos enseñarte la interfaz en menos de un minuto.</DialogDescription>
      <div className="new-player-actions">
        <button className="primary" onClick={() => answer(true)}>Sí, ver tutorial</button>
        <button onClick={() => answer(false)}>No, ya la conozco</button>
      </div>
    </DialogContent>
  </Dialog>;
}

const liveLessons = [
  ['Preparación', 'Tu mazo ya está cargado', 'Abre Preparación y pulsa Repartir 8. La mano será real y privada.'],
  ['Preparación', 'Revisa tu mano inicial', 'Abre Mi mano. Puedes hacer Mulligan, Volver a 8 o conservar estas cartas.'],
  ['Preparación', 'Comienza la partida', 'Pulsa Comenzar. Los dados decidirán el inicio y el tutorial te dará el primer turno.'],
  ['Vigilia', 'Conoce tu Oro inicial', 'Pulsa Patria Vieja en Reserva y lee su texto. Algunos Oros iniciales tienen habilidades y otros no.'],
  ['Vigilia', 'Pon un Oro en juego', 'Desde Mi mano, mueve un Oro a Reserva. La guía detectará el movimiento correcto.'],
  ['Vigilia', 'Paga el coste', 'Mueve dos Oros de Reserva a Oro pagado para pagar un Aliado de coste 2.'],
  ['Vigilia', 'Juega un Aliado', 'Mueve Akari Musashi desde tu mano hasta Defensa.'],
  ['Vigilia', 'Resuelve la habilidad', 'Pulsa Akari. “Cuando entra en juego” es disparada; “una vez por turno” es activada; el aumento de coste es continuo.'],
  ['Guerra de Talismanes', 'Respuestas y Talismanes', 'Antes de resolver un efecto, deja responder. Mueve Tempilcahue desde tu mano al Destierro para representar que se jugó y resolvió.'],
  ['Ataque', 'Mueve el atacante', 'Lleva Akari desde Defensa hasta Ataque. Furia permite atacar al entrar; un Aliado normal espera a un próximo turno.'],
  ['Ataque', 'Declara el ataque', 'Pulsa Atacar, marca Akari y elige al Maestro de la taberna.'],
  ['Bloqueo', 'El rival bloqueó', 'El Maestro eligió un bloqueador. Retador, Imbloqueable, Indestructible e Indesterrable modifican esta resolución.'],
  ['Daño / Final', 'Resuelve y termina', 'El defensor asigna el daño que entra por cada atacante. Después hay una última respuesta, Fase Final y cambio de turno.'],
] as const;

export function GameTutorialCoach({ room, act }: { room: Room; act: (action: Record<string, unknown>) => Promise<Room | undefined> }) {
  if (!room.tutorial) return null;
  const step = Math.min(room.tutorial.step, liveLessons.length - 1);
  const [phase, title, text] = liveLessons[step];
  const canContinue = [1, 11, 12].includes(step);
  return <aside className={`game-tutorial-coach coach-step-${step}`} aria-live="polite">
    <div className="coach-head"><span>PARTIDA TUTORIAL</span><b>{step + 1}/{liveLessons.length}</b></div>
    <small>{phase}</small>
    <h2>{room.tutorial.complete ? '¡Tutorial completado!' : title}</h2>
    <p>{room.tutorial.complete ? 'Ya conoces el flujo principal. Puedes seguir explorando esta mesa o volver al menú y jugar con un amigo.' : text}</p>
    <div className="tutorial-progress">{liveLessons.map((_, index) => <span key={index} className={index <= step ? 'done' : ''}/>)}</div>
    {!room.tutorial.complete && canContinue && <button className="primary" onClick={() => void act({ type: 'tutorialContinue' })}>{step === 1 ? 'Conservar esta mano' : step === 12 ? 'Completar tutorial' : 'Ya lo entendí'} <ArrowRight size={15}/></button>}
    {!room.tutorial.complete && !canContinue && <em>➜ Realiza la acción indicada en la mesa</em>}
  </aside>;
}
