import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, player, action, card } from '../lib/game.mjs';

const empty = (p) => p.cards.forEach((c) => { if (c.zone === 'castillo') c.zone = 'cementerio'; });
test('Turn rotation skips empty Castles, wraps around, and groups the next surviving player', () => {
  const r = createRoom('A', 4);
  r.players.push(player('B'), player('C'), player('D'));
  const [a,b,c,d] = r.players;
  empty(b); empty(d);
  c.cards[0].zone = 'pagado';
  action(r,a.token,{type:'next'});
  assert.equal(r.active,c.id);
  assert.equal(c.cards[0].zone,'reserva');
  assert.equal(r.turn,2);
  action(r,c.token,{type:'next'});
  assert.equal(r.active,a.id);
  empty(a);
  action(r,a.token,{type:'next'});
  assert.equal(r.active,c.id);
  action(r,c.token,{type:'next'});
  assert.equal(r.active,c.id);
  empty(c);
  assert.throws(()=>action(r,c.token,{type:'next'}),/partida terminó/);
});

test('Distinct allies attack multiple rivals in separate declarations in one turn', () => {
  const r=createRoom('A',4);
  r.players.push(player('B'),player('C'),player('D'));
  const [a,b,c,d]=r.players;
  const allies=[1,2,3].map((n)=>card({name:'Aliado '+n,type:'Aliado',zone:'ataque',strength:n}));
  a.cards.push(...allies);
  for (const [i,target] of [b,c,d].entries()) {
    action(r,a.token,{type:'strike',assignments:[{cardId:allies[i].id,target:target.id}]});
  }
  assert.equal(r.pendingBattles.length,3);
  for(const [i,target] of [b,c,d].entries()){
    const battle=r.pendingBattles.find((x)=>x.target===target.id);
    action(r,target.token,{type:'defend',battleId:battle.id,rows:battle.rows.map((row)=>({cardId:row.cardId,damage:row.strength}))});
    assert.equal(r.phase,i<2?'Guerra de Talismanes':'Asignación de daño');
  }
  assert.throws(()=>action(r,a.token,{type:'strike',assignments:[{cardId:allies[0].id,target:c.id}]}));
  const fresh=card({type:'Aliado',zone:'ataque'});
  a.cards.push(fresh); empty(b);
  assert.throws(()=>action(r,a.token,{type:'strike',assignments:[{cardId:fresh.id,target:b.id}]}));
  action(r,a.token,{type:'next'});
  assert.equal(r.active,c.id);
});
