export function homeSkaterChoices<Skater extends {id:string;name:string}>(skaters:Skater[],selectedIds:string[],query:string):Skater[]{
  const selected=new Set(selectedIds);
  const terms=query.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return skaters.filter(skater=>!selected.has(skater.id)&&terms.every(term=>`${skater.name} ${skater.id}`.normalize('NFKC').toLowerCase().includes(term)));
}
