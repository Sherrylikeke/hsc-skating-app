import {AccessError,accessibleSkaters,requireRole,nowISO,stringField} from './member-access';
import type {Member} from './member-access';
import {portalCatalogue} from './portal-content';
export async function readPortalCart(db:D1Database,member:Member){
 const rows=(await db.prepare('SELECT id,item_id,skater_id,quantity FROM hsc_portal_cart WHERE member_id=? ORDER BY updated_at').bind(member.id).all<{id:string;item_id:string;skater_id:string;quantity:number}>()).results;
 const allowed=await accessibleSkaters(db,member);
 const items=rows.map(row=>{const item=portalCatalogue.find(i=>i.id===row.item_id);const canUseSkater=!row.skater_id||member.role==='admin'||allowed.includes(row.skater_id);return {...row,item,lineTotalCents:item?item.priceCents*row.quantity:0,needsReview:!item||item.reviewRequired||item.soldOut||!canUseSkater};});
 return {items,subtotalCents:items.reduce((sum,item)=>sum+item.lineTotalCents,0),currency:'CAD',checkoutEnabled:false,reason:'Online checkout is not available yet. No payment or registration has been made.'};
}
export async function updatePortalCart(db:D1Database,member:Member,body:Record<string,unknown>){
 requireRole(member,'admin','parent','skater','coach');
 const itemId=stringField(body.itemId,120),item=portalCatalogue.find(i=>i.id===itemId),quantity=Number(body.quantity),skaterId=stringField(body.skaterId,160,true);
 if(!item||!Number.isInteger(quantity)||quantity<0||quantity>10)throw new AccessError(400,'Choose a valid item and quantity.');
 if(quantity===0){await db.prepare('DELETE FROM hsc_portal_cart WHERE member_id=? AND item_id=? AND skater_id=?').bind(member.id,itemId,skaterId).run();return readPortalCart(db,member);}
 if(item.soldOut)throw new AccessError(409,'This item is sold out.');
 if(item.kind!=='product'&&(!skaterId||quantity!==1))throw new AccessError(400,'Choose one eligible skater for this item.');
 if(skaterId){if(member.role==='admin'){if(!await db.prepare('SELECT skater_id FROM hsc_admissions WHERE skater_id=? AND admitted=1').bind(skaterId).first())throw new AccessError(403,'This skater has not been admitted.');}else if(!(await accessibleSkaters(db,member)).includes(skaterId))throw new AccessError(403,'An approved skater relationship is required.');}
 await db.prepare('INSERT INTO hsc_portal_cart (id,member_id,item_id,skater_id,quantity,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(member_id,item_id,skater_id) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at').bind(crypto.randomUUID(),member.id,itemId,skaterId,quantity,nowISO()).run();
 return readPortalCart(db,member);
}
