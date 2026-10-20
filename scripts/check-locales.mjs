import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const dictionary=JSON.parse(fs.readFileSync('lib/translations.json','utf8'));
const files=['app/member-app.tsx','app/club-app.tsx','app/athlete-history.tsx','app/coach-editor.tsx','app/password-panel.tsx'];
let calls=0;
for(const file of files){
  const tree=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function inspect(node){
    if(ts.isCallExpression(node)&&node.expression.getText(tree)==='translate'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){
      const key=node.arguments[0].text;
      if(/[\u3400-\u9fff]/.test(key))assert.ok(Object.hasOwn(dictionary,key),file+': '+key);
      calls++;
    }
    ts.forEachChild(node,inspect);
  }
  inspect(tree);
}
for(const [key,value] of Object.entries(dictionary)){
  assert.equal(typeof value,'string');
  assert.deepEqual([...key.matchAll(/\{\d+\}/g)].map(match=>match[0]).sort(),[...value.matchAll(/\{\d+\}/g)].map(match=>match[0]).sort(),key);
}
console.log(JSON.stringify({files:files.length,translationCalls:calls,dictionaryEntries:Object.keys(dictionary).length,allKeysAndPlaceholdersValid:true,defaultLocale:'en'}));
