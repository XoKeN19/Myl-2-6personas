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
  { phase: 'Inicio', title: 'Imperio es rápido', text: 'La partida empieza con un Oro inicial y una mano de ocho. Las cartas tienen muchas habilidades, por eso la mesa te deja resolverlas con libertad. Tu meta es dejar el Castillo rival en cero.' },
  { phase: 'Preparación', title: 'Esta es la distribución correcta', text: 'Arriba van Oro pagado y Ataque. Al centro están Cementerio, Castillo y Defensa. Abajo quedan Destierro, Reserva y Apoyo. Pulsa el Castillo señalado.' },
  { phase: 'Preparación', title: 'El Oro inicial puede tener habilidad', text: 'Patria Vieja parte en Reserva. “Oro inicial” indica dónde comienza; además posee texto permanente y una habilidad de Vigilia. Pulsa la carta para leerla.' },
  { phase: 'Preparación', title: 'Reconoce las habilidades', text: '“Cuando…” dispara una habilidad al ocurrir algo. “Una vez por turno, puedes…” es activada por el jugador. El texto sin disparador suele ser continuo. Las palabras destacadas, como Furia o Indestructible, son habilidades clave.' },
  { phase: 'Preparación', title: 'Mano inicial y mulligan', text: 'Recibes ocho cartas. Antes de comenzar puedes cambiar la mano con Mulligan y, en esta mesa, usar Volver a ocho una vez. Después esas opciones se cierran.' },
  { phase: 'Vigilia', title: 'Pon un Oro en Reserva', text: 'En Vigilia puedes bajar Oro. Pulsa la flecha para mover el Oro de tu mano a Reserva.' },
  { phase: 'Vigilia', title: 'Paga y juega un Aliado', text: 'Akari Musashi cuesta 2. Paga dos Oros y ponlo en Defensa. Su habilidad “cuando entra en juego” se dispara inmediatamente.' },
  { phase: 'Vigilia', title: 'Resuelve la habilidad del Aliado', text: 'Akari permite desterrar una carta oponente y buscar un Héroe. Pulsa la carta: en una partida abrirías sus acciones y las pilas necesarias para completar el efecto.' },
  { phase: 'Guerra de Talismanes', title: 'Da oportunidad de responder', text: 'Antes de cerrar una habilidad o ataque, el rival puede responder. Sheut puede anular un Aliado o Tótem de coste 1 o cancelar una habilidad. Pulsa Sheut para jugar la respuesta.' },
  { phase: 'Ataque', title: 'Declara quién ataca', text: 'Los Aliados se mueven de Defensa a Ataque y eliges al rival. Furia permite atacar el turno en que el Aliado entra. Pulsa la flecha de ataque.' },
  { phase: 'Bloqueo', title: 'Primero se asigna el bloqueo', text: 'El defensor elige qué Aliado bloquea a cuál. Retador puede intervenir en esa elección e Imbloqueable evita el bloqueo. Indestructible e Indesterrable cambian lo que puede ocurrir al resolver.' },
  { phase: 'Daño', title: 'El defensor reparte el daño', text: 'Cada atacante aporta su Fuerza. El defensor confirma cuánto daño entra desde cada Aliado; el daño no bloqueado bota esa cantidad de cartas de su Castillo. Pulsa Resolver daño.' },
  { phase: 'Daño / Final', title: 'Cierra el turno', text: 'Deja una ventana para Talismanes o habilidades que prevengan y cancelen. Después resuelve el daño, usa habilidades de Fase Final, descarta hasta ocho cartas y pasa el turno.' },
];

const tutorialCards = {
  initial: { name: 'Patria Vieja', image: 'https://myths.cl/cards/Kaijus%20vs%20Mechas/full/KVM-301.webp', text: 'Oro Inicial. En tu Vigilia, si no has puesto Oros en juego este turno, puedes mirar las primeras seis cartas de tu Castillo y poner un Oro de ahí en tu Reserva. Tus Aliados de coste 1 o más ganan 1 de Fuerza y no son destruidos cuando bloquean.' },
  ally: { name: 'Akari Musashi', image: 'https://myths.cl/cards/Kaijus%20vs%20Mechas/full/KVM-043.webp', text: 'Cuando entra en juego o ataca, Destierra una carta oponente que no sea Oro. Una vez por turno, busca en tu Castillo un Aliado Héroe y ponlo en tu mano. A tu oponente le cuesta un Oro adicional jugar Talismanes.' },
  talisman: { name: 'Sheut', image: 'https://myths.cl/cards/Bestiarium/full/BES-373.webp', text: 'Si controlas menos Oros que tu oponente puedes jugarlo por un Oro menos. Cuando lo juegues, destiérralo: anula un Aliado o Tótem de coste 1 o menos, o cancela la habilidad de una carta.' },
};

