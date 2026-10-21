export type HomeScope='mine'|'team'|`skater:${string}`;
export function filterHomeSchedule<Row extends {skaterId:string}>(rows:Row[],ownIds:string[],scope:HomeScope):Row[] {
  const own=new Set(ownIds);
  if(scope==='mine')return rows.filter(row=>own.has(row.skaterId));
  if(scope==='team')return [...rows.filter(row=>own.has(row.skaterId)),...rows.filter(row=>!own.has(row.skaterId))];
  return rows.filter(row=>row.skaterId===scope.slice(7));
}
