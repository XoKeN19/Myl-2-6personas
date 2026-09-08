import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,player,action,view,definition} from '../lib/game.mjs';
test('Foto persiste al editar texto y no se revela en mano ajena',()=>{const r=createRoom('A',2),p=r.players[0],q=player('B');r.players.push(q);const image='data:image/jpeg;base64,/9j/';action(r,p.token,{type:'add',card:{name:'Con foto',type:'Aliado',image}});const c=p.cards.at(-1);action(r,p.token,{type:'edit',cardId:c.id,card:{name:'Editada',type:'Aliado',cost:2,strength:4}});assert.equal(c.image,image);assert.equal(view(r,q.token).players[0].cards.some(c=>c.image===image),false);assert.equal(definition({type:'Aliado',image:'javascript:alert(1)'}).image,'');});
