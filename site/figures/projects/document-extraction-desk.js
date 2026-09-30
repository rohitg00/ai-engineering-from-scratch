window.AIFSProjectFigures.register("pj-document-extraction-desk-1", {
  "title": "Define the fields before extracting values",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "validate_schema(schema)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'labels',label:'Labels assigned to two fields',type:'text',value:'Seats,Attendees'}],calculate(v){const labels=v.labels.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);const unique=new Set(labels);const valid=labels.length===unique.size&&labels.length>0;return {summary:valid?'Every normalized label has one destination.':'Reject: repeated or empty labels create an ambiguous schema.',metrics:[{label:'Labels',value:labels.length},{label:'Distinct labels',value:unique.size}],columns:['Label','Occurrences'],rows:[...unique].map(label=>[label,labels.filter(x=>x===label).length])};}}
});

window.AIFSProjectFigures.register("pj-document-extraction-desk-2", {
  "title": "Extract candidates without losing their evidence",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "extract_candidates(text, schema)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'source',label:'Source text',type:'text',value:'Seats: 18; revised Seats: 24'},{key:'quote',label:'Proposed quote',type:'text',value:'24'}],calculate(v){const text=Array.from(v.source),quote=Array.from(v.quote);const matches=[];if(quote.length)for(let i=0;i<=text.length-quote.length;i++)if(quote.every((c,j)=>c===text[i+j]))matches.push(i);return {summary:matches.length===1?'One exact character span supports this quote.':matches.length?'More than one span: keep the ambiguity visible.':'No exact span: reject the fabricated or missing quote.',metrics:[{label:'Matches',value:matches.length}],columns:['Start','End','Quote'],rows:matches.map(start=>[start,start+quote.length,v.quote])};}}
});

window.AIFSProjectFigures.register("pj-document-extraction-desk-3", {
  "title": "Bind approval to one document version",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "typed_value(quote, kind); review_document(text, schema, candidates, decisions=None)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'quote',label:'Integer proposal',type:'text',value:'18'},{key:'approved',label:'Reviewer selected this span',type:'checkbox',value:false},{key:'changed',label:'Source changed after approval',type:'checkbox',value:false}],calculate(v){const valid=/^[+-]?\d+$/.test(v.quote);const state=!valid?'invalid':v.changed&&v.approved?'stale approval':v.approved?'approved':'proposed';return {summary:state==='approved'?'A valid source-bound value can be exported.':'Keep the value out of approved output until the failed boundary is resolved.',metrics:[{label:'State',value:state},{label:'Exported value',value:state==='approved'?Number(v.quote):'none'}],columns:['Boundary','Result'],rows:[['Integer',valid?'valid':'invalid'],['Source version',v.changed?'changed':'same'],['Decision',v.approved?'selected':'pending']]};}}
});

window.AIFSProjectFigures.register("pj-document-extraction-desk-4", {
  "title": "Show evidence and export reviewed values",
  "steps": [
    {
      "label": "Observe input",
      "detail": "Inspect the supplied values and name the contract."
    },
    {
      "label": "Compute state",
      "detail": "render_review(report)"
    },
    {
      "label": "Check the result",
      "detail": "Change one input below, predict the outcome and explain the computed difference."
    }
  ],
  "caption": "An original worked mechanism. Inputs update the calculation immediately; the project tests verify the actual implementation."
,
"lab":{controls:[{key:'required',label:'Required fields',type:'range',value:3,min:1,max:6,step:1},{key:'approved',label:'Approved required fields',type:'range',value:2,min:0,max:6,step:1}],calculate(v){const accepted=Math.min(v.approved,v.required),missing=v.required-accepted;return {summary:missing?'The review remains incomplete; optional fields cannot compensate.':'All required fields have source-bound decisions.',metrics:[{label:'Status',value:missing?'needs_review':'approved'},{label:'Remaining',value:missing}],bars:[{label:'Required fields',value:v.required},{label:'Approved required fields',value:accepted}]};}}
});
