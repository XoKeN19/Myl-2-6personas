import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom,action,player } from '../lib/game.mjs';
test('Sacar primera y última conserva el orden y la cantidad total',()=>{
 const r=createRoom('Uno',2),p=r.players[0],cards=p.cards.filter(c=>c.zone==='castillo');
 action(r,p.token,{type:'castleTake',edge:'last',zone:'mano',count:2});
 assert.deepEqual(p.cards.filter(c=>c.zone==='castillo').map(c=>c.id),cards.slice(0,-2).map(c=>c.id));
 action(r,p.token,{type:'castleTake',edge:'first',zone:'destierro',count:1});
 assert.equal(cards[0].zone,'destierro');assert.equal(p.cards.length,50);
 assert.throws(()=>action(r,p.token,{type:'castleTake',edge:'first',zone:'invalido',count:1}));
});
test('Las fases sugeridas acompañan la jugada sin bloquear ni cambiar el turno rival',()=>{
 const r=createRoom('Uno',2),p=r.players[0],q=player('Dos');r.players.push(q);r.phase='Agrupación';
 const c=p.cards[1];c.zone='mano';
 action(r,p.token,{type:'freeMove',cardId:c.id,sourcePlayerId:p.id,zone:'defensa'});assert.equal(r.phase,'Vigilia');
 action(r,p.token,{type:'freeMove',cardId:c.id,sourcePlayerId:p.id,zone:'ataque'});assert.equal(r.phase,'Guerra de Talismanes');
 const d=q.cards[1];d.zone='mano';
 action(r,q.token,{type:'freeMove',cardId:d.id,sourcePlayerId:q.id,zone:'defensa'});assert.equal(r.phase,'Guerra de Talismanes');
});
