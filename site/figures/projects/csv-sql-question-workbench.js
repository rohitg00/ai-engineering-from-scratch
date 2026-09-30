window.AIFSProjectFigures.register("pj-csv-sql-question-workbench-1", {
  "title": "Import a table without guessing away errors",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "load_csv(text, max_rows=10000)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'cells',label:'CSV column values (comma separated)',type:'text',value:'12,7,5'}],calculate(v){const values=v.cells.split(',').map(s=>s.trim()).filter(Boolean);const safe=s=>/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(s)&&!(/^[+-]?0[0-9]+$/.test(s))&&Number.isFinite(Number(s))&&Math.abs(Number(s))<=Number.MAX_SAFE_INTEGER&&!(Number(s)===0&&/[1-9]/.test(s.split(/[eE]/)[0]));const numeric=values.length>0&&values.every(safe);return {summary:numeric?'All nonempty cells fit the conservative numeric contract: REAL column.':'Preserve TEXT when any cell is nonnumeric, zero-padded, too large or underflows.',metrics:[{label:'Nonempty cells',value:values.length},{label:'Inferred type',value:numeric?'REAL':'TEXT'}],columns:['Cell','Safe numeric conversion?'],rows:values.map(s=>[s,safe(s)?'yes':'preserve text'])};}}
});

window.AIFSProjectFigures.register("pj-csv-sql-question-workbench-2", {
  "title": "Translate a small question into an inspectable plan",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "plan_question(question, data)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'operation',label:'Aggregate',type:'select',value:'sum',options:[{value:'sum',label:'Sum'},{value:'count',label:'Count'}]},{key:'field',label:'Column',type:'select',value:'units',options:[{value:'units',label:'units: REAL'},{value:'region',label:'region: TEXT'}]}],calculate(v){const valid=v.operation==='count'||v.field==='units';return {summary:valid?'Proposal ready for independent execution checks.':'Reject: SUM needs a numeric column.',metrics:[{label:'Decision',value:valid?'propose':'reject'}],columns:['Step','Value'],rows:[['Resolve',v.field],['Check type',valid?'compatible':'incompatible'],['SQL',valid?'SELECT region, '+v.operation.toUpperCase()+'('+v.field+') FROM data GROUP BY region':'no query produced']]};}}
});

window.AIFSProjectFigures.register("pj-csv-sql-question-workbench-3", {
  "title": "Execute a proposal inside a read-only boundary",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "run_query(data, sql, max_rows=100, max_steps=100000)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'rows',label:'Matching rows',type:'range',value:60,min:0,max:200,step:1},{key:'limit',label:'Returned row budget',type:'range',value:40,min:1,max:100,step:1},{key:'write',label:'Proposal requests a write',type:'checkbox',value:false}],calculate(v){const returned=v.write?0:Math.min(v.rows,v.limit);return {summary:v.write?'Authorizer denies the statement before an effect.':v.rows>v.limit?'Result is explicitly marked truncated.':'Complete result fits the row budget.',metrics:[{label:'Returned',value:returned},{label:'Hidden by cap',value:v.write?'query rejected':Math.max(0,v.rows-v.limit)}],bars:[{label:'Matching rows',value:v.rows},{label:'Returned rows',value:returned}]};}}
});

window.AIFSProjectFigures.register("pj-csv-sql-question-workbench-4", {
  "title": "Publish an answer another developer can reproduce",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "render_report(report)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'west',label:'Last West record: units',type:'range',value:4,min:0,max:30,step:1}],calculate(v){const west=12+5+v.west;return {summary:'Changing one source record changes the West aggregate and the grand total.',metrics:[{label:'Grand total',value:10+9+west}],bars:[{label:'East',value:10},{label:'South',value:9},{label:'West',value:west}],columns:['Evidence','Value'],rows:[['West records','12 + 5 + '+v.west],['Executed aggregate',west]]};}}
});
