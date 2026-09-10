'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, BookOpen, Castle, Coins, Hand, Shield, Swords } from 'lucide-react';

const interfaceSteps = [
  { icon: <BookOpen />, title: 'Prepara tu mazo', text: 'Abre Mis mazos para construir, guardar o cargar un mazo. En una sala, cada jugador debe dejar el suyo preparado.' },
  { icon: <Hand />, title: 'Tu mano está abajo', text: 'Abre Mi mano y arrastra una carta hasta una zona. Pulsa una carta para leerla y usar sus acciones.' },
  { icon: <Castle />, title: 'Las pilas también se abren', text: 'Pulsa Castillo, Cementerio o Destierro para robar, mirar, buscar, ordenar y mover cartas.' },
  { icon: <Swords />, title: 'La mesa sigue la jugada', text: 'Al mover aliados a Ataque podrás elegir rival, bloqueadores y daño. Las fases sirven como guía y puedes intervenir antes de resolver.' },
  { icon: <Shield />, title: 'Todo queda sincronizado', text: 'Comparte el enlace de la sala. Tu mano sigue oculta y las solicitudes privadas aparecen para que el dueño acepte o rechace.' },
];

export function InterfaceTutorial({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const current = interfaceSteps[step];
  return <Dialog open={open} onOpenChange={onOpenChange}>
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

const lessons = [
  { phase: 'Objetivo', title: 'Protege tu Castillo', text: 'Tu Castillo comienza con las cartas del mazo. El daño hace botar cartas. Si llega a cero, pierdes la partida.' },
  { phase: 'Preparación', title: 'Conoce tu campo', text: 'Ataque y Defensa reciben Aliados. Apoyo recibe Tótems y otras cartas. Reserva guarda tus Oros disponibles; Oro pagado, los que ya usaste.' },
  { phase: 'Preparación', title: 'Mano inicial y mulligan', text: 'Recibes ocho cartas. Antes de comenzar puedes hacer mulligan y usar la regla de la casa Volver a ocho una vez.' },
  { phase: 'Vigilia', title: 'Genera recursos', text: 'Pon un Oro en la Reserva. Para jugar una carta, mueve a Oro pagado tantos Oros como indique su coste.' },
  { phase: 'Vigilia', title: 'Juega un Aliado', text: 'Arrastra el Aliado a Defensa. Desde ahí queda preparado para combatir y puedes leer sus habilidades pulsándolo.' },
  { phase: 'Ataque', title: 'Declara atacantes', text: 'Mueve el Aliado a Ataque y elige un rival. La fuerza del atacante indica el daño que puede llegar al Castillo.' },
  { phase: 'Bloqueo', title: 'El rival puede bloquear', text: 'El defensor asigna sus Aliados bloqueadores. Las habilidades como Imbloqueable, Indestructible o Retador se resuelven con las herramientas de la carta.' },
  { phase: 'Daño / Final', title: 'Resuelve y termina', text: 'Confirmen el daño, boten las cartas indicadas y den tiempo para respuestas. Al pasar turno, los Oros pagados vuelven a la Reserva cuando corresponde.' },
];

export function ImperioTutorial({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0);
  const lesson = lessons[step];
  const castle = step >= 7 ? 38 : 41;
  return <main className="practice-room">
    <div className="practice-toolbar">
      <button onClick={onExit}><ArrowLeft size={16} /> Salir del tutorial</button>
      <span>SALA DE APRENDIZAJE</span>
      <b>{lesson.phase}</b>
    </div>
    <section className="practice-board" aria-label="Mesa tutorial de Imperio">
      <div className="practice-opponent">
        <span>Maestro de la taberna</span>
        <div className="practice-card back small" />
        <div className="practice-zone enemy">DEFENSA {step >= 6 ? '· 1 ALIADO' : ''}</div>
      </div>
      <div className={`practice-zone attack ${step === 5 ? 'highlight' : ''}`}>
        LÍNEA DE ATAQUE
        {step >= 5 && <div className="practice-card ally"><i>2</i><strong>Guerrero joven</strong><b>3 ⚔</b></div>}
      </div>
      <div className={`practice-zone defense ${step === 4 ? 'highlight' : ''}`}>
        LÍNEA DE DEFENSA
        {step === 4 && <div className="practice-card ally"><i>2</i><strong>Guerrero joven</strong><b>3 ⚔</b></div>}
      </div>
      <div className="practice-zone support">APOYO</div>
      <div className="practice-piles">
        <div><div className="practice-card back" /><b>Castillo {castle}</b></div>
        <div><div className="practice-card pile-card" /><b>Cementerio {step >= 7 ? 3 : 0}</b></div>
        <div><div className="practice-card pile-card" /><b>Destierro 0</b></div>
      </div>
      <div className={`practice-gold ${step === 3 ? 'highlight' : ''}`}>
        <span>ORO PAGADO {step >= 4 ? 1 : 0}</span>
        <span>RESERVA {step >= 3 ? 1 : 0}</span>
        {step >= 3 && <div className="practice-card gold"><Coins /><strong>Oro</strong></div>}
      </div>
      <div className="practice-hand">
        <span>TU MANO</span>
        {[0, 1, 2, 3].map((card) => <div key={card} className={`practice-card ${card === 0 ? 'ally' : 'hand-card'}`}><strong>{card === 0 ? 'Guerrero joven' : 'Carta'}</strong></div>)}
      </div>
    </section>
    <aside className="lesson-card">
      <div className="lesson-number">{step + 1} / {lessons.length}</div>
      <small>{lesson.phase}</small>
      <h2>{lesson.title}</h2>
      <p>{lesson.text}</p>
      <div className="tutorial-progress">{lessons.map((_, index) => <span key={index} className={index <= step ? 'done' : ''} />)}</div>
      <div className="tutorial-nav">
        <button disabled={step === 0} onClick={() => setStep((value) => value - 1)}>Atrás</button>
        {step < lessons.length - 1
          ? <button className="primary" onClick={() => setStep((value) => value + 1)}>Practicar paso <ArrowRight size={16} /></button>
          : <button className="primary" onClick={onExit}>Terminar tutorial</button>}
      </div>
    </aside>
  </main>;
}

