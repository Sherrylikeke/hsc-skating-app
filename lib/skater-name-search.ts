// Search suggestions only. Registration still verifies the chosen canonical name.
const searchKey=(value:string)=>value.normalize('NFKC').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}']+/gu,' ').trim();
function distance(first:string,second:string){
  const rows=Array.from({length:first.length+1},()=>Array<number>(second.length+1).fill(0));
  for(let i=0;i<=first.length;i++)rows[i][0]=i;
  for(let j=0;j<=second.length;j++)rows[0][j]=j;
  for(let i=1;i<=first.length;i++)for(let j=1;j<=second.length;j++){
    rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+Number(first[i-1]!==second[j-1]));
    if(i>1&&j>1&&first[i-1]===second[j-2]&&first[i-2]===second[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
  }
  return rows[first.length][second.length];
}
export function skaterNameSuggestions(names:Iterable<string>,query:string,limit=8){
  const key=searchKey(query),terms=key.split(' ');
  if(key.length<2||query.length>120||terms.length>6)return {names:[] as string[],hasMore:false};
  const unique=new Map<string,string>();for(const name of names)if(!unique.has(searchKey(name)))unique.set(searchKey(name),name);
  const matches=[...unique].flatMap(([nameKey,name])=>{
    const words=nameKey.split(' ');let score=0;
    for(const term of terms){
      const ranks=words.map(word=>word===term?0:word.startsWith(term)?1:word.includes(term)?2:
        term.length>=4&&Math.abs(term.length-word.length)<=2&&distance(term,word)<=(term.length>=7?2:1)?4:Infinity);
      const rank=Math.min(...ranks);if(!Number.isFinite(rank))return [];score+=rank;
    }
    return [{name,score:score-(nameKey===key?1:0)}];
  }).sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,'en'));
  return {names:matches.slice(0,limit).map(match=>match.name),hasMore:matches.length>limit};
}