export function ImperioTutorial({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<keyof typeof tutorialCards | null>(null);
  const lesson = lessons[step];
  const castle = step >= 12 ? 38 : 41;
  const advance = () => { setSelected(null); setStep((value) => Math.min(value + 1, lessons.length - 1)); };
  const CardFace = ({ card, className = '', onClick }: { card: keyof typeof tutorialCards; className?: string; onClick?: () => void }) => {
    const data = tutorialCards[card];
    return <button className={`practice-card scan ${className}`} onClick={() => { setSelected(card); onClick?.(); }} aria-label={`Ver ${data.name}`}><img src={data.image} alt={data.name} /></button>;
  };
  return <main className="practice-room">
    <div className="practice-toolbar">
      <button onClick={onExit}><ArrowLeft size={16} /> Salir del tutorial</button>
      <span>SALA DE APRENDIZAJE</span>
      <b>{lesson.phase}</b>
    </div>
    <section className="practice-board correct-layout" aria-label="Mesa tutorial interactiva de Imperio">
      <div className="tutorial-rival"><b>Maestro de la taberna</b><div className="rival-hand">{[1,2,3,4].map((n)=><div className="practice-card back small" key={n}/>)}</div><div className="rival-line">ATAQUE DEL RIVAL</div></div>
      <div className="tutorial-field">
        <div className="practice-zone paid">ORO PAGADO {step >= 6 ? 2 : 0}{step >= 6 && <><CardFace card="initial" className="mini-card"/><div className="practice-card gold mini-card"><Coins /></div></>}</div>
        <div className={`practice-zone attack ${step === 9 ? 'highlight' : ''}`}>LÍNEA DE ATAQUE{step >= 9 && <CardFace card="ally"/>}{step === 9 && <button className="guide-arrow" onClick={advance}>Atacar ↑</button>}</div>
        <div className="practice-zone cemetery">CEMENTERIO {step >= 12 ? 3 : 0}</div>
        <button className={`practice-zone castle ${step === 1 ? 'highlight' : ''}`} onClick={() => step === 1 ? advance() : undefined}><div className="practice-card back"/><b>CASTILLO {castle}</b>{step === 1 && <span className="guide-arrow">Pulsa aquí ↑</span>}</button>
        <div className={`practice-zone defense ${step === 6 || step === 7 ? 'highlight' : ''}`}>LÍNEA DE DEFENSA{step >= 6 && step < 9 && <CardFace card="ally" onClick={step === 7 ? advance : undefined}/>}</div>
        <div className="practice-zone exile">DESTIERRO {step >= 8 ? 1 : 0}{step >= 9 && <CardFace card="talisman" className="mini-card"/>}</div>
        <div className={`practice-zone reserve ${step === 2 || step === 5 ? 'highlight' : ''}`}>RESERVA {step >= 5 ? 3 : 1}<CardFace card="initial" onClick={step === 2 ? advance : undefined}/>{step === 5 && <button className="guide-arrow" onClick={advance}>Bajar Oro ↑</button>}</div>
        <div className={`practice-zone support ${step === 8 ? 'highlight' : ''}`}>LÍNEA DE APOYO{step === 8 && <CardFace card="talisman" onClick={advance}/>}</div>
      </div>
      <div className="practice-hand"><span>TU MANO · {step < 5 ? 8 : 6}</span><CardFace card="ally"/><CardFace card="talisman"/>{[1,2,3].map((n)=><div className="practice-card hand-card" key={n}><strong>Carta</strong></div>)}</div>
      {step === 6 && <button className="floating-action" onClick={advance}>Pagar 2 y jugar Akari</button>}
      {step === 11 && <button className="floating-action damage" onClick={advance}>Resolver 3 de daño</button>}
    </section>
    <aside className="lesson-card">
      <div className="lesson-number">{step + 1} / {lessons.length}</div>
      <small>{lesson.phase}</small>
      <h2>{lesson.title}</h2>
      <p>{lesson.text}</p>
      {selected && <div className="tutorial-card-text"><b>{tutorialCards[selected].name}</b><p>{tutorialCards[selected].text}</p></div>}
      <div className="tutorial-progress">{lessons.map((_, index) => <span key={index} className={index <= step ? 'done' : ''} />)}</div>
      <div className="tutorial-nav">
        <button disabled={step === 0} onClick={() => setStep((value) => value - 1)}>Atrás</button>
        {step < lessons.length - 1
          ? <button className="primary" onClick={advance}>{[1,2,5,6,7,8,9,11].includes(step) ? 'Omitir acción' : 'Continuar'} <ArrowRight size={16} /></button>
          : <button className="primary" onClick={onExit}>Terminar tutorial</button>}
      </div>
    </aside>
  </main>;
}
