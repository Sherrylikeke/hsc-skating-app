export function outboxStatement(database:D1Database,input:{
  id:string;kind:string;subjectId:string;skaterId:string;authorId?:string;payload:unknown;
},gate?:string){
  const now=new Date().toISOString();
  const values=[input.id,input.kind,input.subjectId,input.skaterId,input.authorId||null,JSON.stringify(input.payload),now,now];
  return database.prepare(`INSERT INTO hsc_outbox (id,kind,subject_id,skater_id,author_id,payload,available_at,created_at)
    SELECT ?,?,?,?,?,?,?,? ${gate?'WHERE EXISTS (SELECT 1 FROM hsc_audit WHERE id=?)':''} ON CONFLICT(id) DO NOTHING`)
    .bind(...values,...(gate?[gate]:[]));
}
